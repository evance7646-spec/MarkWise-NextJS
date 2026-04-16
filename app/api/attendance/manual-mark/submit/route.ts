/**
 * POST /api/attendance/manual-mark/submit
 *
 * Lecturer manually marks a student present after physically verifying
 * their ID card. Requires a conducted session to exist for the slot.
 *
 * Auth: Bearer lecturer JWT
 * Body: {
 *   admissionNumber: string,
 *   studentId:       string,
 *   unitCode:        string,
 *   lectureRoom:     string,
 *   sessionStart:    number,  // Unix ms
 *   lecturerId:      string,
 *   markedAt:        number,  // Unix ms
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { computeAndCachePoints } from "@/lib/gamificationEngine";

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
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  let lecturerIdFromJwt: string;
  try {
    ({ lecturerId: lecturerIdFromJwt } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: {
    admissionNumber?: string;
    studentId?: string;
    unitCode?: string;
    lectureRoom?: string;
    sessionStart?: number;
    lecturerId?: string;
    markedAt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const {
    admissionNumber: rawAdmission,
    studentId,
    unitCode: rawUnitCode,
    lectureRoom: rawRoom,
    sessionStart,
    lecturerId: bodyLecturerId,
    markedAt,
  } = body;

  // ── Validate required fields ─────────────────────────────────────────────
  if (
    !rawAdmission ||
    !rawUnitCode ||
    !rawRoom ||
    typeof sessionStart !== "number" ||
    !bodyLecturerId ||
    typeof markedAt !== "number"
  ) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400, headers: corsHeaders },
    );
  }

  // ── Identity guard ────────────────────────────────────────────────────────
  // Body lecturerId must match the JWT — prevent spoofing another lecturer
  if (bodyLecturerId !== lecturerIdFromJwt) {
    return NextResponse.json(
      { message: "Lecturer identity mismatch" },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Normalise codes (spec form: uppercase, spaces stripped, non-alphanumeric stripped) ─
  const unitCode = rawUnitCode.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  const lectureRoom = rawRoom.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  // Truncate to second precision to match ConductedSession insert logic
  const sessionStartMs = Math.floor(sessionStart / 1000) * 1000;
  const sessionStartDate = new Date(sessionStartMs);
  const markedAtDate = new Date(markedAt);

  // ── Fetch lecturer's institution ──────────────────────────────────────────
  const lecturer = await prisma.lecturer.findUnique({
    where: { id: lecturerIdFromJwt },
    select: { institutionId: true },
  });
  if (!lecturer) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Verify student identity ────────────────────────────────────────────────
  // Look up by admissionNumber within the institution first.
  // If studentId is also supplied it is used as a fallback if admissionNumber
  // lookup fails, and the found record is still scoped to the institution.
  let student = await prisma.student.findFirst({
    where: {
      admissionNumber: { equals: rawAdmission.trim(), mode: "insensitive" },
      institutionId: lecturer.institutionId,
    },
    select: {
      id: true,
      name: true,
      admissionNumber: true,
      institutionId: true,
    },
  });

  if (!student && studentId) {
    // Fallback: resolve by studentId (in case admissionNumber lookup fails)
    student = await prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: lecturer.institutionId,
      },
      select: {
        id: true,
        name: true,
        admissionNumber: true,
        institutionId: true,
      },
    });
  }

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

  // ── Enrollment guard (server-side re-validation) ────────────────────────
  // Enrollment is stored in StudentEnrollmentSnapshot.unitCodes (string[]).
  const snapshot = await prisma.studentEnrollmentSnapshot.findUnique({
    where: { studentId: student.id },
    select: { unitCodes: true },
  });
  const specNormalize = (c: string) => c.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
  const isEnrolled =
    snapshot?.unitCodes.some((uc) => specNormalize(uc) === unitCode) ?? false;
  if (!isEnrolled) {
    return NextResponse.json(
      { message: "Student is not enrolled in this unit" },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Session upsert — create session record if it doesn't exist yet ───────
  // The sync request and manual mark can race; offline replay may also arrive
  // before the session was synced. Upserting here ensures the mark is never
  // lost due to ordering issues. The mark body contains all fields needed to
  // define a valid conducted session.
  const conductedSession = await prisma.conductedSession.upsert({
    where: {
      unitCode_lectureRoom_sessionStart: {
        unitCode,
        lectureRoom,
        sessionStart: sessionStartDate,
      },
    },
    update: {},  // session already exists — leave it unchanged
    create: {
      unitCode,
      lectureRoom,
      sessionStart: sessionStartDate,
      lecturerId: lecturerIdFromJwt,
      createdAt: markedAtDate,   // best available approximation
    },
    select: { id: true, lessonType: true },
  });

  // ── Duplicate check ───────────────────────────────────────────────────────
  const existing = await prisma.offlineAttendanceRecord.findUnique({
    where: {
      studentId_unitCode_lectureRoom_sessionStart: {
        studentId: student.id,
        unitCode,
        lectureRoom,
        sessionStart: sessionStartDate,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { message: "Already marked present for this session" },
      { status: 409, headers: corsHeaders },
    );
  }

  // ── Insert attendance record ──────────────────────────────────────────────
  await prisma.offlineAttendanceRecord.create({
    data: {
      studentId: student.id,
      unitCode,
      lectureRoom,
      sessionStart: sessionStartDate,
      scannedAt: markedAtDate,
      method: "manual_lecturer",
      lessonType: conductedSession.lessonType ?? null,
      admissionNumber: student.admissionNumber,
      markedByLecturerId: lecturerIdFromJwt,
      institutionId: lecturer.institutionId,
    },
  });

  // Refresh gamification cache so points + streak reflect this mark immediately.
  // Fire-and-forget: errors here must not fail the 201 response.
  computeAndCachePoints(student.id).catch(() => {});

  return NextResponse.json(
    { message: "Marked present" },
    { status: 201, headers: corsHeaders },
  );
}
