/**
 * POST /api/timetable/unmerge-lessons
 *
 * Lecturer-initiated unmerge: clears the merged overlay fields on all timetable
 * entries that share the given mergedSessionId, then deletes the MergedSession
 * record. The original day/startTime/endTime/room on each entry are unchanged.
 *
 * Auth: Bearer <lecturerToken>
 *
 * Body:
 * {
 *   mergedSessionId: string   – shared ID from the original merge-lessons call
 *   unitCode:        string   – used for the response and as a consistency check
 * }
 *
 * Responses:
 *   200 { success: true, message, unitCode, unmergedCount }
 *   400 – missing fields
 *   401 – not authenticated
 *   403 – lecturer does not own the entries
 *   404 – no entries found for that mergedSessionId
 *   500 – unexpected error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

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
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: corsHeaders },
    );
  }

  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: corsHeaders },
    );
  }

  const { mergedSessionId, unitCode } = body ?? {};

  if (!mergedSessionId || typeof mergedSessionId !== "string" || !mergedSessionId.trim()) {
    return NextResponse.json(
      { error: "mergedSessionId is required." },
      { status: 400, headers: corsHeaders },
    );
  }
  if (!unitCode || typeof unitCode !== "string" || !unitCode.trim()) {
    return NextResponse.json(
      { error: "unitCode is required." },
      { status: 400, headers: corsHeaders },
    );
  }

  try {
    // ── Find all entries sharing this mergedSessionId ─────────────────────
    const entries = await prisma.timetable.findMany({
      where: { mergedSessionId: mergedSessionId.trim() },
      select: { id: true, lecturerId: true },
    });

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No timetable entries found for the given mergedSessionId." },
        { status: 404, headers: corsHeaders },
      );
    }

    // ── Ownership check ───────────────────────────────────────────────────
    const unauthorized = entries.filter((e) => e.lecturerId !== lecturerId);
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: "You do not own one or more of these timetable entries." },
        { status: 403, headers: corsHeaders },
      );
    }

    // ── Clear merge overlay fields + delete MergedSession in transaction ──
    const entryIds = entries.map((e) => e.id);

    await prisma.$transaction([
      prisma.timetable.updateMany({
        where: { id: { in: entryIds } },
        data: {
          isMerged:        false,
          mergedSessionId: null,
        },
      }),
      prisma.mergedSession.deleteMany({
        where: { id: mergedSessionId.trim() },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Lessons unmerged successfully",
        unitCode: unitCode.trim().toUpperCase(),
        unmergedCount: entryIds.length,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/unmerge-lessons] error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500, headers: corsHeaders },
    );
  }
}
