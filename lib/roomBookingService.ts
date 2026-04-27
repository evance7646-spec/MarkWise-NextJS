// C:\MarkWise\lib\roomBookingService.ts
import {
  BookingHoldStatus,
  BookingStatus,
  Prisma,
  RoomStatus,
  type Booking,
  type BookingHold,
  type Room,
} from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError } from "./errors";
import { emitRoomEvent } from "./roomEvents";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.reserved, BookingStatus.occupied];

const isOverlap = (startAt: Date, endAt: Date) => ({
  startAt: { lt: endAt },
  endAt: { gt: startAt },
});

const holdTtlMinutes = () => {
  const configured = Number(process.env.BOOKING_HOLD_TTL_MINUTES ?? "5");
  if (!Number.isFinite(configured) || configured <= 0) return 5;
  return Math.floor(configured);
};

type TxClient = Prisma.TransactionClient;

async function setRoomStatus(
  tx: TxClient,
  roomId: string,
  toStatus: RoomStatus,
  reason: string,
  actorId: string | null,
): Promise<Room> {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found.");
  }

  if (room.status === toStatus) {
    return room;
  }

  const updated = await tx.room.update({
    where: { id: roomId },
    data: { status: toStatus },
  });

  emitRoomEvent({
    roomId,
    fromStatus: room.status,
    toStatus,
    reason,
    actorId,
  });

  return updated;
}

export async function recomputeRoomStatus(tx: TxClient, roomId: string, reason: string, actorId: string | null) {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found.");
  }

  if (room.status === RoomStatus.unavailable) {
    return room;
  }

  const now = new Date();

  // Check for occupied booking (current time within booking window)
  const occupied = await tx.booking.findFirst({
    where: {
      roomId,
      status: BookingStatus.occupied,
      startAt: { lte: now },
      endAt: { gt: now },
    },
    select: { id: true },
  });
  if (occupied) {
    return setRoomStatus(tx, roomId, RoomStatus.occupied, reason, actorId);
  }

  // If there is an active hold for this room, set status to reserved
  const activeHold = await tx.bookingHold.findFirst({
    where: {
      roomId,
      status: BookingHoldStatus.active,
      startAt: { lte: now },
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (activeHold) {
    return setRoomStatus(tx, roomId, RoomStatus.reserved, reason, actorId);
  }

  // Otherwise, check for reserved bookings starting within today (UTC)
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  const reserved = await tx.booking.findFirst({
    where: {
      roomId,
      status: BookingStatus.reserved,
      startAt: { gt: now, lte: endOfDay },
    },
    select: { id: true },
  });
  if (reserved) {
    return setRoomStatus(tx, roomId, RoomStatus.reserved, reason, actorId);
  }
  
  return setRoomStatus(tx, roomId, RoomStatus.free, reason, actorId);
}

export async function expireHolds(actorId: string | null = "system") {
  const now = new Date();

  // Find expired holds outside any transaction to avoid long-lived locks
  const expiredHolds = await prisma.bookingHold.findMany({
    where: {
      status: BookingHoldStatus.active,
      expiresAt: { lte: now },
    },
    select: { id: true, roomId: true },
  });

  if (!expiredHolds.length) return;

  const holdIds = expiredHolds.map((item) => item.id);
  const affectedRoomIds = [...new Set(expiredHolds.map((item) => item.roomId))];

  // Expire the holds in one atomic batch — no interactive transaction needed
  await prisma.bookingHold.updateMany({
    where: { id: { in: holdIds } },
    data: { status: BookingHoldStatus.expired },
  });

  // Recompute status for each affected room in small, independent transactions
  const BATCH_SIZE = 3;
  for (let i = 0; i < affectedRoomIds.length; i += BATCH_SIZE) {
    const batch = affectedRoomIds.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((roomId) =>
        prisma.$transaction(
          (tx) => recomputeRoomStatus(tx, roomId, "hold.expired", actorId),
          { maxWait: 3_000, timeout: 10_000 },
        )
      )
    );
  }
}

async function assertNoConflicts(
  tx: TxClient,
  roomId: string,
  startAt: Date,
  endAt: Date,
  ignoreHoldId?: string,
) {
  // Check for unavailable status (should be handled before, but double-check)
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) {
    throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found or inactive.");
  }
  if (room.status === "unavailable") {
    throw new ApiError(409, "ROOM_UNAVAILABLE", "Room is unavailable and cannot be booked.");
  }

  // Check for overlapping bookings (reserved/occupied)
  const bookingConflict = await tx.booking.findFirst({
    where: {
      roomId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      ...isOverlap(startAt, endAt),
    },
    select: { id: true, status: true },
  });
  if (bookingConflict) {
    if (bookingConflict.status === "occupied") {
      throw new ApiError(409, "BOOKING_OVERLAP_OCCUPIED", "Room is currently occupied and cannot be booked for this time slot.");
    } else {
      throw new ApiError(409, "BOOKING_OVERLAP_RESERVED", "Room is reserved for this time slot. Please choose a non-overlapping time.");
    }
  }

  // Check for overlapping holds
  const holdConflict = await tx.bookingHold.findFirst({
    where: {
      roomId,
      status: BookingHoldStatus.active,
      expiresAt: { gt: new Date() },
      ...(ignoreHoldId ? { id: { not: ignoreHoldId } } : {}),
      startAt: { lt: endAt },
    },
    select: { id: true },
  });
  if (holdConflict) {
    throw new ApiError(409, "HOLD_OVERLAP", "Room is currently held for the selected time range. Please choose a different slot.");
  }

  // If free, allow booking
  // No error thrown means booking is allowed
}

