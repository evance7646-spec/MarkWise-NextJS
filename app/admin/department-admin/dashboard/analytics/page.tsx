"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, GraduationCap, BarChart3, Activity, AlertTriangle,
  CheckCircle2, AlertCircle, RefreshCw, TrendingDown,
  Shield, UserX, BookOpen, TrendingUp, Calendar,
} from "lucide-react";
import { useDepartmentAdmin } from "../../context";

// ── Types ─────────────────────────────────────────────────────────────────
interface Overview {
  totalStudents: number; activeStudents: number; totalLecturers: number;
  totalSessions: number; overallAvgAttendance: number;
  atRiskCount: number; atRiskPct: number;
  criticalCount: number; criticalPct: number;
  lookbackDays: number;
}
interface LecturerStat {
  lecturerId: string; lecturerName: string; department: string; departmentId: string;
  totalSessions: number; hoursPerWeek: number; unitCount: number;
  avgClassAttendance: number;
}
interface YearBreakdown {
  year: number; totalStudents: number; avgAttendance: number;
  atRiskCount: number; atRiskPct: number;
}
interface AtRiskStudent {
  studentId: string; studentName: string; admissionNumber: string;
  year: number; department: string; overallAttendance: number; riskLevel: string;
}
interface UnitStat {
  unitId: string; unitCode: string; unitTitle: string; department: string;
  sessionsHeld: number; enrolled: number; avgAttendance: number;
  atRiskCount: number; atRiskPct: number; lecturerName: string; lowActivity: boolean;
}
interface DistBucket { range: string; count: number; }
interface WeeklyPoint { week: string; sessions: number; avgPresent: number; }
interface DowPoint    { day: string; sessions: number; avgAttendancePct: number | null; }
interface AnalyticsData {
  overview: Overview;
  lecturers: LecturerStat[];
  students: {
    byDepartment: { departmentId: string; name: string; totalStudents: number; activeStudents: number; avgAttendance: number; atRiskCount: number; atRiskPct: number; }[];
    byYear: YearBreakdown[];
    atRisk: AtRiskStudent[];
    critical: AtRiskStudent[];
  };
  units: UnitStat[];
  distribution: DistBucket[];
  weeklyTrend: WeeklyPoint[];
  dowAbsenteeism: DowPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function pctColor(pct: number): string {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 60) return "text-amber-600";
  return "text-rose-600";
}
function barColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-400";
  return "bg-rose-500";
}
function riskBadge(level: string): string {
  const m: Record<string, string> = {
    none:     "bg-emerald-100 text-emerald-700",
    watch:    "bg-amber-100 text-amber-700",
    warning:  "bg-orange-100 text-orange-700",
    critical: "bg-rose-100 text-rose-700",
  };
  return m[level] ?? "bg-gray-100 text-gray-600";
}



