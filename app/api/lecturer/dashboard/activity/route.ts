/**
 * GET /api/lecturer/dashboard/activity
 *
 * Returns a summary activity feed for the authenticated lecturer's dashboard.
 * Includes recent assignments, upcoming timetable entries, and submission stats.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const DAY_ORDER: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let lecturerId: string;
  try {
    const p = verifyLecturerAccessToken(token);
    lecturerId = p.lecturerId;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
  }

  const [assignments, timetableEntries, recentSubmissions] = await Promise.all([
    // 5 most recently created assignments
    prisma.assignment.findMany({
      where: { lecturerId },
      include: {
        submissions: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // All timetable entries for this lecturer
    prisma.timetable.findMany({
      where: { lecturerId },
      include: { unit: { select: { code: true, title: true } }, room: { select: { name: true, roomCode: true } } },
      orderBy: { startTime: "asc" },
    }),

    // 10 most recent submissions across lecturer's assignments
    prisma.submission.findMany({
      where: { assignment: { lecturerId } },
      include: {
        assignment: { select: { title: true, unitId: true } },
        student: { select: { name: true, admissionNumber: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);

  // Resolve unit info for assignments (no direct relation on Assignment model)
  const assignmentUnitIds = [...new Set(assignments.map((a) => a.unitId))];
  const submissionUnitIds = [...new Set(recentSubmissions.map((s) => s.assignment?.unitId).filter(Boolean) as string[])];
  const allUnitIds = [...new Set([...assignmentUnitIds, ...submissionUnitIds])];
  const units = await prisma.unit.findMany({
    where: { id: { in: allUnitIds } },
    select: { id: true, code: true, title: true },
  });
  const unitMap = new Map(units.map((u) => [u.id, u]));

  // Sort timetable by day then startTime
  const sortedTimetable = timetableEntries.sort((a, b) => {
    const da = DAY_ORDER[a.day.toLowerCase()] ?? 99;
    const db = DAY_ORDER[b.day.toLowerCase()] ?? 99;
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });

  return NextResponse.json(
    {
      recentAssignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        unitCode: unitMap.get(a.unitId)?.code ?? "",
        unitTitle: unitMap.get(a.unitId)?.title ?? "",
        status: a.status,
        dueDate: a.dueDate.toISOString(),
        submissionCount: (a as any).submissions?.length ?? 0,
        createdAt: a.createdAt.toISOString(),
      })),

      upcomingClasses: sortedTimetable.map((e) => ({
        id: e.id,
        unitCode: (e as any).unit?.code ?? "",
        unitTitle: (e as any).unit?.title ?? "",
        day: e.day,
        startTime: e.startTime,
        endTime: e.endTime,
        time: `${e.startTime} - ${e.endTime}`,
        room: (e as any).room?.name ?? e.venueName ?? "",
        roomCode: (e as any).room?.roomCode ?? "",
        status: e.status ?? "Pending",
      })),

      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        assignmentTitle: s.assignment?.title ?? "",
        unitCode: unitMap.get(s.assignment?.unitId ?? "")?.code ?? "",
        studentName: (s as any).student?.name ?? "",
        admissionNumber: (s as any).student?.admissionNumber ?? "",
        status: s.status,
        grade: s.grade ?? null,
        submittedAt: s.submittedAt.toISOString(),
      })),

      stats: {
        totalAssignments: await prisma.assignment.count({ where: { lecturerId } }),
        activeAssignments: await prisma.assignment.count({ where: { lecturerId, status: "active" } }),
        totalClasses: timetableEntries.length,
      },
    },
    { headers: corsHeaders },
  );
}
