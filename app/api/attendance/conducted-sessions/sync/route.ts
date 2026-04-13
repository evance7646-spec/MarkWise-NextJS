import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const VALID_LESSON_TYPES = new Set(["LEC", "GD", "RAT", "CAT", "LAB", "SEM", "WRK", "TUT", "PRE"]);

type SessionPayload = {
  unitCode: string;
  lectureRoom: string;
  lessonType?: string | null;
  sessionStart: number;
  createdAt?: number;
};

// POST /api/attendance/conducted-sessions/sync
// Called by the lecturer device to register offline sessions after coming online.
export async function POST(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }
  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let body: { sessions?: SessionPayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 422, headers: corsHeaders }
    );
  }

  const { sessions } = body;
  if (!Array.isArray(sessions)) {
    return NextResponse.json(
      { message: "sessions must be an array" },
      { status: 422, headers: corsHeaders }
    );
  }

  // Empty array is valid — nothing to sync
  if (sessions.length === 0) {
    return NextResponse.json({ synced: 0, skipped: 0 }, { headers: corsHeaders });
  }

  let synced = 0;
  let skipped = 0;

  for (const s of sessions) {
    const unitCode = s.unitCode?.replace(/\s+/g, "").toUpperCase();
    const lectureRoom = s.lectureRoom?.trim().toUpperCase();
    // Truncate to second precision so all rows are clean regardless of app version
    const rawMs = s.sessionStart ? Math.floor(Number(s.sessionStart) / 1000) * 1000 : null;
    const sessionStart = rawMs ? new Date(rawMs) : null;

    // Normalise and validate lessonType
    const rawLessonType = s.lessonType ? String(s.lessonType).trim().toUpperCase() : null;
    if (rawLessonType !== null && !VALID_LESSON_TYPES.has(rawLessonType)) {
      return NextResponse.json(
        { message: `Invalid lessonType "${rawLessonType}". Valid values: ${[...VALID_LESSON_TYPES].join(", ")}` },
        { status: 400, headers: corsHeaders }
      );
    }
    const lessonType = rawLessonType;

    if (!unitCode || !lectureRoom || !sessionStart || isNaN(sessionStart.getTime())) {
      skipped++;
      continue;
    }

    try {
      // INSERT OR IGNORE using upsert — skip if unique constraint would fire
      await prisma.conductedSession.upsert({
        where: {
          unitCode_lectureRoom_sessionStart: {
            unitCode,
            lectureRoom,
            sessionStart,
          },
        },
        // On conflict: only update lessonType if the incoming value is non-null
        update: lessonType !== null ? { lessonType } : {},
        create: {
          unitCode,
          lectureRoom,
          lessonType,
          sessionStart,
          lecturerId,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        },
      });
      synced++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ synced, skipped }, { headers: corsHeaders });
}
