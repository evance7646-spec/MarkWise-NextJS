/**
 * GET /api/lecturer/analytics
 *
 * Returns per-unit attendance analytics for the authenticated lecturer.
 *
 * Session sources counted as "conducted":
 *  1. OnlineAttendanceSession  — online QR sessions (lecturerId scoped)
 *  2. ConductedSession         — offline BLE / manual PIN sessions (lecturerId scoped)
 *  3. Delegation               — GD group leader sessions (createdBy = lecturerId, used = true)
 *
 * Present marks counted from:
 *  • OnlineAttendanceRecord  — every record in a session this lecturer ran
 *  • OfflineAttendanceRecord — records with method in the valid present set
 *    ('qr' | 'ble' | 'manual' | 'manual_lecturer' | 'proxy_leader' | 'GD')
 *    for unitCodes assigned to this lecturer
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

// Methods that indicate a student was present; excludes any 'absent'/'excused' concept.
const PRESENT_METHODS = ["qr", "ble", "manual", "manual_lecturer", "proxy_leader", "GD"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    // ── 1. Distinct units assigned to this lecturer ──────────────────────────
    const timetableUnits = await prisma.timetable.findMany({
      where: { lecturerId },
      select: { unitId: true },
      distinct: ["unitId"],
    });
    const unitIds = timetableUnits.map((t) => t.unitId);

    if (unitIds.length === 0) {
      return NextResponse.json([], { headers: corsHeaders });
    }

    // ── 2. Unit details ───────────────────────────────────────────────────────
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, code: true, title: true },
    });
    const unitCodes = units.map((u) => u.code);

    // ── 3. Enrolled students per unit ─────────────────────────────────────────
    const enrollmentCounts = await prisma.enrollment.groupBy({
      by: ["unitId"],
      where: { unitId: { in: unitIds } },
      _count: { studentId: true },
    });
    const enrolledMap = new Map(
      enrollmentCounts.map((e) => [e.unitId, e._count.studentId]),
    );

    // ── 4. Session counts + attendance totals ─────────────────────────────────
    // Three session sources:
    //  • OnlineAttendanceSession — online QR sessions explicitly ended
    //  • ConductedSession        — offline BLE/manual sessions (from sync)
    //  • Delegation              — GD group leader sessions (used = true, createdBy = lecturerId)
    //    Delegation sessions that overlap a ConductedSession within ±5 min are deduped.
    //    Delegation attendance marks (method='GD') are already in OfflineAttendanceRecord.
    const [onlineSessions, offlineSessions, delegationSessions, offlineRecords] =
      await Promise.all([
        // Online sessions (ended only)
        prisma.onlineAttendanceSession.findMany({
          where: { lecturerId, unitCode: { in: unitCodes }, endedAt: { not: null } },
          select: { unitCode: true, _count: { select: { records: true } } },
        }),

        // Offline sessions — fetch with sessionStart for deduplication
        prisma.conductedSession.findMany({
          where: { lecturerId, unitCode: { in: unitCodes } },
          select: { unitCode: true, sessionStart: true },
        }),

        // Delegation sessions (used, created by this lecturer)
        prisma.delegation.findMany({
          where: { createdBy: lecturerId, unitCode: { in: unitCodes }, used: true },
          select: { unitCode: true, validFrom: true },
        }),

        // Present marks across all offline submission paths;
        // also select sessionStart so we can scope to THIS lecturer's sessions below.
        prisma.offlineAttendanceRecord.findMany({
          where: {
            unitCode: { in: unitCodes },
            method: { in: PRESENT_METHODS },
          },
          select: { unitCode: true, sessionStart: true },
        }),
      ]);

    // ── 5. Aggregate per unitCode ──────────────────────────────────────────────
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Build map of normalized unitCode → array of offline session start times (ms)
    // Used to dedup delegation sessions AND to scope offline attendance marks.
    const offlineSessionTimes = new Map<string, number[]>();
    for (const s of offlineSessions) {
      const key = normalizeCode(s.unitCode);
      const times = offlineSessionTimes.get(key) ?? [];
      times.push(s.sessionStart.getTime());
      offlineSessionTimes.set(key, times);
    }

    // Pre-build a Set of "${normCode}_${sessionStartMs}" for fast membership check.
    // Only attendance records whose session start matches one of THIS lecturer's
    // conducted sessions are counted — prevents inflation from other lecturers sharing the unit.
    const validOfflineKeys = new Set<string>();
    for (const s of offlineSessions) {
      validOfflineKeys.add(`${normalizeCode(s.unitCode)}_${s.sessionStart.getTime()}`);
    }

    type UnitStats = { conductedSessions: number; totalAttendances: number };
    const sessionStats = new Map<string, UnitStats>();
    const stat = (code: string): UnitStats => {
      if (!sessionStats.has(code)) {
        sessionStats.set(code, { conductedSessions: 0, totalAttendances: 0 });
      }
      return sessionStats.get(code)!;
    };

    for (const s of onlineSessions) {
      const st = stat(s.unitCode);
      st.conductedSessions += 1;
      st.totalAttendances += s._count.records;
    }
    for (const s of offlineSessions) {
      stat(s.unitCode).conductedSessions += 1;
    }
    // Add delegation sessions not already covered by a ConductedSession (±5 min window)
    for (const d of delegationSessions) {
      const key = normalizeCode(d.unitCode);
      const offlineTimes = offlineSessionTimes.get(key) ?? [];
      const delegMs = Number(d.validFrom);
      const overlaps = offlineTimes.some((t) => Math.abs(t - delegMs) <= FIVE_MIN_MS);
      if (!overlaps) {
        stat(d.unitCode).conductedSessions += 1;
      }
    }
    for (const r of offlineRecords) {
      // Only count this mark if it belongs to a session this lecturer conducted
      const key = `${normalizeCode(r.unitCode)}_${r.sessionStart.getTime()}`;
      if (validOfflineKeys.has(key)) {
        stat(r.unitCode).totalAttendances += 1;
      }
    }

    // ── 6. Build response ──────────────────────────────────────────────────────
    const result = units
      .map((unit) => {
        const enrolledStudents = enrolledMap.get(unit.id) ?? 0;
        const { conductedSessions, totalAttendances } =
          sessionStats.get(unit.code) ?? { conductedSessions: 0, totalAttendances: 0 };

        const avgAttended =
          conductedSessions > 0
            ? Math.round(totalAttendances / conductedSessions)
            : 0;

        const attendancePercent =
          enrolledStudents > 0 && conductedSessions > 0
            ? Math.min(
                Math.round(
                  (totalAttendances / (enrolledStudents * conductedSessions)) * 100,
                ),
                100,
              )
            : 0;

        return {
          unitCode: normalizeUnitCode(unit.code),
          unitName: unit.title,
          enrolledStudents,
          conductedSessions,
          avgAttended,
          attendancePercent,
        };
      })
      .sort((a, b) => a.unitCode.localeCompare(b.unitCode));

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[lecturer/analytics] error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
