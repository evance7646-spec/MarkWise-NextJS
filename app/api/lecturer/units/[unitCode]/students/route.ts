/**
 * GET /api/lecturer/units/:unitCode/students
 *
 * Returns the full roster of students enrolled in the given unit so the
 * app can cache them locally (SQLite) for offline manual-mark lookups.
 *
 * Auth: Bearer lecturer JWT
 * Path param: unitCode — normalized (strip spaces, uppercase) before any query
 *
 * Authorization gate:
 *   Lecturer must belong to the same institution as the unit (institutionId
 *   from DB record, or ?institutionId query param as fallback if the JWT
 *   payload does not carry it). No timetable-assignment check is required.
 *
 * Enrollment source: StudentEnrollmentSnapshot.unitCodes (String[])
 * — the Enrollment join-table is NOT used; enrollment POST only writes snapshots.
 *
 * Response 200: [{ studentId, studentName, admissionNumber }]
 *   Empty unit → [] (not 404)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

export const runtime = "nodejs";

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
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Normalize unit code ───────────────────────────────────────────────────
  const { unitCode: rawParam } = await params;
  const unitCode = decodeURIComponent(rawParam).replace(/\s+/g, "").toUpperCase();
  if (!unitCode) {
    return NextResponse.json(
      { message: "unitCode is required" },
      { status: 400, headers: corsHeaders },
    );
  }

  // ── Resolve institutionId ────────────────────────────────────────────────
  // Primary: look up from the Lecturer record.
  // Fallback: ?institutionId query param sent by the app.
  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerId },
    select: { institutionId: true },
  });
  const institutionId =
    lecturer?.institutionId ??
    (req.nextUrl.searchParams.get("institutionId")?.trim() || null);
  if (!institutionId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Find the unit (case-insensitive match on stored code) ─────────────────
  // Unit.code may have variant spacing — normalize on DB side too.
  const unitRows = await prisma.$queryRaw<{ id: string; departmentId: string }[]>`
    SELECT id, "departmentId"
    FROM "Unit"
    WHERE UPPER(REPLACE(code, ' ', '')) = ${unitCode}
    LIMIT 1
  `;
  if (unitRows.length === 0) {
    // Unit not in DB — no enrolled students possible
    return NextResponse.json([], { status: 200, headers: corsHeaders });
  }
  const unit = unitRows[0];

  // ── Institution boundary check ────────────────────────────────────────────
  // Unit → Department → institutionId must match the resolved institutionId.
  // No timetable-assignment check — any lecturer from the same institution
  // may fetch the roster.
  const department = await prisma.department.findUnique({
    where: { id: unit.departmentId },
    select: { institutionId: true },
  });
  if (!department || department.institutionId !== institutionId) {
    return NextResponse.json(
      { message: "Forbidden: unit does not belong to your institution" },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Fetch enrolled students ───────────────────────────────────────────────
  // Enrollment is stored in StudentEnrollmentSnapshot.unitCodes (String[]).
  // Normalize stored codes at query time — handles "SCH 2170" == "SCH2170".
  // Also filter by institutionId to prevent cross-institution data leaks.
  const students = await prisma.$queryRaw<
    { studentId: string; studentName: string; admissionNumber: string }[]
  >`
    SELECT
      s.id              AS "studentId",
      s.name            AS "studentName",
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
  `;

  return NextResponse.json(students, { status: 200, headers: corsHeaders });
}
