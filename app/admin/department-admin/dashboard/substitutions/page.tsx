"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Clock, User, AlertTriangle, CheckCircle, X, ChevronDown } from "lucide-react";
import { useAdmin } from "../../context";

interface TimetableEntry {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  unitCode?: string;
  unitTitle?: string;
  venue?: string;
  status: string;
  lecturerId: string;
  lecturerName?: string;
  courseId?: string;
  courseName?: string;
}

interface Lecturer {
  id: string;
  fullName: string;
  email: string;
}

interface SubRecord {
  entryId: string;
  originalLecturerId: string;
  originalLecturerName: string;
  substituteLecturerId: string;
  substituteLecturerName: string;
  day: string;
  startTime: string;
  unitCode?: string;
  createdAt: string;
  note?: string;
}

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

function dayOrder(day: string) { return DAYS_ORDER.indexOf(day); }

export default function SubstitutionsPage() {
  const admin = useAdmin();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SubRecord[]>([]);
  const [modal, setModal] = useState<{ open: boolean; entry: TimetableEntry | null }>({ open: false, entry: null });
  const [substituteId, setSubstituteId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterDay, setFilterDay] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin?.departmentId) return;
    setLoading(true);
    const [te, lc] = await Promise.all([
      fetch(`/api/timetable?departmentId=${admin.departmentId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}),
      fetch(`/api/lecturers?departmentId=${admin.departmentId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}),
    ]) as any[];
    const rawEntries: TimetableEntry[] = te.entries ?? te.data ?? te ?? [];
    const rawLecturers: Lecturer[] = lc.lecturers ?? lc.data ?? lc ?? [];
    setEntries(rawEntries.sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.startTime.localeCompare(b.startTime)));
    setLecturers(rawLecturers);
    setLoading(false);
  }, [admin?.departmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const days = ["All", ...Array.from(new Set(entries.map(e => e.day))).sort((a, b) => dayOrder(a) - dayOrder(b))];
  const shown = filterDay === "All" ? entries : entries.filter(e => e.day === filterDay);

  function openSubModal(entry: TimetableEntry) {
    setModal({ open: true, entry });
    setSubstituteId("");
    setNote("");
  }

  async function handleSubmit() {
    if (!modal.entry || !substituteId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/timetable/${modal.entry.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecturerId: substituteId }),
      });
      if (res.ok) {
        const sub = lecturers.find(l => l.id === substituteId);
        const record: SubRecord = {
          entryId: modal.entry.id,
          originalLecturerId: modal.entry.lecturerId,
          originalLecturerName: modal.entry.lecturerName ?? "Unknown",
          substituteLecturerId: substituteId,
          substituteLecturerName: sub?.fullName ?? "Unknown",
          day: modal.entry.day,
          startTime: modal.entry.startTime,
          unitCode: modal.entry.unitCode,
          createdAt: new Date().toISOString(),
          note: note.trim() || undefined,
        };
        setHistory(h => [record, ...h]);
        // Update entry in local state
        setEntries(prev => prev.map(e => e.id === modal.entry!.id ? { ...e, lecturerId: substituteId, lecturerName: sub?.fullName } : e));
        setModal({ open: false, entry: null });
      }
    } finally {
      setSaving(false);
    }
  }

  const availableSubs = lecturers.filter(l => l.id !== modal.entry?.lecturerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Substitutions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Reassign timetable sessions when a lecturer is unavailable</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Day filter */}
      <div className="flex flex-wrap gap-2">
        {days.map(d => (
          <button key={d} onClick={() => setFilterDay(d)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${filterDay === d ? "bg-lime-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            {d} {d !== "All" && <span className="ml-1 text-[10px] opacity-70">{entries.filter(e => e.day === d).length}</span>}
          </button>
        ))}
      </div>

      {/* Entries list */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 border-b border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Session</span>
          <span className="hidden sm:block">Day / Time</span>
          <span className="hidden sm:block">Assigned Lecturer</span>
          <span className="text-right">Action</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-slate-800 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <RefreshCw className="h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-600">No timetable entries found</p>
          </div>
        ) : shown.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="border-b border-slate-800/60 last:border-b-0">
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1fr_auto] items-center gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-200">{e.unitCode ? `${e.unitCode}` : "—"}</div>
                <div className="text-xs text-slate-500 truncate">{e.unitTitle ?? e.courseName ?? "—"}</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm text-slate-300">{e.day}</div>
                <div className="text-xs text-slate-500">{e.startTime} – {e.endTime}</div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                  {(e.lecturerName ?? "?")[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-slate-300 truncate">{e.lecturerName ?? "Unassigned"}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  className="flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:text-slate-300 transition-colors sm:hidden">
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === e.id ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => openSubModal(e)}
                  className="flex items-center gap-1.5 rounded-xl bg-lime-600/15 hover:bg-lime-600/30 text-lime-400 px-3 py-1.5 text-xs font-medium transition-colors">
                  <RefreshCw className="h-3.5 w-3.5" /> Sub
                </button>
              </div>
            </div>
            <AnimatePresence>
              {expandedId === e.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-800/60 px-4 py-3 sm:hidden space-y-1 text-sm">
                  <p className="text-slate-400">{e.day}, {e.startTime} – {e.endTime}</p>
                  <p className="text-slate-400">Lecturer: {e.lecturerName ?? "Unassigned"}</p>
                  {e.venue && <p className="text-slate-400">Venue: {e.venue}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Substitution history */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-lime-400" /> Substitution History (this session)
          </h2>
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-3 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-200">{h.unitCode ?? "Session"}</span>
                  <span className="text-slate-500"> · {h.day} {h.startTime}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-red-400 line-through">{h.originalLecturerName}</span>
                  <span>→</span>
                  <span className="text-lime-400">{h.substituteLecturerName}</span>
                </div>
                {h.note && <div className="w-full text-xs text-slate-500 italic">{h.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign substitute modal */}
      <AnimatePresence>
        {modal.open && modal.entry && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-100">Assign Substitute</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{modal.entry.day} · {modal.entry.startTime} – {modal.entry.endTime} · {modal.entry.unitCode}</p>
                </div>
                <button onClick={() => setModal({ open: false, entry: null })} className="text-slate-500 hover:text-slate-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-5 flex gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-300">
                  Current lecturer: <strong>{modal.entry.lecturerName ?? "Unassigned"}</strong>. Selecting a substitute will update the timetable assignment.
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={lbl}>Substitute Lecturer <span className="text-red-400">*</span></label>
                  <select value={substituteId} onChange={e => setSubstituteId(e.target.value)} className={inp}>
                    <option value="">Select a lecturer…</option>
                    {availableSubs.map(l => (
                      <option key={l.id} value={l.id}>{l.fullName} ({l.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Note (optional)</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="e.g. Original lecturer on medical leave"
                    className={inp + " resize-none"} />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setModal({ open: false, entry: null })} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={!substituteId || saving}
                  className="flex items-center gap-2 rounded-xl bg-lime-600 hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors">
                  {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><User className="h-4 w-4" /> Assign Substitute</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
