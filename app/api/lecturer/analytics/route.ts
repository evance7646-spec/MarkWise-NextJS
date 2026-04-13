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
import { Prisma } from "@prisma/client";
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
    // Helper: strip all non-alphanumeric chars for normalization-tolerant comparisons.
    const normalizeCode = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

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
    // Normalised code list for $queryRaw IN() clauses.
    // normalizeCode strips all non-alphanumeric chars so "SCH 2170" → "SCH2170"
    // regardless of how the unit code was stored in each table.
    const normCodes = units.map((u) => normalizeCode(u.code));

    const [onlineSessions, offlineSessions, delegationSessions] =
      await Promise.all([
        // Online sessions (ended only)
        prisma.onlineAttendanceSession.findMany({
          where: { lecturerId, unitCode: { in: unitCodes }, endedAt: { not: null } },
          select: { unitCode: true, _count: { select: { records: true } } },
        }),

        // Offline sessions — normalization-tolerant $queryRaw so that manual-mark
        // sessions (stored with spaces) and BLE sessions (stored without) are both found.
        prisma.$queryRaw<{ normCode: string; sessionStart: Date }[]>(Prisma.sql`
          SELECT UPPER(REPLACE("unitCode", ' ', '')) AS "normCode",
                 "sessionStart"
          FROM   "ConductedSession"
          WHERE  "lecturerId" = ${lecturerId}
            AND  UPPER(REPLACE("unitCode", ' ', '')) IN (${Prisma.join(normCodes)})
        `),

        // Delegation sessions (used, created by this lecturer)
        prisma.delegation.findMany({
          where: { createdBy: lecturerId, unitCode: { in: unitCodes }, used: true },
          select: { unitCode: true, validFrom: true },
        }),
      ]);

    // Offline attendance records — normalization-tolerant JOIN on ConductedSession
    // scoped to this lecturer so marks from other lecturers sharing the unit are excluded.
    // No method filter — count ALL attendance methods (qr, qr_scan, ble, manual_lecturer, etc.)
    const offlineRecords = await prisma.$queryRaw<
      { normCode: string; sessionStart: Date }[]
    >(Prisma.sql`
      SELECT UPPER(REPLACE(oar."unitCode", ' ', '')) AS "normCode",
             oar."sessionStart"
      FROM   "OfflineAttendanceRecord" oar
      INNER JOIN "ConductedSession" cs
        ON  UPPER(REPLACE(cs."unitCode",  ' ', '')) = UPPER(REPLACE(oar."unitCode", ' ', ''))
        AND cs."sessionStart" = oar."sessionStart"
        AND cs."lecturerId"   = ${lecturerId}
      WHERE  UPPER(REPLACE(oar."unitCode", ' ', '')) IN (${Prisma.join(normCodes)})
    `);

    // ── 5. Aggregate per normCode ──────────────────────────────────────────────
    const FIVE_MIN_MS = 5 * 60 * 1000;

    // Build map of normCode → array of offline session start times (ms)
    // Used to dedup delegation sessions that share the same lecture window.
    const offlineSessionTimes = new Map<string, number[]>();
    for (const s of offlineSessions) {
      const times = offlineSessionTimes.get(s.normCode) ?? [];
      times.push(s.sessionStart.getTime());
      offlineSessionTimes.set(s.normCode, times);
    }

    type UnitStats = { conductedSessions: number; totalAttendances: number };
    const sessionStats = new Map<string, UnitStats>();
    const stat = (code: string): UnitStats => {
      const key = normalizeCode(code);
      if (!sessionStats.has(key)) {
        sessionStats.set(key, { conductedSessions: 0, totalAttendances: 0 });
      }
      return sessionStats.get(key)!;
    };

    for (const s of onlineSessions) {
      const st = stat(s.unitCode);
      st.conductedSessions += 1;
      st.totalAttendances += s._count.records;
    }
    for (const s of offlineSessions) {
      // offlineSessions comes from $queryRaw — normCode already normalised
      stat(s.normCode).conductedSessions += 1;
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
      // offlineRecords comes from $queryRaw — normCode + sessionStart already normalised.
      // The query already scoped records to this lecturer's sessions via the INNER JOIN,
      // so every row here is for a valid session. No extra validOfflineKeys check needed.
      stat(r.normCode).totalAttendances += 1;
    }

    // ── 6. Build response ──────────────────────────────────────────────────────
    const result = units
      .map((unit) => {
        const enrolledStudents = enrolledMap.get(unit.id) ?? 0;
        const { conductedSessions, totalAttendances } =
          sessionStats.get(normalizeCode(unit.code)) ?? { conductedSessions: 0, totalAttendances: 0 };

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
          totalPresent: totalAttendances,
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
