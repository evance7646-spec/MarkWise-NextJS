/**
 * POST /api/timetable/merge-lessons
 *
 * Lecturer-initiated merge: links multiple existing timetable entries into a
 * single joint MergedSession record and marks each entry with isMerged = true.
 *
 * Auth: Bearer <lecturerToken>
 *
 * Body:
 * {
 *   entryIds:       string[]  – IDs of timetable entries to merge
 *   mergedRoom?:    string    – display name of the venue for the merged class
 *   mergedRoomId?:  string    – DB room ID (optional)
 *   mergedDay?:     string    – e.g. "Wednesday"
 *   mergedStartTime?: string  – "HH:MM"
 *   mergedEndTime?:   string  – "HH:MM"
 *   mergedNote?:    string    – free-text note shown to students
 * }
 *
 * Success 200:
 * {
 *   success: true,
 *   mergedSessionId: string,
 *   mergedCount: number
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { normalizeUnitCode } from "@/lib/unitCode";

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
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: corsHeaders });
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401, headers: corsHeaders });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: corsHeaders });
  }

  const {
    entryIds,
    mergedRoom,
    mergedRoomId,
    mergedDay,
    mergedStartTime,
    mergedEndTime,
    mergedNote,
  } = body ?? {};

  // ── Validate entryIds ────────────────────────────────────────────────────
  if (!Array.isArray(entryIds) || entryIds.length < 2) {
    return NextResponse.json(
      { error: "entryIds must be an array of at least 2 timetable entry IDs." },
      { status: 400, headers: corsHeaders },
    );
  }
  const ids: string[] = [...new Set((entryIds as any[]).map(String))];

  // ── Fetch the target entries ──────────────────────────────────────────────
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

  // ── Ownership check: every entry must belong to this lecturer ─────────────
  const unauthorized = entries.filter((e) => e.lecturerId !== lecturerId);
  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: "You are not assigned to one or more of these timetable entries." },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Unit code consistency: all entries must share the same unit code ───────
  const unitCodes = [
    ...new Set(entries.map((e) => normalizeUnitCode(e.unit?.code ?? ""))),
  ].filter(Boolean);
  if (unitCodes.length > 1) {
    return NextResponse.json(
      {
        error: `All entries must share the same unit code. Found: ${unitCodes.join(", ")}`,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    // ── Create MergedSession and mark entries in a transaction ────────────────
    const mergedSession = await prisma.$transaction(async (tx) => {
      const session = await tx.mergedSession.create({
        data: {
          lecturerId,
          mergedRoom:      mergedRoom     ?? null,
          mergedRoomId:    mergedRoomId   ?? null,
          mergedDay:       mergedDay      ?? null,
          mergedStartTime: mergedStartTime ?? null,
          mergedEndTime:   mergedEndTime  ?? null,
          mergedNote:      mergedNote     ?? null,
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
        mergedCount: ids.length,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/merge-lessons] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500, headers: corsHeaders });
  }
}
