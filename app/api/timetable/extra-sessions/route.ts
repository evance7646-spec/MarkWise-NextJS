/**
 * /api/timetable/extra-sessions
 *
 * POST  — create a make-up session (lecturer auth)
 * GET   — return all active extra sessions for the caller's unit codes
 *         (lecturer fetches by lecturerId; used internally — mine route below)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { buildPayloadsForStudents, sendPushNotificationBatch } from "@/lib/pushNotification";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const VALID_LESSON_TYPES = ["LEC", "TUT", "LAB", "SEM", "WRK", "CAT", "RAT", "PRE"] as const;

function extractLecturerId(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Unauthorized");
  const payload = verifyLecturerAccessToken(token);
  return payload.lecturerId;
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/timetable/extra-sessions
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let lecturerIdFromJwt: string;
  try {
    lecturerIdFromJwt = extractLecturerId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const {
    unitCode,
    date: dateStr,
    startTime,
    endTime,
    roomCode,
    roomId,
    lessonType = "LEC",
    lecturerId: bodyLecturerId,
  } = body as {
    unitCode?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    roomCode?: string;
    roomId?: string;
    lessonType?: string;
    lecturerId?: string;
  };

  // Use JWT identity; optionally body-supplied lecturerId is ignored for auth —
  // the lecturer can only create sessions for themselves.
  const lecturerId = lecturerIdFromJwt;
  void bodyLecturerId; // accepted in body for mobile client compatibility but not trusted

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!unitCode || typeof unitCode !== "string" || !unitCode.trim()) {
    return NextResponse.json({ error: "unitCode is required" }, { status: 400, headers: corsHeaders });
  }
  if (!dateStr || typeof dateStr !== "string") {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400, headers: corsHeaders });
  }
  if (!startTime || typeof startTime !== "string" || !/^\d{1,2}:\d{2}$/.test(startTime.trim())) {
    return NextResponse.json({ error: "startTime is required in HH:MM format" }, { status: 400, headers: corsHeaders });
  }
  if (!endTime || typeof endTime !== "string" || !/^\d{1,2}:\d{2}$/.test(endTime.trim())) {
    return NextResponse.json({ error: "endTime is required in HH:MM format" }, { status: 400, headers: corsHeaders });
  }

  // Parse and validate date
  const sessionDate = new Date(dateStr.trim());
  if (isNaN(sessionDate.getTime())) {
    return NextResponse.json({ error: "date must be a valid ISO date (YYYY-MM-DD)" }, { status: 400, headers: corsHeaders });
  }
  // Compare date-only (strip time) against today
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr.trim() < todayStr) {
    return NextResponse.json({ error: "date must be today or in the future" }, { status: 400, headers: corsHeaders });
  }

  // Validate time order
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  if (toMinutes(endTime.trim()) <= toMinutes(startTime.trim())) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400, headers: corsHeaders });
  }

  // Validate lessonType
  if (!VALID_LESSON_TYPES.includes(lessonType as (typeof VALID_LESSON_TYPES)[number])) {
    return NextResponse.json(
      { error: `lessonType must be one of: ${VALID_LESSON_TYPES.join(", ")}` },
      { status: 400, headers: corsHeaders },
    );
  }

  // Validate unitCode exists
  const normalisedCode = normalizeUnitCode(unitCode);
  const unit = await prisma.unit.findFirst({
    where: { OR: [{ code: normalisedCode }, { code: unitCode.trim().toUpperCase() }] },
    select: { id: true, title: true, code: true },
  });
  if (!unit) {
    return NextResponse.json({ error: `Unit "${unitCode}" not found` }, { status: 400, headers: corsHeaders });
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  const session = await prisma.extraSession.create({
    data: {
      unitCode: normalizeUnitCode(unit.code),
      lecturerId,
      date: sessionDate,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      roomCode: typeof roomCode === "string" && roomCode.trim() ? roomCode.trim() : null,
      roomId: typeof roomId === "string" && roomId.trim() ? roomId.trim() : null,
      lessonType,
    },
    select: {
      id: true,
      unitCode: true,
      date: true,
      startTime: true,
      endTime: true,
      roomCode: true,
      lessonType: true,
      lecturerId: true,
    },
  });

  const dateFmt = session.date.toISOString().slice(0, 10);
  const venueDisplay = session.roomCode ?? "TBA";

  // ── Push notification to enrolled students (fire-and-forget) ───────────────
  const pushPromise = (async () => {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { unit: { code: session.unitCode } },
        select: { studentId: true },
      });
      const studentIds = enrollments.map((e) => e.studentId);
      if (studentIds.length === 0) return;
      const payloads = await buildPayloadsForStudents(studentIds, {
        title: "Extra Session Added",
        body: `${session.unitCode} — make-up ${session.lessonType} on ${dateFmt} at ${session.startTime} in ${venueDisplay}`,
        data: {
          type: "extra_session",
          sessionId: session.id,
          unitCode: session.unitCode,
          date: dateFmt,
          startTime: session.startTime,
          endTime: session.endTime,
          lessonType: session.lessonType,
          roomCode: venueDisplay,
        },
      });
      await sendPushNotificationBatch(payloads);
    } catch (err) {
      console.error("[extra-sessions/POST] push error:", err);
    }
  })();
  void pushPromise;

  return NextResponse.json(
    {
      message: "Make-up session created",
      data: {
        id: session.id,
        sessionId: session.id,
        unitCode: session.unitCode,
        date: dateFmt,
        startTime: session.startTime,
        endTime: session.endTime,
        roomCode: session.roomCode ?? null,
        lessonType: session.lessonType,
        lecturerId: session.lecturerId,
      },
    },
    { status: 201, headers: corsHeaders },
  );
}
