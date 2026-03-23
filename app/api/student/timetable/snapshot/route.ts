/**
 * GET /api/student/timetable/snapshot
 *
 * Returns the authenticated student's timetable grouped by day.
 * Supports ETag / If-None-Match for efficient polling at 30 s intervals.
 *
 * ETag = max(updatedAt) of all timetable entries the student is enrolled in.
 * Returns 304 Not Modified when the ETag matches the If-None-Match header.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match",
};

const DAY_ORDER: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header." },
      { status: 401, headers: corsHeaders },
    );
  }

  let studentId: string;
  try {
    const payload = verifyStudentAccessToken(token);
    studentId = payload.studentId;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401, headers: corsHeaders },
    );
  }

  // Find enrolled unit IDs
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { unitId: true },
  });
  const unitIds = enrollments.map((e) => e.unitId);

  if (unitIds.length === 0) {
    const empty = buildSnapshot([], 0, new Date(0));
    return NextResponse.json(
      { etag: `"0"`, snapshot: empty },
      { headers: { ...corsHeaders, ETag: `"0"` } },
    );
  }

  const entries = await prisma.timetable.findMany({
    where: { unitId: { in: unitIds } },
    include: { unit: true, room: true, lecturer: true },
  });

  // Compute ETag from the max updatedAt across all entries
  const maxUpdatedAtMs = entries.reduce(
    (max, e) => Math.max(max, e.updatedAt.getTime()),
    0,
  );
  const etag = `"${maxUpdatedAtMs}"`;

  // 304 shortcut
  const ifNoneMatch = (request.headers.get("if-none-match") ?? "").trim();
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers: corsHeaders });
  }

  const snapshot = buildSnapshot(entries, maxUpdatedAtMs, new Date(maxUpdatedAtMs));

  return NextResponse.json(
    { etag, snapshot },
    { headers: { ...corsHeaders, ETag: etag } },
  );
}

function parseStoredRescheduledTo(
  raw: string | null,
): { day: string; startTime: string; endTime: string } | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\w+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/i);
  if (!m) return null;
  return { day: m[1], startTime: m[2], endTime: m[3] };
}

function buildSnapshot(
  entries: any[],
  version: number,
  updatedAt: Date,
) {
  // Group by day
  const byDay = new Map<string, any[]>();
  const sorted = [...entries].sort((a, b) => {
    const dayA = DAY_ORDER[a.day.toLowerCase()] ?? 99;
    const dayB = DAY_ORDER[b.day.toLowerCase()] ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return a.startTime.localeCompare(b.startTime);
  });

  for (const e of sorted) {
    const day = capitalise(e.day);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({
      id: e.id,
      unit: `${e.unit?.title ?? ""} (${e.unit?.code ?? ""})`,
      unitCode: e.unit?.code ?? "",
      time: `${e.startTime} - ${e.endTime}`,
      startTime: e.startTime,
      endTime: e.endTime,
      room: e.room?.name ?? e.venueName ?? "",
      roomCode: e.room?.roomCode ?? "",
      lecturer: e.lecturer?.fullName ?? "",
      status: e.status ?? "Pending",
      reason: e.reason ?? null,
      pendingReason: e.pendingReason ?? null,
      rescheduledTo: parseStoredRescheduledTo(e.rescheduledTo),
      reschedulePermanent: e.reschedulePermanent ?? null,
      originalDay: e.originalDay ?? null,
      originalStartTime: e.originalStartTime ?? null,
      originalEndTime: e.originalEndTime ?? null,
      updatedAt: e.updatedAt?.toISOString() ?? null,
    });
  }

  const timetableByDay = Array.from(byDay.entries()).map(([day, lessons]) => ({
    day,
    lessons,
  }));

  return {
    version,
    updatedAt: updatedAt.toISOString(),
    timetableByDay,
  };
}

function capitalise(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
