/**
 * GET /api/admin/attendance-analytics
 *
 * Scoped attendance analytics for both academic-registrar (institution-wide)
 * and department-admin (single-department) views.
 *
 * Query params:
 *   institutionId  – required for institution-level scope
 *   departmentId   – required for department-level scope (also accepted by institution admin for drill-down)
 *   days           – lookback window in days (default 30)
 *
 * Response shape: { lecturers, students, methods, overview }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";
import { normalizeUnitCode } from "@/lib/unitCode";

export const runtime = "nodejs";

function minutesBetween(s: string, e: string): number {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function riskLevel(pct: number): "none" | "watch" | "warning" | "critical" {
  if (pct >= 75) return "none";
  if (pct >= 60) return "watch";
  if (pct >= 40) return "warning";
  return "critical";
}

export async function GET(req: NextRequest) {
  const scope = await resolveAdminScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId") ?? scope.institutionId;
  const departmentId  = searchParams.get("departmentId")  ?? scope.departmentId ?? null;
  const days          = Math.min(365, Math.max(7, Number(searchParams.get("days") ?? "30")));

  if (!institutionId) {
    return NextResponse.json({ error: "institutionId required" }, { status: 400 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── Resolve scoped departments ────────────────────────────────────────────
  const deptWhere = departmentId
    ? { id: departmentId, institutionId }
    : { institutionId };

  const departments = await prisma.department.findMany({
    where: deptWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const deptIds = departments.map(d => d.id);

  // ── Parallel base fetches ─────────────────────────────────────────────────
  const [units, lecturers, students, timetables, conductedSessions, offlineRecords] =
    await Promise.all([
      prisma.unit.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true, code: true, title: true, departmentId: true },
      }),
      prisma.lecturer.findMany({
        where: { timetables: { some: { departmentId: { in: deptIds } } } },
        select: { id: true, fullName: true, timetables: { where: { departmentId: { in: deptIds } }, select: { departmentId: true, unitId: true, startTime: true, endTime: true } } },
      }),
      prisma.student.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true, name: true, admissionNumber: true, year: true, departmentId: true, courseId: true, course: { select: { code: true, name: true } } },
      }),
      prisma.timetable.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true, lecturerId: true, unitId: true, day: true, startTime: true, endTime: true, departmentId: true },
      }),
      prisma.conductedSession.findMany({
        where: {
          unitCode: { in: [] }, // replaced below after building unitCodes
        },
        select: { id: true, unitCode: true, lectureRoom: true, lecturerId: true, sessionStart: true, sessionEnd: true, lessonType: true },
      }).then(() => null), // placeholder — fetch after building unitCodes
      prisma.offlineAttendanceRecord.findMany({
        where: { institutionId, scannedAt: { gte: since } },
        select: { studentId: true, unitCode: true, method: true, scannedAt: true, markedByLecturerId: true },
      }),
    ]);

  // Now fetch conductedSessions properly using resolved unitCodes
  const unitCodes = units.map(u => normalizeUnitCode(u.code));
  const conductedSessionsReal = await prisma.conductedSession.findMany({
    where: { unitCode: { in: unitCodes }, sessionStart: { gte: since } },
    select: { id: true, unitCode: true, lectureRoom: true, lecturerId: true, sessionStart: true, sessionEnd: true, lessonType: true },
  });

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const unitByCode = new Map(units.map(u => [normalizeUnitCode(u.code), u]));
  const unitById   = new Map(units.map(u => [u.id, u]));
  const deptById   = new Map(departments.map(d => [d.id, d]));

  // ─────────────────────────────────────────────────────────────────────────
  // A. LECTURER ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────

  // Build enrollment counts per unit code (from StudentEnrollmentSnapshot as proxy)
  // For attendance rate: (records for that lecturer's sessions) / (sessions × avg enrolled)
  // We group conductedSessions by lecturerId
  const sessionsByLecturer = new Map<string, typeof conductedSessionsReal>();
  for (const s of conductedSessionsReal) {
    const list = sessionsByLecturer.get(s.lecturerId) ?? [];
    list.push(s);
    sessionsByLecturer.set(s.lecturerId, list);
  }

  // Group offlineRecords by unitCode → count per session (sessionStart+unitCode key)
  const presentPerSession = new Map<string, Set<string>>();
  for (const r of offlineRecords) {
    const code = normalizeUnitCode(r.unitCode);
    // key without room since we're grouping by unit×lecturer, use unit+date
    const key = `${code}::${r.scannedAt.toISOString().slice(0, 10)}`;
    const s = presentPerSession.get(key) ?? new Set();
    s.add(r.studentId);
    presentPerSession.set(key, s);
  }

  // For each conducted session, work out student attendance
  const attendancePerConductedSession = new Map<string, number>();
  for (const cs of conductedSessionsReal) {
    const code = normalizeUnitCode(cs.unitCode);
    const dateKey = cs.sessionStart.toISOString().slice(0, 10);
    const key = `${code}::${dateKey}`;
    const present = presentPerSession.get(key)?.size ?? 0;
    attendancePerConductedSession.set(cs.id, present);
  }

  const lecturerStats = lecturers.map(lec => {
    const sessions = sessionsByLecturer.get(lec.id) ?? [];
    const totalSessions = sessions.length;

    // Hours per week from timetable
    const hoursPerWeek = lec.timetables.reduce((s, t) => s + minutesBetween(t.startTime, t.endTime) / 60, 0);
    const unitCount = new Set(lec.timetables.map(t => t.unitId).filter(Boolean)).size;

    // Method compliance for this lecturer's sessions
    const lecturerOffline = offlineRecords.filter(r => r.markedByLecturerId === lec.id);
    const methodCounts: Record<string, number> = {};
    for (const r of lecturerOffline) {
      methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1;
    }

    // BLE sessions: count sessions that had ≥1 BLE record
    const sessionRecordsByCode = offlineRecords.filter(r => {
      const unit = unitByCode.get(normalizeUnitCode(r.unitCode));
      return unit && lec.timetables.some(t => t.unitId === unit.id);
    });
    const totalRecords = sessionRecordsByCode.length;
    const bleCount    = sessionRecordsByCode.filter(r => r.method === "ble").length;
    const qrCount     = sessionRecordsByCode.filter(r => r.method === "qr").length;
    const pinCount    = sessionRecordsByCode.filter(r => ["manual", "manual_lecturer"].includes(r.method)).length;

    const bleAdoptionRate  = totalRecords > 0 ? Math.round((bleCount  / totalRecords) * 100) : 0;
    const qrAdoptionRate   = totalRecords > 0 ? Math.round((qrCount   / totalRecords) * 100) : 0;
    const pinAdoptionRate  = totalRecords > 0 ? Math.round((pinCount  / totalRecords) * 100) : 0;

    // Average class attendance rate across conducted sessions
    let totalPresent = 0;
    let sessionsWithData = 0;
    for (const cs of sessions) {
      const present = attendancePerConductedSession.get(cs.id) ?? 0;
      if (present > 0) { totalPresent += present; sessionsWithData++; }
    }
    const avgClassAttendance = sessionsWithData > 0
      ? Math.round(totalPresent / sessionsWithData)
      : 0;

    // Dept
    const deptId = lec.timetables[0]?.departmentId ?? "";
    const deptName = deptById.get(deptId)?.name ?? "—";

    return {
      lecturerId:       lec.id,
      lecturerName:     lec.fullName,
      department:       deptName,
      departmentId:     deptId,
      totalSessions,
      hoursPerWeek:     Math.round(hoursPerWeek * 10) / 10,
      unitCount,
      bleAdoptionRate,
      qrAdoptionRate,
      pinAdoptionRate,
      avgClassAttendance,
      totalRecordsCreated: totalRecords,
    };
  }).filter(l => l.totalSessions > 0 || l.totalRecordsCreated > 0)
    .sort((a, b) => b.totalSessions - a.totalSessions);

  // ─────────────────────────────────────────────────────────────────────────
  // B. STUDENT ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────

  // Total distinct sessions per unit code (denominator for student attendance rate)
  const sessionsPerCode = new Map<string, number>();
  for (const cs of conductedSessionsReal) {
    const code = normalizeUnitCode(cs.unitCode);
    sessionsPerCode.set(code, (sessionsPerCode.get(code) ?? 0) + 1);
  }

  // Records per student per unit code
  const recordsByStudentUnit = new Map<string, number>();
  for (const r of offlineRecords) {
    const key = `${r.studentId}::${normalizeUnitCode(r.unitCode)}`;
    recordsByStudentUnit.set(key, (recordsByStudentUnit.get(key) ?? 0) + 1);
  }

  // Enrollment snapshot lookup
  const snapshots = await prisma.studentEnrollmentSnapshot.findMany({
    where: { studentId: { in: students.map(s => s.id) } },
    select: { studentId: true, unitCodes: true },
  });
  const snapshotByStudent = new Map(snapshots.map(s => [s.studentId, s.unitCodes.map(c => normalizeUnitCode(c))]));

  const studentStats = students.map(student => {
    const enrolledCodes = snapshotByStudent.get(student.id) ?? [];
    // Only codes that belong to this scope's units
    const scopedCodes = enrolledCodes.filter(c => unitByCode.has(c));

    let totalSessions = 0;
    let totalAttended = 0;
    const perCourse: Record<string, { sessions: number; attended: number }> = {};

    for (const code of scopedCodes) {
      const sessions = sessionsPerCode.get(code) ?? 0;
      const attended = recordsByStudentUnit.get(`${student.id}::${code}`) ?? 0;
      totalSessions += sessions;
      totalAttended += Math.min(attended, sessions); // cap at total sessions
      perCourse[code] = { sessions, attended: Math.min(attended, sessions) };
    }

    const overallPct = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;
    const dept = deptById.get(student.departmentId)?.name ?? "—";

    return {
      studentId:        student.id,
      studentName:      student.name,
      admissionNumber:  student.admissionNumber,
      year:             student.year,
      department:       dept,
      departmentId:     student.departmentId,
      course:           student.course?.name ?? "—",
      totalSessions,
      totalAttended,
      overallAttendance: overallPct,
      riskLevel:        riskLevel(overallPct),
      enrolledUnitCount: scopedCodes.length,
      perCourseAttendance: perCourse,
    };
  });

  // Risk cohorts
  const atRisk    = studentStats.filter(s => s.riskLevel !== "none" && s.enrolledUnitCount > 0);
  const critical  = studentStats.filter(s => s.riskLevel === "critical" && s.enrolledUnitCount > 0);
  const warning   = studentStats.filter(s => s.riskLevel === "warning"  && s.enrolledUnitCount > 0);
  const watch     = studentStats.filter(s => s.riskLevel === "watch"    && s.enrolledUnitCount > 0);

  // By department
  const studentsByDept = new Map<string, typeof studentStats>();
  for (const s of studentStats) {
    const list = studentsByDept.get(s.departmentId) ?? [];
    list.push(s);
    studentsByDept.set(s.departmentId, list);
  }

  const deptBreakdown = departments.map(dept => {
    const deptStudents = studentsByDept.get(dept.id) ?? [];
    const active = deptStudents.filter(s => s.enrolledUnitCount > 0);
    const avgAtt = active.length > 0
      ? Math.round(active.reduce((s, d) => s + d.overallAttendance, 0) / active.length)
      : 0;
    const atRiskCount = active.filter(s => s.overallAttendance < 60).length;
    return {
      departmentId:  dept.id,
      name:          dept.name,
      totalStudents: deptStudents.length,
      activeStudents: active.length,
      avgAttendance: avgAtt,
      atRiskCount,
      atRiskPct:     active.length > 0 ? Math.round((atRiskCount / active.length) * 100) : 0,
    };
  }).sort((a, b) => b.avgAttendance - a.avgAttendance);

  // By year
  const byYear: Record<number, { total: number; sumPct: number; atRisk: number }> = {};
  for (const s of studentStats.filter(s => s.enrolledUnitCount > 0)) {
    byYear[s.year] = byYear[s.year] ?? { total: 0, sumPct: 0, atRisk: 0 };
    byYear[s.year].total++;
    byYear[s.year].sumPct += s.overallAttendance;
    if (s.overallAttendance < 60) byYear[s.year].atRisk++;
  }
  const yearBreakdown = Object.entries(byYear)
    .map(([year, v]) => ({
      year: Number(year),
      totalStudents: v.total,
      avgAttendance: Math.round(v.sumPct / v.total),
      atRiskCount: v.atRisk,
      atRiskPct: Math.round((v.atRisk / v.total) * 100),
    }))
    .sort((a, b) => a.year - b.year);

  // ─────────────────────────────────────────────────────────────────────────
  // C. METHOD BREAKDOWN
  // ─────────────────────────────────────────────────────────────────────────
  const methodTotals: Record<string, number> = {};
  for (const r of offlineRecords) {
    methodTotals[r.method] = (methodTotals[r.method] ?? 0) + 1;
  }
  const total = offlineRecords.length;
  const methods = Object.entries(methodTotals)
    .map(([method, count]) => ({ method, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Method by department
  const methodByDept = departments.map(dept => {
    const deptCodes = new Set(units.filter(u => u.departmentId === dept.id).map(u => normalizeUnitCode(u.code)));
    const deptRecords = offlineRecords.filter(r => deptCodes.has(normalizeUnitCode(r.unitCode)));
    const t = deptRecords.length;
    const counts: Record<string, number> = {};
    for (const r of deptRecords) counts[r.method] = (counts[r.method] ?? 0) + 1;
    return {
      departmentId: dept.id,
      name: dept.name,
      total: t,
      ble:    t > 0 ? Math.round(((counts["ble"]            ?? 0) / t) * 100) : 0,
      qr:     t > 0 ? Math.round(((counts["qr"]             ?? 0) / t) * 100) : 0,
      pin:    t > 0 ? Math.round((((counts["manual"] ?? 0) + (counts["manual_lecturer"] ?? 0)) / t) * 100) : 0,
      online: 0, // OnlineAttendanceRecord not fetched here — extend if needed
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // D. OVERVIEW KPIs
  // ─────────────────────────────────────────────────────────────────────────
  const activeStudents = studentStats.filter(s => s.enrolledUnitCount > 0);
  const overallAvgAttendance = activeStudents.length > 0
    ? Math.round(activeStudents.reduce((s, x) => s + x.overallAttendance, 0) / activeStudents.length)
    : 0;

  const overview = {
    totalStudents:        students.length,
    activeStudents:       activeStudents.length,
    totalLecturers:       lecturers.length,
    totalSessions:        conductedSessionsReal.length,
    overallAvgAttendance,
    atRiskCount:          atRisk.length,
    atRiskPct:            activeStudents.length > 0 ? Math.round((atRisk.length / activeStudents.length) * 100) : 0,
    criticalCount:        critical.length,
    criticalPct:          activeStudents.length > 0 ? Math.round((critical.length / activeStudents.length) * 100) : 0,
    lookbackDays:         days,
  };

  return NextResponse.json({
    overview,
    lecturers:  lecturerStats,
    students: {
      byDepartment:   deptBreakdown,
      byYear:         yearBreakdown,
      atRisk:         atRisk.slice(0, 100),
      critical:       critical.slice(0, 50),
    },
    methods,
    methodByDept,
  });
}
