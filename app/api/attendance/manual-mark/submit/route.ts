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
    !studentId ||
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
      { status: 401, headers: corsHeaders },
    );
  }

  // ── Normalise codes (match how ConductedSession stores them) ─────────────
  const unitCode = rawUnitCode.replace(/\s+/g, "").toUpperCase();
  const lectureRoom = rawRoom.trim().toUpperCase();
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

  // ── Verify student identity (both id and admissionNumber must match) ──────
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      admissionNumber: { equals: rawAdmission.trim(), mode: "insensitive" },
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

  // ── Enrollment guard (server-side re-validation) ────────────────────────
  // Enrollment is stored in StudentEnrollmentSnapshot.unitCodes (string[]).
  const snapshot = await prisma.studentEnrollmentSnapshot.findUnique({
    where: { studentId: student.id },
    select: { unitCodes: true },
  });
  const normalizeCode = (c: string) => c.replace(/\s+/g, "").toUpperCase();
  const isEnrolled =
    snapshot?.unitCodes.some((uc) => normalizeCode(uc) === unitCode) ?? false;
  if (!isEnrolled) {
    return NextResponse.json(
      { message: "Student is not enrolled in this unit" },
      { status: 403, headers: corsHeaders },
    );
  }

  // ── Session gate — a conducted session must exist ─────────────────────────
  const conductedSession = await prisma.conductedSession.findUnique({
    where: {
      unitCode_lectureRoom_sessionStart: {
        unitCode,
        lectureRoom,
        sessionStart: sessionStartDate,
      },
    },
    select: { id: true, lessonType: true },
  });
  if (!conductedSession) {
    return NextResponse.json(
      { message: "No active session found for this unit and room" },
      { status: 404, headers: corsHeaders },
    );
  }

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

  return NextResponse.json(
    {
      message: "Attendance marked successfully",
      studentName: student.name,
      attendanceMethod: "manual_lecturer",
    },
    { status: 201, headers: corsHeaders },
  );
}
