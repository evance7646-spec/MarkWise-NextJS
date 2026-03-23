
import { prisma } from "@/lib/prisma";
export type EnrollmentMap = Record<string, string[]>;

export const normalizeUnitCode = (value: string) => value.replace(/\s+/g, "").trim().toUpperCase();

const isEnrollmentMap = (value: unknown): value is EnrollmentMap => {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string"),
  );
};

// Returns a map of studentId to array of unitIds for all enrollments
export async function getEnrollmentMap(): Promise<EnrollmentMap> {
  const enrollments = await prisma.enrollment.findMany();
  const map: EnrollmentMap = {};
  for (const e of enrollments) {
    if (!map[e.studentId]) map[e.studentId] = [];
    map[e.studentId].push(e.unitId);
  }
  return map;
}
// ...existing code...

// Deprecated: Use Prisma create/update/delete methods directly for persistence
export async function writeEnrollments(enrollments: EnrollmentMap): Promise<void> {
  throw new Error("writeEnrollments is deprecated. Use Prisma directly.");
}

export async function isStudentEnrolledForUnit(studentId: string, unitCodeOrId: string): Promise<boolean> {
  let unitId: string;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(unitCodeOrId)) {
    unitId = unitCodeOrId;
  } else {
    const normalized = normalizeUnitCode(unitCodeOrId);
    // Case-insensitive exact match
    let unit = await prisma.unit.findFirst({
      where: { code: { equals: normalized, mode: 'insensitive' } },
    });
    // Raw SQL fallback: strip spaces from DB side too (SCH2170 matches stored SCH 2170)
    if (!unit) {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Unit" WHERE REPLACE(UPPER(code), ' ', '') = ${normalized} LIMIT 1
      `;
      if (rows.length > 0) {
        unit = await prisma.unit.findUnique({ where: { id: rows[0].id } });
      }
    }
    if (!unit) return false;
    unitId = unit.id;
  }

  // Check direct Enrollment table row
  const directEnrollment = await prisma.enrollment.findFirst({ where: { studentId, unitId } });
  if (directEnrollment) return true;

  // Fall back: student is enrolled if their course contains this unit (Enrollment table may be empty)
  const student = await prisma.student.findFirst({
    where: { id: studentId, course: { units: { some: { id: unitId } } } },
  });
  return !!student;
}
