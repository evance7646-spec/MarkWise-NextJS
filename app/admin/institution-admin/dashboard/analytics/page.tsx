"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Building2, GraduationCap, Users, DoorOpen,
  TrendingUp, BookOpen,
} from "lucide-react";
import { useInstitutionAdmin } from "../../context";

interface AnalyticsData {
  departments: { id: string; name: string; studentCount: number; lecturerCount: number }[];
  totalStudents: number;
  totalLecturers: number;
  totalRooms: number;
  totalDepartments: number;
  studentsByYear: { year: number; count: number }[];
  roomsByStatus: { status: string; count: number }[];
  roomsByType: { type: string; count: number }[];
}

const STATUS_COLOR: Record<string, string> = {
  free:    "bg-emerald-500",
  booked:  "bg-blue-500",
  held:    "bg-amber-500",
  offline: "bg-slate-500",
};

export default function AnalyticsPage() {
  const admin = useInstitutionAdmin();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!admin?.institutionId) return;
    const iid = admin.institutionId;
    setLoading(true);

    const [dRes, lRes, sRes, rRes] = await Promise.all([
      fetch(`/api/departments?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/lecturers?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/students?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/rooms?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]);

    const dPay = dRes?.data ?? dRes;
    const depts: { id: string; name: string }[] = Array.isArray(dPay) ? dPay : (dPay?.departments ?? []);

    const lPay = lRes?.data ?? lRes;
    const lecturers: { id: string; institutionId: string }[] = Array.isArray(lPay) ? lPay : (lPay?.lecturers ?? []);

    const sPay = sRes?.data ?? sRes;
    const students: { id: string; departmentId: string; year: number }[] = Array.isArray(sPay) ? sPay : (sPay?.students ?? []);

    const rPay = rRes?.data ?? rRes;
    const rooms: { id: string; status: string; type: string }[] = Array.isArray(rPay) ? rPay : (rPay?.rooms ?? []);

    // Students by year
    const yearMap: Record<number, number> = {};
    for (const s of students) {
      yearMap[s.year] = (yearMap[s.year] ?? 0) + 1;
    }
    const studentsByYear = Object.entries(yearMap)
      .map(([y, c]) => ({ year: Number(y), count: c }))
      .sort((a, b) => a.year - b.year);

    // Rooms by status
    const statusMap: Record<string, number> = {};
    for (const r of rooms) {
      statusMap[r.status] = (statusMap[r.status] ?? 0) + 1;
    }
    const roomsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    // Rooms by type
    const typeMap: Record<string, number> = {};
    for (const r of rooms) {
      if (r.type) typeMap[r.type] = (typeMap[r.type] ?? 0) + 1;
    }
    const roomsByType = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Dept breakdowns
    const deptData = depts.map(d => ({
      id: d.id,
      name: d.name,
      studentCount: students.filter(s => s.departmentId === d.id).length,
      lecturerCount: 0,
    })).sort((a, b) => b.studentCount - a.studentCount);

    setData({
      departments: deptData,
      totalStudents: students.length,
      totalLecturers: lecturers.length,
      totalRooms: rooms.length,
      totalDepartments: depts.length,
      studentsByYear,
      roomsByStatus,
      roomsByType,
    });
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const kpis = data ? [
    { label: "Departments",  value: data.totalDepartments, icon: Building2,    color: "text-sky-400",     bg: "bg-sky-500/10" },
    { label: "Lecturers",    value: data.totalLecturers,   icon: GraduationCap,color: "text-amber-400",   bg: "bg-amber-500/10" },
    { label: "Students",     value: data.totalStudents,    icon: Users,        color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Rooms",        value: data.totalRooms,       icon: DoorOpen,     color: "text-orange-400",  bg: "bg-orange-500/10" },
  ] : [];

  const maxStudents = data ? Math.max(...data.departments.map(d => d.studentCount), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Analytics</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-slate-800 bg-slate-900 animate-pulse" />
            ))
          : kpis.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${k.bg}`}>
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
              </motion.div>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students by Year */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-300">Students by Year</h2>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-800 animate-pulse" />)}
            </div>
          ) : !data || data.studentsByYear.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No data available.</p>
          ) : (
            <div className="space-y-3">
              {data.studentsByYear.map((row, i) => {
                const maxYear = Math.max(...data.studentsByYear.map(r => r.count), 1);
                const pct = (row.count / maxYear) * 100;
                return (
                  <div key={row.year} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-14 shrink-0">Year {row.year}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.07, duration: 0.5 }}
                        className="h-2 rounded-full bg-emerald-500"
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-300 w-8 text-right shrink-0">{row.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Room Status Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DoorOpen className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-slate-300">Room Status</h2>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-800 animate-pulse" />)}
            </div>
          ) : !data || data.roomsByStatus.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No rooms registered.</p>
          ) : (
            <div className="space-y-3">
              {data.roomsByStatus.map((row, i) => {
                const pct = data.totalRooms > 0 ? (row.count / data.totalRooms) * 100 : 0;
                return (
                  <div key={row.status}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-400 capitalize">{row.status}</span>
                      <span className="text-slate-300 font-medium">{row.count} ({Math.round(pct)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.07, duration: 0.5 }}
                        className={`h-2 rounded-full ${STATUS_COLOR[row.status] ?? "bg-slate-500"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Students by Department */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-300">Students by Department</h2>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-800 animate-pulse" />)}
            </div>
          ) : !data || data.departments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No departments configured.</p>
          ) : (
            <div className="space-y-3">
              {data.departments.slice(0, 10).map((dept, i) => {
                const pct = (dept.studentCount / maxStudents) * 100;
                return (
                  <div key={dept.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-40 truncate shrink-0">{dept.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className="h-2 rounded-full bg-sky-500"
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-300 w-8 text-right shrink-0">{dept.studentCount}</span>
                  </div>
                );
              })}
              {data.departments.length > 10 && (
                <p className="text-xs text-slate-500 text-center pt-1">
                  + {data.departments.length - 10} more departments
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
