"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, AlertTriangle, GraduationCap,
  Clock, BookOpen, Activity, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { useDepartmentAdmin } from "../../context";

// ── Types ────────────────────────────────────────────────────────────────
interface Summary {
  totalUnits: number; totalEnrolled: number; atRiskCount: number;
  ghostSessionsThisWeek: number; uncoveredUnitsCount: number;
  attendanceRate: number; assignmentCompletionRate: number; manualAttendanceRisk: boolean;
}
interface LecturerLoad {
  lecturerId: string; name: string; weeklyEntries: number;
  hoursPerWeek: number; unitCount: number; status: "overloaded" | "normal" | "underutilised";
}
interface AtRiskStudent { id: string; name: string; admissionNumber: string; year: number; }
interface GhostSession { timetableId: string; day: string; startTime: string; endTime: string; unitCode: string; unitTitle: string; lecturerName: string; }
interface UncoveredUnit { unitId: string; code: string; title: string; }
interface MethodBreakdown { method: string; count: number; pct: number; }
interface AssignmentCompletion { unitCode: string; unitTitle: string; assignmentCount: number; completionRate: number; status: "low" | "fair" | "good"; }

interface DeptAnalytics {
  summary: Summary;
  lecturerWorkload: LecturerLoad[];
  atRiskStudents: AtRiskStudent[];
  ghostSessions: GhostSession[];
  uncoveredUnits: UncoveredUnit[];
  methodBreakdown: MethodBreakdown[];
  assignmentCompletion: AssignmentCompletion[];
}

// ── Helpers ──────────────────────────────────────────────────────────────
const METHOD_COLOR: Record<string, string> = {
  ble:              "bg-emerald-500",
  qr:               "bg-sky-500",
  manual:           "bg-amber-400",
  manual_lecturer:  "bg-rose-400",
};
const METHOD_LABEL: Record<string, string> = {
  ble: "BLE", qr: "QR Code", manual: "Manual (Student)", manual_lecturer: "Manual (Lecturer)",
};
const WORKLOAD_COLOR: Record<string, string> = {
  overloaded:    "bg-rose-100 text-rose-700 border-rose-200",
  normal:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  underutilised: "bg-amber-100 text-amber-700 border-amber-200",
};
const COMPLETION_COLOR: Record<string, string> = {
  low: "bg-rose-500", fair: "bg-amber-400", good: "bg-emerald-500",
};

function Skeleton({ w = "w-12", h = "h-6" }: { w?: string; h?: string }) {
  return <span className={`inline-block ${h} ${w} rounded bg-gray-200 animate-pulse`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function DeptAnalyticsPage() {
  const admin = useDepartmentAdmin();
  const [data, setData]     = useState<DeptAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin?.departmentId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/dept-analytics?departmentId=${admin.departmentId}`, { credentials: "include" });
    if (res.ok) setData(await res.json());
    else setError("Failed to load analytics data.");
    setLoading(false);
  }, [admin?.departmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Department Analytics</h1>
          <p className="text-sm text-gray-400 mt-0.5">Operational insights for {admin?.departmentName ?? "your department"}</p>
        </div>
        <button onClick={fetchData} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
          Refresh
        </button>
      </div>

      {/* ── Manual attendance risk banner ─────────────────────────────── */}
      {!loading && s?.manualAttendanceRisk && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>High proportion of <strong>manual attendance records</strong> detected. Consider enforcing BLE/QR-based check-in.</span>
        </motion.div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Activity,      label: "Attendance Rate",     value: s ? `${s.attendanceRate}%` : "—",     color: "text-teal-600",    bg: "bg-teal-500/10" },
          { icon: AlertTriangle, label: "At-Risk Students",    value: s?.atRiskCount ?? "—",                color: "text-rose-600",    bg: "bg-rose-500/10" },
          { icon: Clock,         label: "Ghost Sessions (wk)", value: s?.ghostSessionsThisWeek ?? "—",      color: "text-amber-600",   bg: "bg-amber-500/10" },
          { icon: BookOpen,      label: "Uncovered Units",     value: s?.uncoveredUnitsCount ?? "—",        color: "text-violet-600",  bg: "bg-violet-500/10" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2.5 ${kpi.bg}`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div className={`text-xl font-bold ${kpi.color}`}>{loading ? <Skeleton /> : kpi.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Lecturer Workload ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-900">Lecturer Workload</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.lecturerWorkload?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No lecturer data</p>
          ) : (
            <div className="space-y-2.5">
              {data.lecturerWorkload.map(l => (
                <div key={l.lecturerId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700 truncate">{l.name}</span>
                      <span className={`shrink-0 text-[10px] font-semibold rounded-full border px-2 py-0.5 leading-tight ${WORKLOAD_COLOR[l.status]}`}>
                        {l.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {l.unitCount} unit{l.unitCount !== 1 ? "s" : ""} · {l.weeklyEntries} sessions · {l.hoursPerWeek}h/wk
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── At-Risk Students ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-gray-900">At-Risk Students</h2>
            <span className="text-[10px] text-gray-400">(0 attendance — last 30 days)</span>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-7 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.atRiskStudents?.length ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-gray-400">No at-risk students this month</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {data.atRiskStudents.map(st => (
                <div key={st.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-xs font-medium text-gray-700">{st.name}</div>
                    <div className="text-[10px] text-gray-400">{st.admissionNumber}</div>
                  </div>
                  <span className="text-[10px] text-gray-400">Year {st.year}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ghost Sessions ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Ghost Sessions This Week</h2>
            <span className="text-[10px] text-gray-400">(scheduled but not conducted)</span>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-7 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.ghostSessions?.length ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-gray-400">All sessions conducted this week</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {data.ghostSessions.map(g => (
                <div key={g.timetableId} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">{g.unitCode}</span>
                    <span className="text-[10px] text-amber-600 font-medium">{g.day}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>{g.unitTitle}</span>
                    <span>{g.startTime}–{g.endTime}</span>
                  </div>
                  <div className="text-[10px] text-gray-400">{g.lecturerName}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Uncovered Units ───────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-900">Units Without Timetable Entries</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-7 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.uncoveredUnits?.length ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm text-gray-400">All units have timetable entries</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
              {data.uncoveredUnits.map(u => (
                <div key={u.unitId} className="flex items-center gap-3 py-2">
                  <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-gray-700">{u.code}</div>
                    <div className="text-[10px] text-gray-400">{u.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Assignment Completion ─────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-900">Assignment Completion by Unit</h2>
          </div>
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.assignmentCompletion?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No assignment data</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {data.assignmentCompletion.map(a => (
                <div key={a.unitCode}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{a.unitCode}</span>
                    <span className="text-gray-400">{a.completionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${a.completionRate}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={`h-full rounded-full ${COMPLETION_COLOR[a.status]}`} />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{a.unitTitle} · {a.assignmentCount} assignment{a.assignmentCount !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Attendance Method Breakdown ───────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold text-gray-900">Attendance Method Breakdown</h2>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-6 rounded bg-gray-100 animate-pulse" />)}</div>
          ) : !data?.methodBreakdown?.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No attendance records yet</p>
          ) : (
            <div className="space-y-3">
              {data.methodBreakdown.map(m => (
                <div key={m.method}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{METHOD_LABEL[m.method] ?? m.method}</span>
                    <span className="text-gray-400">{m.count} ({m.pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${m.pct}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className={`h-full rounded-full ${METHOD_COLOR[m.method] ?? "bg-gray-400"}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
