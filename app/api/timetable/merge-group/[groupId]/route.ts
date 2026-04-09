/**
 * GET /api/timetable/merge-group/[groupId]
 *
 * Returns all timetable entries that share the given mergeGroupId, including
 * their department, course, room, unit and lecturer details.
 * Used by the dept-admin timetable page to show a joint-class detail panel.
 *
 * Auth: admin_auth_token cookie or Bearer token.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

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
  context: { params: Promise<{ groupId: string }> },
) {
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status, headers: corsHeaders });
  }

  const { groupId } = await context.params;
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required." }, { status: 400, headers: corsHeaders });
  }

  const entries = await prisma.timetable.findMany({
    where: {
      mergeGroupId: groupId,
      status: { notIn: ["Cancelled"] },
    },
    include: {
      unit:       { select: { code: true, title: true } },
      course:     { select: { name: true, code: true } },
      department: { select: { id: true, name: true } },
      lecturer:   { select: { id: true, fullName: true } },
      room:       { select: { name: true, roomCode: true, capacity: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) {
    return NextResponse.json({ error: "Merge group not found." }, { status: 404, headers: corsHeaders });
  }

  // Derive combined student count.
  // Enrollment only has (studentId, unitId) — to scope per-entry we count
  // students enrolled in the unit who also belong to that entry's course
  // (via Student.courseId).
  const unitId = entries[0].unitId;
  const courseIds = [...new Set(entries.map((e) => e.courseId))];

  // One query: all students enrolled in this unit, pull their courseId
  const enrolledStudents = await prisma.enrollment.findMany({
    where: { unitId },
    select: { studentId: true, student: { select: { courseId: true } } },
  });

  // Build per-course count map
  const countByCourse: Record<string, number> = {};
  let totalStudents = 0;
  for (const row of enrolledStudents) {
    const cId = row.student?.courseId ?? "";
    if (courseIds.includes(cId)) {
      countByCourse[cId] = (countByCourse[cId] ?? 0) + 1;
      totalStudents++;
    }
  }

  const result = entries.map((e) => ({
    id:             e.id,
    departmentId:   e.departmentId,
    departmentName: e.department?.name ?? "",
    courseName:     e.course?.name ?? "",
    courseCode:     e.course?.code ?? "",
    unitCode:       normalizeUnitCode(e.unit?.code ?? ""),
    unitTitle:      e.unit?.title ?? "",
    lecturerName:   e.lecturer?.fullName ?? "",
    roomName:       e.room?.name ?? e.venueName ?? "",
    roomCode:       e.room?.roomCode ?? "",
    roomCapacity:   e.room?.capacity ?? null,
    day:            e.day,
    startTime:      e.startTime,
    endTime:        e.endTime,
    yearOfStudy:    e.yearOfStudy,
    semester:       e.semester,
    status:         e.status,
    studentCount:   countByCourse[e.courseId] ?? 0,
  }));

  return NextResponse.json(
    { mergeGroupId: groupId, totalStudents, entries: result },
    { headers: corsHeaders },
  );
}
