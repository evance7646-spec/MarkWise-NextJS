import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type Method = "qr" | "ble" | "manual";

function detectMethod(rawPayload: string): Method {
  if (rawPayload.startsWith("MANUAL:")) return "manual";
  if (rawPayload.startsWith("{")) return "ble";
  return "qr";
}

/** Canonical code form: uppercase, no spaces, no non-alphanumeric chars. */
function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");
}

// digestToPin: mix 8-hex-char chunks via uint32 Fibonacci hashing, mod 10^6, zero-pad to 6 digits
function digestToPin(digestHex: string): string {
  let mixed = 0x9e3779b9 >>> 0;
  for (let i = 0; i < digestHex.length; i += 8) {
    const chunk = parseInt(digestHex.substring(i, i + 8), 16);
    mixed = (Math.imul(mixed ^ chunk, 2654435761)) >>> 0;
    mixed = (mixed ^ (mixed >>> 16)) >>> 0;
  }
  return String(mixed % 1_000_000).padStart(6, "0");
}

// Validates a 6-digit Manual PIN using HMAC-SHA256 per spec algorithm.
// Allows 1 window of clock skew (30 s).
function verifyManualPin(
  pin: string,
  unitCode: string,
  lectureRoom: string,
  sessionStart: number
): boolean {
  const TOKEN_SECRET = "MARKWISE_MANUAL_ATTENDANCE_V1";
  const normalizedUnit = unitCode.replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalizedRoom = lectureRoom.replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const currentWindow = Math.floor(Date.now() / 30_000);
  const anchor = Math.floor(sessionStart / 30_000) * 30_000;

  for (let delta = 0; delta <= 1; delta++) {
    const candidateWindow = currentWindow - delta;
    const payload = `MW2|${normalizedUnit}|${normalizedRoom}|${anchor}|${candidateWindow}`;
    const digestHex = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payload)
      .digest("hex");
    if (digestToPin(digestHex) === pin) return true;
  }
  return false;
}

