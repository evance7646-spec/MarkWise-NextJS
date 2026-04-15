/**
 * POST /api/timetable/merge-lessons
 *
 * Merges multiple timetable entries into a single MergedSession record.
 * Supports both Lecturer-initiated and Admin-initiated merges.
 *
 * Auth: Bearer <lecturerToken> or Bearer <adminToken>
 *
 * Body:
 * {
 *   entryIds:   string[]  — IDs of timetable entries to merge (min 2)
 *   unitCode?:  string    — shared unit code
 *   roomCode?:  string    — room code / display name for the merged session
 *   roomId?:    string|number — DB room ID (optional)
 *   note?:      string    — free-text note
 *   day?:       string    — e.g. "Monday"
 *   startTime?: string    — "HH:MM"
 *   endTime?:   string    — "HH:MM"
 *   mergedBy?:  "Lecturer" | "Admin"   — defaults to caller's role
 * }
 *
 * Success 200:
 * {
 *   mergedSessionId: string,
 *   message: "Lessons merged successfully."
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminOrLecturerScope } from "@/lib/adminLecturerAuth";
import { normalizeUnitCode } from "@/lib/unitCode";
import { buildPayloadsForStudents, sendPushNotificationBatch } from "@/lib/pushNotification";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  // ── Auth — accept lecturer or admin token ─────────────────────────────────
  const scope = resolveAdminOrLecturerScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status, headers: corsHeaders });
  }
  const { role, userId } = scope;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders });
  }

  const {
    entryIds,
    unitCode,
    roomCode,
    roomId,
    note,
    day,
    startTime,
    endTime,
    mergedBy: rawMergedBy,
    // Legacy field aliases the old app may still send:
    mergedRoom,
    mergedRoomId,
    mergedDay,
    mergedStartTime,
    mergedEndTime,
    mergedNote,
  } = body ?? {};

  // ── Validate entryIds ─────────────────────────────────────────────────────
  if (!Array.isArray(entryIds) || entryIds.length < 2) {
    return NextResponse.json(
      { error: "entryIds must be an array of at least 2 timetable entry IDs." },
      { status: 400, headers: corsHeaders },
    );
  }
  const ids: string[] = [...new Set((entryIds as unknown[]).map(String))];

  // ── Resolve mergedBy ───────────────────────────────────────────────────────
  // The app sends "Lecturer" or "Admin". Fall back to caller's actual role.
  const resolvedMergedBy: "Lecturer" | "Admin" =
    rawMergedBy === "Admin" || rawMergedBy === "Lecturer"
      ? (rawMergedBy as "Lecturer" | "Admin")
      : role === "admin" ? "Admin" : "Lecturer";

  // If app says "Admin" but caller is lecturer → reject
  if (resolvedMergedBy === "Admin" && role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can create admin-merged sessions." },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Fetch entries ─────────────────────────────────────────────────────────
  const entries = await prisma.timetable.findMany({
    where: { id: { in: ids } },
    include: { unit: { select: { code: true } } },
  });

  if (entries.length !== ids.length) {
    const found = new Set(entries.map((e) => e.id));
    const missing = ids.filter((id) => !found.has(id));
    return NextResponse.json(
      { error: `Timetable entries not found: ${missing.join(", ")}` },
      { status: 400, headers: corsHeaders },
    );
  }

  // ── Conflict check: any entry already merged? ─────────────────────────────
  const alreadyMerged = entries.filter((e) => e.isMerged && e.mergedSessionId);
  if (alreadyMerged.length > 0) {
    return NextResponse.json(
      { error: "One or more entries are already part of a merged session." },
      { status: 409, headers: corsHeaders },
    );
  }

  // ── Ownership check for lecturers ─────────────────────────────────────────
  if (role === "lecturer") {
    const ownedIds = new Set(entries.filter((e) => e.lecturerId === userId).map((e) => e.id));
    if (ownedIds.size === 0) {
      return NextResponse.json(
        { error: "You must own at least one of the timetable entries to merge them." },
        { status: 403, headers: corsHeaders },
      );
    }
  }

  // ── Normalize field values (accept both old + new field names) ─────────────
  const effectiveRoomCode    = (roomCode ?? mergedRoom   ?? null) as string | null;
  const effectiveRoomId      = (roomId   ?? mergedRoomId ?? null);
  const effectiveDay         = (day      ?? mergedDay    ?? null) as string | null;
  const effectiveStartTime   = (startTime ?? mergedStartTime ?? null) as string | null;
  const effectiveEndTime     = (endTime   ?? mergedEndTime   ?? null) as string | null;
  const effectiveNote        = (note      ?? mergedNote      ?? null) as string | null;
  const effectiveUnitCode    = unitCode
    ? normalizeUnitCode(unitCode as string)
    : (entries[0]?.unit?.code ? normalizeUnitCode(entries[0].unit.code) : null);

  // ── Institution — pull from first entry's department → institution ─────────
  const firstEntry = entries[0];
  const department = firstEntry.departmentId
    ? await prisma.department.findUnique({
        where: { id: firstEntry.departmentId },
        select: { institutionId: true },
      })
    : null;
  const institutionId = department?.institutionId ?? null;

  try {
    // Collect all unit codes from the entries being merged
    const mergedUnitCodes = [
      ...new Set(
        entries
          .map(e => e.unit?.code ? normalizeUnitCode(e.unit.code) : null)
          .filter((c): c is string => !!c),
      ),
    ];

    // ── Transaction: create MergedSession + mark entries ───────────────────
    const mergedSession = await prisma.$transaction(async (tx) => {
      const session = await tx.mergedSession.create({
        data: {
          mergedBy:       resolvedMergedBy,
          mergedByUserId: userId,
          lecturerId:     (role === "lecturer" ? userId : null) as string,
          unitCode:       effectiveUnitCode,
          mergedUnitCodes,
          mergedRoom:     effectiveRoomCode,
          mergedRoomId:   effectiveRoomId ? String(effectiveRoomId) : null,
          mergedDay:      effectiveDay,
          mergedStartTime: effectiveStartTime,
          mergedEndTime:  effectiveEndTime,
          mergedNote:     effectiveNote,
          institutionId,
        },
      });

      await tx.timetable.updateMany({
        where: { id: { in: ids } },
        data: {
          isMerged:        true,
          mergedSessionId: session.id,
        },
      });

      return session;
    });

    return NextResponse.json(
      {
        success: true,
        mergedSessionId: mergedSession.id,
        message: "Lessons merged successfully.",
        mergedCount: ids.length,
      },
      { status: 200, headers: corsHeaders },
    );

    // ── Fire-and-forget: notify enrolled students ─────────────────────────
    // (runs after response is returned — failures are logged, not thrown)
    Promise.resolve().then(async () => {
      try {
        // Collect all unitIds from the merged timetable entries
        const unitIds = [
          ...new Set(entries.map((e) => e.unitId).filter((id): id is string => !!id)),
        ];
        if (unitIds.length === 0) return;

        // Get unit info for notification data (use first entry's unit as canonical)
        const units = await prisma.unit.findMany({
          where: { id: { in: unitIds } },
          select: { id: true, code: true, title: true },
        });
        const canonicalUnit = units[0];
        if (!canonicalUnit) return;

        // Find all enrolled student IDs
        const enrollments = await prisma.enrollment.findMany({
          where: { unitId: { in: unitIds } },
          select: { studentId: true },
        });
        const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
        if (studentIds.length === 0) return;

        const mergedUnitCodes = units.map((u) => normalizeUnitCode(u.code)).join(",");
        const newUnitCode = normalizeUnitCode(effectiveUnitCode ?? canonicalUnit.code);
        const newUnitName = canonicalUnit.title ?? newUnitCode;

        const payloads = await buildPayloadsForStudents(studentIds, {
          title: "Unit Update",
          body: `Your units have been merged into ${newUnitName} (${newUnitCode}). Please refresh your timetable.`,
          data: {
            type: "unit_merged",
            mergedUnits: mergedUnitCodes,
            newUnitCode,
            newUnitName,
          },
        });
        await sendPushNotificationBatch(payloads);
      } catch (notifyErr) {
        console.error("[merge-lessons] FCM notification failed:", notifyErr);
      }
    });
  } catch (err) {
    console.error("[timetable/merge-lessons] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500, headers: corsHeaders });
  }
}