export async function createHold(input: { roomId: string; lecturerId: string; startAt: Date; endAt: Date }) {
  await expireHolds();

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: input.roomId } });
    if (!room || !room.isActive) {
      throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found or inactive.");
    }

    if (room.status === RoomStatus.unavailable) {
      throw new ApiError(409, "ROOM_UNAVAILABLE", "Room is unavailable.");
    }

    // Validate lecturerId exists
    const lecturer = await tx.lecturer.findUnique({ where: { id: input.lecturerId } });
    if (!lecturer) {
      throw new ApiError(404, "LECTURER_NOT_FOUND", "Lecturer not found.");
    }

    await assertNoConflicts(tx, input.roomId, input.startAt, input.endAt);

    const hold = await tx.bookingHold.create({
      data: {
        roomId: input.roomId,
        lecturerId: input.lecturerId,
        startAt: input.startAt,
        endAt: input.endAt,
        expiresAt: new Date(Date.now() + holdTtlMinutes() * 60_000),
        status: BookingHoldStatus.active,
      },
    });

    await recomputeRoomStatus(tx, input.roomId, "hold.created", input.lecturerId);

    return hold;
  }, { maxWait: 10000, timeout: 30000 });
}

// FIXED: Added missing startAt and endAt parameters
export async function confirmHold(input: {
  holdId: string;
  lecturerId: string;
  unitCode: string;
  idempotencyKey: string;
  startAt: Date;  // FIX: Added missing parameter
  endAt: Date;    // FIX: Added missing parameter
}) {
  await expireHolds();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({
      where: {
        idempotencyKey: input.idempotencyKey,
        lecturerId: input.lecturerId,
      },
    });

    if (existing) {
      return {
        booking: existing,
        idempotentReplay: true,
      };
    }

    // Fetch hold and room (room without institution include)
    const hold = await tx.bookingHold.findUnique({
      where: { id: input.holdId },
      include: { room: true },
    });

    if (!hold) {
      throw new ApiError(404, "HOLD_NOT_FOUND", "Hold not found.");
    }
    if (!hold.room) {
      throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found for this hold.");
    }

    if (hold.lecturerId !== input.lecturerId) {
      throw new ApiError(403, "HOLD_FORBIDDEN", "Hold belongs to another lecturer.");
    }

    if (hold.status !== BookingHoldStatus.active) {
      throw new ApiError(409, "HOLD_INACTIVE", "Hold is no longer active.");
    }

    if (hold.expiresAt <= new Date()) {
      await tx.bookingHold.update({
        where: { id: hold.id },
        data: { status: BookingHoldStatus.expired },
      });
      await recomputeRoomStatus(tx, hold.roomId, "hold.expired", input.lecturerId);
      throw new ApiError(409, "HOLD_EXPIRED", "Hold has expired.");
    }

    if (!hold.room.isActive || hold.room.status === RoomStatus.unavailable) {
      throw new ApiError(409, "ROOM_UNAVAILABLE", "Room is unavailable.");
    }

    // Validate that the provided times match the hold times
    if (hold.startAt.getTime() !== input.startAt.getTime() || 
        hold.endAt.getTime() !== input.endAt.getTime()) {
      throw new ApiError(400, "TIME_MISMATCH", "Booking times must match the hold times.");
    }

    await assertNoConflicts(tx, hold.roomId, hold.startAt, hold.endAt, hold.id);

    const now = new Date();
    const bookingStatus = hold.startAt <= now && hold.endAt > now ? BookingStatus.occupied : BookingStatus.reserved;

    let booking: Booking;
    try {
      booking = await tx.booking.create({
        data: {
          roomId: hold.roomId,
          lecturerId: input.lecturerId,
          unitCode: input.unitCode,
          startAt: hold.startAt,
          endAt: hold.endAt,
          status: bookingStatus,
          holdId: hold.id,
          idempotencyKey: input.idempotencyKey,
        },
      });

      // Use roomCode or a fallback if name doesn't exist
      const roomDisplayName = hold.room.roomCode || hold.room.name || 'Unknown Room';
      // Notify lecturer
      await tx.notification.create({
        data: {
          userId: input.lecturerId,
          userType: 'lecturer',
          title: 'Room Booking Confirmed',
          message: `Your booking for room ${roomDisplayName} is confirmed from ${hold.startAt.toLocaleString()} to ${hold.endAt.toLocaleString()}.`,
        },
      });
      // Notify all admins in the institution
      const admins = await tx.admin.findMany({
        where: { institutionId: hold.room.institutionId },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            userType: 'admin',
            title: 'Room Booked',
            message: `Room ${roomDisplayName} was booked by a lecturer from ${hold.startAt.toLocaleString()} to ${hold.endAt.toLocaleString()}.`,
          })),
        });
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const replay = await tx.booking.findFirst({
          where: {
            idempotencyKey: input.idempotencyKey,
            lecturerId: input.lecturerId,
          },
        });
        if (replay) {
          return {
            booking: replay,
            idempotentReplay: true,
          };
        }
      }
      throw error;
    }

    await tx.bookingHold.update({
      where: { id: hold.id },
      data: { status: BookingHoldStatus.confirmed },
    });

    await recomputeRoomStatus(tx, hold.roomId, "booking.confirmed", input.lecturerId);

    return {
      booking,
      idempotentReplay: false,
    };
  }, { maxWait: 10000, timeout: 30000 });
}

