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
    // Two session sources:
    //  • OnlineAttendanceSession — online QR sessions explicitly ended
    //  • ConductedSession        — offline BLE/manual (from sync) AND GD delegation
    //                              sessions (upserted by /end on delegation close)
    const [onlineSessions, offlineSessions, offlineRecords] =
      await Promise.all([
        // Online sessions (ended only) — includes records relation count (= present marks).
        prisma.onlineAttendanceSession.findMany({
          where: { lecturerId, unitCode: { in: unitCodes }, endedAt: { not: null } },
          select: { unitCode: true, _count: { select: { records: true } } },
        }),

        // Offline / delegation sessions — ConductedSession is the unified table.
        // The /end route upserts a row here on every successful delegation close.
        prisma.conductedSession.findMany({
          where: { lecturerId, unitCode: { in: unitCodes } },
          select: { unitCode: true },
        }),

        // Present marks across all offline submission paths
        prisma.offlineAttendanceRecord.findMany({
          where: {
            unitCode: { in: unitCodes },
            method: { in: PRESENT_METHODS },
          },
          select: { unitCode: true },
        }),
      ]);

    // ── 5. Aggregate per unitCode ──────────────────────────────────────────────
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
    for (const r of offlineRecords) {
      stat(r.unitCode).totalAttendances += 1;
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
