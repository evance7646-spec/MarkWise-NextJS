import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";

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
  lesson_type?: string | null;  // snake_case alias sent by some app versions
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
  // Accept both lecturer and student JWTs — the same app may use either token
  // depending on the user role that is currently active.
  let lecturerId: string | null = null;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch { /* try student token below */ }
  if (!lecturerId) {
    let studentOk = false;
    try { verifyStudentAccessToken(token); studentOk = true; } catch { /* fall through */ }
    if (!studentOk) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }
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
    const unitCode = s.unitCode?.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
    const lectureRoom = s.lectureRoom?.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
    // Truncate to second precision so all rows are clean regardless of app version
    const rawMs = s.sessionStart ? Math.floor(Number(s.sessionStart) / 1000) * 1000 : null;
    const sessionStart = rawMs ? new Date(rawMs) : null;

    // Normalise lessonType — accept both camelCase and snake_case from clients.
    // Unknown values are silently treated as null rather than rejecting the whole batch.
    const rawLessonTypeInput = s.lessonType ?? s.lesson_type ?? null;
    const rawLessonType = rawLessonTypeInput ? String(rawLessonTypeInput).trim().toUpperCase() : null;
    const lessonType = rawLessonType !== null && VALID_LESSON_TYPES.has(rawLessonType)
      ? rawLessonType
      : null;

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
          lecturerId: lecturerId ?? "SYSTEM_STUB",
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
