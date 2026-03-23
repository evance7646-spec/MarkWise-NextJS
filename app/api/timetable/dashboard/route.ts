import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json(
      { error: 'departmentId is required' },
      { status: 400, headers: corsHeaders }
    );
  }
  try {
    const start = Date.now();
    // Redis removed
    // Get department to find institutionId
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { institutionId: true }
    });
    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    // Fetch timetable entries, rooms, courses, and lecturers in parallel
    const [timetableEntries, rooms, courses] = await Promise.all([
      prisma.timetable.findMany({
        where: { departmentId },
        select: {
          id: true,
          courseId: true,
          unitId: true,
          roomId: true,
          lecturerId: true,
          day: true,
          startTime: true,
          endTime: true,
          venueName: true,
          yearOfStudy: true,
          semester: true,
          status: true,
          departmentId: true,
          course: { select: { name: true } },
          unit: { select: { code: true, title: true } },
          room: { select: { name: true } },
          lecturer: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.room.findMany({
        where: { institutionId: department.institutionId },
        select: {
          id: true,
          name: true,
          buildingCode: true,
          roomCode: true,
          capacity: true,
        },
      }),
      prisma.course.findMany({
        where: { departmentId },
        select: {
          id: true,
          name: true,
          code: true,
          program: { select: { id: true } }
        }
      })
    ]);

    // Batch yearBlock counts: single groupBy instead of N queries
    const programIds = courses
      .map(c => c.program?.id)
      .filter((id): id is string => !!id);
    const yearBlockCounts = programIds.length > 0
      ? await prisma.yearBlock.groupBy({
          by: ['programId'],
          where: { programId: { in: programIds } },
          _count: { _all: true },
        })
      : [];
    const yearCountMap = new Map(
      yearBlockCounts.map(yb => [yb.programId, yb._count._all])
    );
    const coursesWithDuration = courses.map(course => ({
      id: course.id,
      name: course.name,
      code: course.code,
      durationYears: course.program ? (yearCountMap.get(course.program.id) ?? 0) : 0,
    }));

    // Deduplicate lecturers from timetable entries (no LecturerDepartment model needed)
    const lecturerMap = new Map<string, { id: string; fullName: string; email: string; phoneNumber: string | null }>();
    for (const entry of timetableEntries) {
      if (entry.lecturer && !lecturerMap.has(entry.lecturer.id)) {
        lecturerMap.set(entry.lecturer.id, entry.lecturer);
      }
    }
    const lecturers = Array.from(lecturerMap.values());
    // Format timetable entries (existing logic)
    const timetable = timetableEntries.map(item => ({
      id: item.id,
      courseId: item.courseId,
      courseName: item.course?.name,
      yearOfStudy: item.yearOfStudy,
      semester: item.semester,
      unitId: item.unitId,
      unitCode: item.unit?.code,
      unitTitle: item.unit?.title,
      roomId: item.roomId,
      roomName: item.room?.name,
      venueName: item.venueName,
      lecturerId: item.lecturerId,
      lecturerName: item.lecturer?.fullName,
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      department: item.department ? {
        id: item.department.id,
        name: item.department.name
      } : null,
    }));
    const responseData = {
      timetable,
      courses: coursesWithDuration,
      lecturers,
      rooms,
    };
    return NextResponse.json(responseData, {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Timetable API] Error:', error.message);
      console.error('[Timetable API] Stack:', error.stack);
      if ((error as any).cause) {
        console.error('[Timetable API] Cause:', (error as any).cause);
      }
    } else {
      console.error('[Timetable API] Unknown error:', error);
    }
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Failed to fetch dashboard data: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      : 'Failed to fetch dashboard data';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}