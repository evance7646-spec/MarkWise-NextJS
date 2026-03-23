import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, ApiError } from "@/lib/roomApi";
import { toRoomStatusPayload } from "@/lib/roomBookingService";

export const runtime = "nodejs";

/**
 * GET /api/rooms/weekly?institutionId=xxx
 *
 * Returns all rooms with their booking schedule for each day of the
 * current week (Monday–Sunday). Used by the Reservations weekly view.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get("institutionId") ?? undefined;

    if (!institutionId) {
      throw new ApiError(400, "MISSING_PARAM", "institutionId is required.");
    }

    // Calculate Monday–Sunday of the current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + mondayOffset);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7); // exclusive end (Mon next week 00:00)

    // Fetch all active rooms for the institution
    const rooms = await prisma.room.findMany({
      where: { institutionId, isActive: true },
      orderBy: [{ buildingCode: "asc" }, { roomCode: "asc" }],
    });

    // Fetch all bookings for these rooms in the week window
    const roomIds = rooms.map((r) => r.id);
    const bookings = await prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: ["reserved", "occupied"] },
        startAt: { lt: sunday },
        endAt: { gt: monday },
      },
      orderBy: { startAt: "asc" },
      include: {
        lecturer: { select: { id: true, fullName: true, email: true } },
        unit: { select: { id: true, code: true, title: true } },
      },
    });

    // Group bookings by roomId → day index (0=Mon..6=Sun)
    type BookingWithRelations = typeof bookings[number];
    const bookingsByRoom = new Map<string, Map<number, BookingWithRelations[]>>();
    for (const b of bookings) {
      const start = new Date(b.startAt);
      const dayIdx = (start.getDay() + 6) % 7; // convert Sun=0 → 6, Mon=1 → 0, etc.
      if (!bookingsByRoom.has(b.roomId)) bookingsByRoom.set(b.roomId, new Map());
      const dayMap = bookingsByRoom.get(b.roomId)!;
      if (!dayMap.has(dayIdx)) dayMap.set(dayIdx, []);
      dayMap.get(dayIdx)!.push(b);
    }

    const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    // Build response: each room has a `weekSchedule` array of 7 day entries
    const result = rooms.map((room) => {
      const dayMap = bookingsByRoom.get(room.id);
      const weekSchedule = dayLabels.map((label, idx) => {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + idx);
        const dayBookings = dayMap?.get(idx) ?? [];

        // Determine day-level status
        let status: "free" | "reserved" | "occupied" | "unavailable" = "free";
        if (room.status === "unavailable") {
          status = "unavailable";
        } else {
          const hasOccupied = dayBookings.some((b) => b.status === "occupied");
          const hasReserved = dayBookings.some((b) => b.status === "reserved");
          if (hasOccupied) status = "occupied";
          else if (hasReserved) status = "reserved";
        }

        return {
          day: label,
          date: dayDate.toISOString().slice(0, 10),
          status,
          bookings: dayBookings.map((b) => ({
            id: b.id,
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
            status: b.status,
            unitCode: b.unitCode ?? b.unit?.code ?? null,
            unitName: b.unit?.title ?? null,
            lecturerName: b.lecturer?.fullName ?? b.lecturer?.email ?? null,
          })),
        };
      });

      return {
        ...toRoomStatusPayload(room),
        weekSchedule,
      };
    });

    return jsonOk({
      rooms: result,
      week: {
        start: monday.toISOString().slice(0, 10),
        end: new Date(sunday.getTime() - 1).toISOString().slice(0, 10),
      },
      meta: { total: result.length },
    });
  } catch (error) {
    return jsonError(error);
  }
}
