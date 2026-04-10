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
  if (!unitCode || typeof unitCode !== "string" || !unitCode.trim()) {
    return NextResponse.json({ error: "unitCode is required." }, { status: 400, headers: corsHeaders });
  }

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
    await prisma.$transaction([
      prisma.timetable.updateMany({
        where: { mergedSessionId: sessionId },
        data: { isMerged: false, mergedSessionId: null },
      }),
      prisma.mergedSession.deleteMany({
        where: { id: sessionId },
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Session unmerged successfully.",
        unitCode: unitCode.trim().toUpperCase(),
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    console.error("[timetable/unmerge-lessons] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500, headers: corsHeaders });
  }
}

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
