/**
 * GET /api/institution/dashboard?institutionId=xxx
 *
 * Aggregates institution-wide KPIs and department health rankings for the
 * main institution-admin dashboard overview page.
 *
 * Uses real data from:
 *  - Departments, Students, Lecturers, Rooms
 *  - OfflineAttendanceRecord + ConductedSession → attendance rates
 *  - Booking → space utilization
 *  - Assignment + Submission + Enrollment → submission rates
 *  - Group + GroupMember → study group metrics
 *  - Material + MaterialView + Enrollment → material access
 *  - Notification → read rates
 *  - Timetable → conflict counts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/prisma";
import { resolveAdminScope } from "@/lib/adminScope";

export const runtime = "nodejs";

function statusColor(value: number, goodThreshold: number, warnThreshold: number) {
  if (value >= goodThreshold) return "green";
  if (value >= warnThreshold) return "amber";
  return "red";
}

/** Detect overlapping timetable entries within same room+day */
function detectTimetableConflicts(
  entries: { id: string; day: string; startTime: string; endTime: string; roomId: string; departmentId: string }[]
): Map<string, number> {
  const byRoomDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = `${e.roomId}::${e.day}`;
    const list = byRoomDay.get(key) ?? [];
    list.push(e);
    byRoomDay.set(key, list);
  }
  const conflictsByDept = new Map<string, Set<string>>();
  for (const [, group] of byRoomDay) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (a.startTime < b.endTime && a.endTime > b.startTime) {
          const dA = conflictsByDept.get(a.departmentId) ?? new Set();
          dA.add(a.id); dA.add(b.id);
          conflictsByDept.set(a.departmentId, dA);
          if (b.departmentId !== a.departmentId) {
            const dB = conflictsByDept.get(b.departmentId) ?? new Set();
            dB.add(a.id); dB.add(b.id);
            conflictsByDept.set(b.departmentId, dB);
          }
        }
      }
    }
  }
  const result = new Map<string, number>();
  for (const [deptId, ids] of conflictsByDept) {
    result.set(deptId, ids.size);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const scope = await resolveAdminScope(req);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { searchParams } = new URL(req.url);
  const institutionId = searchParams.get("institutionId") ?? scope.institutionId;
  if (!institutionId) {
    return NextResponse.json({ error: "institutionId required" }, { status: 400 });
  }

  // ── Parallel fetches ───────────────────────────────────────────────────────

  const [
    departments,
    students,
    lecturers,
    rooms,
    timetableEntries,
    conductedSessions,
    attendanceRecords,
    groups,
    groupMembers,
    enrollments,
    materials,
    materialViews,
    units,
  ] = await withRetry(() => Promise.all([
    prisma.department.findMany({
      where: { institutionId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({
      where: { institutionId },
      select: { id: true, departmentId: true },
    }),
    prisma.lecturer.findMany({
      where: { institutionId },
      select: { id: true },
    }),
    prisma.room.findMany({
      where: { institutionId },
      select: { id: true, buildingCode: true, name: true, capacity: true, status: true },
    }),
    prisma.timetable.findMany({
      where: { department: { institutionId } },
      select: { id: true, day: true, startTime: true, endTime: true, roomId: true, departmentId: true },
    }),
    prisma.conductedSession.groupBy({
      by: ["unitCode"],
      _count: { id: true },
    }),
    prisma.offlineAttendanceRecord.groupBy({
      by: ["unitCode"],
      where: { institutionId },
      _count: { id: true },
    }),
    prisma.group.findMany({
      where: { unit: { department: { institutionId } } },
      select: { id: true, unitId: true, updatedAt: true, unit: { select: { departmentId: true } } },
    }),
    prisma.groupMember.findMany({
      where: { group: { unit: { department: { institutionId } } }, leftAt: null },
      select: { id: true, groupId: true, studentId: true },
    }),
    prisma.enrollment.findMany({
      where: { unit: { department: { institutionId } } },
      select: { studentId: true, unitId: true },
    }),
    prisma.material.findMany({
      where: { unit: { department: { institutionId } } },
      select: { id: true, unitId: true },
    }),
    prisma.materialView.findMany({
      where: { material: { unit: { department: { institutionId } } } },
      select: { materialId: true, studentId: true },
    }),
    prisma.unit.findMany({
      where: { department: { institutionId } },
      select: { id: true, code: true, departmentId: true },
    }),
  ]));

  // ── Stage 2: scoped by unitIds / studentIds ────────────────────────────────
  const unitIds = units.map(u => u.id);
  const studentIds = students.map(s => s.id);

  const [assignments, submissions, notifications] = await withRetry(() => Promise.all([
    prisma.assignment.findMany({
      where: { unitId: { in: unitIds } },
      select: { id: true, unitId: true },
    }),
    prisma.submission.findMany({
      where: { assignment: { unitId: { in: unitIds } } },
      select: { id: true, assignmentId: true, studentId: true, submittedAt: true },
    }),
    prisma.notification.findMany({
      where: { userId: { in: studentIds } },
      select: { read: true },
    }).catch(() => [] as { read: boolean }[]),
  ]));

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const sessionMap = new Map(conductedSessions.map(s => [s.unitCode, s._count.id]));
  const attendMap = new Map(attendanceRecords.map(a => [a.unitCode, a._count.id]));

  const unitMap = new Map(units.map(u => [u.id, u]));
  const unitByCode = new Map(units.map(u => [u.code, u]));

  // Conflict detection
  const conflictsPerDept = detectTimetableConflicts(timetableEntries);

  // ── Per-department calculations ────────────────────────────────────────────

  interface DeptStats {
    id: string;
    name: string;
    totalStudents: number;
    totalLecturers: number;
    attendance: number;      // 0–100
    studyGroups: number;
    studyGroupParticipation: number; // pct
    submissionRate: number;  // 0–100
    materialAccess: number;  // 0–100
    timetableConflicts: number;
  }

  const deptStats: DeptStats[] = departments.map(dept => {
    const deptStudents = students.filter(s => s.departmentId === dept.id);
    const totalStudents = deptStudents.length;
    const studentIds = new Set(deptStudents.map(s => s.id));

    // Attendance — compute over units belonging to this dept
    const deptUnits = units.filter(u => u.departmentId === dept.id);
    let totalExpected = 0, totalPresent = 0;
    for (const u of deptUnits) {
      const sessions = sessionMap.get(u.code) ?? 0;
      const enrolled = enrollments.filter(e => e.unitId === u.id).length;
      const present = attendMap.get(u.code) ?? 0;
      if (sessions > 0 && enrolled > 0) {
        totalExpected += sessions * enrolled;
        totalPresent += present;
      }
    }
    const attendance = totalExpected > 0
      ? Math.min(100, Math.round((totalPresent / totalExpected) * 100))
      : 0;

    // Study groups
    const deptGroups = groups.filter(g => g.unit?.departmentId === dept.id);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const activeGroups = deptGroups.filter(g => g.updatedAt > twoWeeksAgo);
    const studyGroups = activeGroups.length;
    const groupIds = new Set(deptGroups.map(g => g.id));
    const membersInDept = groupMembers.filter(m => groupIds.has(m.groupId));
    const uniqueStudentsInGroups = new Set(
      membersInDept.filter(m => studentIds.has(m.studentId)).map(m => m.studentId)
    ).size;
    const studyGroupParticipation = totalStudents > 0
      ? Math.round((uniqueStudentsInGroups / totalStudents) * 100)
      : 0;

    // Submission rate
    const deptAssignmentIds = new Set(
      assignments.filter(a => unitMap.get(a.unitId)?.departmentId === dept.id).map(a => a.id)
    );
    const deptSubmissions = submissions.filter(s => deptAssignmentIds.has(s.assignmentId));
    const deptEnrolled = enrollments.filter(e => unitMap.get(e.unitId)?.departmentId === dept.id);
    const expectedSubmissions = deptAssignmentIds.size * (totalStudents || 1);
    const submissionRate = expectedSubmissions > 0
      ? Math.min(100, Math.round((deptSubmissions.length / expectedSubmissions) * 100))
      : 0;

    // Material access
    const deptMaterialIds = new Set(
      materials.filter(m => unitMap.get(m.unitId)?.departmentId === dept.id).map(m => m.id)
    );
    const deptViews = materialViews.filter(v => deptMaterialIds.has(v.materialId));
    const uniqueViewers = new Set(
      deptViews.filter(v => studentIds.has(v.studentId)).map(v => v.studentId)
    ).size;
    const materialAccess = totalStudents > 0
      ? Math.min(100, Math.round((uniqueViewers / totalStudents) * 100))
      : 0;

    return {
      id: dept.id,
      name: dept.name,
      totalStudents,
      totalLecturers: 0, // will be computed below
      attendance,
      studyGroups,
      studyGroupParticipation,
      submissionRate,
      materialAccess,
      timetableConflicts: conflictsPerDept.get(dept.id) ?? 0,
    };
  });

  // ── Institution-wide KPIs ──────────────────────────────────────────────────

  const avgAttendance = deptStats.length > 0
    ? Math.round(deptStats.reduce((s, d) => s + d.attendance, 0) / deptStats.length)
    : 0;
  const avgSubmission = deptStats.length > 0
    ? Math.round(deptStats.reduce((s, d) => s + d.submissionRate, 0) / deptStats.length)
    : 0;
  const avgMaterial = deptStats.length > 0
    ? Math.round(deptStats.reduce((s, d) => s + d.materialAccess, 0) / deptStats.length)
    : 0;
  const totalActiveGroups = deptStats.reduce((s, d) => s + d.studyGroups, 0);

  // Space utilization: rooms with active bookings in next 7 days / total rooms
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const activeBookings = await prisma.booking.findMany({
    where: {
      room: { institutionId },
      status: { in: ["reserved", "occupied"] },
      startAt: { gte: now, lte: sevenDaysLater },
    },
    select: { roomId: true },
    distinct: ["roomId"],
  });
  const spaceUtil = rooms.length > 0
    ? Math.round((activeBookings.length / rooms.length) * 100)
    : 0;

  // Notification read rate
  const totalNotifs = notifications.length;
  const readNotifs = notifications.filter(n => n.read).length;
  const notifReadRate = totalNotifs > 0 ? Math.round((readNotifs / totalNotifs) * 100) : 0;

  // Building utilization breakdown
  const buildingMap = new Map<string, { total: number; active: number }>();
  for (const r of rooms) {
    const code = r.buildingCode || "Unknown";
    const b = buildingMap.get(code) ?? { total: 0, active: 0 };
    b.total++;
    if (r.status === "occupied" || r.status === "reserved") b.active++;
    buildingMap.set(code, b);
  }
  const buildings = [...buildingMap.entries()].map(([building, v]) => ({
    building,
    total: v.total,
    active: v.active,
    rate: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
  })).sort((a, b) => b.rate - a.rate);

  // Alerts generation
  const alerts: { level: "critical" | "warning" | "info"; message: string }[] = [];
  for (const d of deptStats) {
    if (d.attendance > 0 && d.attendance < 70)
      alerts.push({ level: "critical", message: `${d.name}: attendance ${d.attendance}% is below 70% threshold` });
    if (d.submissionRate > 0 && d.submissionRate < 65)
      alerts.push({ level: "critical", message: `${d.name}: assignment submission rate ${d.submissionRate}% is critically low` });
    if (d.timetableConflicts > 20)
      alerts.push({ level: "critical", message: `${d.name}: ${d.timetableConflicts} timetable conflicts detected` });
    if (d.attendance >= 70 && d.attendance < 80)
      alerts.push({ level: "warning", message: `${d.name}: attendance ${d.attendance}% is below 80% target` });
    if (d.materialAccess > 0 && d.materialAccess < 60)
      alerts.push({ level: "warning", message: `${d.name}: material access ${d.materialAccess}% needs improvement` });
    if (d.studyGroups === 0)
      alerts.push({ level: "warning", message: `${d.name}: no active study groups in the past 2 weeks` });
    if (d.attendance >= 85)
      alerts.push({ level: "info", message: `${d.name}: achieving ${d.attendance}% attendance — excellent performance` });
  }
  const underutilizedBuildings = buildings.filter(b => b.rate < 50);
  if (underutilizedBuildings.length > 0)
    alerts.push({ level: "warning", message: `${underutilizedBuildings.length} building(s) below 50% utilization` });

  return NextResponse.json({
    kpis: {
      attendanceRate: avgAttendance,
      spaceUtilization: spaceUtil,
      submissionRate: avgSubmission,
      activeGroups: totalActiveGroups,
      materialAccess: avgMaterial,
      notifReadRate,
      totalStudents: students.length,
      totalLecturers: lecturers.length,
      totalRooms: rooms.length,
      totalDepartments: departments.length,
    },
    departments: deptStats.sort((a, b) => b.attendance - a.attendance),
    buildings,
    alerts,
  });
}
