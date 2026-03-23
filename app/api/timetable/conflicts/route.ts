/**
 * GET /api/timetable/conflicts
 *
 * Pre-flight conflict check for timetable creators.
 *
 * Query params (all required unless noted):
 *   roomId       – target room
 *   day          – e.g. "Monday"
 *   startTime    – "09:00"
 *   endTime      – "11:00"
 *   unitId       – unit being scheduled
 *   lecturerId   – lecturer being assigned
 *   institutionId – needed for capacity check enrollment count
 *   excludeId    – (optional) timetable entry id to exclude (use when editing)
 *
 * Response shape:
 * {
 *   roomConflict:     null | { id, unitCode, unitTitle, departmentName, lecturerName }
 *   lecturerConflict: null | { id, unitCode, roomName, departmentName }
 *   mergeCandidate:   null | { id, unitCode, departmentName, departmentId, mergeGroupId }
 *   unitDuplicate:    null | { id, roomName, roomCode, departmentName }
 *   capacityWarning:  null | { enrolled: number, capacity: number }
 * }
 *
 * HTTP 200 is always returned — the caller inspects the payload.
 * roomConflict and lecturerConflict are hard blocks; the others are warnings.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Returns true when two HH:MM time ranges overlap (exclusive boundary). */
function timesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId       = searchParams.get("roomId");
  const day          = searchParams.get("day");
  const startTime    = searchParams.get("startTime");
  const endTime      = searchParams.get("endTime");
  const unitId       = searchParams.get("unitId");
  const lecturerId   = searchParams.get("lecturerId");
  const excludeId    = searchParams.get("excludeId") ?? undefined;

  if (!roomId || !day || !startTime || !endTime || !unitId || !lecturerId) {
    return NextResponse.json(
      { error: "roomId, day, startTime, endTime, unitId and lecturerId are required." },
      { status: 400, headers: corsHeaders },
    );
  }

  // ── Fetch all timetable entries for this room+day and for the lecturer ──
  const [roomEntries, lecturerEntries, room, enrollmentCount] = await Promise.all([
    prisma.timetable.findMany({
      where: {
        roomId,
        day,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Statuses that are "active" — ignore cancelled entries
        status: { notIn: ["Cancelled"] },
      },
      include: { unit: true, department: true, lecturer: true },
    }),
    prisma.timetable.findMany({
      where: {
        lecturerId,
        day,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        status: { notIn: ["Cancelled"] },
      },
      include: { unit: true, room: true, department: true },
    }),
    prisma.room.findUnique({ where: { id: roomId }, select: { capacity: true } }),
    // Count students enrolled in this unit (proxy for room occupancy)
    prisma.enrollment.count({ where: { unitId } }),
  ]);

  // ── 1. Room conflicts ─────────────────────────────────────────────────────
  let roomConflict: object | null = null;
  let mergeCandidate: object | null = null;

  for (const entry of roomEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;

    if (entry.unitId === unitId) {
      // Same room, same unit, overlapping time → merge candidate
      mergeCandidate = {
        id: entry.id,
        unitCode: entry.unit?.code ?? null,
        unitTitle: entry.unit?.title ?? null,
        departmentName: entry.department?.name ?? null,
        departmentId: entry.departmentId,
        mergeGroupId: (entry as any).mergeGroupId ?? null,
      };
    } else {
      // Different unit → hard room conflict
      roomConflict = {
        id: entry.id,
        unitCode: entry.unit?.code ?? null,
        unitTitle: entry.unit?.title ?? null,
        departmentName: entry.department?.name ?? null,
        lecturerName: entry.lecturer?.fullName ?? null,
        startTime: entry.startTime,
        endTime: entry.endTime,
      };
    }

    // A room can only have one hard conflict — stop after first
    if (roomConflict) break;
  }

  // ── 2. Lecturer conflicts ─────────────────────────────────────────────────
  let lecturerConflict: object | null = null;

  for (const entry of lecturerEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;
    // Same room / same unit already handled above; skip echo
    if (entry.roomId === roomId && entry.unitId === unitId) continue;

    lecturerConflict = {
      id: entry.id,
      unitCode: entry.unit?.code ?? null,
      unitTitle: entry.unit?.title ?? null,
      roomName: entry.room?.name ?? null,
      roomCode: entry.room?.roomCode ?? null,
      departmentName: entry.department?.name ?? null,
      startTime: entry.startTime,
      endTime: entry.endTime,
    };
    break;
  }

  // ── 3. Unit duplicate in another room (student clash) ────────────────────
  //    Same unitId, same day, overlapping time, but DIFFERENT room
  let unitDuplicate: object | null = null;

  const unitEntries = await prisma.timetable.findMany({
    where: {
      unitId,
      day,
      roomId: { not: roomId },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      status: { notIn: ["Cancelled"] },
    },
    include: { room: true, department: true },
    take: 1,
  });

  for (const entry of unitEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;
    unitDuplicate = {
      id: entry.id,
      roomName: entry.room?.name ?? null,
      roomCode: entry.room?.roomCode ?? null,
      departmentName: entry.department?.name ?? null,
      startTime: entry.startTime,
      endTime: entry.endTime,
    };
    break;
  }

  // ── 4. Capacity warning ───────────────────────────────────────────────────
  let capacityWarning: object | null = null;
  if (room && enrollmentCount > room.capacity) {
    capacityWarning = { enrolled: enrollmentCount, capacity: room.capacity };
  }

  return NextResponse.json(
    { roomConflict, lecturerConflict, mergeCandidate, unitDuplicate, capacityWarning },
    { headers: corsHeaders },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
