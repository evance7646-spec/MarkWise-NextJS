import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";
import { verifyFacilitiesManagerJwt } from "@/lib/facilitiesManagerAuthJwt";

export const runtime = "nodejs";

async function resolveInstitutionId(req: NextRequest): Promise<string | null> {
  // Always try cookie-based admin auth first (used by dashboard pages)
  const adminScope = await resolveAdminScope(req);
  if (adminScope.ok && adminScope.institutionId) return adminScope.institutionId;

  // Fall back to Bearer token (facilities manager JWT from mobile/external clients)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    try {
      const payload = verifyFacilitiesManagerJwt(token);
      if (payload?.institutionId) return payload.institutionId;
    } catch {}
  }

  return null;
}

/**
 * GET /api/bookings/conflicts?institutionId=
 *
 * Returns rooms that have overlapping bookings (double-booked time slots)
 * within the next 7 days.
 */
export async function GET(req: NextRequest) {
  const institutionId = await resolveInstitutionId(req);
  if (!institutionId) {
    return NextResponse.json(
      { error: "Unauthorized. Valid admin or room manager token required." },
      { status: 401 }
    );
  }

  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(now.getDate() + 7);

  const bookings = await prisma.booking.findMany({
    where: {
      room: { institutionId },
      status: { in: ["reserved", "occupied"] },
      startAt: { gte: now },
      endAt: { lte: sevenDaysLater },
    },
    orderBy: [{ roomId: "asc" }, { startAt: "asc" }],
    select: {
      id: true,
      roomId: true,
      startAt: true,
      endAt: true,
      unitCode: true,
      room: { select: { roomCode: true, buildingCode: true, name: true } },
    },
  });

  // Detect overlaps per room
  const conflicts: Array<{
    roomId: string;
    roomCode: string;
    buildingCode: string;
    roomName: string;
    bookingA: { id: string; startAt: string; endAt: string; unitCode: string | null };
    bookingB: { id: string; startAt: string; endAt: string; unitCode: string | null };
  }> = [];

  const byRoom: Record<string, typeof bookings> = {};
  for (const b of bookings) {
    if (!byRoom[b.roomId]) byRoom[b.roomId] = [];
    byRoom[b.roomId].push(b);
  }

  for (const [, roomBookings] of Object.entries(byRoom)) {
    for (let i = 0; i < roomBookings.length - 1; i++) {
      for (let j = i + 1; j < roomBookings.length; j++) {
        const a = roomBookings[i];
        const b = roomBookings[j];
        // Overlap: a.startAt < b.endAt && b.startAt < a.endAt
        if (a.startAt < b.endAt && b.startAt < a.endAt) {
          conflicts.push({
            roomId: a.roomId,
            roomCode: a.room.roomCode,
            buildingCode: a.room.buildingCode,
            roomName: a.room.name,
            bookingA: { id: a.id, startAt: a.startAt.toISOString(), endAt: a.endAt.toISOString(), unitCode: a.unitCode },
            bookingB: { id: b.id, startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), unitCode: b.unitCode },
          });
        }
      }
    }
  }

  return NextResponse.json({ conflicts, total: conflicts.length });
}
