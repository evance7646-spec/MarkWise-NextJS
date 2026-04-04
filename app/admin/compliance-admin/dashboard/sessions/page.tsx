"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Search, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { useComplianceAdmin } from "../../context";

interface Session {
  id: string;
  unitCode: string;
  lectureRoom: string;
  lessonType: string | null;
  sessionStart: string;
  sessionEnd: string | null;
  lecturerId: string;
  createdAt: string;
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const PAGE_SIZE = 30;

type FilterType = "all" | "completed" | "ongoing";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function duration(start: string, end: string | null) {
  if (!end) return "Ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  return `${mins} min`;
}

export default function SessionsPage() {
  const admin = useComplianceAdmin();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!admin?.institutionId) return;
    // Fetch conducted sessions for this institution via the admin sessions endpoint
    fetch(`/api/attendance/sessions?institutionId=${admin.institutionId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((data: any) => {
        setSessions(data.sessions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [admin]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = s.unitCode.toLowerCase().includes(q) || (s.lectureRoom ?? "").toLowerCase().includes(q);
      const isOngoing = !s.sessionEnd;
      const matchFilter =
        filter === "all" ? true :
        filter === "ongoing" ? isOngoing :
        !isOngoing;
      return matchSearch && matchFilter;
    });
  }, [sessions, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const completed = sessions.filter(s => s.sessionEnd).length;
  const ongoing = sessions.length - completed;

  const lessonTypeColor: Record<string, string> = {
    LEC: "bg-sky-500/20 text-sky-300",
    GD:  "bg-violet-500/20 text-violet-300",
    LAB: "bg-emerald-500/20 text-emerald-300",
    CAT: "bg-amber-500/20 text-amber-300",
    RAT: "bg-rose-500/20 text-rose-300",
    TUT: "bg-teal-500/20 text-teal-300",
    SEM: "bg-blue-500/20 text-blue-300",
    WRK: "bg-orange-500/20 text-orange-300",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-sky-400" />
          Session Delivery
        </h1>
        <p className="mt-1 text-sm text-slate-400">Monitor conducted sessions across all departments</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sessions", value: sessions.length, icon: CalendarCheck, color: "text-sky-400", border: "border-slate-800" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "text-emerald-400", border: "border-emerald-500/30" },
          { label: "Ongoing", value: ongoing, icon: Clock, color: "text-amber-400", border: "border-amber-500/30" },
        ].map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`rounded-2xl border ${border} bg-slate-900 p-5 flex items-center gap-4`}>
            <Icon className={`h-6 w-6 shrink-0 ${color}`} />
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
            placeholder="Search by unit code or room…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 p-1">
          {(["all", "completed", "ongoing"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all capitalize ${
                filter === f ? "bg-teal-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
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
          <div className="py-16 text-center text-slate-500 text-sm">
            <Filter className="mx-auto h-8 w-8 mb-2 opacity-40" />
            No sessions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Unit Code", "Room", "Type", "Date", "Start", "End", "Duration", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, i) => {
                  const isOngoing = !s.sessionEnd;
                  const typeKey = (s.lessonType ?? "LEC").toUpperCase();
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sky-300 font-medium">{s.unitCode}</td>
                      <td className="px-4 py-3 text-slate-300">{s.lectureRoom}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${lessonTypeColor[typeKey] ?? "bg-slate-700 text-slate-300"}`}>
                          {typeKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{fmtDate(s.sessionStart)}</td>
                      <td className="px-4 py-3 text-slate-300">{fmtTime(s.sessionStart)}</td>
                      <td className="px-4 py-3 text-slate-400">{s.sessionEnd ? fmtTime(s.sessionEnd) : "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{duration(s.sessionStart, s.sessionEnd)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isOngoing ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {isOngoing ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {isOngoing ? "Ongoing" : "Completed"}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
