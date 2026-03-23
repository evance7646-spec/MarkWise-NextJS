// DELETE /api/timetable/[id]
// PATCH /api/timetable/[id]/merge (handled via PATCH)
import { prisma } from '@/lib/prisma';
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const data = await req.json();
    const { departmentId } = data;

    if (!id || !departmentId) {
      return NextResponse.json({ 
        error: 'timetableId and departmentId are required' 
      }, { status: 400, headers: corsHeaders });
    }

    // Find timetable entry
    const timetable = await prisma.timetable.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!timetable) {
      return NextResponse.json({ error: 'Timetable entry not found' }, { status: 404, headers: corsHeaders });
    }

    // Check if department already included
    if (timetable.department?.id === departmentId) {
      return NextResponse.json({ error: 'Department already merged' }, { status: 409, headers: corsHeaders });
    }

    // Merge department (overwrite)
    const updated = await prisma.timetable.update({
      where: { id },
      data: {
        departmentId: departmentId,
      },
      include: { department: true },
    });

    return NextResponse.json({ 
      success: true, 
      timetable: updated 
    }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Failed to merge department schedule:', error);
    return NextResponse.json({ 
      error: 'Failed to merge department schedule' 
    }, { status: 500, headers: corsHeaders });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { resolveAdminOrLecturerScope } from "@/lib/adminLecturerAuth";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { emitToRoom } from "@/lib/emitSignal";
import { cancelTimetableBookings, createTimetableBookings, createNextOccurrenceBooking } from "@/lib/timetableBookingSync";
import { publishTimetableUpdatedEvent } from "@/lib/timetableEvents";
import { bumpTimetableVersion } from "@/lib/timetableSyncStore";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const VALID_STATUSES = ["Confirmed", "Pending", "Cancelled", "Rescheduled", "Online"] as const;
type TimetableStatus = (typeof VALID_STATUSES)[number];

/** Parse "Wednesday 10:00 - 12:00" or "Wednesday 10:00 - 12:00 · HRD 005" */
function parseRescheduledTo(raw: string): { day: string; startTime: string; endTime: string; roomCode: string | null } | null {
  const m = raw.trim().match(/^(\w+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})(?:\s*·\s*(.+))?$/i);
  if (!m) return null;
  return { day: m[1], startTime: m[2], endTime: m[3], roomCode: m[4]?.trim() ?? null };
}

