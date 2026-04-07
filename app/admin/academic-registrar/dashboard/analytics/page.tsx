"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, GraduationCap, Building2, Calendar, TrendingUp,
  AlertTriangle, CheckCircle2, AlertCircle, BookOpen, Activity,
} from "lucide-react";
import { useAcademicRegistrar } from "../../context";

// ── Types ──────────────────────────────────────────────────────────────────
interface KPIs {
  attendanceRate: number; spaceUtilization: number; submissionRate: number;
  activeGroups: number; materialAccess: number; notifReadRate: number;
  totalStudents: number; totalLecturers: number; totalRooms: number; totalDepartments: number;
}
interface DeptHealth {
  id: string; name: string; totalStudents: number;
  attendance: number; submissionRate: number; materialAccess: number;
  timetableConflicts: number; studyGroups: number;
}
interface Alert { level: "critical" | "warning" | "info"; message: string; }
interface Building { building: string; total: number; active: number; rate: number; }

// ── Helpers ────────────────────────────────────────────────────────────────
function HBar({ label, value, max, color, subtitle }: { label: string; value: number; max: number; color: string; subtitle?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 text-right text-xs text-gray-500 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`} />
      </div>
      <div className="w-14 shrink-0 text-xs text-gray-400 text-right">{subtitle ?? value}</div>
    </div>
  );
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}

const ALERT_STYLE: Record<string, string> = {
  critical: "bg-rose-50 border-rose-200 text-rose-700",
  warning:  "bg-amber-50 border-amber-200 text-amber-700",
  info:     "bg-emerald-50 border-emerald-200 text-emerald-700",
};
const ALERT_ICON: Record<string, any> = {
  critical: AlertTriangle,
  warning:  AlertCircle,
  info:     CheckCircle2,
};

// ── Page ───────────────────────────────────────────────────────────────────
export default function FacultyAnalyticsPage() {
  const admin = useAcademicRegistrar();
  const [kpis, setKpis]           = useState<KPIs | null>(null);
  const [deptHealth, setDeptHealth] = useState<DeptHealth[]>([]);
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading]     = useState(true);

  const fetchAll = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const res = await fetch(`/api/institution/dashboard?institutionId=${admin.institutionId}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setKpis(data.kpis ?? null);
      setDeptHealth(data.departments ?? []);
      setAlerts(data.alerts ?? []);
      setBuildings(data.buildings ?? []);
    }
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const Skeleton = ({ w = "w-12", h = "h-6" }: { w?: string; h?: string }) => (
    <span className={`inline-block ${h} ${w} rounded bg-gray-200 animate-pulse`} />
  );

  const criticalAlerts = alerts.filter(a => a.level === "critical");
  const warningAlerts  = alerts.filter(a => a.level === "warning");
  const infoAlerts     = alerts.filter(a => a.level === "info");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Institution Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time health metrics across all departments</p>
        </div>
        <button onClick={fetchAll} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
          Refresh
        </button>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { icon: Users,         label: "Students",        value: kpis?.totalStudents ?? 0,               color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { icon: GraduationCap, label: "Lecturers",       value: kpis?.totalLecturers ?? 0,              color: "text-violet-600",  bg: "bg-violet-500/10" },
          { icon: Building2,     label: "Departments",     value: kpis?.totalDepartments ?? 0,            color: "text-sky-600",     bg: "bg-sky-500/10" },
          { icon: Activity,      label: "Attendance Rate", value: kpis ? `${kpis.attendanceRate}%` : "—", color: "text-teal-600",    bg: "bg-teal-500/10" },
          { icon: BookOpen,      label: "Submission Rate", value: kpis ? `${kpis.submissionRate}%` : "—", color: "text-indigo-600",  bg: "bg-indigo-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2.5 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className={`text-xl font-bold ${s.color}`}>
              {loading ? <Skeleton /> : s.value}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────────── */}
      {!loading && alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> System Alerts
            {criticalAlerts.length > 0 && (
              <span className="rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5">
                {criticalAlerts.length} critical
              </span>
            )}
          </h2>
          {[...criticalAlerts, ...warningAlerts, ...infoAlerts].map((a, i) => {
            const Icon = ALERT_ICON[a.level];
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${ALERT_STYLE[a.level]}`}>
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{a.message}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Department Health ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-cyan-600" />
            <h2 className="text-sm font-semibold text-gray-900">Department Health</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : deptHealth.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No department data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-100">
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 font-medium text-center">Students</th>
                    <th className="pb-2 font-medium w-40">Attendance</th>
                    <th className="pb-2 font-medium w-40">Submissions</th>
                    <th className="pb-2 font-medium text-center">Conflicts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...deptHealth].sort((a, b) => b.attendance - a.attendance).map(d => (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 font-medium text-gray-700">{d.name}</td>
                      <td className="py-2.5 text-center text-gray-500">{d.totalStudents}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                            <div style={{ width: `${d.attendance}%` }}
                              className={`h-full rounded-full transition-all ${d.attendance >= 75 ? "bg-emerald-500" : d.attendance >= 50 ? "bg-amber-400" : "bg-rose-400"}`} />
                          </div>
                          <span className="w-9 text-right text-gray-500">{d.attendance}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                            <div style={{ width: `${d.submissionRate}%` }}
                              className={`h-full rounded-full transition-all ${d.submissionRate >= 75 ? "bg-indigo-500" : d.submissionRate >= 50 ? "bg-amber-400" : "bg-rose-400"}`} />
                          </div>
                          <span className="w-9 text-right text-gray-500">{d.submissionRate}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        {d.timetableConflicts > 0 ? (
                          <span className="rounded-full bg-rose-100 text-rose-600 px-2 py-0.5 text-[10px] font-semibold">{d.timetableConflicts}</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Engagement KPIs ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-900">Engagement Rates</h2>
          </div>
          {loading ? (
            <div className="space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-5 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : kpis ? (
            <div className="space-y-4">
              <RateBar label="Attendance Rate"     value={kpis.attendanceRate}  color="bg-teal-500" />
              <RateBar label="Assignment Submission" value={kpis.submissionRate} color="bg-indigo-500" />
              <RateBar label="Material Access"     value={kpis.materialAccess}  color="bg-violet-500" />
              <RateBar label="Notification Read Rate" value={kpis.notifReadRate} color="bg-sky-500" />
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">No data</p>
          )}
        </div>

        {/* ── Building Utilization ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-gray-900">Room Utilization by Building</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-5 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : buildings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No building data</p>
          ) : (
            <div className="space-y-3">
              {buildings.map(b => (
                <HBar key={b.building} label={b.building} value={b.active} max={b.total}
                  color={b.rate >= 75 ? "bg-rose-400" : b.rate >= 50 ? "bg-amber-400" : "bg-sky-500"}
                  subtitle={`${b.rate}%`} />
              ))}
              <p className="text-[10px] text-gray-400 text-right mt-2">active rooms / total rooms</p>
            </div>
          )}
        </div>

        {/* ── Space Utilization & Study Groups ─────────────────────────── */}
        {kpis && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-900">Resource Overview</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Space Utilization", value: `${kpis.spaceUtilization}%`, color: "text-emerald-600", bg: "bg-emerald-500/10" },
                { label: "Active Study Groups", value: kpis.activeGroups,         color: "text-sky-600",     bg: "bg-sky-500/10" },
                { label: "Total Rooms",         value: kpis.totalRooms,           color: "text-violet-600",  bg: "bg-violet-500/10" },
                { label: "Departments",         value: kpis.totalDepartments,     color: "text-teal-600",    bg: "bg-teal-500/10" },
              ].map(r => (
                <div key={r.label} className={`rounded-xl ${r.bg} p-4 text-center`}>
                  <div className={`text-2xl font-bold ${r.color}`}>{r.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
