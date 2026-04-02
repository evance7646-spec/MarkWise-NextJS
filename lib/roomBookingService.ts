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

  // Otherwise, check for reserved bookings starting within today
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
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

  await prisma.$transaction(async (tx) => {
    const expiredHolds = await tx.bookingHold.findMany({
      where: {
        status: BookingHoldStatus.active,
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        roomId: true,
      },
    });

    if (!expiredHolds.length) return;

    const holdIds = expiredHolds.map((item) => item.id);
    const affectedRoomIds = [...new Set(expiredHolds.map((item) => item.roomId))];

    await tx.bookingHold.updateMany({
      where: {
        id: { in: holdIds },
      },
      data: {
        status: BookingHoldStatus.expired,
      },
    });

    for (const roomId of affectedRoomIds) {
      await recomputeRoomStatus(tx, roomId, "hold.expired", actorId);
    }
  }, { maxWait: 10000, timeout: 30000 });
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
  console.log('Creating hold with input:', input); // Debug log
  
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

    console.log('Hold created:', hold); // Debug log
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
  console.log('Confirming hold with input:', input); // Debug log
  
  await expireHolds();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({
      where: {
        idempotencyKey: input.idempotencyKey,
        lecturerId: input.lecturerId,
      },
    });

    if (existing) {
      console.log('Found existing booking with same idempotency key:', existing); // Debug log
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

    if (!hold) {
      throw new ApiError(404, "HOLD_NOT_FOUND", "Hold not found.");
    }

    console.log('Found hold:', hold); // Debug log

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
      // Notify all admins in the institution (use institutionId from room)
      const admins = await tx.admin.findMany({
        where: { institutionId: hold.room.institutionId },
        select: { id: true },
      });
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            userType: 'admin',
            title: 'Room Booked',
            message: `Room ${roomDisplayName} was booked by a lecturer from ${hold.startAt.toLocaleString()} to ${hold.endAt.toLocaleString()}.`,
          },
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
  console.log('Cancelling booking:', input); // Debug log
  
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
      
      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            userType: 'admin',
            title: 'Room Booking Cancelled',
            message: `A booking for room ${roomDisplayName} was cancelled.`,
          },
        });
      }
    }

    await recomputeRoomStatus(tx, updated.roomId, "booking.cancelled", input.actorId);

    return updated;
  }, { maxWait: 10000, timeout: 30000 });
}

export async function getBookingById(bookingId: string) {
  console.log('Getting booking by id:', bookingId); // Debug log
  
  await expireHolds();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: true,
      hold: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  return booking;
}

export async function refreshRoomStatuses() {
  await prisma.$transaction(async (tx) => {
    const rooms = await tx.room.findMany({
      select: { id: true },
    });

    for (const room of rooms) {
      await recomputeRoomStatus(tx, room.id, "room.refresh", "system");
    }
  }, { maxWait: 10000, timeout: 30000 });
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