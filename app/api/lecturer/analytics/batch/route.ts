/**
 * POST /api/lecturer/analytics/batch
 *
 * Returns per-unit attendance analytics + assignment/material counts for a
 * list of unit codes in a single call.
 *
 * Auth: Bearer lecturer JWT
 *
 * Request body:
 *   { "unitCodes": ["SCH 2170", "CHE 3101"] }
 *
 * Response — plain object keyed by the EXACT unit code string as supplied in
 * the request (same case, same spaces):
 *   {
 *     "SCH 2170": {
 *       "enrolledStudents": 45,
 *       "conductedSessions": 12,
 *       "totalPresent": 432,
 *       "avgAttended": 36,
 *       "attendancePercent": 80,
 *       "assignments": 3,
 *       "materials": 7
 *     }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

const FIVE_MIN_MS = 5 * 60 * 1000;

/** Strip all non-alphanumeric chars, uppercase — used to match across DB representations */
const norm = (c: string) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Count how many times `dayName` (e.g. "Monday") falls within [start, end] inclusive.
 * Used to expand recurring timetable entries into a planned-session count.
 */
function countDayOccurrences(dayName: string, start: Date, end: Date): number {
  const DAY_INDEX: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const idx = DAY_INDEX[dayName.toLowerCase()];
  if (idx === undefined) return 0;
  let count = 0;
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (d.getTime() <= endMs) {
    if (d.getUTCDay() === idx) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { unitCodes?: unknown; startDate?: unknown; endDate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const { unitCodes, startDate: startDateRaw, endDate: endDateRaw } = body;
  if (!Array.isArray(unitCodes) || unitCodes.length === 0) {
    return NextResponse.json(
      { error: "unitCodes is required and must be a non-empty array" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Parse optional date range — used for plannedSessions calculation.
  // If absent, plannedSessions and completionRate are omitted from the response.
  let parsedStart: Date | null = null;
  let parsedEnd:   Date | null = null;
  if (typeof startDateRaw === "string" && typeof endDateRaw === "string") {
    const s = new Date(startDateRaw + "T00:00:00.000Z");
    const e = new Date(endDateRaw   + "T23:59:59.999Z");
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      parsedStart = s;
      parsedEnd   = e;
    }
  }

  // Build norm → first-seen request key map (preserve original string as response key)
  const normToRequestKey = new Map<string, string>();
  const normCodes: string[] = [];
  for (const c of unitCodes) {
    if (typeof c !== "string") continue;
    const n = norm(c);
    if (!normToRequestKey.has(n)) {
      normToRequestKey.set(n, c);
      normCodes.push(n);
    }
  }
  if (normCodes.length === 0) {
    return NextResponse.json(
      { error: "unitCodes must contain valid unit code strings" },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    // ── 1. Resolve units ───────────────────────────────────────────────────
    const units = await prisma.$queryRaw<{ id: string; code: string }[]>(
      Prisma.sql`
        SELECT id, code
        FROM "Unit"
        WHERE UPPER(REPLACE(code, ' ', '')) IN (${Prisma.join(normCodes)})
      `,
    );

    const normToUnit = new Map(units.map((u) => [norm(u.code), u]));
    const unitIds = units.map((u) => u.id);
    const rawUnitCodes = units.map((u) => u.code);
    // OnlineAttendanceSession stores the normalizeUnitCode() output at creation ("SCH 2170" format)
    const normalisedUnitCodes = rawUnitCodes.map(normalizeUnitCode);

    // ── 2. Parallel fetch ─────────────────────────────────────────────────
    const [
      enrollmentCounts,
      onlineSessions,
      offlineSessions,
      delegationSessions,
      offlineRecords,
      timetableEntries,
      assignmentCounts,
      materialCounts,
    ] = await Promise.all([
      // Enrolled students per unit
      unitIds.length > 0
        ? prisma.enrollment.groupBy({
            by: ["unitId"],
            where: { unitId: { in: unitIds } },
            _count: { studentId: true },
          })
        : Promise.resolve([] as { unitId: string; _count: { studentId: number } }[]),

      // Online ended sessions — stored with normalizeUnitCode() at creation ("SCH 2170" format)
      normalisedUnitCodes.length > 0
        ? prisma.onlineAttendanceSession.findMany({
            where: { lecturerId, unitCode: { in: normalisedUnitCodes }, endedAt: { not: null } },
            select: { unitCode: true, _count: { select: { records: true } } },
          })
        : Promise.resolve([] as { unitCode: string; _count: { records: number } }[]),

      // Offline sessions (unitCode stored normalised — no spaces, uppercase).
      // Exclude lectureRoom = 'ONLINE': those rows are registered by the app's
      // sync-on-create for online sessions and are already counted via onlineSessions.
      normCodes.length > 0
        ? prisma.conductedSession.findMany({
            where: { lecturerId, unitCode: { in: normCodes }, NOT: { lectureRoom: "ONLINE" } },
            select: { unitCode: true, sessionStart: true },
          })
        : Promise.resolve([] as { unitCode: string; sessionStart: Date }[]),

      // Delegation / GD group sessions (unitCode stored raw)
      rawUnitCodes.length > 0
        ? prisma.delegation.findMany({
            where: { createdBy: lecturerId, unitCode: { in: rawUnitCodes }, used: true },
            select: { unitCode: true, validFrom: true },
          })
        : Promise.resolve([] as { unitCode: string; validFrom: Date | bigint }[]),

      // Offline attendance records — ALL methods, INNER JOINed to this lecturer's
      // ConductedSession rows so marks from other lecturers are excluded.
      // Exclude lectureRoom = 'ONLINE' sessions: those students are counted via
      // onlineSessions._count.records (OnlineAttendanceRecord), not here.
      normCodes.length > 0
        ? prisma.$queryRaw<{ unitCode: string }[]>(
            Prisma.sql`
              SELECT UPPER(REPLACE(oar."unitCode", ' ', '')) AS "unitCode"
              FROM   "OfflineAttendanceRecord" oar
              INNER JOIN "ConductedSession" cs
                ON  UPPER(REPLACE(cs."unitCode", ' ', '')) = UPPER(REPLACE(oar."unitCode", ' ', ''))
                AND cs."sessionStart" = oar."sessionStart"
                AND cs."lecturerId"   = ${lecturerId}
                AND UPPER(cs."lectureRoom") != 'ONLINE'
              WHERE  UPPER(REPLACE(oar."unitCode", ' ', '')) IN (${Prisma.join(normCodes)})
            `,
          )
        : Promise.resolve([] as { unitCode: string }[]),

      // Timetable entries for planned-session calculation — only needed when a
      // date range was supplied. Fetch all non-cancelled entries for this lecturer
      // across all resolved unit IDs.
      unitIds.length > 0 && parsedStart
        ? prisma.timetable.findMany({
            where: { lecturerId, unitId: { in: unitIds }, status: { not: "cancelled" } },
            select: { unitId: true, day: true },
          })
        : Promise.resolve([] as { unitId: string; day: string }[]),

      // Assignment counts per unitId
      unitIds.length > 0
        ? prisma.assignment.groupBy({
            by: ["unitId"],
            where: { unitId: { in: unitIds } },
            _count: { id: true },
          })
        : Promise.resolve([] as { unitId: string; _count: { id: number } }[]),

      // Material counts per unitId
      unitIds.length > 0
        ? prisma.material.groupBy({
            by: ["unitId"],
            where: { unitId: { in: unitIds } },
            _count: { id: true },
          })
        : Promise.resolve([] as { unitId: string; _count: { id: number } }[]),
    ]);

    // ── 3. Build lookup maps ───────────────────────────────────────────────
    const enrolledMap = new Map(enrollmentCounts.map((e) => [e.unitId, e._count.studentId]));
    const assignMap = new Map(assignmentCounts.map((a) => [a.unitId, a._count.id]));
    const matMap = new Map(materialCounts.map((m) => [m.unitId, m._count.id]));

    // Build offline session-time map (for delegation dedup)
    const offlineTimeMap = new Map<string, number[]>();
    for (const s of offlineSessions) {
      const key = norm(s.unitCode);
      const ms = s.sessionStart.getTime();
      const times = offlineTimeMap.get(key) ?? [];
      times.push(ms);
      offlineTimeMap.set(key, times);
    }

    // ── 4. Accumulate per-unit stats ───────────────────────────────────────
    type UnitStats = { conductedSessions: number; totalPresent: number };
    const statsMap = new Map<string, UnitStats>();
    const stat = (normCode: string): UnitStats => {
      if (!statsMap.has(normCode)) {
        statsMap.set(normCode, { conductedSessions: 0, totalPresent: 0 });
      }
      return statsMap.get(normCode)!;
    };

    for (const s of onlineSessions) {
      const st = stat(norm(s.unitCode));
      st.conductedSessions += 1;
      st.totalPresent += s._count.records;
    }
    for (const s of offlineSessions) {
      stat(norm(s.unitCode)).conductedSessions += 1;
    }
    // Delegation sessions not overlapping an offline session (±5 min)
    for (const d of delegationSessions) {
      const normCode = norm(d.unitCode);
      const offlineTimes = offlineTimeMap.get(normCode) ?? [];
      const delegMs = Number(d.validFrom);
      if (!offlineTimes.some((t) => Math.abs(t - delegMs) <= FIVE_MIN_MS)) {
        stat(normCode).conductedSessions += 1;
      }
    }
    // Offline marks — no longer need validOfflineKeys since the INNER JOIN already
    // scopes records to this lecturer's sessions
    for (const r of offlineRecords) {
      const normCode = norm(r.unitCode);
      stat(normCode).totalPresent += 1;
    }

    // Build planned-session map: normCode → count of timetable occurrences in date range.
    // Only populated when startDate/endDate were provided.
    const plannedMap = new Map<string, number>();
    if (parsedStart && parsedEnd) {
      // unitId → normCode reverse map
      const unitIdToNorm = new Map(units.map((u) => [u.id, norm(u.code)]));
      for (const entry of timetableEntries) {
        const normCode = unitIdToNorm.get(entry.unitId);
        if (!normCode) continue;
        const occurrences = countDayOccurrences(entry.day, parsedStart, parsedEnd);
        plannedMap.set(normCode, (plannedMap.get(normCode) ?? 0) + occurrences);
      }
    }

    // ── 5. Build response ──────────────────────────────────────────────────
    const response: Record<string, object> = {};

    for (const normCode of normCodes) {
      const requestKey = normToRequestKey.get(normCode)!;
      const unit = normToUnit.get(normCode);
      const enrolledStudents = unit ? (enrolledMap.get(unit.id) ?? 0) : 0;
      const { conductedSessions, totalPresent } = statsMap.get(normCode) ?? {
        conductedSessions: 0,
        totalPresent: 0,
      };
      const avgAttended =
        conductedSessions > 0 ? Math.round(totalPresent / conductedSessions) : 0;
      const attendancePercent =
        enrolledStudents > 0 && conductedSessions > 0
          ? Math.min(
              Math.round((totalPresent / (enrolledStudents * conductedSessions)) * 100),
              100,
            )
          : 0;
      const assignments = unit ? (assignMap.get(unit.id) ?? 0) : 0;
      const materials = unit ? (matMap.get(unit.id) ?? 0) : 0;

      const plannedSessions = parsedStart ? (plannedMap.get(normCode) ?? 0) : null;
      const completionRate =
        plannedSessions !== null && plannedSessions > 0
          ? Math.min(Math.round((conductedSessions / plannedSessions) * 100), 100)
          : plannedSessions === 0 ? null : null;

      response[requestKey] = {
        students: enrolledStudents,
        enrolledStudents,
        conductedSessions,
        totalPresent,
        avgAttended,
        attendanceRate: attendancePercent,
        attendancePercent,
        plannedSessions,
        completionRate,
        assignments,
        materials,
      };
    }

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err: unknown) {
    console.error("[lecturer/analytics/batch] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
