/**
 * GET /api/cron/revert-timetable
 *
 * Intended to run every Friday at 23:59 (cron: "59 23 * * 5").
 * Reverts all timetable entries that were temporarily rescheduled
 * back to their original day/time and resets status to "Pending".
 *
 * Protect this route with CRON_SECRET so only your scheduler can call it:
 *   Authorization: Bearer <CRON_SECRET>
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Simple secret-based guard — set CRON_SECRET in your environment variables
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.replace(/^Bearer\s+/i, "").trim() !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Find all temporary reschedules
    const targets = await prisma.timetable.findMany({
      where: {
        status: "Rescheduled",
        reschedulePermanent: false,
        originalDay: { not: null },
        originalStartTime: { not: null },
        originalEndTime: { not: null },
      },
      select: {
        id: true,
        originalDay: true,
        originalStartTime: true,
        originalEndTime: true,
        unit: { select: { code: true } },
      },
    });

    if (targets.length === 0) {
      return NextResponse.json({ reverted: 0, message: "Nothing to revert." });
    }

    // Revert each entry individually so updatedAt triggers correctly, then emit socket event
    for (const t of targets) {
      await prisma.timetable.update({
        where: { id: t.id },
        data: {
          day: t.originalDay!,
          startTime: t.originalStartTime!,
          endTime: t.originalEndTime!,
          status: "Pending",
          rescheduledTo: null,
          reschedulePermanent: null,
          updatedBy: "system",
        },
      });


    }

    console.log(`[cron/revert-timetable] Reverted ${targets.length} temporary reschedule(s).`);
    return NextResponse.json({ reverted: targets.length, ids: targets.map((t) => t.id) });
  } catch (err) {
    console.error("[cron/revert-timetable] error:", err);
    return NextResponse.json({ error: "Revert job failed." }, { status: 500 });
  }
}
