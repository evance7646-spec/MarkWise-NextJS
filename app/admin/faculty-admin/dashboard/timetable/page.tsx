"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Calendar, Search, Building2 } from "lucide-react";
import { useFacultyAdmin } from "../../context";

interface Entry {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  unitCode?: string;
  unitTitle?: string;
  venue?: string;
  status: string;
  lecturerName?: string;
  courseName?: string;
  departmentId?: string;
}

interface Department { id: string; name: string }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-emerald-500/15 text-emerald-400",
  Pending:   "bg-amber-500/15 text-amber-400",
  Cancelled: "bg-red-500/15 text-red-400",
  Online:    "bg-blue-500/15 text-blue-400",
};

export default function FacultyTimetablePage() {
  const admin = useFacultyAdmin();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState("Monday");
  const [deptFilter, setDeptFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [d, depts] = await Promise.all([
      fetch(`/api/timetable?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    setEntries(d.entries ?? d.data ?? d ?? []);
    setDepartments(depts.departments ?? depts.data ?? depts ?? []);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayName = DAYS[new Date().getDay() - 1] ?? "Monday";
  useEffect(() => { setActiveDay(todayName); }, [todayName]);

  const shown = entries
    .filter(e => e.day === activeDay)
    .filter(e => deptFilter === "all" || e.departmentId === deptFilter)
    .filter(e => !search || (e.unitCode ?? "").toLowerCase().includes(search.toLowerCase()) || (e.unitTitle ?? "").toLowerCase().includes(search.toLowerCase()) || (e.lecturerName ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayCount = (d: string) => entries.filter(e => e.day === d).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Timetable</h1>
        <p className="text-sm text-slate-500 mt-0.5">Institution-wide schedule overview — read only</p>
      </div>

      {/* Dept filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit or lecturer…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 pl-9 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Day tabs */}
      <div className="flex flex-wrap gap-2">
        {DAYS.map(d => (
          <button key={d} onClick={() => setActiveDay(d)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${activeDay === d ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            {d.slice(0,3)} <span className="text-[10px] opacity-70 ml-1">{dayCount(d)}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Time</span><span>Unit</span><span>Lecturer</span><span>Department</span><span>Status</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-slate-800 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12"><Calendar className="h-8 w-8 text-slate-700" /><p className="text-sm text-slate-600">No sessions for {activeDay}</p></div>
        ) : shown.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center px-4 py-3.5 border-b border-slate-800/60 last:border-b-0">
            <div className="text-xs font-mono text-slate-400 whitespace-nowrap">{e.startTime}–{e.endTime}</div>
            <div>
              <div className="text-sm font-medium text-slate-200">{e.unitCode ?? "—"}</div>
              <div className="text-xs text-slate-500 truncate">{e.unitTitle ?? e.courseName ?? ""}</div>
            </div>
            <div className="text-sm text-slate-400 truncate hidden sm:block">{e.lecturerName ?? "—"}</div>
            <div className="hidden sm:block text-xs text-slate-500 truncate flex items-center gap-1">
              <Building2 className="h-3 w-3 inline" /> {departments.find(d => d.id === e.departmentId)?.name ?? "—"}
            </div>
            <div className="hidden sm:block">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? "bg-slate-700 text-slate-400"}`}>
                {e.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">Timetable editing is done at department level</p>
    </div>
  );
}