export async function cancelBooking(input: { bookingId: string; actorId: string; actorRole: "admin" | "lecturer" }) {
  await expireHolds();

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ 
      where: { id: input.bookingId },
      include: { room: true }
    });
    
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    if (input.actorRole === "lecturer" && booking.lecturerId !== input.actorId) {
      throw new ApiError(403, "BOOKING_FORBIDDEN", "You can only cancel your own booking.");
    }

    if (booking.status === BookingStatus.cancelled || booking.status === BookingStatus.completed) {
      return booking;
    }

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.cancelled },
    });

    // FIX: Use roomCode or fallback
    const roomDisplayName = booking.room?.roomCode || booking.room?.name || 'Unknown Room';

    // Notify lecturer if exists
    if (booking.lecturerId) {
      await tx.notification.create({
        data: {
          userId: booking.lecturerId,
          userType: 'lecturer',
          title: 'Room Booking Cancelled',
          message: `Your booking for room ${roomDisplayName} was cancelled.`,
        },
      });
    }
    
    // Notify all admins in the institution
    if (booking.room) {
      const admins = await tx.admin.findMany({
        where: { institutionId: booking.room.institutionId },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            userType: 'admin',
            title: 'Room Booking Cancelled',
            message: `A booking for room ${roomDisplayName} was cancelled.`,
          })),
        });
      }
    }

    await recomputeRoomStatus(tx, updated.roomId, "booking.cancelled", input.actorId);

    return updated;
  }, { maxWait: 10000, timeout: 30000 });
}

export async function getBookingById(bookingId: string) {
  await expireHolds();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  return booking;
}

// Cooldown: only refresh once per 30 s per institution to avoid saturating the connection pool.
const _lastRefresh = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 30_000;

