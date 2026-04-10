import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";
import { verifyFacilitiesManagerJwt } from "@/lib/facilitiesManagerAuthJwt";

export const runtime = "nodejs";

async function resolveInstitutionId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const adminScope = await resolveAdminScope(req);
  if (adminScope.ok && adminScope.institutionId) return adminScope.institutionId;

  try {
    const payload = verifyFacilitiesManagerJwt(token);
    if (payload?.institutionId) return payload.institutionId;
  } catch {}

  return null;
}

/**
 * GET /api/bookings/analytics?institutionId=
 * Returns aggregated booking analytics for the institution.
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
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

  // Monday of current week
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now); monday.setDate(now.getDate() + mondayOffset); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);

  // Last 30 days
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30); thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [allBookings, rooms, activeHolds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        room: { institutionId },
        startAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        roomId: true,
        room: { select: { id: true, buildingCode: true, roomCode: true, name: true, type: true, capacity: true } },
      },
    }),
    prisma.room.findMany({
      where: { institutionId },
      select: { id: true, buildingCode: true, roomCode: true, name: true, type: true, capacity: true, status: true },
    }),
    prisma.bookingHold.count({
      where: { room: { institutionId }, status: "active", expiresAt: { gt: now } },
    }),
  ]);

  // Summary counts
  const todayCount = allBookings.filter(
    (b) => b.startAt >= startOfToday && b.startAt <= endOfToday
  ).length;
  const thisWeekCount = allBookings.filter(
    (b) => b.startAt >= monday && b.startAt <= sunday
  ).length;
  const totalBookings = allBookings.length;

  const statusCounts: Record<string, number> = {};
  for (const b of allBookings) {
    statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
  }

  const cancelled = statusCounts["cancelled"] ?? 0;
  const cancellationRate = totalBookings > 0 ? Math.round((cancelled / totalBookings) * 100) : 0;

  const totalDurationMs = allBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()), 0);
  const nonCancelledCount = totalBookings - cancelled;
  const avgDurationMinutes = nonCancelledCount > 0
    ? Math.round(totalDurationMs / nonCancelledCount / 60_000)
    : 0;

  // Room status summary
  const roomsSummary = {
    free: rooms.filter((r) => r.status === "free").length,
    reserved: rooms.filter((r) => r.status === "reserved").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    unavailable: rooms.filter((r) => r.status === "unavailable").length,
    total: rooms.length,
  };

  // Bookings by day (last 14 days)
  const dayMap: Record<string, number> = {};
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 13);
  for (let d = new Date(fourteenDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const b of allBookings) {
    const key = new Date(b.startAt).toISOString().slice(0, 10);
    if (key in dayMap) dayMap[key]++;
  }
  const bookingsByDay = Object.entries(dayMap).map(([date, count]) => ({ date, count }));

  // Peak hours
  const hourMap: Record<number, number> = {};
  for (let h = 0; h < 24; h++) hourMap[h] = 0;
  for (const b of allBookings.filter((b) => b.status !== "cancelled")) {
    hourMap[new Date(b.startAt).getHours()]++;
  }
  const peakHours = Object.entries(hourMap)
    .map(([h, count]) => ({ hour: Number(h), count }))
    .sort((a, b) => a.hour - b.hour);

  // Top rooms by booking count
  const roomBookingMap: Record<string, { count: number; totalMinutes: number; roomCode: string; buildingCode: string; name: string }> = {};
  for (const b of allBookings.filter((bk) => bk.status !== "cancelled")) {
    if (!roomBookingMap[b.roomId]) {
      roomBookingMap[b.roomId] = {
        count: 0,
        totalMinutes: 0,
        roomCode: b.room.roomCode,
        buildingCode: b.room.buildingCode,
        name: b.room.name,
      };
    }
    roomBookingMap[b.roomId].count++;
    roomBookingMap[b.roomId].totalMinutes += Math.round(
      (new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60_000
    );
  }
  const topRooms = Object.entries(roomBookingMap)
    .map(([roomId, v]) => ({
      roomId,
      roomCode: v.roomCode,
      buildingCode: v.buildingCode,
      name: v.name,
      count: v.count,
      totalMinutes: v.totalMinutes,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Utilization (assumes 12 working hours/day over 30 days)
  const availableMinutesPerRoom = 12 * 60 * 30;
  const utilizationByRoom = rooms.map((room) => {
    const hoursBooked = (roomBookingMap[room.id]?.totalMinutes ?? 0) / 60;
    const utilizationPct = availableMinutesPerRoom > 0
      ? Math.min(100, Math.round((hoursBooked * 60) / availableMinutesPerRoom * 100))
      : 0;
    return {
      roomId: room.id,
      roomCode: room.roomCode,
      buildingCode: room.buildingCode,
      name: room.name,
      type: room.type,
      capacity: room.capacity,
      hoursBooked: Math.round(hoursBooked * 10) / 10,
      utilizationPct,
      bookingCount: roomBookingMap[room.id]?.count ?? 0,
    };
  }).sort((a, b) => b.utilizationPct - a.utilizationPct);

  return NextResponse.json({
    summary: {
      totalBookings,
      todayCount,
      thisWeekCount,
      avgDurationMinutes,
      cancellationRate,
      activeHoldsCount: activeHolds,
      statusCounts,
    },
    roomsSummary,
    bookingsByDay,
    peakHours,
    topRooms,
    utilizationByRoom,
  });
}
