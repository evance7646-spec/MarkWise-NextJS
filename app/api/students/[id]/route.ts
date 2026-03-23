import { NextResponse } from "next/server";
import { normalizeAdmission, readStudents, type StudentRecord, writeStudents } from "@/lib/studentStore.server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<StudentRecord>;
    const name = body.name?.trim() ?? "";
    const admissionNumber = normalizeAdmission(body.admissionNumber ?? "");
    const courseId = body.courseId?.trim() ?? "";
    const email = body.email?.trim();

    if (!name || !admissionNumber || !courseId) {
      return NextResponse.json(
        { error: "Name, admissionNumber and courseId are required." },
        { status: 400, headers: corsHeaders },
      );
    }

    const students = await readStudents();
    const targetIndex = students.findIndex((student) => student.id === id);

    if (targetIndex < 0) {
      return NextResponse.json({ error: "Student not found." }, { status: 404, headers: corsHeaders });
    }

    const exists = students.some(
      (student) => student.id !== id && normalizeAdmission(student.admissionNumber) === admissionNumber,
    );

    if (exists) {
      return NextResponse.json(
        { error: "Student with this admission number already exists." },
        { status: 409, headers: corsHeaders },
      );
    }

    const updatedStudent: StudentRecord = {
      ...students[targetIndex],
      name,
      admissionNumber,
      courseId,
      email,
    };

    const updatedStudents = [...students];
    updatedStudents[targetIndex] = updatedStudent;
    await writeStudents(updatedStudents);

    return NextResponse.json({ student: updatedStudent }, { headers: corsHeaders });
  } catch {
    return NextResponse.json(
      { error: "Failed to update student." },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const deleted = await prisma.student.delete({ where: { id } });
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete student." },
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