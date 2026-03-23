/**
 * PATCH /api/timetable/entries/:entryId/status
 *
 * Mobile-app–facing endpoint for updating a timetable entry's status.
 * Receives `rescheduledTo` as an object { day, startTime, endTime } (not a string).
 * After a successful update, broadcasts a timetable.updated SSE event to all
 * students subscribed to that unit via GET /api/student/timetable/events.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { resolveAdminOrLecturerScope } from "@/lib/adminLecturerAuth";
import { broadcastTimetableEvent } from "@/lib/timetableSseStore";
import { bumpTimetableVersion } from "@/lib/timetableSyncStore";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const VALID_STATUSES = ["Pending", "Confirmed", "Cancelled", "Rescheduled", "Online"] as const;
type TimetableStatus = (typeof VALID_STATUSES)[number];

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entryId: string }> },
) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let lecturerId: string | null = null;
  let isAdmin = false;
  try {
    const p = verifyLecturerAccessToken(token);
    lecturerId = p.lecturerId;
  } catch {
    const scope = resolveAdminOrLecturerScope(request);
    if (scope.ok) {
      isAdmin = true;
    } else {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401, headers: corsHeaders },
      );
    }
  }

  const { entryId } = await context.params;

  let body: {
    status: TimetableStatus;
    reason?: string;
    pendingReason?: string;
    rescheduledTo?: { day: string; startTime: string; endTime: string };
    reschedulePermanent?: boolean;
    clearVenue?: boolean;
    lessonType?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const { status, reason, pendingReason, rescheduledTo, reschedulePermanent, clearVenue, lessonType } = body;

  const VALID_LESSON_TYPES = ["LEC","GD","RAT","CAT","LAB","SEM","WRK","TUT"];
  if (lessonType != null && !VALID_LESSON_TYPES.includes(lessonType)) {
    return NextResponse.json(
      { error: `lessonType must be one of: ${VALID_LESSON_TYPES.join(", ")}` },
      { status: 400, headers: corsHeaders },
    );
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400, headers: corsHeaders },
    );
  }

  // Per-status validation
  if (status === "Cancelled" && !reason?.trim()) {
    return NextResponse.json(
      { error: "reason is required when status is Cancelled" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (status === "Rescheduled") {
    if (!rescheduledTo?.day || !rescheduledTo?.startTime || !rescheduledTo?.endTime) {
      return NextResponse.json(
        { error: "rescheduledTo { day, startTime, endTime } is required when status is Rescheduled" },
        { status: 400, headers: corsHeaders },
      );
    }
  }

  const existing = await prisma.timetable.findUnique({
    where: { id: entryId },
    include: { unit: { select: { code: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Timetable entry not found" }, { status: 404, headers: corsHeaders });
  }

  // Lecturers can only update their own entries
  if (lecturerId && !isAdmin && existing.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
  }

  // Build update payload
  let updateData: Record<string, unknown> = {
    status,
    updatedBy: lecturerId ?? "admin",
    ...(lessonType != null ? { lessonType } : {}),
  };

  if (status === "Pending") {
    const venueRestore: Record<string, unknown> = {};
    if ((existing as any).originalVenue) {
      venueRestore.venueName = (existing as any).originalVenue;
      venueRestore.originalVenue = null;
    }
    updateData = {
      ...updateData,
      reason: null,
      rescheduledTo: null,
      reschedulePermanent: null,
      pendingReason: pendingReason ?? null,
      ...venueRestore,
    };
  } else if (status === "Confirmed") {
    const venueRestore: Record<string, unknown> = {};
    if ((existing as any).originalVenue) {
      venueRestore.venueName = (existing as any).originalVenue;
      venueRestore.originalVenue = null;
    }
    updateData = {
      ...updateData,
      reason: null,
      rescheduledTo: null,
      reschedulePermanent: null,
      ...venueRestore,
    };
  } else if (status === "Online") {
    if (clearVenue) {
      updateData.originalVenue = (existing as any).originalVenue ?? (existing as any).venueName ?? "";
      updateData.venueName = null;
    }
  } else if (status === "Cancelled") {
    updateData = { ...updateData, reason: reason!.trim() };
  } else if (status === "Rescheduled") {
    const { day, startTime, endTime } = rescheduledTo!;
    // Store as the canonical string form so existing consumers still work
    const rescheduledToStr = `${day} ${startTime} - ${endTime}`;
    updateData = {
      ...updateData,
      rescheduledTo: rescheduledToStr,
      reschedulePermanent: reschedulePermanent ?? false,
      day,
      startTime,
      endTime,
      // Snapshot originals if not already stored
      originalDay: existing.originalDay ?? existing.day,
      originalStartTime: existing.originalStartTime ?? existing.startTime,
      originalEndTime: existing.originalEndTime ?? existing.endTime,
    };
  }

  const updated = await prisma.timetable.update({
    where: { id: entryId },
    data: updateData,
    include: { unit: true, course: true, room: true, lecturer: true, department: true },
  });

  // Bump version so student clients detect the status change
  bumpTimetableVersion(updated.courseId).catch((err) =>
    console.error("[PATCH status] version bump failed:", err)
  );

  const unitCode = updated.unit?.code ?? "";

  // Broadcast SSE event to subscribed students
  if (unitCode) {
    broadcastTimetableEvent(unitCode, {
      event: "timetable.updated",
      entryId: updated.id,
      unitCode,
      day: updated.day,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      reason: updated.reason ?? null,
      rescheduledTo: parseStoredRescheduledTo(updated.rescheduledTo),
      reschedulePermanent: updated.reschedulePermanent ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  // Fan-out in-app notifications (fire-and-forget)
  if (unitCode) {
    let notifTitle = "";
    let notifMessage = "";
    if (status === "Cancelled") {
      notifTitle = `${unitCode} lecture cancelled`;
      notifMessage = `Your ${unitCode} lecture on ${updated.day} has been cancelled. Reason: ${reason}`;
    } else if (status === "Rescheduled") {
      const perm = reschedulePermanent ? "permanent" : "this week only";
      notifTitle = `${unitCode} lecture rescheduled`;
      notifMessage = `Your ${unitCode} lecture has been rescheduled to ${rescheduledTo!.day} ${rescheduledTo!.startTime}–${rescheduledTo!.endTime} (${perm}).`;
    } else if (status === "Confirmed") {
      notifTitle = `${unitCode} lecture confirmed`;
      notifMessage = `Your ${unitCode} lecture on ${updated.day} is confirmed.`;
    }
    if (notifTitle) {
      prisma.enrollment
        .findMany({ where: { unitId: updated.unitId }, select: { studentId: true } })
        .then((enrollments) => {
          if (!enrollments.length) return;
          return prisma.notification.createMany({
            data: enrollments.map((e) => ({
              userId: e.studentId,
              userType: "student" as const,
              title: notifTitle,
              message: notifMessage,
              read: false,
            })),
          });
        })
        .catch((err) => console.error("[PATCH status] notification fan-out error:", err));
    }
  }

  return NextResponse.json(formatEntry(updated), { headers: corsHeaders });
}

function parseStoredRescheduledTo(
  raw: string | null,
): { day: string; startTime: string; endTime: string } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\w+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/i);
  if (!m) return null;
  return { day: m[1], startTime: m[2], endTime: m[3] };
}

function formatEntry(e: any) {
  return {
    id: e.id,
    unitId: e.unitId,
    unitCode: e.unit?.code ?? "",
    unitTitle: e.unit?.title ?? "",
    unit: `${e.unit?.title ?? ""} (${e.unit?.code ?? ""})`,
    day: e.day,
    startTime: e.startTime,
    endTime: e.endTime,
    time: `${e.startTime} - ${e.endTime}`,
    room: e.venueName === null ? null : (e.room?.name ?? e.venueName ?? ""),
    roomCode: e.venueName === null ? null : (e.room?.roomCode ?? ""),
    venue: e.venueName ?? null,
    lectureRoom: e.venueName === null ? null : (e.room?.name ?? e.venueName ?? ""),
    originalVenue: (e as any).originalVenue ?? null,
    lecturer: e.lecturer?.fullName ?? "",
    lecturerId: e.lecturerId,
    status: e.status ?? "Pending",
    reason: e.reason ?? null,
    pendingReason: e.pendingReason ?? null,
    rescheduledTo: parseStoredRescheduledTo(e.rescheduledTo),
    reschedulePermanent: e.reschedulePermanent ?? null,
    originalDay: e.originalDay ?? null,
    originalStartTime: e.originalStartTime ?? null,
    originalEndTime: e.originalEndTime ?? null,
    updatedBy: e.updatedBy ?? null,
    updatedAt: e.updatedAt?.toISOString() ?? null,
    yearOfStudy: e.yearOfStudy ?? "",
    semester: e.semester ?? "",
    departmentId: e.departmentId,
    courseId: e.courseId,
  };
}
