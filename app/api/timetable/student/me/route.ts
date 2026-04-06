import { NextResponse } from "next/server";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";
import { prisma } from "@/lib/prisma";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DAY_ORDER: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

export async function GET(request: Request) {
  try {
    const token = (request.headers.get("authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header." },
        { status: 401, headers: corsHeaders },
      );
    }

    let studentId: string;
    try {
      const payload = verifyStudentAccessToken(token);
      studentId = payload.studentId;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 401, headers: corsHeaders },
      );
    }

    // Find all units the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId },
      select: { unitId: true },
    });
    const unitIds = enrollments.map((e) => e.unitId);

    if (unitIds.length === 0) {
      return NextResponse.json([], { headers: corsHeaders });
    }

    const entries = await prisma.timetable.findMany({
      where: { unitId: { in: unitIds } },
      select: {
        id: true,
        unitId: true,
        courseId: true,
        day: true,
        startTime: true,
        endTime: true,
        venueName: true,
        lessonType: true,
        lecturerId: true,
        status: true,
        reason: true,
        pendingReason: true,
        rescheduledTo: true,
        reschedulePermanent: true,
        originalDay: true,
        originalStartTime: true,
        originalEndTime: true,
        updatedBy: true,
        updatedAt: true,
        yearOfStudy: true,
        semester: true,
        departmentId: true,
        roomId: true,
        unit: { select: { code: true, title: true } },
        course: { select: { name: true } },
        room: { select: { name: true, roomCode: true } },
        lecturer: { select: { fullName: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: [
        { day: 'asc' },
        { startTime: 'asc' },
      ],
    });

    const result = entries
      .sort((a, b) => {
        const dayDelta =
          (DAY_ORDER[a.day.toLowerCase()] ?? 99) -
          (DAY_ORDER[b.day.toLowerCase()] ?? 99);
        if (dayDelta !== 0) return dayDelta;
        return a.startTime.localeCompare(b.startTime);
      })
      .map((e) => {
        const code = normalizeUnitCode(e.unit?.code ?? "");
        return ({
        id: e.id,
        unitId: e.unitId,
        unitCode: code,
        unitTitle: e.unit?.title ?? "",
        unit: `${e.unit?.title ?? ""} (${code})`,
        courseId: e.courseId,
        courseName: e.course?.name ?? "",
        day: e.day,
        startTime: e.startTime,
        endTime: e.endTime,
        time: `${e.startTime} - ${e.endTime}`,
        venue: e.venueName ?? "",
        venueName: e.venueName ?? "",
        roomCode: e.room?.roomCode ?? "",
        roomName: e.room?.name ?? "",
        type: e.lessonType ?? "LEC",
        lessonType: e.lessonType ?? "LEC",
        lecturerId: e.lecturerId,
        lecturerName: e.lecturer?.fullName ?? "",
        lecturer: e.lecturer?.fullName ?? "",
        // Status fields
        status: e.status ?? "Pending",
        reason: e.reason ?? null,
        pendingReason: e.pendingReason ?? null,
        rescheduledTo: e.rescheduledTo ?? null,
        reschedulePermanent: e.reschedulePermanent ?? null,
        originalDay: e.originalDay ?? null,
        originalStartTime: e.originalStartTime ?? null,
        originalEndTime: e.originalEndTime ?? null,
        updatedBy: e.updatedBy ?? null,
        updatedAt: e.updatedAt?.toISOString() ?? null,
        // Metadata
        yearOfStudy: e.yearOfStudy ?? "",
        semester: e.semester ?? "",
        departmentId: e.departmentId,
        department: e.department ? { id: e.department.id, name: e.department.name } : null,
      });});

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error("[timetable/student/me] GET error:", err);
    return NextResponse.json(
      { error: "Failed to load student timetable." },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
