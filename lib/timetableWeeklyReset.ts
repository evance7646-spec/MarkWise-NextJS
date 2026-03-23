/**
 * Weekly timetable status reset.
 *
 * Every Saturday at 00:00 server time, any timetable entry whose status is
 * 'Cancelled', 'Rescheduled', or 'Online' and whose change is NOT permanent
 * is reset back to 'Pending'.  If the venue was cleared for an Online entry,
 * it is restored from originalVenue.
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
    const affected = await prisma.timetable.findMany({
      where: {
        status: { in: ["Cancelled", "Rescheduled", "Online"] },
        OR: [
          { reschedulePermanent: false },
          { reschedulePermanent: null },
        ],
      },
      select: {
        id: true,
        courseId: true,
        originalVenue: true,
        unit: { select: { code: true } },
      },
    });

    if (affected.length === 0) {
      console.log("[timetable-reset] No entries to reset.");
      return;
    }

    // Single atomic SQL update:
    //  - status → 'Pending'
    //  - venueName restored from originalVenue when present
    //  - originalVenue cleared
    //  - updatedBy / updatedAt refreshed
    await prisma.$executeRaw`
      UPDATE "Timetable"
      SET
        status         = 'Pending',
        "venueName"    = COALESCE("originalVenue", "venueName"),
        "originalVenue"= NULL,
        "updatedBy"    = 'system',
        "updatedAt"    = NOW()
      WHERE
        status IN ('Cancelled', 'Rescheduled', 'Online')
        AND ("reschedulePermanent" IS NULL OR "reschedulePermanent" = false)
    `;

    console.log(`[timetable-reset] Reset ${affected.length} entries to Pending.`);

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
      message: "Weekly reset applied",
    });

    console.log("[timetable-reset] Done.");
  } catch (err) {
    console.error("[timetable-reset] Error during weekly reset:", err);
  }
}

/** Register the weekly cron.  Call once from instrumentation.ts on server start. */
export function startWeeklyResetCron(): void {
  // Every Saturday at 00:00:00 server local time
  cron.schedule("0 0 * * 6", () => {
    resetWeeklyStatuses().catch((err) =>
      console.error("[timetable-reset] Unhandled cron error:", err),
    );
  });
  console.log("[timetable-reset] Weekly reset cron registered (0 0 * * 6).");
}
