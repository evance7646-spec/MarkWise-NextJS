/**
 * GET /api/lecturer/units/:unitCode/attendance
 *
 * Returns per-student attendance breakdown for every student enrolled in the
 * given unit so the Analytics screen can display attended / conducted fractions.
 *
 * Auth:  Bearer lecturer JWT
 * 401   token missing or invalid
 * 403   lecturer not timetable-assigned to this unit
 * 404   unit does not exist
 *
 * Response 200 — array sorted by percentage descending:
 * [{ studentId, name, admissionNumber, attended, conducted, percentage }]
 *
 * "attended"  = offline + online records for this student in this unit
 * "conducted" = ConductedSession rows (offline/GD) + ended OnlineAttendanceSessions
 *               attributed to this lecturer for this unit (same formula as /analytics)
 * "percentage" = ROUND((attended / conducted) × 100, 1); 0 when conducted = 0
 *
 * Students with zero attendance are still included so the lecturer sees the
 * full enrollment roster.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

export const runtime = "nodejs";

const PRESENT_METHODS = ["qr", "ble", "manual", "manual_lecturer", "proxy_leader", "GD"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitCode: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Normalize unit code ───────────────────────────────────────────────────
  const { unitCode: rawParam } = await params;
  const unitCode = decodeURIComponent(rawParam).replace(/\s+/g, "").toUpperCase();
  if (!unitCode) {
    return NextResponse.json(
      { error: "Unit not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  try {
    // ── Resolve unit (case-insensitive, space-tolerant) ───────────────────────
    // Fetch both id (for Timetable check) and raw code (for OnlineAttendanceSession query).
    const unitRows = await prisma.$queryRaw<
      { id: string; code: string; departmentId: string }[]
    >`
      SELECT id, code, "departmentId"
      FROM "Unit"
      WHERE UPPER(REPLACE(code, ' ', '')) = ${unitCode}
      LIMIT 1
    `;
    if (unitRows.length === 0) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404, headers: corsHeaders },
      );
    }
    const unit = unitRows[0];

    // ── Authorization: lecturer must be timetable-assigned to this unit ───────
    const timetableEntry = await prisma.timetable.findFirst({
      where: { lecturerId, unitId: unit.id },
      select: { id: true },
    });
    if (!timetableEntry) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: corsHeaders },
      );
    }

    // ── Resolve institutionId for enrollment query ─────────────────────────
    const lecturer = await prisma.lecturer.findUnique({
      where: { id: lecturerId },
      select: { institutionId: true },
    });
    if (!lecturer?.institutionId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }
    const institutionId = lecturer.institutionId;

    // ── Parallel data fetch ───────────────────────────────────────────────────
    // OnlineAttendanceSession stores unitCode as the raw Unit.code value, so use
    // unit.code (raw) for online queries. OfflineAttendanceRecord stores the
    // normalised code (no spaces, uppercase), so use the local `unitCode` var.
    const rawUnitCode = unit.code;

    const [
      enrolledStudents,
      onlineSessionIds,
      offlineAttendanceGroups,
      conductedOnlineCount,
      offlineSessionStarts,
      delegationSessions,
    ] = await Promise.all([
      // All students enrolled in this unit (including those with 0 attendance)
      prisma.$queryRaw<
        { studentId: string; studentName: string; admissionNumber: string }[]
      >`
        SELECT
          s.id              AS "studentId",
          s.name            AS "studentName",
          s."admissionNumber"
        FROM "StudentEnrollmentSnapshot" es
        JOIN "Student" s ON s.id = es."studentId"
        WHERE s."institutionId" = ${institutionId}
          AND EXISTS (
            SELECT 1
            FROM unnest(es."unitCodes") AS uc
            WHERE UPPER(REPLACE(uc, ' ', '')) = ${unitCode}
          )
        ORDER BY s.name ASC
      `,

      // IDs of ended online sessions for this unit (needed to count online marks)
      prisma.onlineAttendanceSession.findMany({
        where: { lecturerId, unitCode: rawUnitCode, endedAt: { not: null } },
        select: { id: true },
      }),

      // Offline present marks grouped by student
      prisma.offlineAttendanceRecord.groupBy({
        by: ["studentId"],
        where: { unitCode, method: { in: PRESENT_METHODS } },
        _count: { id: true },
      }),

      // Conducted online session count
      prisma.onlineAttendanceSession.count({
        where: { lecturerId, unitCode: rawUnitCode, endedAt: { not: null } },
      }),

      // Conducted offline sessions — fetch with sessionStart for delegation dedup
      prisma.conductedSession.findMany({
        where: { lecturerId, unitCode },
        select: { sessionStart: true },
      }),

      // Delegation sessions (used, created by this lecturer, raw unitCode)
      prisma.delegation.findMany({
        where: { createdBy: lecturerId, unitCode: rawUnitCode, used: true },
        select: { validFrom: true },
      }),
    ]);

    // Compute unified conducted count across all three sources.
    // Delegation sessions within ±5 min of an offline session represent the
    // same real lecture and must not be double-counted.
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const offlineTimes = offlineSessionStarts.map((s) => s.sessionStart.getTime());
    const standaloneDelCount = delegationSessions.filter((d) => {
      const delegMs = Number(d.validFrom);
      return !offlineTimes.some((t) => Math.abs(t - delegMs) <= FIVE_MIN_MS);
    }).length;
    const conducted =
      conductedOnlineCount + offlineSessionStarts.length + standaloneDelCount;

    // ── Online marks grouped by student ──────────────────────────────────────
    const sessionIds = onlineSessionIds.map((s) => s.id);
    const onlineAttendanceGroups =
      sessionIds.length > 0
        ? await prisma.onlineAttendanceRecord.groupBy({
            by: ["studentId"],
            where: { sessionId: { in: sessionIds } },
            _count: { id: true },
          })
        : [];

    // ── Merge offline + online attended counts per student ────────────────────
    const attendedMap = new Map<string, number>();
    for (const row of offlineAttendanceGroups) {
      attendedMap.set(row.studentId, (attendedMap.get(row.studentId) ?? 0) + row._count.id);
    }
    for (const row of onlineAttendanceGroups) {
      attendedMap.set(row.studentId, (attendedMap.get(row.studentId) ?? 0) + row._count.id);
    }

    // ── Build response — sorted by percentage descending ─────────────────────
    const result = enrolledStudents
      .map((s) => {
        const attended = attendedMap.get(s.studentId) ?? 0;
        // Round to 1 decimal place: ROUND(attended/conducted*100, 1)
        const percentage =
          conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 0;
        return {
          studentId: s.studentId,
          name: s.studentName,
          admissionNumber: s.admissionNumber,
          attended,
          conducted,
          percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[lecturer/units/attendance] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
