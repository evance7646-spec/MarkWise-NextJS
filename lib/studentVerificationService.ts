import { findCourseById, type CourseRecord } from "@/lib/courseStore";
import { findStudentByAdmissionIndexed, normalizeAdmission } from "@/lib/studentStore.server";
import { prisma } from "@/lib/prisma";

type VerificationPayload = {
  exists: boolean;
  admissionNumber: string;
  fullName: string | null;
  email: string | null;
  course: {
    id: string;
    code: string;
    name: string;
  } | null;
  department: { name: string } | null;
  hasAppAccount: boolean;   // true = StudentAuth record exists (student registered on mobile app)
  enrolledUnitCount: number; // current number of unit enrollments
};

type VerificationCacheEntry = {
  expiresAtMs: number;
  payload: VerificationPayload;
};

export type VerificationLookupSource = "cache" | "db";

export type VerificationResult = {
  payload: VerificationPayload;
  lookupSource: VerificationLookupSource;
};

const VERIFICATION_CACHE_TTL_MS = 90_000;
const verificationCache = new Map<string, VerificationCacheEntry>();

const asCoursePayload = (course: CourseRecord | null) => {
  if (!course) return null;
  return {
    id: course.id,
    code: course.code,
    name: course.name,
  };
};

export async function verifyStudentByAdmission(admissionNumber: string, institutionId: string): Promise<VerificationResult> {
  const normalizedAdmission = normalizeAdmission(admissionNumber);
  const cacheKey = `${institutionId}:${normalizedAdmission}`;

  const cached = verificationCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAtMs > now) {
    return {
      payload: cached.payload,
      lookupSource: "cache",
    };
  }

  const lookup = await findStudentByAdmissionIndexed(normalizedAdmission, institutionId);
  if (!lookup.student) {
    const payload: VerificationPayload = {
      exists: false,
      admissionNumber: normalizedAdmission,
      fullName: null,
      email: null,
      course: null,
      department: null,
      hasAppAccount: false,
      enrolledUnitCount: 0,
    };

    verificationCache.set(cacheKey, {
      payload,
      expiresAtMs: now + VERIFICATION_CACHE_TTL_MS,
    });

    return {
      payload,
      lookupSource: "db",
    };
  }

  const [course, enrolledUnitCount] = await Promise.all([
    findCourseById(lookup.student.courseId?.trim() ?? ""),
    prisma.enrollment.count({ where: { studentId: lookup.student.id } }),
  ]);

  const payload: VerificationPayload = {
    exists: true,
    admissionNumber: normalizedAdmission,
    fullName: lookup.student.name,
    email: lookup.student.email ?? null,
    course: asCoursePayload(course),
    department: lookup.student.departmentName ? { name: lookup.student.departmentName } : null,
    hasAppAccount: !!lookup.student.email, // email is sourced from StudentAuth
    enrolledUnitCount,
  };

  // Do not cache found-student payloads — activeness data must always be live
  return {
    payload,
    lookupSource: "db",
  };
}

export function clearStudentVerificationCache() {
  verificationCache.clear();
}
