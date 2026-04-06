"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ClipboardCheck, Search, Filter, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { useAcademicRegistrar } from "../../context";

interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: string;
  roomId?: string;
  unitCode?: string;
  student?: { name: string; admissionNumber: string };
  room?: { roomNumber?: string; name?: string };
}

interface OfflineRecord {
  id: string;
  studentId: string;
  unitCode: string;
  sessionStart: string;
  method: string;
  admissionNumber?: string;
  student?: { name: string; admissionNumber: string };
}

interface Dept { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  present: "bg-emerald-500/10 text-emerald-600",
  absent:  "bg-rose-500/10 text-rose-600",
  late:    "bg-amber-500/10 text-amber-600",
};

export default function AttendancePage() {
  const admin = useAcademicRegistrar();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [offline, setOffline] = useState<OfflineRecord[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<"online" | "offline">("online");

  const load = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [att, off, d] = await Promise.all([
      fetch(`/api/attendance?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/attendance/offline?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : []) as any,
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    setRecords(att.records ?? att.data ?? att ?? []);
    setOffline(off.records ?? off.data ?? (Array.isArray(off) ? off : []));
    setDepts(d.departments ?? d.data ?? d ?? []);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { load(); }, [load]);

  const q = search.toLowerCase();

  const filteredOnline = records.filter(r => {
    const matchQ = !q || r.student?.name?.toLowerCase().includes(q) || r.student?.admissionNumber?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchQ && matchStatus;
  });

  const filteredOffline = offline.filter(r => {
    const matchQ = !q || r.student?.name.toLowerCase().includes(q) || r.admissionNumber?.toLowerCase().includes(q);
    return matchQ;
  });

  const presentCount = records.filter(r => r.status === "present").length;
  const absentCount = records.filter(r => r.status === "absent").length;
  const rate = records.length ? Math.round((presentCount / records.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-teal-600" /> Attendance Records
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Institution-wide attendance overview</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Records", value: records.length, color: "text-teal-600", bg: "bg-teal-500/10" },
          { label: "Present",       value: presentCount,   color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Absent",        value: absentCount,    color: "text-rose-600", bg: "bg-rose-500/10" },
          { label: "Attendance Rate", value: `${rate}%`,   color: "text-sky-600", bg: "bg-sky-500/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-gray-200 bg-white border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>
              {loading ? <span className="inline-block h-7 w-12 rounded bg-gray-200 animate-pulse" /> : s.value}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-50 p-1 w-fit">
        {(["online", "offline"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors capitalize
              ${tab === t ? "bg-slate-700 text-gray-800 shadow" : "text-gray-400 hover:text-gray-700"}`}>
            {t === "online" ? "Live Sessions" : "Offline / BLE"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or admission no…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm text-gray-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
        </div>
        {tab === "online" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Student</th>
                {tab === "online"
                  ? <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 hidden md:table-cell">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 hidden lg:table-cell">Room</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">Status</th>
                    </>
                  : <>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 hidden md:table-cell">Unit</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 hidden lg:table-cell">Session</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">Method</th>
                    </>
                }
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-200/50">
                    {[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><div className="h-5 rounded bg-gray-200 animate-pulse" /></td>)}
                  </tr>
                ))
              ) : tab === "online" ? (
                filteredOnline.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-7 w-7 text-slate-700" />
                      <p>No attendance records found</p>
                    </div>
                  </td></tr>
                ) : filteredOnline.slice(0, 100).map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className="border-b border-gray-200/50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.student?.name ?? "—"}</div>
                      <div className="text-xs text-gray-400">{r.student?.admissionNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{r.room?.name ?? r.room?.roomNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLOR[r.status] ?? "text-gray-500 bg-slate-800"}`}>
                        {r.status === "present" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {r.status}
                      </span>
                    </td>
                  </motion.tr>
                ))
              ) : (
                filteredOffline.length === 0 ? (
                  <tr><td colSpan={4} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-7 w-7 text-slate-700" />
                      <p>No offline attendance records found</p>
                    </div>
                  </td></tr>
                ) : filteredOffline.slice(0, 100).map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className="border-b border-gray-200/50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.student?.name ?? r.admissionNumber ?? "—"}</div>
                      <div className="text-xs text-gray-400">{r.admissionNumber}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-amber-600 hidden md:table-cell">{r.unitCode}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {new Date(r.sessionStart).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-xs text-teal-600 capitalize">{r.method}</span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && tab === "online" && filteredOnline.length > 100 && (
          <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400 text-center">
            Showing first 100 of {filteredOnline.length} records. Use search to filter further.
          </div>
        )}
      </div>
    </div>
  );
}
