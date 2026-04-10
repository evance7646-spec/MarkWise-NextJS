/**
 * POST /api/reports/generate
 *
 * Generates an academic report for the authenticated lecturer and uploads it
 * to Vercel Blob storage, returning a publicly-accessible URL.
 *
 * Auth: Bearer <lecturerToken>
 *
 * Body:
 * {
 *   period:     "weekly" | "monthly" | "semester"
 *   types:      string[]   – "attendance"|"performance"|"assignments"|"students"|"sessions"|"comprehensive"
 *   format:     "pdf" | "csv" | "excel"
 *   unitCodes:  string[]   – unit codes to scope the report (required, non-empty)
 *   startDate:  "YYYY-MM-DD"
 *   endDate:    "YYYY-MM-DD"
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   reportId: string,
 *   fileUrl: string,        // publicly accessible Vercel Blob URL
 *   fileSizeBytes: number,
 *   generatedAt: string
 * }
 *
 * Errors use { message: "..." } (not { error: "..." }).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLecturerAccessToken } from "@/lib/lecturerAuthJwt";
import { normalizeUnitCode } from "@/lib/unitCode";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const VALID_PERIODS = ["weekly", "monthly", "semester"] as const;
const VALID_TYPES = ["attendance", "performance", "assignments", "students", "sessions", "comprehensive"] as const;
const VALID_FORMATS = ["pdf", "csv", "excel"] as const;

type Period = (typeof VALID_PERIODS)[number];
type ReportType = (typeof VALID_TYPES)[number];
type Format = (typeof VALID_FORMATS)[number];

const MIME_MAP: Record<Format, string> = {
  pdf:   "application/pdf",
  csv:   "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ─────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────
function apiErr(msg: string, status: number): NextResponse {
  return NextResponse.json({ message: msg }, { status, headers: corsHeaders });
}

function parseCalendarDate(s: string): Date | null {
  const d = new Date(s + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────
// Data gathering helpers
// ─────────────────────────────────────────────────────────────────
async function gatherAttendanceData(lecturerId: string, unitCodes: string[], start: Date, end: Date) {
  const [offlineRecords, onlineSessions] = await Promise.all([
    prisma.offlineAttendanceRecord.findMany({
      where: {
        unitCode: { in: unitCodes },
        markedByLecturerId: lecturerId,
        sessionStart: { gte: start, lte: end },
      },
      select: {
        unitCode: true,
        studentId: true,
        sessionStart: true,
        method: true,
        admissionNumber: true,
      },
    }),
    prisma.onlineAttendanceSession.findMany({
      where: {
        lecturerId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        records: {
          select: { studentId: true, unitCode: true, admissionNumber: true, markedAt: true },
        },
      },
    }),
  ]);

  // Combine offline + online into a unified list keyed by (unitCode, sessionKey)
  const allRecords: Array<{
    unitCode: string;
    studentId: string;
    sessionKey: string;
    admissionNumber: string;
  }> = [];

  for (const r of offlineRecords) {
    allRecords.push({
      unitCode: normalizeUnitCode(r.unitCode),
      studentId: r.studentId,
      sessionKey: r.sessionStart.toISOString(),
      admissionNumber: r.admissionNumber ?? r.studentId,
    });
  }
  for (const s of onlineSessions) {
    for (const r of s.records) {
      allRecords.push({
        unitCode: normalizeUnitCode(r.unitCode || s.unitCode),
        studentId: r.studentId,
        sessionKey: s.createdAt.toISOString(),
        admissionNumber: r.admissionNumber ?? r.studentId,
      });
    }
  }

  // Per-unit stats
  const byUnit = new Map<string, { sessions: Set<string>; students: Map<string, number> }>();
  for (const r of allRecords) {
    if (!byUnit.has(r.unitCode)) byUnit.set(r.unitCode, { sessions: new Set(), students: new Map() });
    const u = byUnit.get(r.unitCode)!;
    u.sessions.add(r.sessionKey);
    u.students.set(r.studentId, (u.students.get(r.studentId) ?? 0) + 1);
  }

  return Array.from(byUnit.entries()).map(([unitCode, data]) => ({
    unitCode,
    totalSessions: data.sessions.size,
    totalStudentAttendances: allRecords.filter((r) => r.unitCode === unitCode).length,
    uniqueStudents: data.students.size,
    perStudent: Array.from(data.students.entries()).map(([studentId, count]) => ({
      studentId,
      attendanceCount: count,
      attendanceRate: data.sessions.size > 0 ? Math.round((count / data.sessions.size) * 100) : 0,
    })),
  }));
}

async function gatherPerformanceData(lecturerId: string, unitCodes: string[], start: Date, end: Date) {
  const [sessions, timetable] = await Promise.all([
    prisma.conductedSession.findMany({
      where: { lecturerId, unitCode: { in: unitCodes }, sessionStart: { gte: start, lte: end } },
      orderBy: { sessionStart: "asc" },
    }),
    prisma.timetable.findMany({
      where: { lecturerId, unit: { code: { in: unitCodes } } },
      select: { status: true, lessonType: true, unit: { select: { code: true } } },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  const lessonTypeCounts: Record<string, number> = {};
  for (const t of timetable) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    lessonTypeCounts[t.lessonType] = (lessonTypeCounts[t.lessonType] ?? 0) + 1;
  }

  return {
    conductedSessions: sessions.length,
    timetableEntries: timetable.length,
    statusBreakdown: statusCounts,
    lessonTypeBreakdown: lessonTypeCounts,
    completionRate: timetable.length > 0
      ? Math.round(((timetable.length - (statusCounts["Cancelled"] ?? 0)) / timetable.length) * 100)
      : 0,
    recentSessions: sessions.slice(0, 50).map((s) => ({
      unitCode: normalizeUnitCode(s.unitCode),
      room: s.lectureRoom,
      lessonType: s.lessonType ?? "LEC",
      start: s.sessionStart.toISOString(),
      end: s.sessionEnd?.toISOString() ?? null,
    })),
  };
}

async function gatherAssignmentsData(lecturerId: string, unitCodes: string[], start: Date, end: Date) {
  const units = await prisma.unit.findMany({
    where: { code: { in: unitCodes } },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  const assignments = await prisma.assignment.findMany({
    where: {
      lecturerId,
      unitId: { in: unitIds },
      dueDate: { gte: start, lte: end },
    },
    include: {
      submissions: {
        select: { submittedAt: true, status: true, grade: true, studentId: true },
      },
      _count: { select: { submissions: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return assignments.map((a) => {
    const totalSubs = a.submissions.length;
    const gradedSubs = a.submissions.filter((s) => s.grade !== null);
    const grades = gradedSubs.map((s) => s.grade!);
    const avgGrade = grades.length > 0 ? grades.reduce((x, y) => x + y, 0) / grades.length : null;
    const lateSubs = a.submissions.filter((s) => s.submittedAt > a.dueDate).length;

    return {
      id: a.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate.toISOString(),
      maxScore: a.maxScore,
      totalSubmissions: totalSubs,
      gradedSubmissions: gradedSubs.length,
      lateSubmissions: lateSubs,
      averageGrade: avgGrade !== null ? Math.round(avgGrade * 10) / 10 : null,
      submissionRate: a.maxScore ? Math.round((totalSubs / (a.maxScore || 1)) * 100) : null,
    };
  });
}

async function gatherStudentsData(
  lecturerId: string,
  unitCodes: string[],
  start: Date,
  end: Date,
) {
  // Get enrollments for the lecturer's units
  const units = await prisma.unit.findMany({
    where: { code: { in: unitCodes } },
    select: { id: true, code: true, title: true },
  });
  const unitIds = units.map((u) => u.id);

  const enrollments = await prisma.enrollment.findMany({
    where: { unitId: { in: unitIds } },
    select: { studentId: true, unitId: true, student: { select: { fullName: true, admissionNumber: true } } },
  });

  // Offline attendance in range
  const attendance = await prisma.offlineAttendanceRecord.findMany({
    where: {
      unitCode: { in: unitCodes },
      markedByLecturerId: lecturerId,
      sessionStart: { gte: start, lte: end },
    },
    select: { studentId: true, unitCode: true, sessionStart: true },
  });

  // Total sessions per unit in range
  const sessionsByUnit: Record<string, Set<string>> = {};
  for (const r of attendance) {
    const uc = normalizeUnitCode(r.unitCode);
    if (!sessionsByUnit[uc]) sessionsByUnit[uc] = new Set();
    sessionsByUnit[uc].add(r.sessionStart.toISOString());
  }

  // Per-student attendance count
  const attendanceCount: Record<string, number> = {};
  for (const r of attendance) {
    attendanceCount[r.studentId] = (attendanceCount[r.studentId] ?? 0) + 1;
  }

  const studentMap = new Map<string, { fullName: string; admissionNumber: string; unitCodes: string[] }>();
  for (const e of enrollments) {
    const unitCode = units.find((u) => u.id === e.unitId)?.code ?? "";
    if (!studentMap.has(e.studentId)) {
      studentMap.set(e.studentId, {
        fullName: e.student?.fullName ?? e.studentId,
        admissionNumber: e.student?.admissionNumber ?? "",
        unitCodes: [],
      });
    }
    studentMap.get(e.studentId)!.unitCodes.push(normalizeUnitCode(unitCode));
  }

  const studentList = Array.from(studentMap.entries()).map(([studentId, info]) => {
    const totalPossible = info.unitCodes.reduce(
      (sum, uc) => sum + (sessionsByUnit[uc]?.size ?? 0),
      0,
    );
    const attended = attendanceCount[studentId] ?? 0;
    const rate = totalPossible > 0 ? Math.round((attended / totalPossible) * 100) : 0;
    return { studentId, ...info, attended, totalPossible, attendanceRate: rate };
  });

  const atRisk = studentList.filter((s) => s.attendanceRate < 60 && s.totalPossible > 0);
  const topAttendees = [...studentList].sort((a, b) => b.attendanceRate - a.attendanceRate).slice(0, 10);

  return { total: studentList.length, atRisk, topAttendees, all: studentList };
}

async function gatherSessionsData(lecturerId: string, unitCodes: string[], start: Date, end: Date) {
  const sessions = await prisma.conductedSession.findMany({
    where: { lecturerId, unitCode: { in: unitCodes }, sessionStart: { gte: start, lte: end } },
    orderBy: { sessionStart: "asc" },
  });

  return sessions.map((s) => ({
    unitCode: normalizeUnitCode(s.unitCode),
    room: s.lectureRoom,
    lessonType: s.lessonType ?? "LEC",
    start: s.sessionStart.toISOString(),
    end: s.sessionEnd?.toISOString() ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────
// PDF builder
// ─────────────────────────────────────────────────────────────────
async function buildPdf(
  data: Record<string, unknown>,
  lecturerName: string,
  period: Period,
  types: ReportType[],
  startDate: Date,
  endDate: Date,
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    // Cover section
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("MarkWise Academic Report", { align: "center" })
      .moveDown(0.5);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text(`Lecturer: ${lecturerName}`, { align: "center" })
      .text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)} (${fmt(startDate)} – ${fmt(endDate)})`, { align: "center" })
      .text(`Generated: ${fmt(new Date())}`, { align: "center" })
      .moveDown(1);

    const effectiveTypes = types.includes("comprehensive")
      ? (["attendance", "performance", "assignments", "students", "sessions"] as ReportType[])
      : types;

    for (const type of effectiveTypes) {
      doc.addPage();
      doc.fontSize(15).font("Helvetica-Bold").text(type.charAt(0).toUpperCase() + type.slice(1), { underline: true }).moveDown(0.5);
      doc.fontSize(10).font("Helvetica");

      if (type === "attendance") {
        const rows = data.attendance as Awaited<ReturnType<typeof gatherAttendanceData>>;
        if (!rows?.length) { doc.text("No attendance records in this period."); continue; }
        for (const u of rows) {
          doc.font("Helvetica-Bold").text(`Unit: ${u.unitCode}`).font("Helvetica");
          doc.text(`  Sessions: ${u.totalSessions}  |  Unique Students: ${u.uniqueStudents}  |  Total Attendances: ${u.totalStudentAttendances}`);
          doc.moveDown(0.3);
          for (const s of u.perStudent.slice(0, 30)) {
            doc.text(`    ${s.studentId}: ${s.attendanceCount} / ${u.totalSessions} sessions (${s.attendanceRate}%)`);
          }
          if (u.perStudent.length > 30) doc.text(`    ... and ${u.perStudent.length - 30} more students`);
          doc.moveDown(0.5);
        }
      } else if (type === "performance") {
        const d = data.performance as Awaited<ReturnType<typeof gatherPerformanceData>>;
        if (!d) { doc.text("No performance data available."); continue; }
        doc.text(`Completion Rate: ${d.completionRate}%`);
        doc.text(`Timetable Entries: ${d.timetableEntries}  |  Conducted Sessions: ${d.conductedSessions}`);
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text("Status Breakdown:").font("Helvetica");
        for (const [k, v] of Object.entries(d.statusBreakdown)) doc.text(`  ${k}: ${v}`);
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text("Lesson Type Breakdown:").font("Helvetica");
        for (const [k, v] of Object.entries(d.lessonTypeBreakdown)) doc.text(`  ${k}: ${v}`);
        doc.moveDown(0.3);
        if (d.recentSessions.length) {
          doc.font("Helvetica-Bold").text("Recent Sessions:").font("Helvetica");
          for (const s of d.recentSessions.slice(0, 20)) {
            doc.text(`  ${new Date(s.start).toLocaleDateString("en-GB")}  ${s.unitCode}  ${s.lessonType}  ${s.room}`);
          }
        }
      } else if (type === "assignments") {
        const rows = data.assignments as Awaited<ReturnType<typeof gatherAssignmentsData>>;
        if (!rows?.length) { doc.text("No assignments due in this period."); continue; }
        for (const a of rows) {
          doc.font("Helvetica-Bold").text(`${a.title}`).font("Helvetica");
          doc.text(`  Due: ${new Date(a.dueDate).toLocaleDateString("en-GB")}  |  Type: ${a.type}  |  Max Score: ${a.maxScore ?? "N/A"}`);
          doc.text(`  Submissions: ${a.totalSubmissions}  |  Graded: ${a.gradedSubmissions}  |  Late: ${a.lateSubmissions}`);
          if (a.averageGrade !== null) doc.text(`  Average Grade: ${a.averageGrade}`);
          doc.moveDown(0.5);
        }
      } else if (type === "students") {
        const d = data.students as Awaited<ReturnType<typeof gatherStudentsData>>;
        if (!d) { doc.text("No student data available."); continue; }
        doc.text(`Total Enrolled Students: ${d.total}`);
        doc.text(`At-Risk Students (attendance < 60%): ${d.atRisk.length}`);
        doc.moveDown(0.3);
        if (d.atRisk.length) {
          doc.font("Helvetica-Bold").text("At-Risk Students:").font("Helvetica");
          for (const s of d.atRisk.slice(0, 20)) {
            doc.text(`  ${s.fullName || s.studentId} (${s.admissionNumber}) - ${s.attendanceRate}% (${s.attended}/${s.totalPossible})`);
          }
        }
        doc.moveDown(0.3);
        doc.font("Helvetica-Bold").text("Top Attendees:").font("Helvetica");
        for (const s of d.topAttendees.slice(0, 10)) {
          doc.text(`  ${s.fullName || s.studentId} - ${s.attendanceRate}%`);
        }
      } else if (type === "sessions") {
        const rows = data.sessions as Awaited<ReturnType<typeof gatherSessionsData>>;
        if (!rows?.length) { doc.text("No sessions recorded in this period."); continue; }
        for (const s of rows) {
          doc.text(`  ${new Date(s.start).toLocaleDateString("en-GB")}  ${s.start.slice(11, 16)}–${(s.end ?? "").slice(11, 16)}  ${s.unitCode}  ${s.lessonType}  ${s.room}`);
        }
      }
    }

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────
// CSV builder
// ─────────────────────────────────────────────────────────────────
function buildCsv(
  data: Record<string, unknown>,
  types: ReportType[],
  period: Period,
  startDate: Date,
  endDate: Date,
  lecturerName: string,
): string {
  const lines: string[] = [];
  const row = (...cells: (string | number | null | undefined)[]) =>
    lines.push(cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));

  row("MarkWise Academic Report");
  row("Lecturer", lecturerName);
  row("Period", period.charAt(0).toUpperCase() + period.slice(1));
  row("Date Range", `${fmtDate(startDate)} to ${fmtDate(endDate)}`);
  row("Generated", new Date().toISOString());
  lines.push("");

  const effectiveTypes = types.includes("comprehensive")
    ? (["attendance", "performance", "assignments", "students", "sessions"] as ReportType[])
    : types;

  for (const type of effectiveTypes) {
    row(`=== ${type.toUpperCase()} ===`);

    if (type === "attendance") {
      const rows = data.attendance as Awaited<ReturnType<typeof gatherAttendanceData>>;
      row("Unit Code", "Total Sessions", "Unique Students", "Total Attendances");
      for (const u of rows ?? []) {
        row(u.unitCode, u.totalSessions, u.uniqueStudents, u.totalStudentAttendances);
        row("  Student ID", "Attendance Count", "Rate (%)");
        for (const s of u.perStudent) row(`  ${s.studentId}`, s.attendanceCount, s.attendanceRate);
      }
    } else if (type === "performance") {
      const d = data.performance as Awaited<ReturnType<typeof gatherPerformanceData>>;
      row("Completion Rate (%)", d?.completionRate ?? "");
      row("Timetable Entries", d?.timetableEntries ?? "");
      row("Conducted Sessions", d?.conductedSessions ?? "");
      lines.push("");
      row("Status", "Count");
      for (const [k, v] of Object.entries(d?.statusBreakdown ?? {})) row(k, v);
      lines.push("");
      row("Lesson Type", "Count");
      for (const [k, v] of Object.entries(d?.lessonTypeBreakdown ?? {})) row(k, v);
    } else if (type === "assignments") {
      const rows = data.assignments as Awaited<ReturnType<typeof gatherAssignmentsData>>;
      row("Title", "Type", "Due Date", "Max Score", "Submissions", "Graded", "Late", "Avg Grade");
      for (const a of rows ?? []) {
        row(a.title, a.type, a.dueDate, a.maxScore ?? "", a.totalSubmissions, a.gradedSubmissions, a.lateSubmissions, a.averageGrade ?? "");
      }
    } else if (type === "students") {
      const d = data.students as Awaited<ReturnType<typeof gatherStudentsData>>;
      row("Student ID", "Name", "Admission No.", "Attended", "Total Possible", "Attendance Rate (%)");
      for (const s of d?.all ?? []) {
        row(s.studentId, s.fullName, s.admissionNumber, s.attended, s.totalPossible, s.attendanceRate);
      }
    } else if (type === "sessions") {
      const rows = data.sessions as Awaited<ReturnType<typeof gatherSessionsData>>;
      row("Unit Code", "Lesson Type", "Room", "Start", "End");
      for (const s of rows ?? []) {
        row(s.unitCode, s.lessonType, s.room, s.start, s.end ?? "");
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Excel builder
// ─────────────────────────────────────────────────────────────────
function buildExcel(
  data: Record<string, unknown>,
  types: ReportType[],
  period: Period,
  startDate: Date,
  endDate: Date,
  lecturerName: string,
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  // Cover sheet
  const coverData = [
    ["MarkWise Academic Report"],
    ["Lecturer", lecturerName],
    ["Period", period.charAt(0).toUpperCase() + period.slice(1)],
    ["Date Range", `${fmtDate(startDate)} – ${fmtDate(endDate)}`],
    ["Generated", new Date().toISOString()],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(coverData), "Cover");

  const effectiveTypes = types.includes("comprehensive")
    ? (["attendance", "performance", "assignments", "students", "sessions"] as ReportType[])
    : types;

  for (const type of effectiveTypes) {
    const sheetName = type.charAt(0).toUpperCase() + type.slice(1);

    if (type === "attendance") {
      const rows = data.attendance as Awaited<ReturnType<typeof gatherAttendanceData>>;
      const sheetData: (string | number)[][] = [
        ["Unit Code", "Total Sessions", "Unique Students", "Total Attendances"],
      ];
      for (const u of rows ?? []) {
        sheetData.push([u.unitCode, u.totalSessions, u.uniqueStudents, u.totalStudentAttendances]);
        sheetData.push(["Student ID", "Attendance Count", "Rate (%)"]);
        for (const s of u.perStudent) sheetData.push([s.studentId, s.attendanceCount, s.attendanceRate]);
        sheetData.push([]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
    } else if (type === "performance") {
      const d = data.performance as Awaited<ReturnType<typeof gatherPerformanceData>>;
      const sheetData: (string | number)[][] = [
        ["Metric", "Value"],
        ["Completion Rate (%)", d?.completionRate ?? ""],
        ["Timetable Entries", d?.timetableEntries ?? ""],
        ["Conducted Sessions", d?.conductedSessions ?? ""],
        [],
        ["Status", "Count"],
        ...Object.entries(d?.statusBreakdown ?? {}).map(([k, v]) => [k, v]),
        [],
        ["Lesson Type", "Count"],
        ...Object.entries(d?.lessonTypeBreakdown ?? {}).map(([k, v]) => [k, v]),
        [],
        ["Unit Code", "Lesson Type", "Room", "Start", "End"],
        ...(d?.recentSessions ?? []).map((s) => [s.unitCode, s.lessonType, s.room, s.start, s.end ?? ""]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
    } else if (type === "assignments") {
      const rows = data.assignments as Awaited<ReturnType<typeof gatherAssignmentsData>>;
      const sheetData: (string | number | null)[][] = [
        ["Title", "Type", "Due Date", "Max Score", "Submissions", "Graded", "Late", "Avg Grade"],
        ...(rows ?? []).map((a) => [
          a.title, a.type, a.dueDate, a.maxScore ?? null,
          a.totalSubmissions, a.gradedSubmissions, a.lateSubmissions, a.averageGrade ?? null,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
    } else if (type === "students") {
      const d = data.students as Awaited<ReturnType<typeof gatherStudentsData>>;
      const sheetData: (string | number)[][] = [
        ["Student ID", "Name", "Admission No.", "Attended", "Total Possible", "Attendance Rate (%)"],
        ...(d?.all ?? []).map((s) => [
          s.studentId, s.fullName, s.admissionNumber, s.attended, s.totalPossible, s.attendanceRate,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
    } else if (type === "sessions") {
      const rows = data.sessions as Awaited<ReturnType<typeof gatherSessionsData>>;
      const sheetData: (string | null)[][] = [
        ["Unit Code", "Lesson Type", "Room", "Start", "End"],
        ...(rows ?? []).map((s) => [s.unitCode, s.lessonType, s.room, s.start, s.end]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
    }
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ─────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!token) return apiErr("Unauthorized", 401);

  let lecturerId: string;
  try {
    ({ lecturerId } = verifyLecturerAccessToken(token));
  } catch {
    return apiErr("Unauthorized", 401);
  }

  // ── Parse body ────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiErr("Invalid JSON body.", 400);
  }

  const { period, types, format, unitCodes, startDate, endDate } = body ?? {};

  // ── Validate ──────────────────────────────────────────────────
  if (!period || !VALID_PERIODS.includes(period as Period))
    return apiErr(`period must be one of: ${VALID_PERIODS.join(", ")}`, 400);

  if (!Array.isArray(types) || types.length === 0)
    return apiErr("types is required and must be a non-empty array", 400);
  for (const t of types as unknown[]) {
    if (!VALID_TYPES.includes(t as ReportType))
      return apiErr(`Invalid report type: ${t}`, 400);
  }

  if (!format || !VALID_FORMATS.includes(format as Format))
    return apiErr(`format must be one of: ${VALID_FORMATS.join(", ")}`, 400);

  if (!unitCodes) return apiErr("unitCodes is required", 400);
  if (!Array.isArray(unitCodes) || unitCodes.length === 0) return apiErr("No unit codes provided", 400);

  if (!startDate || typeof startDate !== "string") return apiErr("startDate is required (YYYY-MM-DD)", 400);
  if (!endDate   || typeof endDate   !== "string") return apiErr("endDate is required (YYYY-MM-DD)", 400);

  const parsedStart = parseCalendarDate(startDate);
  const parsedEnd   = parseCalendarDate(endDate);
  if (!parsedStart) return apiErr("startDate is not a valid date (use YYYY-MM-DD)", 400);
  if (!parsedEnd)   return apiErr("endDate is not a valid date (use YYYY-MM-DD)", 400);
  parsedEnd.setUTCHours(23, 59, 59, 999);

  const validPeriod  = period  as Period;
  const validTypes   = types   as ReportType[];
  const validFormat  = format  as Format;
  const normalizedCodes = (unitCodes as string[]).map((c) => normalizeUnitCode(c)).filter(Boolean);

  try {
    // ── Gather reporter identity ──────────────────────────────
    const lecturer = await prisma.lecturer.findUnique({
      where: { id: lecturerId },
      select: { fullName: true },
    });
    const lecturerName = lecturer?.fullName ?? lecturerId;

    // ── Gather data ───────────────────────────────────────────
    const effectiveTypes = validTypes.includes("comprehensive")
      ? (["attendance", "performance", "assignments", "students", "sessions"] as ReportType[])
      : validTypes;

    const data: Record<string, unknown> = {};
    await Promise.all(effectiveTypes.map(async (type) => {
      if (type === "attendance")  data.attendance  = await gatherAttendanceData(lecturerId, normalizedCodes, parsedStart, parsedEnd);
      if (type === "performance") data.performance = await gatherPerformanceData(lecturerId, normalizedCodes, parsedStart, parsedEnd);
      if (type === "assignments") data.assignments = await gatherAssignmentsData(lecturerId, normalizedCodes, parsedStart, parsedEnd);
      if (type === "students")    data.students    = await gatherStudentsData(lecturerId, normalizedCodes, parsedStart, parsedEnd);
      if (type === "sessions")    data.sessions    = await gatherSessionsData(lecturerId, normalizedCodes, parsedStart, parsedEnd);
    }));

    // ── Build file buffer ─────────────────────────────────────
    let fileBuffer: Buffer;
    const ext = validFormat === "pdf" ? "pdf" : validFormat === "csv" ? "csv" : "xlsx";

    try {
      if (validFormat === "pdf") {
        fileBuffer = await buildPdf(data, lecturerName, validPeriod, validTypes, parsedStart, parsedEnd);
      } else if (validFormat === "csv") {
        fileBuffer = Buffer.from(buildCsv(data, validTypes, validPeriod, parsedStart, parsedEnd, lecturerName), "utf-8");
      } else {
        fileBuffer = buildExcel(data, validTypes, validPeriod, parsedStart, parsedEnd, lecturerName);
      }
    } catch (buildErr) {
      console.error("[reports/generate] file build error:", buildErr);
      return apiErr("Failed to generate report file", 500);
    }

    // ── Upload to Vercel Blob ─────────────────────────────────
    const blobName = `reports/${lecturerId.slice(0, 8)}_${Date.now()}.${ext}`;
    const mimeType = MIME_MAP[validFormat];

    let fileUrl: string;
    try {
      const blob = await put(blobName, fileBuffer, {
        access: "public",
        contentType: mimeType,
      });
      fileUrl = blob.url;
    } catch (uploadErr) {
      console.error("[reports/generate] upload error:", uploadErr);
      return apiErr("Failed to upload report", 500);
    }

    // ── Persist report record ─────────────────────────────────
    const report = await prisma.lecturerReport.create({
      data: {
        lecturerId,
        period:        validPeriod,
        types:         validTypes,
        format:        validFormat,
        unitCodes:     normalizedCodes,
        startDate:     parsedStart,
        endDate:       parsedEnd,
        fileUrl,
        fileSizeBytes: fileBuffer.length,
      },
    });

    return NextResponse.json(
      {
        success:       true,
        reportId:      report.id,
        fileUrl:       report.fileUrl,
        url:           report.fileUrl,
        downloadUrl:   report.fileUrl,
        fileSizeBytes: report.fileSizeBytes,
        generatedAt:   report.generatedAt.toISOString(),
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (fatal) {
    console.error("[reports/generate] fatal error:", fatal);
    return apiErr("An unexpected error occurred while generating the report", 500);
  }
}
