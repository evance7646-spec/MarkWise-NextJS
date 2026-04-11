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
 *   types:      string[]
 *   format:     "pdf" | "csv" | "excel"
 *   department: string      (display name for report header)
 *   unitCodes:  string[]
 *   startDate:  "YYYY-MM-DD"
 *   endDate:    "YYYY-MM-DD"
 * }
 *
 * Returns: { fileUrl: string }
 * Errors:  { message: string }
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
const VALID_PERIODS  = ["weekly", "monthly", "semester"] as const;
const VALID_TYPES    = ["attendance", "performance", "assignments", "students", "sessions", "comprehensive"] as const;
const VALID_FORMATS  = ["pdf", "csv", "excel"] as const;

type Period     = (typeof VALID_PERIODS)[number];
type ReportType = (typeof VALID_TYPES)[number];
type Format     = (typeof VALID_FORMATS)[number];

const MIME_MAP: Record<Format, string> = {
  pdf:   "application/pdf",
  csv:   "text/csv",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// Attendance status thresholds
const THRESHOLD_GOOD    = 75;  // >= 75%: Good
const THRESHOLD_AT_RISK = 60;  // 60-74%: At Risk; < 60%: Warning

const STATUS_COLORS: Record<string, string> = {
  Good:      "#D1FAE5",
  "At Risk": "#FEF3C7",
  Warning:   "#FEE2E2",
};

const STATUS_SORT: Record<string, number> = {
  Warning:   0,
  "At Risk": 1,
  Good:      2,
};

// ─────────────────────────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────────────────────────
interface SessionRow {
  index:        number;    // 1-based lecture number
  sessionStart: Date;
  lectureRoom:  string;
  lessonType:   string;
  key:          string;    // "${lectureRoom}_${sessionStart.toISOString()}" for presence lookup
}

interface StudentRow {
  studentId:       string;
  admissionNumber: string;
  name:            string;
  attended:        number;
  totalSessions:   number;
  rate:            number;
  status:          "Good" | "At Risk" | "Warning";
}

interface UnitReportData {
  unitCode:        string;
  unitName:        string;
  department:      string;
  lecturerName:    string;
  institutionName: string;
  sessions:        SessionRow[];
  students:        StudentRow[];
  presenceMap:     Set<string>;  // "${studentId}__${sessionKey}"
  summary: {
    totalEnrolled:    number;
    totalSessions:    number;
    avgAttendance:    number;
    trend:            string;    // e.g. "▲ +5%" | "▼ -3%" | "→ No change"
    belowThreshold75: number;
    belowThreshold60: number;
  };
}

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

function fmtDateTime(d: Date): string {
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

function studentStatus(rate: number): "Good" | "At Risk" | "Warning" {
  if (rate >= THRESHOLD_GOOD)    return "Good";
  if (rate >= THRESHOLD_AT_RISK) return "At Risk";
  return "Warning";
}

// ─────────────────────────────────────────────────────────────────
// Per-unit data gatherer
// ─────────────────────────────────────────────────────────────────
async function gatherUnitReportData(
  unitCode: string,
  lecturerId: string,
  lecturerName: string,
  institutionName: string,
  departmentLabel: string,
  start: Date,
  end: Date,
): Promise<UnitReportData> {
  const norm = normalizeUnitCode(unitCode);

  // 1. Unit info
  const unit = await prisma.unit.findFirst({
    where: { code: { equals: norm, mode: "insensitive" } },
    select: { id: true, title: true, code: true, department: { select: { name: true } } },
  });
  const unitName   = unit?.title                ?? unitCode;
  const department = departmentLabel || unit?.department?.name ?? "";

  // 2. Enrolled students
  const enrollments = unit
    ? await prisma.enrollment.findMany({
        where: { unitId: unit.id },
        select: {
          studentId: true,
          student: { select: { name: true, admissionNumber: true } },
        },
      })
    : [];
  const roster = enrollments.map((e) => ({
    studentId:       e.studentId,
    admissionNumber: e.student?.admissionNumber ?? "",
    name:            e.student?.name ?? e.studentId,
  }));

  // 3. Conducted sessions in the date range
  const conductedSessions = await prisma.conductedSession.findMany({
    where: {
      lecturerId,
      unitCode: { equals: norm, mode: "insensitive" },
      sessionStart: { gte: start, lte: end },
    },
    orderBy: { sessionStart: "asc" },
  });
  const sessions: SessionRow[] = conductedSessions.map((s, i) => ({
    index:        i + 1,
    sessionStart: s.sessionStart,
    lectureRoom:  s.lectureRoom,
    lessonType:   s.lessonType ?? "LEC",
    key:          `${s.lectureRoom}_${s.sessionStart.toISOString()}`,
  }));

  // 4. Offline attendance records in range
  const offlineRecords = await prisma.offlineAttendanceRecord.findMany({
    where: {
      unitCode:     { equals: norm, mode: "insensitive" },
      sessionStart: { gte: start, lte: end },
    },
    select: { studentId: true, lectureRoom: true, sessionStart: true },
  });

  // 5. Online attendance — match to conducted sessions by time (±15 min)
  const onlineSessions = await prisma.onlineAttendanceSession.findMany({
    where: {
      lecturerId,
      unitCode: { equals: norm, mode: "insensitive" },
      createdAt: {
        gte: new Date(start.getTime() - 15 * 60_000),
        lte: new Date(end.getTime()   + 15 * 60_000),
      },
    },
    include: { records: { select: { studentId: true } } },
  });
  const onlineToSessionKey = new Map<string, string>();
  for (const os of onlineSessions) {
    const osMs = os.createdAt.getTime();
    let bestKey: string | null = null;
    let bestDiff = Infinity;
    for (const s of sessions) {
      const diff = Math.abs(s.sessionStart.getTime() - osMs);
      if (diff < 15 * 60_000 && diff < bestDiff) { bestDiff = diff; bestKey = s.key; }
    }
    if (bestKey) onlineToSessionKey.set(os.id, bestKey);
  }

  // 6. Build presence set:  "${studentId}__${sessionKey}"
  const presenceMap = new Set<string>();
  for (const r of offlineRecords) {
    presenceMap.add(`${r.studentId}__${r.lectureRoom}_${r.sessionStart.toISOString()}`);
  }
  for (const os of onlineSessions) {
    const key = onlineToSessionKey.get(os.id);
    if (!key) continue;
    for (const r of os.records) presenceMap.add(`${r.studentId}__${key}`);
  }

  // 7. Per-student stats
  const totalSessions = sessions.length;
  const students: StudentRow[] = roster.map(({ studentId, admissionNumber, name }) => {
    const attended = sessions.filter((s) => presenceMap.has(`${studentId}__${s.key}`)).length;
    const rate     = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
    return { studentId, admissionNumber, name, attended, totalSessions, rate, status: studentStatus(rate) };
  });
  // Sort: Warning → At Risk → Good
  students.sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status]);

  // 8. Summary
  const avgAttendance =
    students.length > 0 && totalSessions > 0
      ? Math.round(students.reduce((s, r) => s + r.rate, 0) / students.length)
      : 0;
  const belowThreshold75 = students.filter((s) => s.rate < THRESHOLD_GOOD    && totalSessions > 0).length;
  const belowThreshold60 = students.filter((s) => s.rate < THRESHOLD_AT_RISK && totalSessions > 0).length;

  // 9. Previous period trend
  const periodMs  = end.getTime() - start.getTime();
  const prevEnd   = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - periodMs - 1);
  const prevSessions = await prisma.conductedSession.findMany({
    where: {
      lecturerId,
      unitCode:     { equals: norm, mode: "insensitive" },
      sessionStart: { gte: prevStart, lte: prevEnd },
    },
    select: { sessionStart: true, lectureRoom: true },
  });

  let trend = "→ No change";
  if (prevSessions.length > 0 && roster.length > 0) {
    const prevRecords = await prisma.offlineAttendanceRecord.findMany({
      where: {
        unitCode:     { equals: norm, mode: "insensitive" },
        sessionStart: { gte: prevStart, lte: prevEnd },
      },
      select: { studentId: true, lectureRoom: true, sessionStart: true },
    });
    const prevPresence = new Set(
      prevRecords.map((r) => `${r.studentId}__${r.lectureRoom}_${r.sessionStart.toISOString()}`),
    );
    const prevAvg = Math.round(
      roster
        .map(({ studentId }) => {
          const attended = prevSessions.filter((s) =>
            prevPresence.has(`${studentId}__${s.lectureRoom}_${s.sessionStart.toISOString()}`),
          ).length;
          return prevSessions.length > 0 ? Math.round((attended / prevSessions.length) * 100) : 0;
        })
        .reduce((a, b) => a + b, 0) / roster.length,
    );
    const delta = avgAttendance - prevAvg;
    if      (delta > 0) trend = `▲ +${delta}%`;
    else if (delta < 0) trend = `▼ ${delta}%`;
    else                trend = "→ No change";
  }

  return {
    unitCode: norm,
    unitName,
    department,
    lecturerName,
    institutionName,
    sessions,
    students,
    presenceMap,
    summary: {
      totalEnrolled: roster.length,
      totalSessions,
      avgAttendance,
      trend,
      belowThreshold75,
      belowThreshold60,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// PDF builder  (pdfkit — already a dependency)
// ─────────────────────────────────────────────────────────────────
async function buildPdf(units: UnitReportData[], period: Period, startDate: Date, endDate: Date): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: false });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end",  () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W         = 595 - 100; // usable width (A4 595pt, 50pt each side)
    const FONT_BOLD = "Helvetica-Bold";
    const FONT      = "Helvetica";

    // Track total pages for "Page X of Y" — we add it as a postprocess via range
    const pageRefs: number[] = [];

    function addPageNum() {
      // Called at end of each page
      const pageNum = pageRefs.length;
      doc.fontSize(8).font(FONT).fillColor("#666666")
        .text(`Page ${pageNum}`, 0, 780, { align: "center", width: 595 });
      doc.fillColor("#000000");
    }

    // ── Helper: draw a simple text table row with optional background ──
    function tableRow(
      cols: string[],
      colWidths: number[],
      x: number,
      y: number,
      bgColor?: string,
      bold?: boolean,
    ): number {
      const rowH = 16;
      if (bgColor) {
        doc.save().rect(x, y, colWidths.reduce((a, b) => a + b, 0), rowH).fill(bgColor).restore();
      }
      doc.fontSize(8).font(bold ? FONT_BOLD : FONT).fillColor("#000000");
      let cx = x;
      for (let i = 0; i < cols.length; i++) {
        doc.text(cols[i], cx + 2, y + 3, { width: colWidths[i] - 4, lineBreak: false, ellipsis: true });
        cx += colWidths[i];
      }
      return rowH;
    }

    // ── Helper: ensure enough vertical space remains, else new page ──
    function ensureSpace(needed: number) {
      if (doc.y + needed > 780) {
        addPageNum();
        doc.addPage();
        pageRefs.push(1);
      }
    }

    // ─────────────────────────────────────────
    // RENDER EACH UNIT
    // ─────────────────────────────────────────
    for (const u of units) {
      doc.addPage();
      pageRefs.push(1);

      let y = 50;

      // ── BLOCK 1: HEADER ──────────────────────────────────────
      doc.fontSize(14).font(FONT_BOLD).fillColor("#1e3a8a")
        .text("MarkWise — Attendance Report", 50, y, { width: W });
      y += 20;
      doc.fontSize(11).font(FONT_BOLD).fillColor("#1e3a8a")
        .text(u.department, 50, y, { width: W });
      y += 18;

      doc.fontSize(9).font(FONT).fillColor("#000000");
      const labelW = 75;
      const lines = [
        ["Unit:",      `${u.unitCode}  —  ${u.unitName}`],
        ["Lecturer:",  u.lecturerName],
        ["Period:",    `${period.charAt(0).toUpperCase() + period.slice(1)}   ${fmtDate(startDate)} – ${fmtDate(endDate)}`],
        ["Generated:", fmtDateTime(new Date())],
      ];
      for (const [lbl, val] of lines) {
        doc.font(FONT_BOLD).text(lbl, 50, y, { width: labelW, continued: false });
        doc.font(FONT).text(val, 50 + labelW, y, { width: W - labelW });
        y += 14;
      }
      y += 6;

      // ── BLOCK 2: SUMMARY ─────────────────────────────────────
      doc.moveTo(50, y).lineTo(545, y).stroke("#1e3a8a");
      y += 8;
      doc.fontSize(10).font(FONT_BOLD).text("SUMMARY", 50, y);
      y += 14;
      doc.fontSize(9).font(FONT);
      const sumLines = [
        [`Total enrolled:`,        `${u.summary.totalEnrolled}`],
        [`Sessions held:`,         `${u.summary.totalSessions}`],
        [`Avg attendance:`,        `${u.summary.avgAttendance}%  (${u.summary.trend} from previous period)`],
        [`Below 75% (exam risk):`, `${u.summary.belowThreshold75}`],
        [`Below 60% (warning):`,   `${u.summary.belowThreshold60}`],
      ];
      for (const [lbl, val] of sumLines) {
        doc.font(FONT_BOLD).text(lbl, 50, y, { width: 160, continued: false });
        doc.font(FONT).text(val, 210, y, { width: W - 160 });
        y += 13;
      }
      y += 8;

      // ── BLOCK 3: PER-STUDENT TABLE ────────────────────────────
      doc.moveTo(50, y).lineTo(545, y).stroke("#1e3a8a");
      y += 8;
      doc.fontSize(10).font(FONT_BOLD).text("PER-STUDENT BREAKDOWN", 50, y);
      y += 14;

      const colW3 = [75, 155, 75, 70, 40, 60];
      const hdr3  = ["Adm No.", "Name", "Attended", "Total Sessions", "%", "Status"];

      ensureSpace(20);
      y = doc.y;
      tableRow(hdr3, colW3, 50, y, "#1e3a8a", true);
      doc.fillColor("#ffffff");
      doc.text("", 50, y, { width: W }); // reset fill
      doc.fillColor("#000000");
      y += 17;

      for (const s of u.students) {
        ensureSpace(18);
        y = doc.y;
        const bg = STATUS_COLORS[s.status];
        tableRow(
          [s.admissionNumber, s.name, String(s.attended), String(s.totalSessions), `${s.rate}%`, s.status],
          colW3, 50, y, bg,
        );
        y += 17;
        doc.moveTo(50, y - 1).lineTo(545, y - 1).stroke("#e5e7eb");
      }

      y += 8;

      // ── BLOCK 4: PER-SESSION DETAIL ───────────────────────────
      if (u.sessions.length > 0) {
        ensureSpace(40);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#1e3a8a");
        doc.moveDown(0.4);
        doc.fontSize(10).font(FONT_BOLD).text("PER-SESSION DETAIL");
        doc.moveDown(0.4);

        const colW4 = [50, 70, 75, 165, 80];
        const hdr4  = ["Lecture #", "Date", "Adm No.", "Name", "Status"];

        ensureSpace(20);
        tableRow(hdr4, colW4, 50, doc.y, "#1e3a8a", true);
        doc.fillColor("#000000");
        doc.moveDown(0.05);

        for (const sess of u.sessions) {
          const dateStr = sess.sessionStart.toISOString().slice(0, 10);
          for (const stu of u.students) {
            const present = u.presenceMap.has(`${stu.studentId}__${sess.key}`);
            ensureSpace(18);
            tableRow(
              [`LEC ${sess.index}`, dateStr, stu.admissionNumber, stu.name, present ? "Present" : "Absent"],
              colW4, 50, doc.y, present ? "#f0fdf4" : "#fff1f2",
            );
            doc.moveDown(0.05);
            doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#e5e7eb");
            doc.moveDown(0.05);
          }
        }
      }

      // ── BLOCK 5: FOOTER ───────────────────────────────────────
      ensureSpace(60);
      doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke("#1e3a8a");
      doc.moveDown(0.6);
      doc.fontSize(8).font(FONT).fillColor("#374151")
        .text("NOTE: Minimum 75% attendance required to sit exams.", 50, doc.y);
      doc.moveDown(0.4);
      doc.text(`Lecturer signature: _________________________   Date: ____________`, 50, doc.y);
      doc.fillColor("#000000");

      addPageNum();
    }

    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────────
