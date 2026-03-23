import { prisma } from "@/lib/prisma";

export type TimetableEntry = {
  id: string;
  courseId?: string;
  courseName?: string;
  yearOfStudy?: string;
  semester?: "1" | "2";
  unitCode: string;
  unitTitle: string;
  venueName?: string;
  lecturerId: string;
  lecturerName: string;
  day: string;
  startTime: string;
  endTime: string;
  status?: "Confirmed" | "Pending" | "Rescheduled" | "Canceled";
  createdAt: string;
  updatedAt?: string;
};



const isTimetableEntry = (value: unknown): value is TimetableEntry => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (typeof item.courseId === "undefined" || typeof item.courseId === "string") &&
    (typeof item.courseName === "undefined" || typeof item.courseName === "string") &&
    (typeof item.yearOfStudy === "undefined" || typeof item.yearOfStudy === "string") &&
    (typeof item.semester === "undefined" || item.semester === "1" || item.semester === "2") &&
    typeof item.unitCode === "string" &&
    typeof item.unitTitle === "string" &&
    (typeof item.venueName === "undefined" || typeof item.venueName === "string") &&
    typeof item.lecturerId === "string" &&
    typeof item.lecturerName === "string" &&
    typeof item.day === "string" &&
    typeof item.startTime === "string" &&
    typeof item.endTime === "string" &&
    (typeof item.status === "undefined" ||
      item.status === "Confirmed" ||
      item.status === "Pending" ||
      item.status === "Rescheduled" ||
      item.status === "Canceled") &&
    typeof item.createdAt === "string" &&
    (typeof item.updatedAt === "undefined" || typeof item.updatedAt === "string")
  );
};

// Fetch all timetable entries from the database
export async function getTimetableEntries(): Promise<TimetableEntry[]> {
  const entries = await prisma.timetable.findMany({
    include: {
      course: true,
      unit: true,
      lecturer: true,
    },
  });
  return entries.map((item) => ({
    id: item.id,
    courseId: item.courseId,
    courseName: item.course?.name,
    yearOfStudy: item.yearOfStudy,
    semester: item.semester,
    unitCode: item.unit?.code ?? "",
    unitTitle: item.unit?.title ?? "",
    venueName: item.venueName,
    lecturerId: item.lecturerId,
    lecturerName: item.lecturer?.fullName ?? "",
    day: item.day,
    startTime: item.startTime,
    endTime: item.endTime,
    status: item.status as any,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt?.toISOString(),
  }));

}

