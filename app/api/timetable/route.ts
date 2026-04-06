import { NextRequest, NextResponse } from "next/server";
import { prisma } from '../../../lib/prisma';
import { verifyAdminAuthToken } from '../../../lib/adminAuthJwt';
import { verifyLecturerAccessToken } from '../../../lib/lecturerAuthJwt';
import { createTimetableBookings } from '@/lib/timetableBookingSync';
import { resolveAdminScope } from '@/lib/adminScope';
import { bumpTimetableVersion } from '@/lib/timetableSyncStore';
import { normalizeUnitCode } from '@/lib/unitCode';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type TimetableBody = {
  courseId: string;
  departmentId: string;
  unitId: string;
  lecturerId: string;
  roomId: string;
  day: string;
  startTime: string;
  endTime: string;
  venueName: string;
  yearOfStudy?: string;
  semester?: string;
  status?: string;
  unitCode?: string;
};

// GET /api/timetable?departmentId=xxx  OR  ?institutionId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get('departmentId');
  const institutionId = searchParams.get('institutionId');

  if (!departmentId && !institutionId) {
    return NextResponse.json({ error: 'departmentId or institutionId is required' }, { status: 400, headers: corsHeaders });
  }

  // Verify the caller is authenticated
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status, headers: corsHeaders });
  }

  // Institution-wide path: institution-level admins only
  if (institutionId && !departmentId) {
    if (!scope.isInstitutionAdmin || scope.institutionId !== institutionId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403, headers: corsHeaders });
    }
    try {
      const entries = await prisma.timetable.findMany({
        where: { department: { institutionId } },
        select: {
          id: true, courseId: true, unitId: true, roomId: true, lecturerId: true,
          day: true, startTime: true, endTime: true, venueName: true,
          yearOfStudy: true, semester: true, status: true, createdAt: true, updatedAt: true, departmentId: true,
          course: { select: { name: true } },
          unit: { select: { code: true, title: true } },
          lecturer: { select: { fullName: true } },
          room: { select: { name: true, roomCode: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'asc' },
      });
      const result = entries.map(item => ({
        id: item.id, courseId: item.courseId, courseName: item.course?.name,
        yearOfStudy: item.yearOfStudy, semester: item.semester, semesterLabel: item.semester,
        unitId: item.unitId, unitCode: item.unit?.code ? normalizeUnitCode(item.unit.code) : undefined, unitTitle: item.unit?.title,
        roomId: item.roomId, roomName: item.room?.name, roomCode: item.room?.roomCode ?? '',
        venueName: item.venueName, lecturerId: item.lecturerId, lecturerName: item.lecturer?.fullName,
        day: item.day, startTime: item.startTime, endTime: item.endTime, status: item.status,
        createdAt: item.createdAt, updatedAt: item.updatedAt,
        departmentId: item.departmentId,
        department: item.department ? { id: item.department.id, name: item.department.name } : null,
      }));
      return NextResponse.json(result, { headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=30, stale-while-revalidate=300' } });
    } catch (error) {
      console.error('Failed to fetch timetable entries:', error);
      return NextResponse.json({ error: 'Failed to fetch timetable entries' }, { status: 500, headers: corsHeaders });
    }
  }

  // Department admins may only read their own department's timetable
  if (!scope.isInstitutionAdmin && scope.departmentId && scope.departmentId !== departmentId) {
    return NextResponse.json({ error: 'Access denied to this department.' }, { status: 403, headers: corsHeaders });
  }

  // Type-narrow departmentId: at this point institutionId-only path already returned above,
  // so departmentId must be a non-null string here.
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId is required' }, { status: 400, headers: corsHeaders });
  }

  try {
    const entries = await prisma.timetable.findMany({
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
        createdAt: true,
        updatedAt: true,
        departmentId: true,
        course: { select: { name: true } },
        unit: { select: { code: true, title: true } },
        lecturer: { select: { fullName: true } },
        room: { select: { name: true, roomCode: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Map to API response shape
    const result = entries.map(item => ({
      id: item.id,
      courseId: item.courseId,
      courseName: item.course?.name,
      yearOfStudy: item.yearOfStudy,
      semester: item.semester,
      semesterLabel: item.semester, // Add this if your frontend expects it
      unitId: item.unitId,
      unitCode: item.unit?.code ? normalizeUnitCode(item.unit.code) : undefined,
      unitTitle: item.unit?.title,
      roomId: item.roomId,
      roomName: item.room?.name,
      roomCode: item.room?.roomCode ?? '',
      venueName: item.venueName,
      lecturerId: item.lecturerId,
      lecturerName: item.lecturer?.fullName,
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      department: item.department ? { id: item.department.id, name: item.department.name } : null,
    }));

    return NextResponse.json(result, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Failed to fetch timetable entries:', error);
    return NextResponse.json({ error: 'Failed to fetch timetable entries' }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/timetable
export async function POST(req: NextRequest) {
  // Auth: require admin_auth_token cookie or Bearer token (admin or lecturer)
  let token = req.cookies.get('admin_auth_token')?.value;
  let adminId: string | null = null;
  let lecturerIdFromToken: string | null = null;
  
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }
  }
  
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated. Please log in.' }, { status: 401, headers: corsHeaders });
  }
  
  // Try admin token
  const adminPayload = verifyAdminAuthToken(token);
  if (adminPayload && adminPayload.adminId) {
    adminId = adminPayload.adminId;
  } else {
    // Try lecturer token
    try {
      const lecturerPayload = verifyLecturerAccessToken(token);
      lecturerIdFromToken = lecturerPayload.lecturerId;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: corsHeaders });
    }
  }
  
  const data = await req.json();
  const { 
    courseId, 
    departmentId, 
    unitId, 
    lecturerId: bodyLecturerId, 
    roomId, 
    day, 
    startTime, 
    endTime, 
    venueName, 
    yearOfStudy, 
    semester, 
    semesterLabel, // Add this if your frontend sends it
    status,
    unitCode 
  } = data;
  const normalisedUnitCode = unitCode ? normalizeUnitCode(unitCode) : undefined;

  // Only allow admin or lecturer to create entries for themselves
  if (adminId == null && lecturerIdFromToken == null) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers: corsHeaders });
  }

  // If lecturer, ensure lecturerId matches
  if (lecturerIdFromToken && lecturerIdFromToken !== bodyLecturerId) {
    return NextResponse.json({ error: 'Lecturer token does not match lecturerId.' }, { status: 403, headers: corsHeaders });
  }

  // Parallelise independent validation queries
  const [adminRecord, courseExists] = await Promise.all([
    adminId
      ? prisma.admin.findUnique({
          where: { id: adminId },
          select: { departmentId: true, role: true, institutionId: true },
        })
      : null,
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true } }),
  ]);

  if (adminId && adminRecord && adminRecord.role !== 'system_admin') {
    if (adminRecord.departmentId && adminRecord.departmentId !== departmentId) {
      return NextResponse.json(
        { error: 'You can only create timetable entries for your own department.' },
        { status: 403, headers: corsHeaders },
      );
    }
  }

  // Validate required fields
  const missingFields = [];
  if (!courseId) missingFields.push('courseId');
  if (!departmentId) missingFields.push('departmentId');
  if (!unitId) missingFields.push('unitId');
  if (!bodyLecturerId) missingFields.push('lecturerId');
  if (!roomId) missingFields.push('roomId');
  if (!day) missingFields.push('day');
  if (!startTime) missingFields.push('startTime');
  if (!endTime) missingFields.push('endTime');
  if (!venueName) missingFields.push('venueName');

  if (missingFields.length > 0) {
    return NextResponse.json({ 
      error: `Missing required fields: ${missingFields.join(', ')}` 
    }, { status: 400, headers: corsHeaders });
  }

  if (startTime >= endTime) {
    return NextResponse.json({ error: 'endTime must be after startTime' }, { status: 400, headers: corsHeaders });
  }

  if (!courseExists) {
    return NextResponse.json({ error: 'Invalid courseId: Course does not exist.' }, { status: 400, headers: corsHeaders });
  }

  try {
    // Check room + lecturer conflicts in parallel
    const [existingBooking, lecturerConflict] = await Promise.all([
      prisma.timetable.findFirst({
        where: {
          roomId,
          day,
          OR: [
            { startTime: { lte: startTime }, endTime: { gt: startTime } },
            { startTime: { lt: endTime }, endTime: { gte: endTime } },
            { startTime: { gte: startTime }, endTime: { lte: endTime } },
          ],
        },
        select: {
          id: true,
          departmentId: true,
          unit: { select: { code: true } },
          department: { select: { id: true } },
        },
      }),
      prisma.timetable.findFirst({
        where: {
          lecturerId: bodyLecturerId,
          day,
          roomId: { not: roomId },
          status: { notIn: ['Cancelled'] },
          OR: [
            { startTime: { lte: startTime }, endTime: { gt: startTime } },
            { startTime: { lt: endTime }, endTime: { gte: endTime } },
            { startTime: { gte: startTime }, endTime: { lte: endTime } },
          ],
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          unit: { select: { code: true } },
          room: { select: { name: true } },
        },
      }),
    ]);

    if (existingBooking) {
      const existingUnitCode = existingBooking.unit?.code;
      
      // If it's the same unit, suggest merge
      if (existingUnitCode === normalisedUnitCode) {
        return NextResponse.json({
          mergePrompt: true,
          conflictId: existingBooking.id,
          conflictDepartment: existingBooking.department?.id || null,
          message: 'This room is already booked for the same unit at this time. Would you like to merge the schedules?'
        }, { status: 409, headers: corsHeaders });
      }
      
      // Different unit - hard room conflict
      return NextResponse.json({
        mergePrompt: false,
        conflictId: existingBooking.id,
        conflictDepartment: existingBooking.department?.id || null,
        message: `Room is already booked for ${existingUnitCode ?? 'a different unit'} at this time.`
      }, { status: 409, headers: corsHeaders });
    }

    if (lecturerConflict) {
      return NextResponse.json({
        error: `Lecturer is already assigned to ${lecturerConflict.unit?.code ?? 'another class'} in ${lecturerConflict.room?.name ?? 'another room'} at this time (${lecturerConflict.startTime}–${lecturerConflict.endTime}).`,
        lecturerConflict: true,
        conflictId: lecturerConflict.id,
      }, { status: 409, headers: corsHeaders });
    }

    const entry = await prisma.timetable.create({
      data: {
        courseId,
        unitId,
        lecturerId: bodyLecturerId,
        roomId,
        day,
        startTime,
        endTime,
        venueName,
        yearOfStudy: yearOfStudy || null,
        semester: semester || semesterLabel || null,
        status: 'Pending',
        // Snapshot originals so they can be restored after a temporary reschedule
        originalDay: day,
        originalStartTime: startTime,
        originalEndTime: endTime,
        departmentId,
      },
    });

    // Bump version so student clients detect the new entry
    bumpTimetableVersion(courseId).catch((err) =>
      console.error('[timetable/POST] version bump failed:', err)
    );

    // Create recurring room bookings for the next 16 weeks (fire-and-don't-fail)
    createTimetableBookings({
      id: entry.id,
      roomId: entry.roomId,
      lecturerId: entry.lecturerId,
      unitId: entry.unitId,
      unitCode: normalisedUnitCode ?? null,
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }).catch((err) =>
      console.error('[timetable/POST] booking sync failed:', err)
    );

    return NextResponse.json(entry, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Failed to create timetable entry:', error);
    return NextResponse.json({ error: 'Failed to create timetable entry' }, { status: 500, headers: corsHeaders });
  }
}





export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export const runtime = "nodejs";