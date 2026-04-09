import { NextResponse, type NextRequest } from 'next/server';
import { verifyLecturerAccessToken } from '@/lib/lecturerAuthJwt';
import { prisma } from '@/lib/prisma';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// GET /api/lecturer/timetable
// Auth: Bearer <lecturer_token>
// Returns all timetable entries assigned to the authenticated lecturer.
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  let lecturerId: string;
  try {
    const payload = verifyLecturerAccessToken(token);
    lecturerId = payload.lecturerId;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders });
  }

  try {
    const entries = await prisma.timetable.findMany({
      where: { lecturerId },
      include: {
        unit: true,
        room: true,
        course: true,
        department: true,
        mergedSession: {
          select: {
            id: true,
            mergedRoom: true,
            mergedDay: true,
            mergedStartTime: true,
            mergedEndTime: true,
            mergedNote: true,
          },
        },
      },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });

    const result = entries.map(entry => ({
      // Identity
      id: entry.id,

      // Unit fields
      unitId:    entry.unit?.bleId ?? null,
      unitCode:  entry.unit?.code  ?? '',
      unitName:  entry.unit?.title ?? '',
      unitTitle: entry.unit?.title ?? '',

      // Course / programme
      courseId:   entry.courseId,
      courseName: entry.course?.name ?? '',
      courseCode: entry.course?.code ?? '',

      // Department
      departmentId:  entry.departmentId,
      department:    entry.department
        ? { id: entry.department.id, name: entry.department.name }
        : null,

      // Scheduling
      day:       entry.day,
      startAt:   entry.startTime,
      endAt:     entry.endTime,
      startTime: entry.startTime,
      endTime:   entry.endTime,

      // Venue
      roomId:       entry.room?.bleId ?? null,
      room:         entry.room?.name ?? entry.venueName ?? '',
      venue:        entry.venueName ?? entry.room?.name ?? '',
      venueName:    entry.venueName ?? entry.room?.name ?? '',
      roomName:     entry.room?.name ?? '',
      roomCode:     entry.room?.roomCode ?? '',
      buildingCode: entry.room?.buildingCode ?? '',

      // Status management
      status:              entry.status ?? 'Pending',
      reason:              entry.reason ?? null,
      pendingReason:       entry.pendingReason ?? null,
      rescheduledTo:       entry.rescheduledTo ?? null,
      reschedulePermanent: entry.reschedulePermanent ?? null,
      originalDay:         entry.originalDay ?? null,
      originalStartTime:   entry.originalStartTime ?? null,
      originalEndTime:     entry.originalEndTime ?? null,
      updatedBy:           entry.updatedBy ?? null,
      updatedAt:           entry.updatedAt?.toISOString() ?? null,

      // Metadata
      yearOfStudy:   entry.yearOfStudy ?? '',
      semester:      entry.semester ?? '',
      semesterLabel: entry.semester ?? '',
      lecturerId:    entry.lecturerId,

      // Merge state (Change 4)
      isMerged:    entry.isMerged ?? false,
      mergedRoom:  entry.mergedSession?.mergedRoom ?? null,
      mergedDay:   entry.mergedSession?.mergedDay ?? null,
      mergedStart: entry.mergedSession?.mergedStartTime ?? null,
      mergedEnd:   entry.mergedSession?.mergedEndTime ?? null,
      mergedNote:  entry.mergedSession?.mergedNote ?? null,
    }));

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error('[lecturer/timetable] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timetable entries' },
      { status: 500, headers: corsHeaders },
    );
  }
}
