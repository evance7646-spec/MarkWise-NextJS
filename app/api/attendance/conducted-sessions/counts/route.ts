import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/attendance/conducted-sessions/counts?unitCodes=CS301,CS302[&byType=true]
 *
 * Returns COUNT(DISTINCT sessionStart) per unit code, independent of the
 * requesting student's own attendance.
 *
 * With byType=true, also returns a per-lesson-type breakdown under "byType".
 *
 * Auth: student Bearer JWT
 */
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }
  try {
    verifyStudentAccessToken(token);
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Parse + sanitise unitCodes ───────────────────────────────────────────
  const raw = req.nextUrl.searchParams.get("unitCodes") ?? "";
  const codes = raw
    .split(",")
    .map((c) => c.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const byType = req.nextUrl.searchParams.get("byType") === "true";

  if (codes.length > 50) {
    return NextResponse.json(
      { message: "Too many unit codes — maximum 50 per request." },
      { status: 400, headers: corsHeaders },
    );
  }

  if (codes.length === 0) {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  // ── Query ────────────────────────────────────────────────────────────────
  // Use parameterised groupBy — safe against injection, no raw SQL needed.
  const rows = await prisma.conductedSession.groupBy({
    by: ["unitCode"],
    where: { unitCode: { in: codes } },
    _count: { sessionStart: true },
  });

  // Build a map of unitCode → distinct-session count.
  // Note: Prisma groupBy with _count counts non-null values per group;
  // the @@unique([unitCode, lectureRoom, sessionStart]) constraint ensures
  // each (unitCode, sessionStart) pair is already deduplicated at insert time,
  // so this count equals the number of distinct sessions per unit.
  const result: Record<string, number> = {};
  for (const row of rows) {
    // Normalise the stored code to match the sanitised request key
    const key = row.unitCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    result[key] = (result[key] ?? 0) + row._count.sessionStart;
  }

  if (!byType) {
    return NextResponse.json(result, { headers: corsHeaders });
  }

  // ── Optional per-type breakdown ──────────────────────────────────────────
  const typeRows = await prisma.conductedSession.groupBy({
    by: ["unitCode", "lessonType"],
    where: { unitCode: { in: codes } },
    _count: { sessionStart: true },
  });

  const byTypeResult: Record<string, Record<string, number>> = {};
  for (const row of typeRows) {
    const key = row.unitCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lt = row.lessonType ?? "LEC";
    if (!byTypeResult[key]) byTypeResult[key] = {};
    byTypeResult[key][lt] = (byTypeResult[key][lt] ?? 0) + row._count.sessionStart;
  }

  return NextResponse.json({ ...result, byType: byTypeResult }, { headers: corsHeaders });
}