function Bar({
  pct, color, animated = true,
}: {
  pct: number; color: string; animated?: boolean;
}) {
  return (
    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
      {animated ? (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      ) : (
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

function Skeleton({ w = "w-16", h = "h-5" }: { w?: string; h?: string }) {
  return <span className={`inline-block ${h} ${w} rounded bg-gray-200 animate-pulse`} />;
}

function KpiCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-800 leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

type Tab = "overview" | "lecturers" | "students" | "units" | "trends";

// ── Page ──────────────────────────────────────────────────────────────────
export default function DeptAttendanceAnalyticsPage() {
  const admin = useDepartmentAdmin();
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<Tab>("overview");
  const [days, setDays]       = useState(30);

  const fetchData = useCallback(async () => {
    if (!admin?.departmentId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/attendance-analytics?departmentId=${admin.departmentId}&days=${days}`,
        { credentials: "include" },
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? `Error ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [admin?.departmentId, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ov = data?.overview;

  return (
    <div className="space-y-6 p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-500" />
            Attendance Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Department-level attendance overview · last {days} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Activity} label="Overall Attendance"
          color="bg-indigo-100 text-indigo-600"
          value={loading ? <Skeleton /> : `${ov?.overallAvgAttendance ?? 0}%`}
          sub={`${ov?.totalSessions ?? 0} sessions conducted`}
        />
        <KpiCard
          icon={Users} label="Active Students"
          color="bg-sky-100 text-sky-600"
          value={loading ? <Skeleton /> : (ov?.activeStudents ?? 0).toLocaleString()}
          sub={`of ${(ov?.totalStudents ?? 0).toLocaleString()} enrolled`}
        />
        <KpiCard
          icon={UserX} label="At-Risk Students"
          color="bg-amber-100 text-amber-600"
          value={loading ? <Skeleton /> : `${ov?.atRiskPct ?? 0}%`}
          sub={`${(ov?.atRiskCount ?? 0).toLocaleString()} below 60%`}
        />
        <KpiCard
          icon={GraduationCap} label="Lecturers Active"
          color="bg-violet-100 text-violet-600"
          value={loading ? <Skeleton /> : (ov?.totalLecturers ?? 0).toLocaleString()}
          sub={`in last ${days} days`}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["overview", "lecturers", "students", "units", "trends"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              tab === t
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Overview
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">

          {/* Year breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-400" />
              Attendance by Year of Study
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.students.byYear ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No data available.</p>
            ) : (
              <div className="space-y-3">
                {(data?.students.byYear ?? []).map(yr => (
                  <div key={yr.year}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">Year {yr.year}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-gray-400">{yr.totalStudents} students</span>
                        {yr.atRiskPct > 0 && (
                          <span className="text-amber-600">{yr.atRiskPct}% at-risk</span>
                        )}
                        <span className={`font-semibold ${pctColor(yr.avgAttendance)}`}>
                          {yr.avgAttendance}%
                        </span>
                      </div>
                    </div>
                    <Bar pct={yr.avgAttendance} color={barColor(yr.avgAttendance)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical students */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              Critical Students — Below 40%
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.students.critical ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No critical students — great work!
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {(data?.students.critical ?? []).map(s => (
                  <div key={s.studentId} className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.studentName}</p>
                      <p className="text-xs text-gray-400">{s.admissionNumber} · Year {s.year}</p>
                    </div>
                    <span className="text-sm font-bold text-rose-600">{s.overallAttendance}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk alert banner */}
          {!loading && (ov?.atRiskCount ?? 0) > 0 && (
            <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    {ov?.atRiskCount} students ({ov?.atRiskPct}%) are below 60% attendance in this department
                  </p>
                  {(ov?.criticalCount ?? 0) > 0 && (
                    <p className="text-sm text-rose-700 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4" />
                      {ov?.criticalCount} students ({ov?.criticalPct}%) are below 40% — require immediate intervention
                    </p>
                  )}
                  <p className="text-xs text-amber-600 mt-1">
                    Switch to the Students tab to view individual at-risk students.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Lecturers
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "lecturers" && (
        <div className="space-y-6">

          {/* Performance table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                Lecturer Performance — This Department
              </h2>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.lecturers ?? []).length === 0 ? (
              <div className="p-6 text-sm text-gray-400">No lecturer data in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Lecturer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Sessions</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Units</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Hrs/Wk</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Avg Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data?.lecturers ?? []).map(lec => (
                      <tr key={lec.lecturerId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-800 max-w-[160px] truncate">
                          {lec.lecturerName}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{lec.totalSessions}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{lec.unitCount}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{lec.hoursPerWeek}h</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${pctColor(lec.avgClassAttendance)}`}>
                            {lec.avgClassAttendance > 0 ? `${lec.avgClassAttendance} avg` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

{!loading && (data?.lecturers ?? []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Avg Class Attendance Ranking</h2>
              <div className="space-y-3">
                {[...(data?.lecturers ?? [])]
                  .sort((a, b) => b.avgClassAttendance - a.avgClassAttendance)
                  .map(lec => (
                    <div key={lec.lecturerId} className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-right text-xs text-gray-500 truncate">
                        {lec.lecturerName.split(" ").slice(0, 2).join(" ")}
                      </div>
                      <Bar pct={lec.avgClassAttendance} color={barColor(lec.avgClassAttendance)} />
                      <div className={`w-10 shrink-0 text-xs font-semibold text-right ${pctColor(lec.avgClassAttendance)}`}>
                        {lec.avgClassAttendance}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Students
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "students" && (
        <div className="space-y-6">

          {/* Risk cohort cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Normal (≥75%)",
                count: (ov?.activeStudents ?? 0) - (ov?.atRiskCount ?? 0),
                colorText: "text-emerald-600",
                colorBg: "bg-emerald-50 border-emerald-200",
              },
              {
                label: "Watch (60–74%)",
                count: Math.max(0, (ov?.atRiskCount ?? 0) - (ov?.criticalCount ?? 0)),
                colorText: "text-amber-600",
                colorBg: "bg-amber-50 border-amber-200",
              },
              {
                label: "At-Risk (<60%)",
                count: ov?.atRiskCount ?? 0,
                colorText: "text-orange-600",
                colorBg: "bg-orange-50 border-orange-200",
              },
              {
                label: "Critical (<40%)",
                count: ov?.criticalCount ?? 0,
                colorText: "text-rose-700",
                colorBg: "bg-rose-50 border-rose-200",
              },
            ].map(c => (
              <div key={c.label} className={`rounded-2xl border p-5 ${c.colorBg}`}>
                <p className="text-xs text-gray-500 font-medium mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.colorText}`}>
                  {loading ? <Skeleton h="h-7" /> : c.count.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* At-risk % by year */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-400" />
              At-Risk % by Year of Study
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.students.byYear ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No data available.</p>
            ) : (
              <div className="space-y-3">
                {(data?.students.byYear ?? []).map(yr => (
                  <div key={yr.year} className="flex items-center gap-4">
                    <div className="w-16 text-xs text-gray-500 font-medium shrink-0">Year {yr.year}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">
                          {yr.totalStudents} students · avg {yr.avgAttendance}%
                        </span>
                        <span className={`font-semibold ${yr.atRiskPct > 20 ? "text-rose-600" : "text-amber-600"}`}>
                          {yr.atRiskPct}% at-risk
                        </span>
                      </div>
                      <Bar
                        pct={yr.atRiskPct}
                        color={yr.atRiskPct > 20 ? "bg-rose-500" : "bg-amber-400"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* At-risk student list */}
          {!loading && (data?.students.atRisk ?? []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  At-Risk Students — Below 60% Attendance
                </h2>
                <span className="text-xs text-gray-400">
                  {data?.students.atRisk.length} students
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Student</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Admission No.</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Year</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Attendance</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data?.students.atRisk ?? []).map(s => (
                      <tr
                        key={s.studentId}
                        className={`hover:bg-gray-50/50 ${s.riskLevel === "critical" ? "bg-rose-50/20" : ""}`}
                      >
                        <td className="px-6 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                          {s.studentName}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.admissionNumber}</td>
                        <td className="px-4 py-3 text-right text-gray-600">Yr {s.year}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          <span className={pctColor(s.overallAttendance)}>{s.overallAttendance}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskBadge(s.riskLevel)}`}>
                            {s.riskLevel.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Units
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "units" && (
        <div className="space-y-6">

          {/* Low-activity alert */}
          {!loading && (data?.units ?? []).some(u => u.lowActivity) && (
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {(data?.units ?? []).filter(u => u.lowActivity).length} unit(s) have fewer than 2 sessions recorded in this period.
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Attendance percentages for these units may not be meaningful. They are flagged below.
                </p>
              </div>
            </div>
          )}

          {/* Unit table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                Unit Attendance Breakdown
              </h2>
            </div>
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.units ?? []).length === 0 ? (
              <div className="p-6 text-sm text-gray-400">No unit data in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Lecturer</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Sessions</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Enrolled</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">At-Risk</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Avg Att.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(data?.units ?? []).map(u => (
                      <tr key={u.unitId} className={`hover:bg-gray-50/50 transition-colors ${u.lowActivity ? "bg-amber-50/30" : ""}`}>
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-800 leading-tight">{u.unitCode}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{u.unitTitle}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[130px] truncate">{u.lecturerName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {u.sessionsHeld}
                          {u.lowActivity && (
                            <span className="ml-1 text-amber-500 text-xs">⚠</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{u.enrolled}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-medium ${u.atRiskPct > 20 ? "text-rose-600" : "text-amber-600"}`}>
                            {u.atRiskCount} ({u.atRiskPct}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor(u.avgAttendance)}`}
                                style={{ width: `${u.avgAttendance}%` }}
                              />
                            </div>
                            <span className={`font-semibold text-xs ${pctColor(u.avgAttendance)}`}>
                              {u.avgAttendance}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Tab: Trends
      ══════════════════════════════════════════════════════════════════ */}
      {tab === "trends" && (
        <div className="space-y-6">

          {/* Attendance distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-400" />
              Attendance Distribution — Student Count per Band
            </h2>
            {loading ? (
              <div className="flex items-end gap-2 h-32">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gray-100 animate-pulse" style={{ height: `${30 + i * 7}%` }} />
                ))}
              </div>
            ) : (
              (() => {
                const dist = data?.distribution ?? [];
                const max  = Math.max(1, ...dist.map(b => b.count));
                return (
                  <div className="space-y-1">
                    {dist.map((b, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-gray-500 text-right shrink-0">{b.range}</div>
                        <div className="flex-1 h-5 rounded bg-gray-50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(b.count / max) * 100}%` }}
                            transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                            className={`h-full rounded ${i <= 3 ? "bg-rose-400" : i <= 5 ? "bg-amber-400" : i <= 7 ? "bg-yellow-300" : "bg-emerald-400"}`}
                          />
                        </div>
                        <div className="w-8 text-xs font-semibold text-gray-700 shrink-0">{b.count}</div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Weekly trend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              Weekly Session Activity
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.weeklyTrend ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No weekly data for this period.</p>
            ) : (
              (() => {
                const trend = data?.weeklyTrend ?? [];
                const maxSess = Math.max(1, ...trend.map(w => w.sessions));
                return (
                  <div className="space-y-2">
                    {trend.map(w => (
                      <div key={w.week} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-gray-500 shrink-0">{w.week}</div>
                        <div className="flex-1 h-5 rounded bg-gray-50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(w.sessions / maxSess) * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded bg-indigo-400"
                          />
                        </div>
                        <div className="w-24 text-xs text-gray-600 shrink-0">
                          {w.sessions} sess · {w.avgPresent} avg
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Day-of-week heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-400" />
              Attendance by Day of Week
            </h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (data?.dowAbsenteeism ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No day-of-week data available.</p>
            ) : (
              <div className="space-y-3">
                {(data?.dowAbsenteeism ?? []).map(d => {
                  const pct = d.avgAttendancePct ?? 0;
                  return (
                    <div key={d.day} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-medium text-gray-700 shrink-0">{d.day}</div>
                      <Bar pct={pct} color={barColor(pct)} />
                      <div className="w-24 text-xs text-right shrink-0">
                        {d.avgAttendancePct !== null ? (
                          <span className={`font-semibold ${pctColor(pct)}`}>{pct}%</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        <span className="text-gray-400 ml-1">({d.sessions} sess)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
