import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BLEIdManager } from "@/lib/ble/BLEIdManager";
import { jsonError, jsonOk, optionsResponse, ApiError } from "@/lib/roomApi";
import { resolveRoomScope } from "@/lib/roomAuth";
import { createRoomSchema, roomsQuerySchema } from "@/lib/roomValidation";
import { expireHolds, refreshRoomStatuses, toRoomStatusPayload } from "@/lib/roomBookingService";
import { updateInstitutionMappingSet } from '@/lib/updateInstitutionMappingSet';

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // No authentication required for GET

    // Automatically expire holds before refreshing room statuses
    // Only refresh DB statuses when no explicit time window is provided
    // (window queries compute availability on-the-fly instead)
    const { searchParams } = new URL(request.url);
    await expireHolds();
    const needsDbRefresh = !searchParams.get("startAt") || !searchParams.get("endAt");
    if (needsDbRefresh) {
      await refreshRoomStatuses();
    }

    const queryPayload = {
      institutionId: searchParams.get("institutionId") ?? undefined,
      buildingCode: searchParams.get("buildingCode") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      startAt: searchParams.get("startAt") ?? undefined,
      endAt: searchParams.get("endAt") ?? undefined,
      capacity: searchParams.get("capacity") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    };

    const parsed = roomsQuerySchema.safeParse(queryPayload);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid rooms query.", parsed.error.flatten());
    }

    let windowStart: Date | undefined;
    let windowEnd: Date | undefined;

    if (parsed.data.startAt && parsed.data.endAt) {
      windowStart = new Date(parsed.data.startAt);
      windowEnd = new Date(parsed.data.endAt);
      if (windowStart >= windowEnd) {
        throw new ApiError(400, "INVALID_RANGE", "endAt must be after startAt.");
      }
    } else if (parsed.data.date) {
      const day = new Date(`${parsed.data.date}T00:00:00.000Z`);
      if (Number.isNaN(day.getTime())) {
        throw new ApiError(400, "INVALID_DATE", "date must be in YYYY-MM-DD format.");
      }
      windowStart = day;
      windowEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }

    const where: Prisma.RoomWhereInput = {
      ...(parsed.data.institutionId ? { institutionId: parsed.data.institutionId } : {}),
      ...(parsed.data.buildingCode ? { buildingCode: parsed.data.buildingCode } : {}),
      ...(parsed.data.capacity ? { capacity: { gte: parsed.data.capacity } } : {}),
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    };

    // Add limit and pagination for performance
    const limit = Number(searchParams.get("limit")) || 100;
    const offset = Number(searchParams.get("offset")) || 0;

    let rooms = await prisma.room.findMany({
      where: {
        ...where,
        isActive: true,
      },
      orderBy: [{ institutionId: "asc" }, { buildingCode: "asc" }, { roomCode: "asc" }],
      take: limit,
      skip: offset,
    });

    // If institutionId was provided but no rooms found, fetch all active rooms with limit
    if (parsed.data.institutionId && rooms.length === 0) {
      rooms = await prisma.room.findMany({
        where: { isActive: true },
        orderBy: [{ institutionId: "asc" }, { buildingCode: "asc" }, { roomCode: "asc" }],
        take: limit,
        skip: offset,
      });
    }



    // Track whether the caller passed an explicit time window
    const hasExplicitWindow = Boolean(parsed.data.startAt && parsed.data.endAt);

    // Default to today if no date/time window specified
    if (!windowStart || !windowEnd) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      windowStart = todayStart;
      windowEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    }

    // If explicit window provided, also check timetable conflicts for all rooms
    const roomIds = rooms.map((r) => r.id);
    let timetableBusyIds = new Set<string>();

    if (hasExplicitWindow && roomIds.length > 0) {
      // Derive day name and HH:mm times from the window
      const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const windowDay = DAYS[windowStart!.getUTCDay()];
      const padTime = (t: string) => t.replace(/^(\d):/, "0$1:");
      const wStartTime = padTime(
        `${windowStart!.getUTCHours()}:${String(windowStart!.getUTCMinutes()).padStart(2, "0")}`
      );
      const wEndTime = padTime(
        `${windowEnd!.getUTCHours()}:${String(windowEnd!.getUTCMinutes()).padStart(2, "0")}`
      );

      const timetableConflicts = await prisma.timetable.findMany({
        where: {
          day: windowDay,
          status: { notIn: ["Cancelled"] },
          OR: [
            { roomId: { in: roomIds } },
            { rescheduledRoomId: { in: roomIds } },
          ],
        },
        select: {
          roomId: true,
          rescheduledRoomId: true,
          status: true,
          startTime: true,
          endTime: true,
        },
      });

      for (const e of timetableConflicts) {
        const eStart = padTime(e.startTime);
        const eEnd = padTime(e.endTime);
        if (eStart < wEndTime && eEnd > wStartTime) {
          if (e.status === "Rescheduled") {
            timetableBusyIds.add(e.rescheduledRoomId ?? e.roomId);
          } else {
            timetableBusyIds.add(e.roomId);
          }
        }
      }
    }

    const withAvailability = await Promise.all(
      rooms.map(async (room) => {
        const now = new Date();
        // Only fetch bookings within the requested window (defaults to today)
        const bookings = await prisma.booking.findMany({
          where: {
            roomId: room.id,
            status: { in: ["reserved", "occupied"] },
            startAt: { lt: windowEnd },
            endAt: { gt: windowStart },
          },
          orderBy: { startAt: "asc" },
          include: {
            lecturer: true,
            unit: true,
          },
        });

        // Find the current booking (if any)
        const currentBooking = bookings.find(
          (b) => new Date(b.startAt) <= now && new Date(b.endAt) > now
        );

        // Find the next booking (if any)
        const nextBooking = bookings.find(
          (b) => new Date(b.startAt) > now
        );

        // Attach booking details for reserved rooms using next booking if no current booking exists
        let bookingStartTime = currentBooking?.startAt?.toISOString();
        let bookingEndTime = currentBooking?.endAt?.toISOString();
        let bookingUnitCode = currentBooking?.unitCode || currentBooking?.unit?.code;
        let bookingLecturerName = currentBooking?.lecturer?.fullName || currentBooking?.lecturer?.email;

        // If room is reserved and no current booking, use next booking details
        if (room.status === "reserved" && !currentBooking && nextBooking) {
          bookingStartTime = nextBooking.startAt?.toISOString();
          bookingEndTime = nextBooking.endAt?.toISOString();
          bookingUnitCode = nextBooking.unitCode || nextBooking.unit?.code;
          bookingLecturerName = nextBooking.lecturer?.fullName || nextBooking.lecturer?.email;
        }

        const [bookingConflict, holdConflict] = await Promise.all([
          prisma.booking.findFirst({
            where: {
              roomId: room.id,
              status: { in: ["reserved", "occupied"] },
              startAt: { lt: windowEnd },
              endAt: { gt: windowStart },
            },
            select: { id: true },
          }),
          prisma.bookingHold.findFirst({
            where: {
              roomId: room.id,
              status: "active",
              expiresAt: { gt: new Date() },
              startAt: { lt: windowEnd },
              endAt: { gt: windowStart },
            },
            select: { id: true },
          }),
        ]);

        const hasBookingConflict = Boolean(bookingConflict || holdConflict);
        const hasTimetableConflict = timetableBusyIds.has(room.id);
        const hasConflict = hasBookingConflict || hasTimetableConflict;

        // When an explicit time window is provided, compute the availability
        // status for that window instead of using the DB's real-time status.
        let windowStatus: string | undefined;
        if (hasExplicitWindow) {
          if (room.status === "unavailable") {
            windowStatus = "unavailable";
          } else if (hasConflict) {
            // Use the booking's actual status if available, otherwise "reserved"
            windowStatus = currentBooking?.status ?? (bookings.length > 0 ? bookings[0].status : "reserved");
          } else {
            windowStatus = "free";
          }
        }

        return {
          ...toRoomStatusPayload(room),
          hasConflict,
          // Override status with window-aware status when explicit window given
          ...(windowStatus ? { status: windowStatus } : {}),
          bookingStartTime,
          bookingEndTime,
          bookingUnitCode,
          bookingLecturerName,
          bookings,
        };
      })
    );

    return jsonOk({
      rooms: withAvailability,
      filters: {
        ...parsed.data,
        startAt: windowStart?.toISOString(),
        endAt: windowEnd?.toISOString(),
      },
      meta: {
        total: rooms.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRoomScope(request);
    if (!scope.ok) {
      throw new ApiError(scope.status, "UNAUTHORIZED", scope.error);
    }

    if (scope.role !== "roomManager") {
      throw new ApiError(403, "FORBIDDEN", "Only room managers can add, edit, or delete rooms. Other roles are read-only.");
    }

    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid room payload.", parsed.error.flatten());
    }

    const exists = await prisma.room.findUnique({
      where: {
        institutionId_buildingCode_roomCode: {
          institutionId: parsed.data.institutionId,
          buildingCode: parsed.data.buildingCode,
          roomCode: parsed.data.roomCode,
        },
      },
      select: { id: true },
    });

    if (exists) {
      throw new ApiError(409, "ROOM_ALREADY_EXISTS", "Room with this institution/building/room code already exists.");
    }

    // Assign next available BLE ID in the correct range (R200-R999)
    const nextBleId = await BLEIdManager.getNextRoomId(parsed.data.institutionId);
    const room = await prisma.room.create({
      data: { ...parsed.data, bleId: nextBleId },
    });
    if (parsed.data.institutionId) {
      await updateInstitutionMappingSet(parsed.data.institutionId);
    }
    return jsonOk({ room: toRoomStatusPayload(room) }, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH() {
  return NextResponse.json(
    {
      apiVersion: "v1",
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use /api/rooms/:id for updates.",
      },
    },
    {
      status: 405,
    },
  );
}
