/**
 * POST /api/attendance/manual-mark/submit
 *
 * Lecturer manually marks a student present using their physical ID card.
 * Auto-creates the ConductedSession if one does not already exist for this
 * (unitCode, lectureRoom, sessionStart) tuple.
 *
 * Body:
 *   studentId      string   — target student id
 *   admissionNumber string  — for audit trail
 *   unitCode       string
 *   lectureRoom    string
 *   lessonType     string   (optional)
 *   sessionStart   number   — epoch ms
 *
 * Returns 409 if the student is already marked for this session.
 * Auth: Bearer lecturer JWT
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

const VALID_LESSON_TYPES = new Set(["LEC", "GD", "RAT", "CAT", "LAB", "SEM", "WRK", "TUT", "PRE"]);

function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const {
    studentId,
    admissionNumber,
    unitCode: unitCodeRaw,
    lectureRoom: lectureRoomRaw,
    lessonType: lessonTypeRaw,
    sessionStart: sessionStartRaw,
  } = body as {
    studentId?: string;
    admissionNumber?: string;
    unitCode?: string;
    lectureRoom?: string;
    lessonType?: string;
    sessionStart?: number;
  };

  if (!studentId || typeof studentId !== "string") {
    return NextResponse.json({ message: "studentId is required" }, { status: 400, headers: corsHeaders });
  }
  if (!admissionNumber || typeof admissionNumber !== "string") {
    return NextResponse.json({ message: "admissionNumber is required" }, { status: 400, headers: corsHeaders });
  }
  if (!unitCodeRaw || typeof unitCodeRaw !== "string") {
    return NextResponse.json({ message: "unitCode is required" }, { status: 400, headers: corsHeaders });
  }
  if (!lectureRoomRaw || typeof lectureRoomRaw !== "string") {
    return NextResponse.json({ message: "lectureRoom is required" }, { status: 400, headers: corsHeaders });
  }
  if (typeof sessionStartRaw !== "number" || !Number.isFinite(sessionStartRaw)) {
    return NextResponse.json({ message: "sessionStart must be a numeric epoch ms value" }, { status: 400, headers: corsHeaders });
  }

  const normUnit = normaliseCode(unitCodeRaw);
  const lectureRoom = lectureRoomRaw.trim().toUpperCase();
  const lessonType = lessonTypeRaw
    ? lessonTypeRaw.trim().toUpperCase()
    : null;
  if (lessonType && !VALID_LESSON_TYPES.has(lessonType)) {
    return NextResponse.json(
      { message: `lessonType must be one of: ${[...VALID_LESSON_TYPES].join(", ")}` },
      { status: 400, headers: corsHeaders },
    );
  }

  const sessionStart = new Date(sessionStartRaw);
  const now = new Date();

  try {
    // Verify student exists and is enrolled in this unit
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, admissionNumber: true, institutionId: true },
    });
    if (!student) {
      return NextResponse.json({ message: "Student not found" }, { status: 404, headers: corsHeaders });
    }

    const snapshot = await prisma.studentEnrollmentSnapshot.findUnique({
      where: { studentId },
      select: { unitCodes: true },
    });
    const isEnrolled =
      snapshot?.unitCodes.some((c) => normaliseCode(c) === normUnit) ?? false;
    if (!isEnrolled) {
      return NextResponse.json(
        { message: "Student is not enrolled in this unit" },
        { status: 422, headers: corsHeaders },
      );
    }

    // Auto-create ConductedSession if it doesn't exist yet
    await prisma.conductedSession.upsert({
      where: { unitCode_lectureRoom_sessionStart: { unitCode: normUnit, lectureRoom, sessionStart } },
      create: {
        unitCode:     normUnit,
        lectureRoom,
        lessonType:   lessonType ?? "LEC",
        sessionStart,
        lecturerId,
      },
      update: {},
    });

    // Create OfflineAttendanceRecord (409 if already marked)
    try {
      const record = await prisma.offlineAttendanceRecord.create({
        data: {
          studentId,
          unitCode:            normUnit,
          lectureRoom,
          lessonType:          lessonType ?? "LEC",
          sessionStart,
          scannedAt:           now,
          method:              "manual_lecturer",
          admissionNumber:     admissionNumber.trim().toUpperCase(),
          markedByLecturerId:  lecturerId,
          institutionId:       student.institutionId,
        },
      });

      return NextResponse.json(
        {
          success:         true,
          recordId:        record.id,
          studentId,
          studentName:     student.name,
          admissionNumber: student.admissionNumber,
          unitCode:        normUnit,
          lectureRoom,
          sessionStart:    sessionStart.toISOString(),
          markedAt:        now.toISOString(),
        },
        { headers: corsHeaders },
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        // Unique constraint — student already marked for this session
        return NextResponse.json(
          { message: "Student already marked present for this session" },
          { status: 409, headers: corsHeaders },
        );
      }
      throw err;
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json(
        { message: "Student already marked present for this session" },
        { status: 409, headers: corsHeaders },
      );
    }
    console.error("[attendance/manual-mark/submit] error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
}
