/**
 * POST /api/timetable/unmerge-lessons
 *
 * Unmerges a previously-merged set of timetable entries.
 *
 * Auth: Bearer <lecturerToken> or Bearer <adminToken>
 *
 * Permission rules:
 *   - mergedBy = 'Admin'   → only admins may unmerge
 *   - mergedBy = 'Lecturer' → owning lecturer or any admin may unmerge
 *
 * Body:
 * {
 *   mergedSessionId: string
 *   unitCode:        string   (used as consistency check / response label)
 * }
 *
 * Responses:
 *   200 { message: "Session unmerged successfully." }
 *   400 – missing fields
 *   401 – not authenticated
 *   403 – lecturer tries to unmerge an admin-created merge
 *   404 – mergedSessionId not found
 *   500 – unexpected error
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminOrLecturerScope } from "@/lib/adminLecturerAuth";

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

  const { mergedSessionId, unitCode } = body ?? {};

  if (!mergedSessionId || typeof mergedSessionId !== "string" || !mergedSessionId.trim()) {
    return NextResponse.json({ error: "mergedSessionId is required." }, { status: 400, headers: corsHeaders });
  }
  // unitCode is optional — kept for response labelling only

  const sessionId = mergedSessionId.trim();

  try {
    // ── Look up the MergedSession record ──────────────────────────────────
    const mergedSession = await prisma.mergedSession.findUnique({
      where: { id: sessionId },
      select: { id: true, mergedBy: true, mergedByUserId: true, lecturerId: true },
    });

    if (!mergedSession) {
      return NextResponse.json(
        { error: "Merged session not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    // ── Permission enforcement ────────────────────────────────────────────
    if (mergedSession.mergedBy === "Admin" && role !== "admin") {
      return NextResponse.json(
        { error: "This merged session was created by an admin and cannot be unmerged by a lecturer." },
        { status: 403, headers: corsHeaders },
      );
    }

    if (mergedSession.mergedBy === "Lecturer" && role === "lecturer") {
      // Owning lecturer check: they must own at least one entry in the merge
      const ownedEntry = await prisma.timetable.findFirst({
        where: { mergedSessionId: sessionId, lecturerId: userId },
        select: { id: true },
      });
      if (!ownedEntry) {
        return NextResponse.json(
          { error: "You do not own any of the timetable entries in this merged session." },
          { status: 403, headers: corsHeaders },
        );
      }
    }

    // ── Clear merge fields + delete MergedSession in a transaction ─────────
    // First, find all timetable entries linked to this session so we can
    // also clear their mergeGroupId (used by the admin dashboard view).
    const affectedEntries = await prisma.timetable.findMany({
      where: { mergedSessionId: sessionId },
      select: { id: true, mergeGroupId: true },
    });
    const affectedIds = affectedEntries.map(e => e.id);

    await prisma.$transaction([
      prisma.timetable.updateMany({
        where: { id: { in: affectedIds } },
        data: { isMerged: false, mergedSessionId: null, mergeGroupId: null },
      }),
      prisma.mergedSession.deleteMany({
        where: { id: sessionId },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Session unmerged successfully.",
        unitCode: typeof unitCode === "string" ? unitCode.trim().toUpperCase() : undefined,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/unmerge-lessons] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500, headers: corsHeaders });
  }
}

