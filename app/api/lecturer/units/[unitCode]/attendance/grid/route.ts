/**
 * GET /api/lecturer/units/:unitCode/attendance/grid
 *
 * Returns a session-by-session attendance grid for the given unit.
 * Rows = enrolled students, columns = conducted sessions (LEC1 … LECN).
 *
 * Auth:  Bearer lecturer JWT
 * 401   token missing or invalid
 * 403   lecturer not timetable-assigned to this unit
 * 404   unit not found
 * 200 { sessions: [], students: [] }   unit exists but no sessions conducted yet
 *
 * Response shape:
 * {
 *   sessions: ["LEC1", "LEC2", …],        // ordered column labels
 *   students: [                            // sorted alphabetically by name
 *     {
 *       admissionNumber: string,
 *       name: string,
 *       attendance: boolean[]              // index-aligned with sessions[]
 *     },
 *     …
 *   ]
 * }
 *
 * Sessions include both offline ConductedSessions (QR/BLE/Manual/GD) and
 * ended OnlineAttendanceSessions, merged and ordered by time ascending.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

export const runtime = "nodejs";

const PRESENT_METHODS = ["qr", "ble", "manual", "manual_lecturer", "proxy_leader", "GD"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ unitCode: string }> },
) {
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

  // ── Normalize unit code ───────────────────────────────────────────────────
  const { unitCode: rawParam } = await params;
  const unitCode = decodeURIComponent(rawParam).replace(/\s+/g, "").toUpperCase();
  if (!unitCode) {
    return NextResponse.json(
      { error: "Unit not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  try {
    // ── Resolve unit (case-insensitive, space-tolerant) ───────────────────────
    const unitRows = await prisma.$queryRaw<
      { id: string; code: string }[]
    >`
      SELECT id, code
      FROM "Unit"
      WHERE UPPER(REPLACE(code, ' ', '')) = ${unitCode}
      LIMIT 1
    `;
    if (unitRows.length === 0) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404, headers: corsHeaders },
      );
    }
    const unit = unitRows[0];
    // OnlineAttendanceSession stores the raw (un-normalised) unit code
    const rawUnitCode = unit.code;

    // ── Authorization: lecturer must be timetable-assigned to this unit ───────
    const timetableEntry = await prisma.timetable.findFirst({
      where: { lecturerId, unitId: unit.id },
      select: { id: true },
    });
    if (!timetableEntry) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: corsHeaders },
      );
    }

    // ── Resolve institution (needed for enrollment snapshot query) ────────────
    const lecturer = await prisma.lecturer.findUnique({
      where: { id: lecturerId },
      select: { institutionId: true },
    });
    if (!lecturer?.institutionId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }
    const { institutionId } = lecturer;

    // ── Parallel fetch: students + conducted sessions ─────────────────────────
    const [enrolledStudents, offlineSessions, onlineSessions, delegationSessions] = await Promise.all([
      // Enrolled students sorted alphabetically by name
      prisma.$queryRaw<
        { studentId: string; name: string; admissionNumber: string }[]
      >`
        SELECT
          s.id              AS "studentId",
          s.name            AS "name",
          s."admissionNumber"
        FROM "StudentEnrollmentSnapshot" es
        JOIN "Student" s ON s.id = es."studentId"
        WHERE s."institutionId" = ${institutionId}
          AND EXISTS (
            SELECT 1
            FROM unnest(es."unitCodes") AS uc
            WHERE UPPER(REPLACE(uc, ' ', '')) = ${unitCode}
          )
        ORDER BY s.name ASC
      `,

      // Offline conducted sessions — normalization-tolerant $queryRaw so that
      // manual-mark sessions (stored with spaces) and BLE sessions (stored without)
      // are both found. sessionStart returned for the response payload.
      prisma.$queryRaw<{ id: string; sessionStart: Date; lectureRoom: string }[]>(Prisma.sql`
        SELECT id, "sessionStart", "lectureRoom"
        FROM   "ConductedSession"
        WHERE  "lecturerId" = ${lecturerId}
          AND  UPPER(REPLACE("unitCode", ' ', '')) = ${unitCode}
        ORDER BY "sessionStart" ASC
      `),

      // Online ended sessions
      prisma.onlineAttendanceSession.findMany({
        where: { lecturerId, unitCode: rawUnitCode, endedAt: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true },
      }),

      // Delegation / GD group sessions (used, created by this lecturer)
      prisma.delegation.findMany({
        where: { createdBy: lecturerId, unitCode: rawUnitCode, used: true },
        orderBy: { validFrom: "asc" },
        select: { id: true, validFrom: true },
      }),
    ]);

    // ── Merge and sort all sessions by time, dedup delegation ±5 min ─────────
    type OfflineSession  = { type: "offline";    id: string; time: Date; lectureRoom: string; sessionStart: Date };
    type OnlineSession   = { type: "online";     id: string; time: Date };
    type DelegSession    = { type: "delegation"; id: string; time: Date };
    type AnySession = OfflineSession | OnlineSession | DelegSession;

    // Session object shape returned to the mobile app — includes sessionStart (Unix ms)
    // so the app can match locally-cached manual marks to the correct column.
    interface SessionOut {
      id: string;
      sessionStart: number; // Unix ms
      lectureRoom: string;
      label: string;
    }

    const FIVE_MIN_MS = 5 * 60 * 1000;
    const offlineTimes = offlineSessions.map((s) => s.sessionStart.getTime());

    // Only include delegation sessions that don't overlap an offline session (±5 min)
    const standaloneDelSessions = delegationSessions.filter((d) => {
      const delegMs = Number(d.validFrom);
      return !offlineTimes.some((t) => Math.abs(t - delegMs) <= FIVE_MIN_MS);
    });

    const allSessions: AnySession[] = [
      ...offlineSessions.map((s): OfflineSession => ({
        type: "offline",
        id: s.id,
        time: s.sessionStart,
        lectureRoom: s.lectureRoom,
        sessionStart: s.sessionStart,
      })),
      ...onlineSessions.map((s): OnlineSession => ({
        type: "online",
        id: s.id,
        time: s.createdAt,
      })),
      ...standaloneDelSessions.map((d): DelegSession => ({
        type: "delegation",
        id: d.id,
        time: new Date(Number(d.validFrom)),
      })),
    ].sort((a, b) => a.time.getTime() - b.time.getTime());

    // No sessions yet — return empty grid (not a 404)
    if (allSessions.length === 0) {
      return NextResponse.json(
        {
          sessions: [] as SessionOut[],
          students: enrolledStudents.map((s) => ({
            studentId:       s.studentId,
            admissionNumber: s.admissionNumber,
            name:            s.name,
            attendance:      [] as boolean[],
          })),
        },
        { status: 200, headers: corsHeaders },
      );
    }

    // Build column-index lookup: sessionKey → 0-based column index
    const sessionIndexMap = new Map<string, number>();
    const sessionObjects: SessionOut[] = [];

    allSessions.forEach((s, i) => {
      let key: string;
      let out: SessionOut;
      if (s.type === "offline") {
        key = `off_${s.lectureRoom}_${s.sessionStart.getTime()}`;
        out = {
          id:           s.id,
          sessionStart: s.sessionStart.getTime(),
          lectureRoom:  s.lectureRoom,
          label:        `LEC ${i + 1}`,
        };
      } else if (s.type === "online") {
        key = `on_${s.id}`;
        out = {
          id:           s.id,
          sessionStart: s.time.getTime(),
          lectureRoom:  "",
          label:        `LEC ${i + 1}`,
        };
      } else {
        key = `del_${s.id}`;
        out = {
          id:           s.id,
          sessionStart: s.time.getTime(),
          lectureRoom:  "",
          label:        `LEC ${i + 1}`,
        };
      }
      sessionIndexMap.set(key, i);
      sessionObjects.push(out);
    });

    // ── Fetch attendance records for those sessions ───────────────────────────
    const onlineSessionIds = onlineSessions.map((s) => s.id);
    const delegationIds = standaloneDelSessions.map((d) => d.id);

    const [offlineRecords, onlineRecords, delegationRecords] = await Promise.all([
      // Use $queryRaw with UPPER(REPLACE) normalization so that manually-marked
      // sessions (stored as "SCH 2170") are matched when queried as "SCH2170".
      // INNER JOIN on ConductedSession scopes marks to this lecturer's sessions
      // and uses cs.lectureRoom / cs.sessionStart as the canonical key values
      // so they align exactly with the sessionIndexMap keys built above.
      offlineSessions.length > 0
        ? prisma.$queryRaw<{ studentId: string; lectureRoom: string; sessionStart: Date }[]>(Prisma.sql`
            SELECT DISTINCT oar."studentId", cs."lectureRoom", cs."sessionStart"
            FROM "OfflineAttendanceRecord" oar
            INNER JOIN "ConductedSession" cs
              ON  UPPER(REPLACE(cs."unitCode", ' ', '')) = UPPER(REPLACE(oar."unitCode", ' ', ''))
              AND cs."sessionStart" = oar."sessionStart"
              AND cs."lecturerId"   = ${lecturerId}
            WHERE UPPER(REPLACE(oar."unitCode", ' ', '')) = ${unitCode}
              AND oar."method" IN (${Prisma.join(PRESENT_METHODS)})
          `)
        : Promise.resolve([] as { studentId: string; lectureRoom: string; sessionStart: Date }[]),

      onlineSessionIds.length > 0
        ? prisma.onlineAttendanceRecord.findMany({
            where: { sessionId: { in: onlineSessionIds } },
            select: { studentId: true, sessionId: true },
          })
        : Promise.resolve([] as { studentId: string; sessionId: string }[]),

      // Delegation attendance: OfflineAttendanceRecord rows linked via delegationId
      delegationIds.length > 0
        ? prisma.offlineAttendanceRecord.findMany({
            where: {
              delegationId: { in: delegationIds },
              method: { in: PRESENT_METHODS },
            },
            select: { studentId: true, delegationId: true },
          })
        : Promise.resolve([] as { studentId: string; delegationId: string | null }[]),
    ]);

    // Build presence set: `${studentId}_${columnIndex}` → present
    const presenceSet = new Set<string>();

    for (const r of offlineRecords) {
      const key = `off_${r.lectureRoom}_${r.sessionStart.getTime()}`;
      const idx = sessionIndexMap.get(key);
      if (idx !== undefined) {
        presenceSet.add(`${r.studentId}_${idx}`);
      }
    }

    for (const r of onlineRecords) {
      const key = `on_${r.sessionId}`;
      const idx = sessionIndexMap.get(key);
      if (idx !== undefined) {
        presenceSet.add(`${r.studentId}_${idx}`);
      }
    }

    for (const r of delegationRecords) {
      if (!r.delegationId) continue;
      const key = `del_${r.delegationId}`;
      const idx = sessionIndexMap.get(key);
      if (idx !== undefined) {
        presenceSet.add(`${r.studentId}_${idx}`);
      }
    }

    // ── Build grid rows ───────────────────────────────────────────────────────
    const N = allSessions.length;
    const students = enrolledStudents.map((s) => ({
      studentId:       s.studentId,
      admissionNumber: s.admissionNumber,
      name:            s.name,
      attendance: Array.from({ length: N }, (_, i) =>
        presenceSet.has(`${s.studentId}_${i}`),
      ),
    }));

    return NextResponse.json(
      { sessions: sessionObjects, students },
      { status: 200, headers: corsHeaders },
    );
  } catch (err: unknown) {
    console.error("[lecturer/units/attendance/grid] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
