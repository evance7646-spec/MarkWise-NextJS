import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Auth
  const scope = await resolveAdminScope(req);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status ?? 401 });
  }

  let body: { students?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const students = Array.isArray(body?.students) ? body.students : [];
  if (students.length === 0) {
    return NextResponse.json(
      { error: "students array is required and must not be empty" },
      { status: 400 },
    );
  }

  // Derive departmentId from scope (dept admin uses their own; institution admin provides it in the row)
  const firstRow = students[0] as Record<string, unknown>;
  const departmentId = scope.isInstitutionAdmin
    ? String(firstRow?.departmentId ?? "").trim()
    : (scope.departmentId ?? "");

  if (!departmentId) {
    return NextResponse.json({ error: "departmentId is required" }, { status: 400 });
  }

  // Validate department + get institutionId in one query
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { institutionId: true },
  });
  if (!dept) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }
  if (
    scope.isInstitutionAdmin &&
    scope.institutionId &&
    dept.institutionId !== scope.institutionId
  ) {
    return NextResponse.json(
      { error: "Department does not belong to your institution" },
      { status: 403 },
    );
  }

  const institutionId = dept.institutionId;
  let created = 0;
  let skipped = 0;

  for (const raw of students) {
    const s = raw as Record<string, unknown>;
    const name = String(s.name ?? "").trim();
    const admissionNumber = String(s.admissionNumber ?? "").trim();
    const courseId = String(s.courseId ?? "").trim();
    const emailRaw = String(s.email ?? "").trim();
    const email = emailRaw || null;

    if (!name || !admissionNumber || !courseId) {
      skipped++;
      continue;
    }

    // Duplicate check
    const exists = await prisma.student.findFirst({
      where: { admissionNumber },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    // Email uniqueness — skip if email already taken
    if (email) {
      const emailTaken = await prisma.student.findFirst({
        where: { email },
        select: { id: true },
      });
      if (emailTaken) {
        skipped++;
        continue;
      }
    }

    try {
      await prisma.student.create({
        data: {
          name,
          admissionNumber,
          email,
          courseId,
          departmentId,
          institutionId,
          year: typeof s.year === "number" ? s.year : 1,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

