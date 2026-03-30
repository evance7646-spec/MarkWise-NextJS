/**
 * GET /api/attendance/manual-mark/lookup
 *
 * Lecturer looks up a student by admission number before manually marking
 * them present. Returns enrollment status so the app can gate the mark step.
 *
 * Auth: Bearer lecturer JWT
 * Query params:
 *   admissionNumber  string  required
 *   unitCode         string  required
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

export async function GET(req: NextRequest) {
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

  // ── Query params ──────────────────────────────────────────────────────────
  const rawAdmission = req.nextUrl.searchParams.get("admissionNumber")?.trim() ?? "";
  const rawUnitCode = req.nextUrl.searchParams.get("unitCode")?.trim() ?? "";

  if (!rawAdmission || !rawUnitCode) {
    return NextResponse.json(
      { message: "admissionNumber and unitCode are required" },
      { status: 400, headers: corsHeaders },
    );
  }

  const unitCode = rawUnitCode.replace(/\s+/g, "").toUpperCase();

  // ── Fetch lecturer's institution ──────────────────────────────────────────
  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerId },
    select: { institutionId: true },
  });
  if (!lecturer) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Find student by admission number (case-insensitive) ──────────────────
  const student = await prisma.student.findFirst({
    where: {
      admissionNumber: { equals: rawAdmission, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      admissionNumber: true,
      institutionId: true,
    },
  });

  if (!student) {
    return NextResponse.json(
      { message: "Student not found" },
      { status: 404, headers: corsHeaders },
    );
  }

  // ── Institution scope guard ───────────────────────────────────────────────
  if (student.institutionId !== lecturer.institutionId) {
    return NextResponse.json(
      { message: "Student does not belong to your institution" },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Enrollment check ─────────────────────────────────────────────────────
  // Enrollment is stored in StudentEnrollmentSnapshot.unitCodes (string[]).
  // Normalize both sides: uppercase, strip spaces.
  const snapshot = await prisma.studentEnrollmentSnapshot.findUnique({
    where: { studentId: student.id },
    select: { unitCodes: true },
  });
  const normalize = (c: string) => c.replace(/\s+/g, "").toUpperCase();
  const isEnrolled =
    snapshot?.unitCodes.some((uc) => normalize(uc) === unitCode) ?? false;

  return NextResponse.json(
    {
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admissionNumber,
      isEnrolled,
    },
    { status: 200, headers: corsHeaders },
  );
}
