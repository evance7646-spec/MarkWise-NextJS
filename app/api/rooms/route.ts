import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BLEIdManager } from "@/lib/ble/BLEIdManager";
import { jsonError, jsonOk, optionsResponse, ApiError } from "@/lib/roomApi";
import { resolveRoomScope } from "@/lib/roomAuth";
import { createRoomSchema, roomsQuerySchema } from "@/lib/roomValidation";
import { expireHolds, refreshRoomStatuses, toRoomStatusPayload } from "@/lib/roomBookingService";
import { MappingService } from "@/lib/ble/MappingService";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // No authentication required for GET

    // Automatically expire holds before refreshing room statuses
    // Only refresh DB statuses when no explicit time window is provided
    // (window queries compute availability on-the-fly instead)
    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get("institutionId") ?? undefined;
    // Best-effort — a DB blip should not prevent rooms from being returned
    try {
      await expireHolds();
    } catch (holdErr) {
      console.warn("[rooms] expireHolds skipped:", (holdErr as Error).message);
    }
    const needsDbRefresh = !searchParams.get("startAt") || !searchParams.get("endAt");
    if (needsDbRefresh) {
      // Refresh is best-effort — a DB blip or pool exhaustion should not fail the whole request.
      try {
        await refreshRoomStatuses(institutionId);
      } catch (refreshErr) {
        console.warn("[rooms] refreshRoomStatuses skipped:", (refreshErr as Error).message);
      }
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

    // Batch-fetch ALL bookings and holds for all rooms in 2 queries (avoids N+1 pool exhaustion)
    const now = new Date();
    const allBookings = roomIds.length > 0 ? await prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: ["reserved", "occupied"] },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      orderBy: { startAt: "asc" },
      include: { lecturer: true, unit: true },
    }) : [];

    const allActiveHolds = roomIds.length > 0 ? await prisma.bookingHold.findMany({
      where: {
        roomId: { in: roomIds },
        status: "active",
        expiresAt: { gt: now },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      select: { id: true, roomId: true },
    }) : [];

    // Group by roomId for O(1) lookup
    const bookingsByRoom = new Map<string, typeof allBookings>();
    for (const b of allBookings) {
      if (!bookingsByRoom.has(b.roomId)) bookingsByRoom.set(b.roomId, []);
      bookingsByRoom.get(b.roomId)!.push(b);
    }
    const holdRoomIds = new Set(allActiveHolds.map((h) => h.roomId));

    // Fetch today's timetable entries for all rooms so the facilities manager
    // can see the recurring schedule even without an explicit time window.
    const DAYS_ARR = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const todayName = DAYS_ARR[now.getDay()];
    const allTodayTimetable = roomIds.length > 0 ? await prisma.timetable.findMany({
      where: {
        roomId: { in: roomIds },
        day: todayName,
        status: { notIn: ["Cancelled"] },
      },
      select: {
        id: true,
        roomId: true,
        startTime: true,
        endTime: true,
        unitId: true,
        unit: { select: { code: true, title: true } },
        lecturer: { select: { fullName: true } },
        course: { select: { name: true } },
        department: { select: { name: true } },
      },
    }) : [];
    const timetableByRoom = new Map<string, typeof allTodayTimetable>();
    for (const t of allTodayTimetable) {
      if (!timetableByRoom.has(t.roomId)) timetableByRoom.set(t.roomId, []);
      timetableByRoom.get(t.roomId)!.push(t);
    }

    const withAvailability = rooms.map((room) => {
      const bookings = bookingsByRoom.get(room.id) ?? [];

      const currentBooking = bookings.find(
        (b) => new Date(b.startAt) <= now && new Date(b.endAt) > now
      );
      const nextBooking = bookings.find((b) => new Date(b.startAt) > now);

      let bookingStartTime = currentBooking?.startAt?.toISOString();
      let bookingEndTime = currentBooking?.endAt?.toISOString();
      let bookingUnitCode = (currentBooking?.unitCode || currentBooking?.unit?.code) ?? undefined;
      if (bookingUnitCode) bookingUnitCode = normalizeUnitCode(bookingUnitCode);
      let bookingLecturerName = currentBooking?.lecturer?.fullName || currentBooking?.lecturer?.email;

      if (room.status === "reserved" && !currentBooking && nextBooking) {
        bookingStartTime = nextBooking.startAt?.toISOString();
        bookingEndTime = nextBooking.endAt?.toISOString();
        const rawNext = nextBooking.unitCode || nextBooking.unit?.code;
        bookingUnitCode = rawNext ? normalizeUnitCode(rawNext) : undefined;
        bookingLecturerName = nextBooking.lecturer?.fullName || nextBooking.lecturer?.email;
      }

      const hasBookingConflict = bookings.length > 0 || holdRoomIds.has(room.id);
      const hasTimetableConflict = timetableBusyIds.has(room.id);
      const hasConflict = hasBookingConflict || hasTimetableConflict;

      let windowStatus: string | undefined;
      if (hasExplicitWindow) {
        if (room.status === "unavailable") {
          windowStatus = "unavailable";
        } else if (hasConflict) {
          windowStatus = currentBooking?.status ?? (bookings.length > 0 ? bookings[0].status : "reserved");
        } else {
          windowStatus = "free";
        }
      }

      const todayTimetable = (timetableByRoom.get(room.id) ?? [])
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((t) => ({
          id: t.id,
          startTime: t.startTime,
          endTime: t.endTime,
          unitCode: t.unit?.code ?? "",
          unitTitle: t.unit?.title ?? "",
          courseName: t.course?.name ?? "",
          lecturerName: t.lecturer?.fullName ?? "",
          departmentName: t.department?.name ?? "",
        }));

      return {
        ...toRoomStatusPayload(room),
        hasConflict,
        ...(windowStatus ? { status: windowStatus } : {}),
        bookingStartTime,
        bookingEndTime,
        bookingUnitCode,
        bookingLecturerName,
        bookings,
        todayTimetable,
      };
    });

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

    if (scope.role !== "roomManager" && scope.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Only room managers or admins can add rooms.");
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
      await BLEIdManager.autoAssignIds(parsed.data.institutionId);
      const mappingSet = await MappingService.generateMappingSet(parsed.data.institutionId);
      await MappingService.saveMappingSet(parsed.data.institutionId, mappingSet);
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