export async function refreshRoomStatuses(institutionId?: string) {
  const key = institutionId ?? "__all__";
  const now = Date.now();
  if ((now - (_lastRefresh.get(key) ?? 0)) < REFRESH_COOLDOWN_MS) return;
  _lastRefresh.set(key, now);

  // Fetch rooms that can change status (skip unavailable — those are manually managed)
  const rooms = await prisma.room.findMany({
    select: { id: true, status: true },
    where: {
      isActive: true,
      status: { not: RoomStatus.unavailable },
      ...(institutionId ? { institutionId } : {}),
    },
  });

  if (!rooms.length) return;

  const roomIds = rooms.map((r) => r.id);
  const nowDate = new Date();
  const endOfDay = new Date(nowDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Day name for timetable lookup (e.g. "Monday")
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const todayName = DAYS[nowDate.getDay()];
  const nowHHMM = `${String(nowDate.getHours()).padStart(2,"0")}:${String(nowDate.getMinutes()).padStart(2,"0")}`;

  // 4 bulk queries — no per-room transactions needed
  // The 4th query checks the Timetable table directly so rooms committed to
  // recurring weekly classes are marked reserved even if the Booking sync
  // was not run for those entries (e.g. legacy entries).
  const [occupiedRows, holdRows, reservedRows, timetableRows] = await Promise.all([
    prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: BookingStatus.occupied,
        startAt: { lte: nowDate },
        endAt: { gt: nowDate },
      },
      select: { roomId: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        roomId: { in: roomIds },
        status: BookingHoldStatus.active,
        startAt: { lte: nowDate },
        expiresAt: { gt: nowDate },
      },
      select: { roomId: true },
    }),
    prisma.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: BookingStatus.reserved,
        startAt: { gt: nowDate, lte: endOfDay },
      },
      select: { roomId: true },
    }),
    // Timetable entries for today: covers rooms whose bookings haven't been
    // created yet (legacy entries) or whose booking sync is behind.
    prisma.timetable.findMany({
      where: {
        roomId: { in: roomIds },
        day: todayName,
        status: { notIn: ["Cancelled"] },
        // Room is still reserved for the day even if class hasn't started yet
        endTime: { gt: nowHHMM },
      },
      select: { roomId: true, startTime: true, endTime: true },
    }),
  ]);

  const occupiedIds = new Set(occupiedRows.map((r) => r.roomId));
  const holdIds     = new Set(holdRows.map((r) => r.roomId));
  const reservedIds = new Set(reservedRows.map((r) => r.roomId));

  // A room is occupied via timetable if a session is currently in progress
  for (const t of timetableRows) {
    if (t.startTime <= nowHHMM && t.endTime > nowHHMM) {
      occupiedIds.add(t.roomId);
    } else {
      // Session later today → reserved
      reservedIds.add(t.roomId);
    }
  }

  const toOccupied: string[] = [];
  const toReserved: string[] = [];
  const toFree:     string[] = [];

  for (const room of rooms) {
    if (occupiedIds.has(room.id)) {
      if (room.status !== RoomStatus.occupied) toOccupied.push(room.id);
    } else if (holdIds.has(room.id) || reservedIds.has(room.id)) {
      if (room.status !== RoomStatus.reserved) toReserved.push(room.id);
    } else {
      if (room.status !== RoomStatus.free) toFree.push(room.id);
    }
  }

  // 3 bulk writes — replaces O(n) per-room transactions
  await Promise.all([
    toOccupied.length
      ? prisma.room.updateMany({ where: { id: { in: toOccupied } }, data: { status: RoomStatus.occupied } })
      : null,
    toReserved.length
      ? prisma.room.updateMany({ where: { id: { in: toReserved } }, data: { status: RoomStatus.reserved } })
      : null,
    toFree.length
      ? prisma.room.updateMany({ where: { id: { in: toFree } }, data: { status: RoomStatus.free } })
      : null,
  ].filter(Boolean));
}

export async function markRoomUnavailable(roomId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new ApiError(404, "ROOM_NOT_FOUND", "Room not found.");
    }

    return setRoomStatus(tx, roomId, RoomStatus.unavailable, "room.unavailable", actorId);
  }, { maxWait: 10000, timeout: 30000 });
}

export function canReadBooking(booking: { lecturerId: string }, scope: { role: "admin" | "lecturer"; userId: string }) {
  if (scope.role === "admin") return true;
  return booking.lecturerId === scope.userId;
}

export function toRoomStatusPayload(room: Room) {
  return {
    id: room.id,
    institutionId: room.institutionId,
    buildingCode: room.buildingCode,
    roomCode: room.roomCode,
    name: room.name,
    capacity: room.capacity,
    type: room.type,
    floor: room.floor,
    status: room.status,
    isActive: room.isActive,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export function toHoldPayload(hold: BookingHold) {
  return {
    id: hold.id,
    roomId: hold.roomId,
    lecturerId: hold.lecturerId,
    startAt: hold.startAt.toISOString(),
    expiresAt: hold.expiresAt.toISOString(),
    status: hold.status,
    createdAt: hold.createdAt.toISOString(),
  };
}

export function toBookingPayload(booking: Booking) {
  return {
    id: booking.id,
    roomId: booking.roomId,
    lecturerId: booking.lecturerId,
    unitCode: booking.unitCode,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    status: booking.status,
    holdId: booking.holdId,
    createdAt: booking.createdAt.toISOString(),
  };
}