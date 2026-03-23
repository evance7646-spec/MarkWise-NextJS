import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";
import { rateLimit } from "@/lib/rateLimit";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Max 3 attempts per (deviceId, sessionId) within 10 minutes
const submitLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 3 });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// POST /api/attendance/sessions/:id/submit
// Auth: Student JWT required
// Body: { deviceId: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // --- Auth ---
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let studentId: string;
  let admissionNumber: string;
  try {
    ({ studentId, admissionNumber } = verifyStudentAccessToken(token));
  } catch {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401, headers: corsHeaders });
  }

  // --- Body ---
  let body: { deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const deviceId = body.deviceId?.trim();
  if (!deviceId) {
    return NextResponse.json({ message: "deviceId is required" }, { status: 400, headers: corsHeaders });
  }

  const { id: sessionId } = await params;

  // --- Session check (step 2) ---
  // Sweep expired sessions first so the status field is consistent
  await prisma.onlineAttendanceSession.updateMany({
    where: { status: "active", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });

  const session = await prisma.onlineAttendanceSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, expiresAt: true, unitCode: true },
  });

  if (!session) {
    return NextResponse.json({ message: "Session not found" }, { status: 404, headers: corsHeaders });
  }

  const now = new Date();
  if (session.status !== "active" || session.expiresAt <= now) {
    return NextResponse.json(
      { message: "Session has ended" },
      { status: 410, headers: corsHeaders }
    );
  }

  // --- Duplicate check (step 3) ---
  const existing = await prisma.onlineAttendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: session.id, studentId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ message: "Already submitted" }, { status: 409, headers: corsHeaders });
  }

  // --- Device duplicate check (step 3b) ---
  const deviceUsed = await prisma.onlineAttendanceRecord.findUnique({
    where: { sessionId_deviceId: { sessionId: session.id, deviceId } },
    select: { id: true },
  });
  if (deviceUsed) {
    return NextResponse.json(
      { message: "This device has already been used to mark attendance for this session" },
      { status: 409, headers: corsHeaders }
    );
  }

  // --- Rate limit by (deviceId, sessionId) (step 4) ---
  const { allowed } = await submitLimiter(`${deviceId}:${sessionId}`);
  if (!allowed) {
    return NextResponse.json(
      { message: "Too many attempts. Try again later." },
      { status: 429, headers: corsHeaders }
    );
  }

  // --- Record attendance (step 5) ---
  const record = await prisma.onlineAttendanceRecord.create({
    data: {
      sessionId: session.id,
      studentId,
      admissionNumber: admissionNumber.toUpperCase(),
      unitCode: session.unitCode,
      deviceId,
    },
    select: { id: true },
  });

  return NextResponse.json(
    { message: "Attendance recorded", attendanceId: record.id },
    { status: 200, headers: corsHeaders }
  );
}
