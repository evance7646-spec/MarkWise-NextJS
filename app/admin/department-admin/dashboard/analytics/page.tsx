"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, GraduationCap, BarChart3, Activity, AlertTriangle,
  CheckCircle2, AlertCircle, RefreshCw, TrendingDown,
  Shield, UserX,
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
interface AnalyticsData {
  overview: Overview;
  lecturers: LecturerStat[];
  students: {
    byDepartment: { departmentId: string; name: string; totalStudents: number; activeStudents: number; avgAttendance: number; atRiskCount: number; atRiskPct: number; }[];
    byYear: YearBreakdown[];
    atRisk: AtRiskStudent[];
    critical: AtRiskStudent[];
  };
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

type Tab = "overview" | "lecturers" | "students";

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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["overview", "lecturers", "students"] as Tab[]).map(t => (
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

    </div>
  );
}