// CSV builder
// ─────────────────────────────────────────────────────────────────
function buildCsv(units: UnitReportData[], period: Period, startDate: Date, endDate: Date): string {
  const lines: string[] = [];
  const esc  = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const row  = (...cells: (string | number | null | undefined)[]) =>
    lines.push(cells.map(esc).join(","));

  for (const u of units) {
    // Header block
    row("MarkWise Attendance Report");
    row("Department", u.department);
    row("Unit Code", u.unitCode);
    row("Unit Name", u.unitName);
    row("Lecturer", u.lecturerName);
    row("Period", `${period.charAt(0).toUpperCase() + period.slice(1)}  ${fmtDate(startDate)} – ${fmtDate(endDate)}`);
    row("Generated", fmtDateTime(new Date()));
    lines.push("");

    // Summary
    row("SUMMARY");
    row("Total Enrolled",        u.summary.totalEnrolled);
    row("Sessions Held",         u.summary.totalSessions);
    row("Avg Attendance (%)",    u.summary.avgAttendance);
    row("Trend",                 u.summary.trend);
    row("Below 75% (exam risk)", u.summary.belowThreshold75);
    row("Below 60% (warning)",   u.summary.belowThreshold60);
    lines.push("");

    // Per-student breakdown
    row("PER-STUDENT BREAKDOWN");
    row("Department", "Unit Code", "Unit Name", "Adm No.", "Student Name",
        "Sessions Attended", "Total Sessions", "Attendance %", "Status",
        "Period Start", "Period End", "Lecturer");
    for (const s of u.students) {
      row(
        u.department, u.unitCode, u.unitName,
        s.admissionNumber, s.name,
        s.attended, s.totalSessions, s.rate, s.status,
        fmtDate(startDate), fmtDate(endDate), u.lecturerName,
      );
    }
    lines.push("");

    // Per-session detail
    row("PER-SESSION DETAIL");
    row("Lecture #", "Date", "Adm No.", "Name", "Status");
    for (const sess of u.sessions) {
      const dateStr = sess.sessionStart.toISOString().slice(0, 10);
      for (const stu of u.students) {
        const present = u.presenceMap.has(`${stu.studentId}__${sess.key}`);
        row(`LEC ${sess.index}`, dateStr, stu.admissionNumber, stu.name, present ? "Present" : "Absent");
      }
    }
    lines.push("", "");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Excel builder
// ─────────────────────────────────────────────────────────────────
function buildExcel(units: UnitReportData[], period: Period, startDate: Date, endDate: Date): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const wb   = XLSX.utils.book_new();

  for (const u of units) {
    const sheetName = u.unitCode.slice(0, 31);
    const data: (string | number)[][] = [];

    // Header rows
    data.push(["MarkWise Attendance Report"]);
    data.push(["Department", u.department]);
    data.push(["Unit",       `${u.unitCode} — ${u.unitName}`]);
    data.push(["Lecturer",   u.lecturerName]);
    data.push(["Period",     `${period.charAt(0).toUpperCase() + period.slice(1)}  ${fmtDate(startDate)} – ${fmtDate(endDate)}`]);
    data.push(["Generated",  fmtDateTime(new Date())]);
    data.push([]);

    // Summary
    data.push(["SUMMARY"]);
    data.push(["Total Enrolled",        u.summary.totalEnrolled]);
    data.push(["Sessions Held",         u.summary.totalSessions]);
    data.push(["Avg Attendance (%)",    u.summary.avgAttendance]);
    data.push(["Trend",                 u.summary.trend]);
    data.push(["Below 75% (exam risk)", u.summary.belowThreshold75]);
    data.push(["Below 60% (warning)",   u.summary.belowThreshold60]);
    data.push([]);

    // Per-student header (row index for freeze)
    const studentTableStart = data.length;
    data.push(["Adm No.", "Name", "Sessions Attended", "Total Sessions", "Attendance %", "Status"]);
    for (const s of u.students) {
      data.push([s.admissionNumber, s.name, s.attended, s.totalSessions, s.rate, s.status]);
    }
    data.push([]);

    // Per-session detail
    data.push(["Lecture #", "Date", "Adm No.", "Name", "Status"]);
    for (const sess of u.sessions) {
      const dateStr = sess.sessionStart.toISOString().slice(0, 10);
      for (const stu of u.students) {
        const present = u.presenceMap.has(`${stu.studentId}__${sess.key}`);
        data.push([`LEC ${sess.index}`, dateStr, stu.admissionNumber, stu.name, present ? "Present" : "Absent"]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Bold header rows
    for (let r = 0; r < 6; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
      if (cell) cell.s = { font: { bold: true } };
    }
    // Bold table header
    for (let c = 0; c < 6; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: studentTableStart, c })];
      if (cell) cell.s = { font: { bold: true } };
    }

    // Freeze first row of student table
    ws["!freeze"] = { xSplit: 0, ySplit: studentTableStart + 1 };

    // Status column colours (col index 5)
    for (let rowIdx = studentTableStart + 1; rowIdx < studentTableStart + 1 + u.students.length; rowIdx++) {
      const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: 5 });
      const cell = ws[cellAddr];
      if (cell) {
        const status = u.students[rowIdx - studentTableStart - 1]?.status ?? "Good";
        const color  = (STATUS_COLORS[status] ?? "#FFFFFF").replace("#", "");
        cell.s = { fill: { fgColor: { rgb: color } } };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
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

  const { period, types, format, department, unitCodes, startDate, endDate } = body ?? {};

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

  if (!unitCodes || !Array.isArray(unitCodes) || unitCodes.length === 0)
    return apiErr("No valid unit codes provided", 400);

  if (!startDate || typeof startDate !== "string") return apiErr("startDate is required (YYYY-MM-DD)", 400);
  if (!endDate   || typeof endDate   !== "string") return apiErr("endDate is required (YYYY-MM-DD)", 400);

  const parsedStart = parseCalendarDate(startDate);
  const parsedEnd   = parseCalendarDate(endDate);
  if (!parsedStart) return apiErr("startDate is not a valid date (use YYYY-MM-DD)", 400);
  if (!parsedEnd)   return apiErr("endDate is not a valid date (use YYYY-MM-DD)", 400);
  parsedEnd.setUTCHours(23, 59, 59, 999);

  const validPeriod  = period as Period;
  const validTypes   = types  as ReportType[];
  const validFormat  = format as Format;
  const departmentLabel = typeof department === "string" ? department : "";
  const normalizedCodes = (unitCodes as string[]).map((c) => normalizeUnitCode(c)).filter(Boolean);

  if (normalizedCodes.length === 0)
    return apiErr("No valid unit codes provided", 400);

  try {
    // ── Lecturer identity ─────────────────────────────────────
    const lecturer = await prisma.lecturer.findUnique({
      where:  { id: lecturerId },
      select: { fullName: true, institution: { select: { name: true } } },
    });
    const lecturerName    = lecturer?.fullName  ?? lecturerId;
    const institutionName = lecturer?.institution?.name ?? "MarkWise";

    // ── Gather per-unit data ──────────────────────────────────
    const unitDataList = await Promise.all(
      normalizedCodes.map((uc) =>
        gatherUnitReportData(uc, lecturerId, lecturerName, institutionName, departmentLabel, parsedStart, parsedEnd),
      ),
    );

    // ── Build file buffer ─────────────────────────────────────
    const ext = validFormat === "pdf" ? "pdf" : validFormat === "csv" ? "csv" : "xlsx";
    let fileBuffer: Buffer;

    try {
      if (validFormat === "pdf") {
        fileBuffer = await buildPdf(unitDataList, validPeriod, parsedStart, parsedEnd);
      } else if (validFormat === "csv") {
        fileBuffer = Buffer.from(buildCsv(unitDataList, validPeriod, parsedStart, parsedEnd), "utf-8");
      } else {
        fileBuffer = buildExcel(unitDataList, validPeriod, parsedStart, parsedEnd);
      }
    } catch (buildErr) {
      console.error("[reports/generate] file build error:", buildErr);
      return apiErr(`Report generation failed: ${buildErr instanceof Error ? buildErr.message : String(buildErr)}`, 500);
    }

    // ── Upload to Vercel Blob ─────────────────────────────────
    const blobName = `reports/${lecturerId.slice(0, 8)}_${Date.now()}.${ext}`;

    let fileUrl: string;
    try {
      const blob = await put(blobName, fileBuffer, {
        access:      "public",
        contentType: MIME_MAP[validFormat],
      });
      fileUrl = blob.url;
    } catch (uploadErr) {
      console.error("[reports/generate] upload error:", uploadErr);
      return apiErr(`Report generation failed: upload error`, 500);
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
      { fileUrl: report.fileUrl },
      { status: 200, headers: corsHeaders },
    );
  } catch (fatal) {
    console.error("[reports/generate] fatal error:", fatal);
    return apiErr(`Report generation failed: ${fatal instanceof Error ? fatal.message : "unexpected error"}`, 500);
  }
}
