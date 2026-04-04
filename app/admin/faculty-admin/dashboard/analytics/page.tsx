"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart3, Users, GraduationCap, Building2, Calendar, TrendingUp } from "lucide-react";
import { useFacultyAdmin } from "../../context";

interface Department { id: string; name: string }
interface Lecturer { id: string; fullName: string }
interface Student { id: string; departmentId?: string }
interface Entry { departmentId?: string; day: string; startTime: string; endTime: string }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function minutesBetween(s: string, e: string) {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return Math.max(0, ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0)));
}

function HBar({ label, value, max, color, subtitle }: { label: string; value: number; max: number; color: string; subtitle?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 text-right text-xs text-slate-400 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-800">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`} />
      </div>
      <div className="w-12 shrink-0 text-xs text-slate-500 text-right">{subtitle ?? value}</div>
    </div>
  );
}

export default function FacultyAnalyticsPage() {
  const admin = useFacultyAdmin();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [d, l, s, t] = await Promise.all([
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/lecturers?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/students?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/timetable?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    setDepartments(d.departments ?? d.data ?? d ?? []);
    setLecturers(l.lecturers ?? l.data ?? l ?? []);
    setStudents(s.students ?? s.data ?? s ?? []);
    setEntries(t.entries ?? t.data ?? t ?? []);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Students per dept
  const studentsPerDept = departments.map(d => ({
    name: d.name, count: students.filter(s => s.departmentId === d.id).length,
  })).sort((a, b) => b.count - a.count);

  // Sessions per day
  const sessionsPerDay = DAYS.map(d => ({ day: d.slice(0, 3), count: entries.filter(e => e.day === d).length }));

  // Sessions per dept
  const sessionsPerDept = departments.map(d => ({ name: d.name, count: entries.filter(e => e.departmentId === d.id).length })).sort((a, b) => b.count - a.count);

  const totalHours = Math.round(entries.reduce((sum, e) => sum + minutesBetween(e.startTime, e.endTime), 0) / 60);

  const summary = [
    { icon: Building2,    label: "Departments",   value: departments.length, color: "text-sky-400",    bg: "bg-sky-500/10" },
    { icon: GraduationCap,label: "Lecturers",      value: lecturers.length,   color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: Users,        label: "Students",       value: students.length,    color: "text-emerald-400",bg: "bg-emerald-500/10" },
    { icon: Calendar,     label: "Weekly Sessions",value: entries.length,     color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { icon: TrendingUp,   label: "Teaching Hrs/Wk",value: `${totalHours}h`,  color: "text-cyan-400",   bg: "bg-cyan-500/10" },
  ];

  const maxStudents = Math.max(1, ...studentsPerDept.map(d => d.count));
  const maxSessions = Math.max(1, ...sessionsPerDay.map(d => d.count));
  const maxDeptSessions = Math.max(1, ...sessionsPerDept.map(d => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Institution-wide metrics and resource overview</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summary.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2.5 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="text-xl font-bold text-slate-100">
              {loading ? <span className="h-5 w-8 bg-slate-800 rounded animate-pulse inline-block" /> : s.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Students per dept */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-5"><Users className="h-4 w-4 text-emerald-400" /><h2 className="text-sm font-semibold text-slate-200">Student Distribution by Department</h2></div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-slate-800 animate-pulse" />)}</div> : (
            <div className="space-y-3">
              {studentsPerDept.length === 0 ? <p className="text-sm text-slate-600 text-center py-4">No data</p>
                : studentsPerDept.map(d => <HBar key={d.name} label={d.name} value={d.count} max={maxStudents} color="bg-emerald-500" subtitle={`${d.count}`} />)}
            </div>
          )}
        </div>

        {/* Sessions per day */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-5"><Calendar className="h-4 w-4 text-indigo-400" /><h2 className="text-sm font-semibold text-slate-200">Classes per Day of Week</h2></div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-slate-800 animate-pulse" />)}</div> : (
            <div className="space-y-3">
              {sessionsPerDay.map(d => <HBar key={d.day} label={d.day} value={d.count} max={maxSessions} color="bg-indigo-500" subtitle={`${d.count}`} />)}
            </div>
          )}
        </div>

        {/* Sessions per dept */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-5"><BarChart3 className="h-4 w-4 text-cyan-400" /><h2 className="text-sm font-semibold text-slate-200">Timetable Load per Department</h2></div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-slate-800 animate-pulse" />)}</div> : (
            <div className="space-y-3">
              {sessionsPerDept.length === 0 ? <p className="text-sm text-slate-600 text-center py-4">No data</p>
                : sessionsPerDept.map(d => <HBar key={d.name} label={d.name} value={d.count} max={maxDeptSessions} color="bg-cyan-500" subtitle={`${d.count}`} />)}
            </div>
          )}
        </div>

        {/* Lecturer-to-student ratio */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-5"><TrendingUp className="h-4 w-4 text-sky-400" /><h2 className="text-sm font-semibold text-slate-200">Lecturer : Student Ratio per Dept</h2></div>
          {loading ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-slate-800 animate-pulse" />)}</div> : (() => {
            const ratios = departments.map(d => ({
              name: d.name,
              ratio: students.filter(s => s.departmentId === d.id).length,
            })).sort((a, b) => b.ratio - a.ratio);
            const maxRatio = Math.max(1, ...ratios.map(r => r.ratio));
            return (
              <div className="space-y-3">
                {ratios.length === 0 ? <p className="text-sm text-slate-600 text-center py-4">No data</p>
                  : ratios.map(r => <HBar key={r.name} label={r.name} value={r.ratio} max={maxRatio} color="bg-sky-500" subtitle={`${r.ratio} students`} />)}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
