import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// GET /api/lecturer/analytics
export async function GET(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    // Step 1: Get distinct units assigned to this lecturer via timetable
    const timetableUnits = await prisma.timetable.findMany({
      where: { lecturerId },
      select: { unitId: true },
      distinct: ["unitId"],
    });
    const unitIds = timetableUnits.map((t) => t.unitId);

    if (unitIds.length === 0) {
      return NextResponse.json([], { headers: corsHeaders });
    }

    // Step 2: Fetch unit details
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, code: true, title: true },
    });
    const unitMap = new Map(units.map((u) => [u.id, u]));

    // Step 3: Count enrolled students per unit
    const enrollmentCounts = await prisma.enrollment.groupBy({
      by: ["unitId"],
      where: { unitId: { in: unitIds } },
      _count: { studentId: true },
    });
    const enrolledMap = new Map(
      enrollmentCounts.map((e) => [e.unitId, e._count.studentId])
    );

    // Step 4: Get session counts and total attendances per unitCode
    // Online sessions: OnlineAttendanceSession + OnlineAttendanceRecord
    // Offline sessions: ConductedSession + OfflineAttendanceRecord
    const unitCodes = units.map((u) => u.code);

    const [onlineSessions, offlineSessions, offlineRecords] = await Promise.all([
      prisma.onlineAttendanceSession.findMany({
        where: { lecturerId, unitCode: { in: unitCodes } },
        select: { unitCode: true, _count: { select: { records: true } } },
      }),
      prisma.conductedSession.findMany({
        where: { lecturerId, unitCode: { in: unitCodes } },
        select: { unitCode: true },
      }),
      prisma.offlineAttendanceRecord.findMany({
        where: { unitCode: { in: unitCodes } },
        select: { unitCode: true },
      }),
    ]);

    // Aggregate per unitCode
    const sessionStats = new Map<
      string,
      { conductedSessions: number; totalAttendances: number }
    >();

    for (const s of onlineSessions) {
      const existing = sessionStats.get(s.unitCode) ?? { conductedSessions: 0, totalAttendances: 0 };
      existing.conductedSessions += 1;
      existing.totalAttendances += s._count.records;
      sessionStats.set(s.unitCode, existing);
    }
    for (const s of offlineSessions) {
      const existing = sessionStats.get(s.unitCode) ?? { conductedSessions: 0, totalAttendances: 0 };
      existing.conductedSessions += 1;
      sessionStats.set(s.unitCode, existing);
    }
    for (const r of offlineRecords) {
      const existing = sessionStats.get(r.unitCode) ?? { conductedSessions: 0, totalAttendances: 0 };
      existing.totalAttendances += 1;
      sessionStats.set(r.unitCode, existing);
    }

    // Step 5: Build the response
    const result = units
      .map((unit) => {
        const enrolled = enrolledMap.get(unit.id) ?? 0;
        const stats = sessionStats.get(unit.code) ?? {
          conductedSessions: 0,
          totalAttendances: 0,
        };
        const { conductedSessions, totalAttendances } = stats;

        const attendancePercent =
          enrolled > 0 && conductedSessions > 0
            ? Math.round(
                (totalAttendances / (enrolled * conductedSessions)) * 100
              )
            : 0;

        const avgAttended =
          conductedSessions > 0
            ? Math.round(totalAttendances / conductedSessions)
            : 0;

        return {
          unitCode: unit.code,
          unitName: unit.title,
          enrolledStudents: enrolled,
          conductedSessions,
          attendancePercent: Math.min(attendancePercent, 100),
          avgAttended,
        };
      })
      .sort((a, b) => a.unitCode.localeCompare(b.unitCode));

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("Lecturer analytics error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
