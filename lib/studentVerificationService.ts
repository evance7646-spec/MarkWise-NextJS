import { findCourseById, type CourseRecord } from "@/lib/courseStore";
import { findStudentByAdmissionIndexed, normalizeAdmission } from "@/lib/studentStore.server";

type VerificationPayload = {
  exists: boolean;
  admissionNumber: string;
  fullName: string | null;
  course: {
    id: string;
    code: string;
    name: string;
  } | null;
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
      course: null,
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

  const course = await findCourseById(lookup.student.courseId?.trim() ?? "");
  const payload: VerificationPayload = {
    exists: true,
    admissionNumber: normalizedAdmission,
    fullName: lookup.student.name,
    course: asCoursePayload(course),
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

export function clearStudentVerificationCache() {
  verificationCache.clear();
}
