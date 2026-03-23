import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const isValidUnitsMap = (value: unknown): value is Record<string, string[]> => {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string"),
  );
};

const readUnitsMap = async () => {
  // Fetch all records from the UnitsByYearSemester table
  const records = await prisma.unitsByYearSemester.findMany();
  const map: Record<string, string[]> = {};
  for (const rec of records) {
    const key = `${rec.year}-${rec.semester}`;
    map[key] = rec.unitIds ? rec.unitIds.split(",") : [];
  }
  return map;
};

const writeUnitsMap = async (map: Record<string, string[]>) => {
  // Remove all existing records
  await prisma.unitsByYearSemester.deleteMany();
  // Insert new records
  for (const key in map) {
    const [year, semester] = key.split("-");
    await prisma.unitsByYearSemester.create({
      data: {
        year: parseInt(year, 10),
        semester: parseInt(semester, 10),
        unitIds: map[key].join(","),
      },
    });
  }
};

export async function GET() {
  const map = await readUnitsMap();
  return NextResponse.json({ unitsByYearSemester: map }, { headers: corsHeaders });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      unitsByYearSemester?: unknown;
    };

    if (!isValidUnitsMap(body.unitsByYearSemester)) {
      return NextResponse.json(
        { error: "Invalid payload. Expected unitsByYearSemester: Record<string, string[]>" },
        { status: 400, headers: corsHeaders },
      );
    }

    await writeUnitsMap(body.unitsByYearSemester);
    return NextResponse.json(
      { success: true, unitsByYearSemester: body.unitsByYearSemester },
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update unitsByYearSemester." },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
