import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentAccessToken } from "@/lib/studentAuthJwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getStudentId(req: NextRequest): string | null {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) return null;
  try {
    return verifyStudentAccessToken(token).studentId;
  } catch {
    return null;
  }
}

// POST /api/student/enrollment
// Body: { unitCodes: string[], unitNamesMap: Record<string,string>, year: string, semester: string }
// Upserts the student's enrollment snapshot. Returns { success: true }.
export async function POST(req: NextRequest) {
  const studentId = getStudentId(req);
  if (!studentId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let body: {
    unitCodes?: unknown;
    unitNamesMap?: unknown;
    year?: string | number | null;
    semester?: string | number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const { unitCodes, unitNamesMap, year, semester } = body;
  console.log("[enrollment POST] studentId:", studentId, "| unitCodes:", unitCodes, "| year:", year, `(${typeof year})`, "| semester:", semester, `(${typeof semester})`);

  if (!Array.isArray(unitCodes)) {
    return NextResponse.json(
      { message: "unitCodes must be an array" },
      { status: 422, headers: corsHeaders }
    );
  }

  // Accept year/semester as string or number and coerce to string
  const yearStr = year != null && year !== "" ? String(year) : null;
  const semesterStr = semester != null && semester !== "" ? String(semester) : null;

  if (!yearStr) {
    return NextResponse.json(
      { message: "year is required" },
      { status: 422, headers: corsHeaders }
    );
  }
  if (!semesterStr) {
    return NextResponse.json(
      { message: "semester is required" },
      { status: 422, headers: corsHeaders }
    );
  }

  const codes = (unitCodes as unknown[])
    .filter((c) => typeof c === "string" && c.trim() !== "")
    .map((c) => (c as string).trim());

  const namesMap =
    unitNamesMap && typeof unitNamesMap === "object" && !Array.isArray(unitNamesMap)
      ? unitNamesMap
      : {};

  try {
    await prisma.studentEnrollmentSnapshot.upsert({
      where: { studentId },
      update: { unitCodes: codes, unitNamesMap: namesMap, year: yearStr, semester: semesterStr },
      create: { studentId, unitCodes: codes, unitNamesMap: namesMap, year: yearStr, semester: semesterStr },
    });
  } catch (err) {
    console.error("[enrollment POST] upsert failed for studentId:", studentId, err);
    return NextResponse.json(
      { message: "Failed to save enrollment" },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
}

// GET /api/student/enrollment
// Returns the student's latest saved enrollment snapshot.
// Returns { unitCodes: [], unitNamesMap: {}, year: "1", semester: "1" } if none exists.
export async function GET(req: NextRequest) {
  const studentId = getStudentId(req);
  if (!studentId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }

  let snapshot;
  try {
    snapshot = await prisma.studentEnrollmentSnapshot.findUnique({
      where: { studentId },
      select: { unitCodes: true, unitNamesMap: true, year: true, semester: true },
    });
  } catch (err) {
    console.error("[enrollment GET] query failed for studentId:", studentId, err);
    return NextResponse.json(
      { unitCodes: [], unitNamesMap: {}, year: "1", semester: "1" },
      { status: 200, headers: corsHeaders }
    );
  }

  if (!snapshot) {
    return NextResponse.json(
      { unitCodes: [], unitNamesMap: {}, year: "1", semester: "1" },
      { status: 200, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    {
      unitCodes: snapshot.unitCodes,
      unitNamesMap: snapshot.unitNamesMap ?? {},
      year: snapshot.year,
      semester: snapshot.semester,
    },
    { status: 200, headers: corsHeaders }
  );
}
