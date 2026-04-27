import { prisma } from "@/lib/prisma";
import { publishTimetableUpdatedEvent } from "@/lib/timetableEvents";

/**
 * Bump the TimetableVersion for a course so mobile clients detect the change
 * via ETag / If-None-Match polling.  Fire-and-forget safe.
 */
export async function bumpTimetableVersion(courseId: string) {
  const now = new Date();
  const versionRecord = await prisma.timetableVersion.upsert({
    where: { courseId },
    update: { version: { increment: 1 }, updatedAt: now },
    create: { courseId, version: 1, updatedAt: now },
  });

  publishTimetableUpdatedEvent({
    courseId,
    version: versionRecord.version,
    updatedAt: versionRecord.updatedAt.toISOString(),
  });

  return versionRecord;
}

type CourseTimetableVersion = {
  version: number;
  updatedAt: string;
};

type CreateTimetableInput = {
  courseId: string;
  day: string;
  startTime: string;
  endTime: string;
  unitCode: string;
  unitName: string;
  venue: string;
  lecturer: string;
  lecturerId: string;
  yearOfStudy?: string;
  semester?: "1" | "2";
  status?: "Confirmed" | "Pending" | "Rescheduled" | "Canceled";
};

type UpdateTimetableInput = {
  day?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  status?: "Confirmed" | "Pending" | "Rescheduled" | "Canceled";
};



const buildCourseSnapshot = async (courseId: string) => {
  // Fetch only this course's entries + its version in parallel
  const [entries, versionRecord] = await Promise.all([
    prisma.timetable.findMany({
      where: { courseId },
      include: {
        unit: { select: { code: true, title: true } },
        lecturer: { select: { fullName: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.timetableVersion.findUnique({ where: { courseId } }),
  ]);

  const filtered = entries.map((entry) => ({
    id: entry.id,
    courseId,
    day: entry.day,
    startTime: entry.startTime,
    endTime: entry.endTime,
    unitCode: entry.unit?.code ?? "",
    unitName: entry.unit?.title ?? "",
    venue: entry.venueName ?? "",
    lecturer: entry.lecturer?.fullName ?? "",
    status: entry.status ?? "Confirmed",
    updatedAt: entry.updatedAt?.toISOString() ?? entry.createdAt.toISOString(),
  }));

  const version = versionRecord?.version ?? 0;
  const updatedAt = versionRecord?.updatedAt?.toISOString() ?? "";

  return {
    courseId,
    version,
    updatedAt,
    timetable: filtered,
  };
};


export async function getCourseTimetableSnapshot(courseId: string) {
  return buildCourseSnapshot(courseId);
}

export async function createCourseTimetableEntry(input: CreateTimetableInput) {
  const versionRecord = await bumpTimetableVersion(input.courseId);
  const nextVersion: CourseTimetableVersion = {
    version: versionRecord.version,
    updatedAt: versionRecord.updatedAt.toISOString(),
  };
  return { ok: true as const, version: nextVersion };
}

export async function updateCourseTimetableEntry(entryId: string, input: UpdateTimetableInput) {
  const dbEntry = await prisma.timetable.findUnique({
    where: { id: entryId },
    select: { id: true, courseId: true, day: true, startTime: true, endTime: true },
  });

  if (!dbEntry) {
    return { ok: false as const, status: 404, error: "Timetable entry not found." };
  }

  const courseId = dbEntry.courseId?.trim() ?? "";
  if (!courseId) {
    return {
      ok: false as const,
      status: 400,
      error: "Timetable entry has no courseId. Migrate legacy entries before editing.",
    };
  }

  const nextStart = input.startTime?.trim() ?? dbEntry.startTime;
  const nextEnd = input.endTime?.trim() ?? dbEntry.endTime;

  if (nextStart >= nextEnd) {
    return { ok: false as const, status: 400, error: "endTime must be after startTime." };
  }

  const versionRecord = await bumpTimetableVersion(courseId);
  return {
    ok: true as const,
    version: { version: versionRecord.version, updatedAt: versionRecord.updatedAt.toISOString() } satisfies CourseTimetableVersion,
  };
}

export async function deleteCourseTimetableEntry(entryId: string) {
  const dbEntry = await prisma.timetable.findUnique({
    where: { id: entryId },
    select: { id: true, courseId: true },
  });

  if (!dbEntry) {
    return { ok: false as const, status: 404, error: "Timetable entry not found." };
  }

  const courseId = dbEntry.courseId?.trim() ?? "";
  if (!courseId) {
    return {
      ok: false as const,
      status: 400,
      error: "Timetable entry has no courseId. Migrate legacy entries before deleting.",
    };
  }

  const versionRecord = await bumpTimetableVersion(courseId);
  return {
    ok: true as const,
    version: { version: versionRecord.version, updatedAt: versionRecord.updatedAt.toISOString() } satisfies CourseTimetableVersion,
  };
}
