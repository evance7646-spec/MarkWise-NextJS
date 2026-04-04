"use client";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck, Search, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useComplianceAdmin } from "../../context";

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string | null;
  submittedByName: string | null;
  submittedAt: string;
  status: string;
  version: number;
  assignment?: {
    title: string;
    dueDate: string;
    unitId: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  unitId: string;
  maxScore: number | null;
  submissions: Submission[];
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:   "bg-slate-700 text-slate-300",
    submitted: "bg-sky-500/15 text-sky-400",
    late:      "bg-rose-500/15 text-rose-400",
  };
  return map[status] ?? "bg-slate-700 text-slate-300";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SubmissionsPage() {
  const admin = useComplianceAdmin();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!admin?.institutionId) return;
    // Fetch assignments scoped to this institution — use cookie auth
    fetch(`/api/assignments?institutionId=${admin.institutionId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((data: any) => {
        const asgn: Assignment[] = data.assignments ?? data.data ?? [];
        setAssignments(asgn);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [admin]);

  const allSubmissions: (Submission & { assignmentTitle: string })[] = useMemo(() => {
    return assignments.flatMap(a =>
      (a.submissions ?? []).map(s => ({ ...s, assignmentTitle: a.title }))
    );
  }, [assignments]);

  const filtered = useMemo(() => {
    return allSubmissions.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = (s.submittedByName ?? "").toLowerCase().includes(q) || s.assignmentTitle.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allSubmissions, search, statusFilter]);

  const counts = useMemo(() => ({
    total: allSubmissions.length,
    submitted: allSubmissions.filter(s => s.status === "submitted").length,
    pending: allSubmissions.filter(s => s.status === "pending").length,
    late: allSubmissions.filter(s => s.status === "late").length,
  }), [allSubmissions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileCheck className="h-6 w-6 text-violet-400" />
          Submissions
        </h1>
        <p className="mt-1 text-sm text-slate-400">Assignment submission compliance across all units</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Submissions", value: counts.total,     color: "text-violet-400", icon: FileCheck },
          { label: "Submitted",         value: counts.submitted, color: "text-emerald-400", icon: CheckCircle2 },
          { label: "Pending",           value: counts.pending,   color: "text-amber-400",  icon: Clock },
          { label: "Late Submissions",  value: counts.late,      color: "text-rose-400",   icon: XCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center gap-4">
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Assignment accordion */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Per-Assignment Breakdown</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              className="h-7 w-7 rounded-full border-2 border-teal-500 border-t-transparent"
            />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">No assignments found</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => {
              const subs = a.submissions ?? [];
              const submittedCount = subs.filter(s => s.status === "submitted").length;
              const lateCount = subs.filter(s => s.status === "late").length;
              const pct = subs.length > 0 ? Math.round((submittedCount / subs.length) * 100) : 0;
              const isOpen = expandedId === a.id;
              return (
                <div key={a.id} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    onClick={() => setExpandedId(isOpen ? null : a.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-4 w-4 text-violet-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{a.title}</p>
                        <p className="text-xs text-slate-500">Due {fmtDate(a.dueDate)} · {subs.length} submissions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400">{pct}% submitted</span>
                      </div>
                      {lateCount > 0 && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-400">{lateCount} late</span>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-700 overflow-x-auto">
                          {subs.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-slate-500">No submissions yet</p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-800/60">
                                  {["Student", "Submitted At", "Version", "Status"].map(h => (
                                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {subs.map(s => (
                                  <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                                    <td className="px-4 py-2 text-slate-300">{s.submittedByName ?? "—"}</td>
                                    <td className="px-4 py-2 text-slate-400 text-xs">{fmtDate(s.submittedAt)}</td>
                                    <td className="px-4 py-2 text-slate-400">v{s.version}</td>
                                    <td className="px-4 py-2">
                                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(s.status)}`}>
                                        {s.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Flat view filters + table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">All Submissions</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              className={`${inp} pl-9`}
              placeholder="Search by student or assignment…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inp} w-auto`}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="late">Late</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-8">No submissions match your filter</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Assignment", "Student", "Submitted", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 50).map((s, i) => (
                  <motion.tr key={s.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">{s.assignmentTitle}</td>
                    <td className="px-4 py-3 text-slate-300">{s.submittedByName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(s.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="text-center text-xs text-slate-500 py-3">Showing first 50 of {filtered.length} results — use filters to narrow down</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
