/**
 * POST /api/timetable/[id]/merge
 *
 * Merges a second department's lesson into an existing timetable entry.
 *
 * The "merge" concept:
 *   Two (or more) departments teach the SAME unit in the SAME room at the SAME
 *   time. Each department still needs its own Timetable row so that their
 *   students see the entry in their timetable. A shared `mergeGroupId` UUID
 *   links the rows together and lets the UI show them as one combined lesson.
 *
 * Body:
 *   {
 *     departmentId: string    – the joining department
 *     courseId:     string    – course in the joining department
 *     lecturerId?:  string    – lecturer for the joining dept (defaults to same)
 *     yearOfStudy?: string
 *     semester?:    string
 *   }
 *
 * Response:
 *   { success: true, entry: <new timetable row>, mergeGroupId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminAuthToken } from "@/lib/adminAuthJwt";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { createTimetableBookings } from "@/lib/timetableBookingSync";
import { randomUUID } from "crypto";
import { normalizeUnitCode } from "@/lib/unitCode";
import { buildPayloadsForStudents, sendPushNotificationBatch } from "@/lib/pushNotification";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────
  let token = req.cookies.get("admin_auth_token")?.value;
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7).trim();
  }
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401, headers: corsHeaders },
    );
  }
  const adminPayload = verifyAdminAuthToken(token);
  if (!adminPayload) {
    try { verifyLecturerAccessToken(token); }
    catch {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 401, headers: corsHeaders },
      );
    }
  }

  const { id: sourceId } = await context.params;
  const body = await req.json();
  const { departmentId, courseId, lecturerId: bodyLecturerId, yearOfStudy, semester } = body ?? {};

  if (!departmentId || !courseId) {
    return NextResponse.json(
      { error: "departmentId and courseId are required." },
      { status: 400, headers: corsHeaders },
    );
  }

  // ── Fetch the source entry ────────────────────────────────────────────────
  const source = await prisma.timetable.findUnique({
    where: { id: sourceId },
    include: { unit: true, department: true, room: { select: { roomCode: true, name: true } } },
  });
  if (!source) {
    return NextResponse.json(
      { error: "Source timetable entry not found." },
      { status: 404, headers: corsHeaders },
    );
  }

  // Guard: same department would just create a duplicate
  if (source.departmentId === departmentId) {
    return NextResponse.json(
      { error: "This department is already the owner of the source entry." },
      { status: 409, headers: corsHeaders },
    );
  }

  // Guard: active merge entry for this dept already exists in the same group
  const sourceGroupId = (source as any).mergeGroupId as string | null;
  if (sourceGroupId) {
    const alreadyMerged = await prisma.timetable.findFirst({
      where: {
        mergeGroupId: sourceGroupId,
        departmentId,
        status: { notIn: ["Cancelled"] },
      } as any,
    });
    if (alreadyMerged) {
      return NextResponse.json(
        { error: "This department has already been merged into this lesson group.", mergeGroupId: sourceGroupId },
        { status: 409, headers: corsHeaders },
      );
    }
  }

  // ── Resolve / create the mergeGroupId ────────────────────────────────────
  const mergeGroupId = sourceGroupId ?? randomUUID();

  // Ensure course belongs to the joining department
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json(
      { error: "courseId does not exist." },
      { status: 400, headers: corsHeaders },
    );
  }
  if (course.departmentId !== departmentId) {
    return NextResponse.json(
      { error: "courseId does not belong to the given departmentId." },
      { status: 400, headers: corsHeaders },
    );
  }

  // Lecturer defaults to same as source entry
  const effectiveLecturerId = bodyLecturerId ?? source.lecturerId;

  // ── Stamp mergeGroupId on the source entry if it didn't have one ──────────
  if (!sourceGroupId) {
    await (prisma.timetable.update as any)({
      where: { id: sourceId },
      data: { mergeGroupId },
    });
  }

  // ── Create the new entry for the joining department ───────────────────────  type MergedEntry = typeof source & {
    mergeGroupId: string;
    unit: { code?: string; title?: string } | null;
    course: { id: string; name: string } | null;
    room: { name: string; roomCode: string } | null;
    department: { name: string } | null;
    lecturer: { fullName: string } | null;
  };
  const newEntry = await (prisma.timetable.create as any)({
    data: {
      courseId,
      unitId: source.unitId,
      lecturerId: effectiveLecturerId,
      roomId: source.roomId,
      day: source.day,
      startTime: source.startTime,
      endTime: source.endTime,
      venueName: source.venueName,
      yearOfStudy: yearOfStudy ?? source.yearOfStudy,
      semester: semester ?? source.semester,
      status: source.status,
      departmentId,
      mergeGroupId,
      originalDay: source.day,
      originalStartTime: source.startTime,
      originalEndTime: source.endTime,
    },
    include: { unit: true, course: true, room: true, department: true, lecturer: true },
  }) as MergedEntry;

  // ── Create/update MergedSession so the mobile app can see this merge ──────
  // Fetch all entries in this merge group (including source + the one we just created).
  const allGroupEntries = await prisma.timetable.findMany({
    where: { mergeGroupId } as any,
    include: { unit: { select: { code: true } } },
  });

  const mergedUnitCodes = [
    ...new Set(
      allGroupEntries
        .map(e => (e as any).unit?.code ? normalizeUnitCode((e as any).unit.code) : null)
        .filter((c): c is string => !!c),
    ),
  ];

  const roomCode = (source.room as any)?.roomCode ?? (source.room as any)?.name ?? source.venueName ?? "";

  // Check if any entry in the group already has a MergedSession
  const existingSessionEntry = allGroupEntries.find((e: any) => !!e.mergedSessionId);
  let mergedSessionId: string;

  if (existingSessionEntry) {
    // Reuse and update the existing MergedSession
    mergedSessionId = (existingSessionEntry as any).mergedSessionId as string;
    await prisma.mergedSession.update({
      where: { id: mergedSessionId },
      data: { mergedUnitCodes },
    });
  } else {
    // Create a new MergedSession for this admin-initiated merge
    const dept = await prisma.department.findUnique({
      where: { id: source.departmentId },
      select: { institutionId: true },
    });
    const session = await prisma.mergedSession.create({
      data: {
        mergedBy:        "Admin",
        mergedByUserId:  adminPayload?.id ?? null,
        unitCode:        mergedUnitCodes[0] ?? null,
        mergedUnitCodes,
        mergedRoom:      roomCode,
        mergedDay:       source.day,
        mergedStartTime: source.startTime,
        mergedEndTime:   source.endTime,
        institutionId:   dept?.institutionId ?? null,
      },
    });
    mergedSessionId = session.id;
  }

  // Stamp isMerged + mergedSessionId on ALL entries in the group
  await prisma.timetable.updateMany({
    where: { mergeGroupId } as any,
    data: { isMerged: true, mergedSessionId },
  });

  // ── Bump TimetableVersion for the joining dept's course ──────────────────
  const now = new Date();
  const existingVersion = await prisma.timetableVersion.findFirst({ where: { courseId } });
  if (existingVersion) {
    await prisma.timetableVersion.update({
      where: { id: existingVersion.id },
      data: { version: { increment: 1 }, updatedAt: now },
    });
  } else {
    await prisma.timetableVersion.create({
      data: { courseId, version: 1, updatedAt: now },
    });
  }

  // ── Create room bookings for the new entry (fire-and-don't-fail) ──────────
  createTimetableBookings({
    id: newEntry.id,
    roomId: newEntry.roomId,
    lecturerId: newEntry.lecturerId,
    unitId: newEntry.unitId,
    unitCode: newEntry.unit?.code ? normalizeUnitCode(newEntry.unit.code) : null,
    day: newEntry.day,
    startTime: newEntry.startTime,
    endTime: newEntry.endTime,
  }).catch(err => console.error("[timetable/merge] booking creation failed:", err));

  const response = NextResponse.json(
    {
      success: true,
      mergeGroupId,
      mergedSessionId,
      entry: {
        id: newEntry.id,
        courseId: newEntry.courseId,
        unitId: newEntry.unitId,
        unitCode: newEntry.unit?.code ? normalizeUnitCode(newEntry.unit.code) : undefined,
        unitTitle: newEntry.unit?.title,
        roomId: newEntry.roomId,
        roomName: newEntry.room?.name,
        day: newEntry.day,
        startTime: newEntry.startTime,
        endTime: newEntry.endTime,
        departmentId: newEntry.departmentId,
        departmentName: newEntry.department?.name,
        lecturerName: newEntry.lecturer?.fullName,
        mergeGroupId,
        mergedSessionId,
        isMerged: true,
        mergedBy: "Admin",
        mergedUnitCodes,
        status: newEntry.status,
      },
    },
    { status: 201, headers: corsHeaders },
  );

  // ── Fire-and-forget: notify enrolled students ─────────────────────────────
  // Both departments' students (source + joining) should be notified.
  Promise.resolve().then(async () => {
    try {
      const mergedUnitIds = [source.unitId, newEntry.unitId].filter(
        (id): id is string => !!id,
      );
      const uniqueUnitIds = [...new Set(mergedUnitIds)];
      if (uniqueUnitIds.length === 0) return;

      const unitRows = await prisma.unit.findMany({
        where: { id: { in: uniqueUnitIds } },
        select: { id: true, code: true, title: true },
      });
      const canonicalUnit = unitRows[0];
      if (!canonicalUnit) return;

      const enrollments = await prisma.enrollment.findMany({
        where: { unitId: { in: uniqueUnitIds } },
        select: { studentId: true },
      });
      const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
      if (studentIds.length === 0) return;

      const mergedUnitCodes = unitRows.map((u) => normalizeUnitCode(u.code)).join(",");
      const newUnitCode = normalizeUnitCode(canonicalUnit.code);
      const newUnitName = canonicalUnit.title ?? newUnitCode;

      const payloads = await buildPayloadsForStudents(studentIds, {
        title: "Unit Update",
        body: `Your units have been merged into ${newUnitName} (${newUnitCode}). Please refresh your timetable.`,
        data: {
          type: "unit_merged",
          mergedUnits: mergedUnitCodes,
          newUnitCode,
          newUnitName,
        },
      });
      await sendPushNotificationBatch(payloads);
    } catch (notifyErr) {
      console.error("[timetable/[id]/merge] FCM notification failed:", notifyErr);
    }
  });

  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