function formatEntry(e: any) {
  return {
    id: e.id,
    unitId: e.unitId,
    unitCode: e.unit?.code ?? "",
    unitTitle: e.unit?.title ?? "",
    courseId: e.courseId,
    courseName: e.course?.name ?? "",
    day: e.day,
    startTime: e.startTime,
    endTime: e.endTime,
    venue: e.venueName ?? null,
    venueName: e.venueName ?? null,
    roomCode: e.venueName === null ? null : (e.room?.roomCode ?? ""),
    lectureRoom: e.venueName === null ? null : (e.room?.name ?? e.venueName ?? ""),
    originalVenue: e.originalVenue ?? null,
    type: e.lessonType ?? "LEC",
    lessonType: e.lessonType ?? "LEC",
    status: e.status,
    reason: e.reason ?? null,
    pendingReason: e.pendingReason ?? null,
    rescheduledTo: e.rescheduledTo ?? null,
    reschedulePermanent: e.reschedulePermanent ?? null,
    rescheduledVenue: e.rescheduledRoom?.name ?? null,
    originalDay: e.originalDay ?? null,
    originalStartTime: e.originalStartTime ?? null,
    originalEndTime: e.originalEndTime ?? null,
    updatedBy: e.updatedBy ?? null,
    updatedAt: e.updatedAt?.toISOString() ?? null,
    lecturerId: e.lecturerId,
    roomId: e.rescheduledRoomId ?? e.roomId ?? null,
    departmentId: e.departmentId,
    yearOfStudy: e.yearOfStudy ?? "",
    semester: e.semester ?? "",
  };
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // Accept either admin or lecturer token
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    let lecturerId: string | null = null;
    let isAdmin = false;
    try {
      const p = verifyLecturerAccessToken(token);
      lecturerId = p.lecturerId;
    } catch {
      const scope = resolveAdminOrLecturerScope(request);
      if (scope.ok) { isAdmin = true; }
      else return NextResponse.json({ message: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      status,
      reason,
      pendingReason,
      rescheduledTo,
      reschedulePermanent,
      roomId: bodyRoomId,
      clearVenue,
      lessonType: bodyLessonType,
    } = body as {
      status: TimetableStatus;
      reason?: string;
      pendingReason?: string;
      rescheduledTo?: string;
      reschedulePermanent?: boolean;
      roomId?: string;
      clearVenue?: boolean;
      lessonType?: string;
    };

    const VALID_LESSON_TYPES = ["LEC","GD","RAT","CAT","LAB","SEM","WRK","TUT"];
    if (bodyLessonType != null && !VALID_LESSON_TYPES.includes(bodyLessonType)) {
      return NextResponse.json({ message: "Invalid lessonType value." }, { status: 422, headers: corsHeaders });
    }

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ message: "Invalid status value." }, { status: 422, headers: corsHeaders });
    }

    // Fetch existing entry
    const existing = await prisma.timetable.findUnique({
      where: { id },
      include: { unit: true, course: true, room: true },
    });
    if (!existing) {
      return NextResponse.json({ message: "Timetable entry not found." }, { status: 404, headers: corsHeaders });
    }

    // Lecturer can only update their own entries
    if (lecturerId && existing.lecturerId !== lecturerId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403, headers: corsHeaders });
    }

    // Per-status validation and data preparation
    let updateData: Record<string, unknown> = {
      status,
      updatedBy: lecturerId ?? "admin",
      ...(bodyLessonType != null ? { lessonType: bodyLessonType } : {}),
    };

    if (status === "Confirmed") {
      const restore: Record<string, unknown> = { rescheduledRoomId: null };
      if (existing.originalVenue) {
        restore.venueName = existing.originalVenue;
        restore.originalVenue = null;
      }
      if (existing.originalDay) {
        restore.day = existing.originalDay;
        restore.startTime = existing.originalStartTime!;
        restore.endTime = existing.originalEndTime!;
        restore.originalDay = null;
        restore.originalStartTime = null;
        restore.originalEndTime = null;
      }
      updateData = { ...updateData, reason: null, rescheduledTo: null, reschedulePermanent: null, ...restore };
    } else if (status === "Pending") {
      const restore: Record<string, unknown> = { rescheduledRoomId: null };
      if (existing.originalVenue) {
        restore.venueName = existing.originalVenue;
        restore.originalVenue = null;
      }
      if (existing.originalDay) {
        restore.day = existing.originalDay;
        restore.startTime = existing.originalStartTime!;
        restore.endTime = existing.originalEndTime!;
        restore.originalDay = null;
        restore.originalStartTime = null;
        restore.originalEndTime = null;
      }
      updateData = { ...updateData, reason: null, rescheduledTo: null, reschedulePermanent: null, pendingReason: pendingReason ?? null, ...restore };
    } else if (status === "Online") {
      if (clearVenue) {
        updateData.originalVenue = existing.originalVenue ?? existing.venueName ?? "";
        updateData.venueName = null;
      }
    } else if (status === "Cancelled") {
      if (!reason?.trim()) {
        return NextResponse.json({ message: "Cancellation reason is required." }, { status: 422, headers: corsHeaders });
      }
      updateData = { ...updateData, reason: reason.trim() };
    } else if (status === "Rescheduled") {
      if (!rescheduledTo?.trim() || reschedulePermanent === undefined || reschedulePermanent === null) {
        return NextResponse.json(
          { message: "rescheduledTo and reschedulePermanent are required for rescheduling." },
          { status: 422, headers: corsHeaders },
        );
      }
      const parsed = parseRescheduledTo(rescheduledTo.trim());
      if (!parsed) {
        return NextResponse.json(
          { message: "rescheduledTo must be in format 'Wednesday 10:00 - 12:00'." },
          { status: 422, headers: corsHeaders },
        );
      }
      updateData = {
        ...updateData,
        rescheduledTo: rescheduledTo.trim(),
        reschedulePermanent,
        day: parsed.day,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        // Preserve originals if not already set
        originalDay: existing.originalDay ?? existing.day,
        originalStartTime: existing.originalStartTime ?? existing.startTime,
        originalEndTime: existing.originalEndTime ?? existing.endTime,
      };

      // Resolve rescheduled room: explicit bodyRoomId > room code in rescheduledTo string
      let resolvedRescheduledRoomId: string | null = bodyRoomId ?? null;
      if (!resolvedRescheduledRoomId && parsed.roomCode) {
        const room = await prisma.room.findFirst({
          where: { roomCode: { equals: parsed.roomCode, mode: "insensitive" } },
          select: { id: true },
        });
        resolvedRescheduledRoomId = room?.id ?? null;
      }
      if (resolvedRescheduledRoomId) {
        updateData.rescheduledRoomId = resolvedRescheduledRoomId;
      }
    }

    const updated = await prisma.timetable.update({
      where: { id },
      data: updateData,
      include: { unit: true, course: true, room: true, rescheduledRoom: true },
    });

    // ── Sync room bookings based on status change ──────────────────────────
    if (status === "Cancelled") {
      // Cancel all future reserved bookings for this entry
      cancelTimetableBookings(id).catch((err) =>
        console.error("[timetable/PUT] booking cancel failed:", err)
      );
    } else if (status === "Confirmed" || status === "Pending") {
      // Coming back from Rescheduled: cancel the rescheduled room bookings.
      // For Confirmed, also restore bookings for the original room at original times.
      if (existing.status === "Rescheduled" || existing.rescheduledRoomId) {
        cancelTimetableBookings(id)
          .then(() => {
            if (status === "Confirmed") {
              return createTimetableBookings({
                id,
                roomId: existing.roomId,
                lecturerId: updated.lecturerId,
                unitId: updated.unitId,
                unitCode: updated.unit?.code ?? null,
                // updated.day/startTime/endTime already restored to original by updateData
                day: updated.day,
                startTime: updated.startTime,
                endTime: updated.endTime,
              });
            }
          })
          .catch((err) =>
            console.error("[timetable/PUT] booking restore failed:", err)
          );
      }
    } else if (status === "Rescheduled") {
      // Cancel old bookings, then create new ones at the rescheduled room + time
      const effectiveRoomId = updated.rescheduledRoomId ?? updated.roomId;
      cancelTimetableBookings(id)
        .then(() => {
          if (reschedulePermanent) {
            // Permanent: book all future recurring occurrences
            return createTimetableBookings({
              id: updated.id,
              roomId: effectiveRoomId,
              lecturerId: updated.lecturerId,
              unitId: updated.unitId,
              unitCode: updated.unit?.code ?? null,
              day: updated.day,
              startTime: updated.startTime,
              endTime: updated.endTime,
            });
          } else {
            // Temporary: book only the single next occurrence
            return createNextOccurrenceBooking({
              id: updated.id,
              roomId: effectiveRoomId,
              lecturerId: updated.lecturerId,
              unitId: updated.unitId,
              unitCode: updated.unit?.code ?? null,
              day: updated.day,
              startTime: updated.startTime,
              endTime: updated.endTime,
            });
          }
        })
        .catch((err) =>
          console.error("[timetable/PUT] booking reschedule failed:", err)
        );
    }

    // Bump version so student clients detect the change
    bumpTimetableVersion(updated.courseId).catch((err) =>
      console.error("[timetable/PUT] version bump failed:", err)
    );

    // Emit real-time socket event (fire-and-forget)
    const unitCode = updated.unit?.code ?? "";
    if (unitCode) {
      emitToRoom(`unit:${unitCode.trim().toUpperCase()}`, "timetable:status-changed", {
        entryId: updated.id,
        unitCode,
        day: updated.day,
        startTime: updated.startTime,
        endTime: updated.endTime,
        status: updated.status,
        reason: updated.reason ?? null,
        rescheduledTo: updated.rescheduledTo ?? null,
        reschedulePermanent: updated.reschedulePermanent ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    // Fan-out notifications to enrolled students (fire-and-forget)
    let notifTitle = "";
    let notifMessage = "";
    if (status === "Cancelled") {
      notifTitle = `${unitCode} lecture cancelled`;
      notifMessage = `Your ${unitCode} lecture on ${updated.day} has been cancelled. Reason: ${reason}`;
    } else if (status === "Rescheduled") {
      const perm = reschedulePermanent ? "Permanent" : "Temporary";
      notifTitle = `${unitCode} lecture rescheduled`;
      notifMessage = `Your ${unitCode} lecture has been rescheduled to ${rescheduledTo} (${perm}).`;
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
        .catch((err) => console.error("[timetable/PUT] notification error:", err));
    }

    return NextResponse.json(
      { message: "Timetable entry updated successfully.", entry: formatEntry(updated) },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/PUT] error:", err);
    return NextResponse.json({ message: "Failed to update timetable entry." }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = resolveAdminOrLecturerScope(_request);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status, headers: corsHeaders });
    }

    const { id } = await context.params;

    // Find the entry so we have courseId for version management
    const entry = await prisma.timetable.findUnique({
      where: { id },
      select: { id: true, courseId: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "Timetable entry not found." }, { status: 404, headers: corsHeaders });
    }

    // Cancel all future room bookings generated by this entry
    await cancelTimetableBookings(id);

    // Delete the timetable entry from Prisma
    await prisma.timetable.delete({ where: { id } });

    // Bump version so student clients detect the deletion
    const versionRecord = await bumpTimetableVersion(entry.courseId);

    return NextResponse.json(
      { success: true, version: versionRecord.version, updatedAt: versionRecord.updatedAt },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete timetable entry." }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
