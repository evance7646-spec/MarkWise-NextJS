import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeAdmission, readStudents, type StudentRecord, writeStudents } from "@/lib/studentStore.server";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseId?: string;
      students?: Array<{ name?: string; admissionNumber?: string; email?: string }>;
    };
    const courseId = body.courseId?.trim() ?? "";

    const incoming = body.students ?? [];
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json(
        { error: "students array is required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const current = await readStudents();
    const existingAdmissions = new Set(
      current.map((student) => normalizeAdmission(student.admissionNumber)),
    );

    const added: StudentRecord[] = [];
    const skipped: Array<{ name: string; admissionNumber: string; reason: string }> = [];

    for (const rawStudent of incoming) {
      const name = rawStudent.name?.trim() ?? "";
      const admissionNumber = normalizeAdmission(rawStudent.admissionNumber ?? "");
      const email = rawStudent.email?.trim();

      if (!name || !admissionNumber) {
        skipped.push({ name, admissionNumber, reason: "invalid" });
        continue;
      }

      if (existingAdmissions.has(admissionNumber)) {
        skipped.push({ name, admissionNumber, reason: "duplicate" });
        continue;
      }

      existingAdmissions.add(admissionNumber);
      added.push({ id: randomUUID(), name, admissionNumber, courseId, email });
    }

    if (added.length > 0) {
      await writeStudents([...current, ...added]);
    }

    return NextResponse.json(
      {
        added,
        skipped,
      },
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed bulk add." },
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
