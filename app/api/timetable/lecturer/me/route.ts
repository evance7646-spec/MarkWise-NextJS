import { NextResponse } from "next/server";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { prisma } from "@/lib/prisma";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const dayOrder: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

/** Returns the most recent Saturday at 00:00:00 local server time. */
function getMostRecentSaturdayMidnight(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const daysAgo = day === 6 ? 0 : day + 1;
  const sat = new Date(now);
  sat.setDate(sat.getDate() - daysAgo);
  sat.setHours(0, 0, 0, 0);
  return sat;
}

function getEffectiveStatus(
  status: string,
  reschedulePermanent: boolean | null | undefined,
  updatedAt: Date | null | undefined,
): string {
  if (!["Cancelled", "Rescheduled", "Online"].includes(status)) return status;
  if (reschedulePermanent === true) return status;
  const lastReset = getMostRecentSaturdayMidnight();
  if (updatedAt && updatedAt < lastReset) return "Pending";
  return status;
}

export async function GET(request: Request) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header." },
        { status: 401, headers: corsHeaders },
      );
    }

    let lecturerId: string;
    try {
      ({ lecturerId } = verifyLecturerAccessToken(token));
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 401, headers: corsHeaders },
      );
    }

    // Query only this lecturer's entries directly — do not load all timetable rows
    const rows = await prisma.timetable.findMany({
      where: { lecturerId },
      include: {
        unit: { select: { id: true, code: true, title: true } },
        course: { select: { id: true, name: true } },
        lecturer: { select: { fullName: true } },
        room: { select: { name: true, roomCode: true } },
      },
    });


    const entries = rows
      .map((item) => {
        const effectiveStatus = getEffectiveStatus(
          item.status,
          item.reschedulePermanent,
          item.updatedAt,
        );
        const wasReset = effectiveStatus !== item.status;
        let effectiveVenue: string | null;
        if (wasReset) {
          effectiveVenue = (item as any).originalVenue || (item.room as any)?.name || item.venueName || "TBA";
        } else if (item.venueName === null) {
          effectiveVenue = null;
        } else {
          effectiveVenue = (item.room as any)?.name || item.venueName || "TBA";
        }
        return {
          id: item.id,
          courseId: item.courseId,
          courseName: item.course?.name ?? "",
          yearOfStudy: item.yearOfStudy,
          semester: item.semester,
          unitCode: normalizeUnitCode(item.unit?.code ?? ""),
          unitTitle: item.unit?.title ?? "",
          venueName: wasReset ? (effectiveVenue ?? "") : (item.venueName ?? null),
          venue: wasReset ? (effectiveVenue ?? "TBA") : effectiveVenue,
          roomCode: item.venueName === null && !wasReset ? null : ((item.room as any)?.roomCode ?? ""),
          lectureRoom: item.venueName === null && !wasReset ? null : ((item.room as any)?.name ?? item.venueName ?? ""),
          originalVenue: wasReset ? null : ((item as any).originalVenue ?? null),
          type: (item as any).lessonType ?? "LEC",
          lessonType: (item as any).lessonType ?? "LEC",
          lecturerId: item.lecturerId,
          lecturerName: item.lecturer?.fullName ?? "",
          day: item.day,
          startTime: item.startTime,
          endTime: item.endTime,
          status: effectiveStatus,
          reschedulePermanent: wasReset ? null : (item.reschedulePermanent ?? null),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt?.toISOString(),
          updatedBy: wasReset ? "system" : (item.updatedBy ?? null),
        };
      })
      .sort((a, b) => {
        const dayDelta =
          (dayOrder[a.day?.toLowerCase()] ?? 99) -
          (dayOrder[b.day?.toLowerCase()] ?? 99);
        if (dayDelta !== 0) return dayDelta;
        return a.startTime.localeCompare(b.startTime);
      });

    // Deduplicated unit list — useful for dropdowns in the mobile app
    const seenUnitIds = new Set<string>();
    const units: { unitCode: string; unitTitle: string }[] = [];
    for (const row of rows) {
      if (row.unit && !seenUnitIds.has(row.unit.id)) {
        seenUnitIds.add(row.unit.id);
        units.push({ unitCode: normalizeUnitCode(row.unit.code), unitTitle: row.unit.title });
      }
    }
    units.sort((a, b) => a.unitCode.localeCompare(b.unitCode));

    return NextResponse.json(
      { lecturerId, entries, units },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Error in lecturer timetable API:", error);
    return NextResponse.json(
      { error: "Failed to load lecturer timetable." },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}