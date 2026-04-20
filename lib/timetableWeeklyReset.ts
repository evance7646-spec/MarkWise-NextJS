/**
 * Weekly timetable status reset.
 *
 * Every Saturday at 23:59 server time, any timetable entry whose status is
 * 'Cancelled', 'Rescheduled', 'Online', or 'Confirmed' and whose change is NOT permanent
 * is reset back to 'Pending' and all time/venue fields are restored to their original
 * admin-set state.  If the venue was cleared for an Online entry, it is restored from
 * originalVenue. The day, startTime, and endTime are restored from their original values.
 *
 * Permanent reschedules (reschedulePermanent = true) are NOT reset, as they persist
 * for the entire semester.
 *
 * After the DB update, a `timetable:reset` SSE event is broadcast to every
 * connected student so their timetable syncs immediately.
 */
import cron from "node-cron";
import { prisma } from "./prisma";
import { broadcastToAllSubscribed } from "./timetableSseStore";
import { bumpTimetableVersion } from "./timetableSyncStore";

export async function resetWeeklyStatuses(): Promise<void> {
  console.log("[timetable-reset] Running weekly status reset …");
  try {
    // Collect affected entries first (need unit codes + courseIds for post-processing)
    // Exclude entries where reschedulePermanent is true (semester-wide changes)
    const affected = await prisma.timetable.findMany({
      where: {
        status: { in: ["Cancelled", "Rescheduled", "Online", "Confirmed"] },
        OR: [
          { reschedulePermanent: false },
          { reschedulePermanent: null },
        ],
      },
      select: {
        id: true,
        courseId: true,
        originalVenue: true,
        originalDay: true,
        originalStartTime: true,
        originalEndTime: true,
        unit: { select: { code: true } },
      },
    });

    if (affected.length === 0) {
      console.log("[timetable-reset] No entries to reset.");
      return;
    }

    // Single atomic SQL update:
    //  - status → 'Pending' (restore to original admin-set state)
    //  - day restored from originalDay
    //  - startTime restored from originalStartTime
    //  - endTime restored from originalEndTime
    //  - venueName restored from originalVenue when present
    //  - originalDay/StartTime/EndTime/Venue cleared
    //  - rescheduledRoomId cleared (back to original room)
    //  - rescheduleSubStatus, rescheduledTo, reason cleared
    //  - updatedBy / updatedAt refreshed
    await prisma.$executeRaw`
      UPDATE "Timetable"
      SET
        status                = 'Pending',
        day                   = COALESCE("originalDay", day),
        "startTime"           = COALESCE("originalStartTime", "startTime"),
        "endTime"             = COALESCE("originalEndTime", "endTime"),
        "venueName"           = COALESCE("originalVenue", "venueName"),
        "originalDay"         = NULL,
        "originalStartTime"   = NULL,
        "originalEndTime"     = NULL,
        "originalVenue"       = NULL,
        "rescheduledRoomId"   = NULL,
        "rescheduleSubStatus" = NULL,
        "rescheduledTo"       = NULL,
        "reason"              = NULL,
        "updatedBy"           = 'system',
        "updatedAt"           = NOW()
      WHERE
        status IN ('Cancelled', 'Rescheduled', 'Online', 'Confirmed')
        AND ("reschedulePermanent" IS NULL OR "reschedulePermanent" = false)
    `;

    console.log(`[timetable-reset] Reset ${affected.length} entries to original admin-set state.`);

    // Bump timetable version for each affected course so polling clients detect the change
    const courseIds = [...new Set(affected.map((e) => e.courseId))];
    await Promise.all(
      courseIds.map((cId) =>
        bumpTimetableVersion(cId).catch((err) =>
          console.error("[timetable-reset] version bump failed for course", cId, err),
        ),
      ),
    );

    // Broadcast SSE event to all connected student streams
    broadcastToAllSubscribed({
      event: "timetable:reset",
      message: "Weekly reset applied - timetables restored to original schedule",
    });

    console.log("[timetable-reset] Done.");
  } catch (err) {
    console.error("[timetable-reset] Error during weekly reset:", err);
  }
}

/** Register the weekly cron.  Call once from instrumentation.ts on server start. */
export function startWeeklyResetCron(): void {
  // Every Saturday at 23:59:00 server local time
  cron.schedule("59 23 * * 6", () => {
    resetWeeklyStatuses().catch((err) =>
      console.error("[timetable-reset] Unhandled cron error:", err),
    );
  });
  console.log("[timetable-reset] Weekly reset cron registered (59 23 * * 6 - Saturday 23:59).");
}
