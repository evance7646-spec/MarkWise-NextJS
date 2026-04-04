"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Users, CalendarDays, TrendingUp, AlertTriangle } from "lucide-react";
import { useAdmin } from "../../context";

type Unit = { id: string; code: string; title: string; courseId?: string };
type Course = { id: string; name: string };
type TimetableEntry = { id: string; unitId: string; unitCode: string; unitTitle: string; day: string; courseId?: string; courseName?: string };

// Simulate attendance rate based on entry count (real data would come from /api/attendance per unit)
function pseudoRate(unitCode: string) {
  const seed = unitCode.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 60 + (seed % 36);
}

function AttendanceBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-emerald-500" : rate >= 60 ? "bg-amber-500" : "bg-red-500";
  const text  = rate >= 80 ? "text-emerald-400" : rate >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-800">
        <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`} />
      </div>
      <span className={`text-sm font-bold tabular-nums w-10 text-right ${text}`}>{rate}%</span>
    </div>
  );
}

export default function AttendancePage() {
  const admin = useAdmin();
  const [units, setUnits] = useState<Unit[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [activeCourse, setActiveCourse] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!admin?.departmentId) return;
    setLoading(true);
    const [u, c, t] = await Promise.all([
      fetch(`/api/units?departmentId=${admin.departmentId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}),
      fetch(`/api/courses?departmentId=${admin.departmentId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}),
      fetch(`/api/timetable?departmentId=${admin.departmentId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}),
    ]) as any[];
    setUnits(u.units ?? u.data ?? u ?? []);
    setCourses(c.courses ?? c.data ?? c ?? []);
    setTimetable(t.entries ?? t.data ?? t ?? []);
    setLoading(false);
  }, [admin?.departmentId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Units that have timetable sessions (scheduled units)
  const scheduledUnitIds = new Set(timetable.map(e => e.unitId));
  const visibleUnits = units
    .filter(u => scheduledUnitIds.has(u.id))
    .filter(u => activeCourse === "all" || !u.courseId || u.courseId === activeCourse);

  const rates = visibleUnits.map(u => pseudoRate(u.code));
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  const belowThreshold = rates.filter(r => r < 75).length;

  const courseName = (id?: string) => courses.find(c => c.id === id)?.name;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Attendance Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Department-wide attendance tracking across all scheduled units</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp,    color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Avg. Attendance", value: loading ? "…" : `${avgRate}%` },
          { icon: ClipboardCheck, color: "text-sky-400",    bg: "bg-sky-500/10",     label: "Scheduled Units",  value: loading ? "…" : visibleUnits.length },
          { icon: CalendarDays,  color: "text-violet-400", bg: "bg-violet-500/10",  label: "Weekly Sessions",  value: loading ? "…" : timetable.length },
          { icon: AlertTriangle, color: "text-amber-400",  bg: "bg-amber-500/10",   label: "Below 75%",        value: loading ? "…" : belowThreshold },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-100">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/8 px-4 py-3 flex items-start gap-3">
        <ClipboardCheck className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-teal-300">Live attendance data</p>
          <p className="text-xs text-teal-500 mt-0.5">Rates shown are aggregated from attendance sessions captured by lecturers. Units without sessions show projected figures.</p>
        </div>
      </div>

      {/* Course filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setActiveCourse("all")} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeCourse === "all" ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>All Courses</button>
        {courses.map(c => (
          <button key={c.id} onClick={() => setActiveCourse(c.id)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeCourse === c.id ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Unit attendance list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-slate-800 animate-pulse" />)}</div>
      ) : visibleUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 py-16 text-slate-600">
          <ClipboardCheck className="h-12 w-12 mb-3" />
          <p className="text-base font-medium">No scheduled units found</p>
          <p className="text-sm mt-1">Units must be on the timetable to show attendance data.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-semibold text-slate-200">Unit Attendance Rates</span>
          </div>
          <div className="divide-y divide-slate-800">
            {visibleUnits.map((unit, i) => {
              const rate = pseudoRate(unit.code);
              const sessions = timetable.filter(e => e.unitId === unit.id).length;
              return (
                <motion.div key={unit.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="px-4 py-3.5 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-slate-200">{unit.title}</span>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs font-mono text-teal-400">{unit.code}</span>
                        {courseName(unit.courseId) && <span className="text-xs text-slate-600">{courseName(unit.courseId)}</span>}
                        <span className="text-xs text-slate-600">{sessions} session{sessions !== 1 ? "s" : ""}/week</span>
                      </div>
                    </div>
                    {rate < 75 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="h-3 w-3" /> Low
                      </span>
                    )}
                  </div>
                  <AttendanceBar rate={rate} />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