// POST /api/attendance/offline/submit
export async function POST(req: NextRequest) {
  // --- Auth ---
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }
  let studentId: string;
  try {
    ({ studentId } = verifyStudentAccessToken(token));
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  // --- Parse body ---
  let body: {
    unitCode?: string;
    lectureRoom?: string;
    sessionStart?: number | string;
    scannedAt?: number | string;
    deviceId?: string | null;
    rawPayload?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  // rawPayload and deviceId are optional — store NULL in DB when absent
  const rawPayload  = (body.rawPayload ?? null) || null;
  const deviceId    = body.deviceId || null;

  // method is never sent by the client — default to 'ble' server-side
  const method: Method = rawPayload ? detectMethod(rawPayload) : "ble";

  // --- Step 1: Normalise inputs ---
  // Primary: use explicit body fields. Fallback: parse from rawPayload for QR/BLE.
  let unitCode     = normaliseCode(String(body.unitCode ?? ""));
  let lectureRoom  = normaliseCode(body.lectureRoom ?? "");
  let sessionStart = Number(body.sessionStart ?? 0) || 0;
  const scannedAt  = Number(body.scannedAt ?? 0) || 0;

  if (rawPayload && (!unitCode || !lectureRoom || !sessionStart)) {
    if (method === "qr") {
      // Format: "UNITCODE@ROOM;sessionStart;sessionEnd"
      const parts = rawPayload.split(";");
      const codePart = parts[0] ?? "";
      const atIdx = codePart.indexOf("@");
      if (atIdx !== -1) {
        if (!unitCode) unitCode = normaliseCode(codePart.substring(0, atIdx));
        if (!lectureRoom) lectureRoom = codePart.substring(atIdx + 1).trim().toUpperCase();
      }
      if (!sessionStart || isNaN(sessionStart)) sessionStart = parseInt(parts[1] ?? "0", 10);
    } else if (method === "ble") {
      try {
        const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
        if (!unitCode) unitCode = normaliseCode(String(parsed.unitCode ?? ""));
        if (!lectureRoom) lectureRoom = String(parsed.lectureRoom ?? "").trim().toUpperCase();
        if (!sessionStart || isNaN(sessionStart))
          sessionStart = parseInt(String(parsed.sessionStart ?? "0"), 10);
      } catch { /* not valid JSON, leave fields empty */ }
    }
  }

  // Validate the four required fields — all other fields default server-side.
  if (!unitCode || !lectureRoom || !sessionStart || !scannedAt) {
    return NextResponse.json(
      { message: "Missing or invalid session fields", reason: "MISSING_FIELDS" },
      { status: 422, headers: corsHeaders }
    );
  }

  const scannedAtDate = new Date(scannedAt);

  try {
    // Normalise sessionStart to second precision (matches app behaviour)
    const normalisedSessionStart = Math.floor(sessionStart / 1000) * 1000;

    // --- Step 2: Verify session exists ---
    // Use ±SESSION_DURATION_MS window so submissions that arrive before the
    // lecturer's sync has propagated still match. Also accept either the room
    // as sent or with spaces stripped ("CLB004" == "CLB 004").
    // BLE sends roomCode (e.g. "NCLB") but sessions are stored with room.name
    // (e.g. "NEW COLLEGE LIBRARY BLOCK"), so also resolve via roomCode lookup.
    const SESSION_DURATION_MS = 600_000; // 10 minutes
    const lectureRoomStripped = lectureRoom.replace(/\s+/g, "");

    // Resolve roomCode → room.name so BLE submissions can match sessions stored
    // with room.name. Build a deduplicated list of candidate lectureRoom values.
    const roomCandidates = new Set<string>([lectureRoom, lectureRoomStripped]);
    const matchedRoom = await prisma.room.findFirst({
      where: {
        OR: [
          { roomCode: lectureRoom },
          { roomCode: lectureRoomStripped },
        ],
      },
      select: { name: true, roomCode: true },
    });
    if (matchedRoom) {
      roomCandidates.add(matchedRoom.name.trim().toUpperCase());
      roomCandidates.add(matchedRoom.name.trim());
      roomCandidates.add(matchedRoom.roomCode.trim().toUpperCase());
    }

    const session = await prisma.conductedSession.findFirst({
      where: {
        // Accept both canonical ("SCH 2170") and legacy stripped ("SCH2170") forms
        // during the transition period before the migration script is run.
        unitCode: { in: [unitCode, unitCode.replace(/\s+/g, "")] },
        lectureRoom: { in: Array.from(roomCandidates) },
        sessionStart: {
          gte: new Date(normalisedSessionStart - SESSION_DURATION_MS),
          lte: new Date(normalisedSessionStart + SESSION_DURATION_MS),
        },
      },
      select: { id: true, sessionStart: true, lectureRoom: true, lessonType: true, unitCode: true },
      orderBy: { sessionStart: "desc" }, // most recent within the window
    });

    // If no conducted session found, create a stub so the attendance record
    // can still be counted in session analytics. This handles the race where
    // the student submits before the lecturer's sync has propagated.
    const effectiveSession = session ?? await prisma.conductedSession.upsert({
      where: {
        unitCode_lectureRoom_sessionStart: {
          unitCode,
          lectureRoom,
          sessionStart: new Date(normalisedSessionStart),
        },
      },
      update: {},
      create: {
        unitCode,
        lectureRoom,
        sessionStart: new Date(normalisedSessionStart),
        lecturerId: "SYSTEM_STUB",
      },
      select: { id: true, sessionStart: true, lectureRoom: true, lessonType: true, unitCode: true },
    });

    // Canonical values — always use spec-normalised form for storage
    const canonicalSessionStart = new Date(Math.floor(effectiveSession.sessionStart.getTime() / 1000) * 1000);
    const canonicalLectureRoom = normaliseCode(effectiveSession.lectureRoom);
    const canonicalUnitCode = normaliseCode(effectiveSession.unitCode);

    // --- Step 3: Validate Manual PIN ---
    if (method === "manual" && rawPayload) {
      const pin = rawPayload.replace(/^MANUAL:/i, "").trim();
      const valid = verifyManualPin(pin, unitCode, lectureRoom, sessionStart);
      if (!valid) {
        console.log("[offline/submit] BAD_PIN:", { pin, unitCode, lectureRoom, sessionStart });
        return NextResponse.json(
          { message: "Invalid or expired PIN", reason: "BAD_PIN" },
          { status: 422, headers: corsHeaders }
        );
      }
    }

    // --- Step 4: Duplicate check ---
    const existing = await prisma.offlineAttendanceRecord.findUnique({
      where: {
        studentId_unitCode_lectureRoom_sessionStart: {
          studentId,
          unitCode: canonicalUnitCode,
          lectureRoom: canonicalLectureRoom,
          sessionStart: canonicalSessionStart,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: true, duplicate: true },
        { status: 200, headers: corsHeaders }
      );
    }

    // --- Step 5: Validate timestamp window (within 24 hours) ---
    const diffMs = Math.abs(scannedAtDate.getTime() - canonicalSessionStart.getTime());
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (diffMs > twentyFourHours) {
      console.log("[offline/submit] WINDOW_EXPIRED:", { scannedAt, canonicalSessionStart: canonicalSessionStart.toISOString(), diffMs, diffHours: diffMs/3600000 });
      return NextResponse.json(
        { message: "Attendance window expired", reason: "WINDOW_EXPIRED" },
        { status: 422, headers: corsHeaders }
      );
    }

    // --- Step 6: Insert record ---
    const record = await prisma.offlineAttendanceRecord.create({
      data: {
        studentId,
        unitCode: canonicalUnitCode,
        lectureRoom: canonicalLectureRoom,
        lessonType: effectiveSession.lessonType ?? null,
        sessionStart: canonicalSessionStart, // already truncated to second precision above
        scannedAt: scannedAtDate,
        deviceId: deviceId ?? null,
        rawPayload: rawPayload ?? null,
        method,
      },
      select: { id: true },
    });

    // --- Step 7: Return success ---
    return NextResponse.json(
      { attendanceId: record.id, message: "Attendance recorded" },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json(
        { success: true, duplicate: true },
        { status: 200, headers: corsHeaders }
      );
    }
    console.error("Offline attendance submit error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
