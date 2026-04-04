"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, Search, Filter, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useComplianceAdmin } from "../../context";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  role: string;
  result: "allowed" | "blocked" | "error";
  reason?: string;
  courseId?: string;
  requestedCourseId?: string;
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const PAGE_SIZE = 30;

function resultIcon(result: string) {
  if (result === "allowed") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (result === "blocked") return <XCircle className="h-4 w-4 text-rose-400" />;
  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

function resultBadge(result: string) {
  const map: Record<string, string> = {
    allowed: "bg-emerald-500/15 text-emerald-400",
    blocked: "bg-rose-500/15 text-rose-400",
    error:   "bg-amber-500/15 text-amber-400",
  };
  return map[result] ?? "bg-slate-700 text-slate-300";
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    student:        "bg-blue-500/15 text-blue-400",
    lecturer:       "bg-violet-500/15 text-violet-400",
    admin:          "bg-teal-500/15 text-teal-400",
    dept_admin:     "bg-indigo-500/15 text-indigo-400",
    faculty_admin:  "bg-sky-500/15 text-sky-400",
    registry_admin: "bg-purple-500/15 text-purple-400",
    space_admin:    "bg-orange-500/15 text-orange-400",
  };
  return map[role] ?? "bg-slate-700 text-slate-300";
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// Synthetic audit log entry generated from system events (security log is console-based in this app)
// We simulate fetching from a hypothetical /api/audit-log endpoint while gracefully handling 404
export default function AuditLogPage() {
  const admin = useComplianceAdmin();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!admin?.institutionId) return;
    fetch(`/api/compliance/audit-log?institutionId=${admin.institutionId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then((data: any) => {
        setEntries(data.entries ?? data.logs ?? data.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [admin]);

  const roles = useMemo(() => {
    const set = new Set(entries.map(e => e.role).filter(Boolean));
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const q = search.toLowerCase();
      const matchSearch =
        (e.action ?? "").toLowerCase().includes(q) ||
        (e.userId ?? "").toLowerCase().includes(q) ||
        (e.reason ?? "").toLowerCase().includes(q);
      const matchResult = resultFilter === "all" || e.result === resultFilter;
      const matchRole = roleFilter === "all" || e.role === roleFilter;
      return matchSearch && matchResult && matchRole;
    });
  }, [entries, search, resultFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => ({
    total: entries.length,
    allowed: entries.filter(e => e.result === "allowed").length,
    blocked: entries.filter(e => e.result === "blocked").length,
    error: entries.filter(e => e.result === "error").length,
  }), [entries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="h-6 w-6 text-rose-400" />
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-slate-400">Security scope checks and access-control events</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: counts.total, color: "text-slate-400", icon: Info },
          { label: "Allowed", value: counts.allowed, color: "text-emerald-400", icon: CheckCircle2 },
          { label: "Blocked", value: counts.blocked, color: "text-rose-400", icon: XCircle },
          { label: "Errors", value: counts.error, color: "text-amber-400", icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center gap-3">
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className={`${inp} pl-9`}
            placeholder="Search action, user ID, reason…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className={`${inp} w-auto`} value={resultFilter} onChange={e => { setResultFilter(e.target.value); setPage(1); }}>
          <option value="all">All Results</option>
          <option value="allowed">Allowed</option>
          <option value="blocked">Blocked</option>
          <option value="error">Error</option>
        </select>
        <select className={`${inp} w-auto`} value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              className="h-7 w-7 rounded-full border-2 border-teal-500 border-t-transparent"
            />
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center">
            <Filter className="mx-auto h-8 w-8 text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">
              {entries.length === 0 ? "No audit events recorded — security events are logged to the console" : "No events match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Timestamp", "Action", "User ID", "Role", "Result", "Reason"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((e, i) => (
                  <motion.tr key={e.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDateTime(e.timestamp)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-sky-300">{e.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-32 truncate">{e.userId}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge(e.role)}`}>{e.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${resultBadge(e.result)}`}>
                        {resultIcon(e.result)}
                        {e.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-48 truncate">{e.reason ?? "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Prev
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
