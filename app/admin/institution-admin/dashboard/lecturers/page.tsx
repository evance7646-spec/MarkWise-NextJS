"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Plus, Search, X, Mail, Phone, Loader2, CheckCircle2, Eye, EyeOff,
} from "lucide-react";
import { useInstitutionAdmin } from "../../context";

interface Lecturer {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  institutionId: string;
  createdAt: string;
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";
const EMPTY = { fullName: "", email: "", password: "", phoneNumber: "" };

export default function LecturersPage() {
  const admin = useInstitutionAdmin();
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]  = useState(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");
  const [addOk, setAddOk] = useState(false);

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  const fetchLecturers = useCallback(async () => {
    if (!admin?.institutionId) { setLoading(false); return; }
    setLoading(true);
    const r = await fetch(`/api/lecturers?institutionId=${admin.institutionId}`, { credentials: "include" });
    if (r.ok) {
      const data = await r.json();
      setLecturers(data.lecturers ?? data.data ?? (Array.isArray(data) ? data : []));
    }
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchLecturers(); }, [fetchLecturers]);

  const addLecturer = async () => {
    if (!form.fullName.trim()) { setAddErr("Full name is required."); return; }
    if (!form.email.trim())    { setAddErr("Email is required."); return; }
    if (!form.password || form.password.length < 6) { setAddErr("Password must be at least 6 characters."); return; }
    setAdding(true); setAddErr(""); setAddOk(false);
    const r = await fetch("/api/lecturers", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, institutionId: admin?.institutionId }),
    });
    if (r.ok) {
      setAddOk(true);
      setForm(EMPTY);
      setShowAdd(false);
      await fetchLecturers();
      setTimeout(() => setAddOk(false), 3000);
    } else {
      const j = await r.json();
      setAddErr(j.error ?? "Failed to add lecturer.");
    }
    setAdding(false);
  };

  const filtered = lecturers.filter(l =>
    l.fullName.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Lecturers</h1>
          <p className="text-xs text-slate-500 mt-0.5">{lecturers.length} lecturer{lecturers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddErr(""); setForm(EMPTY); }}
          className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Lecturer
        </button>
      </div>

      {addOk && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 text-sm text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4" />
          Lecturer added successfully.
        </motion.div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-6 w-6 rounded-full border-2 border-amber-500 border-t-transparent"
            />
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">
              {search ? "No lecturers match your search." : "No lecturers yet."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="px-4 py-3 text-left font-medium">Lecturer</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paged.map((l, i) => (
                <motion.tr
                  key={l.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.025 }}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 shrink-0">
                        <GraduationCap className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <span className="font-medium text-slate-200">{l.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Mail className="h-3.5 w-3.5 text-slate-600" />
                      {l.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                    {l.phoneNumber ? (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-600" />
                        {l.phoneNumber}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Lecturer Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-slate-100">Add Lecturer</h2>
                  <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={lbl}>Full Name</label>
                    <input className={inp} placeholder="e.g. Dr. John Smith" value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Email Address</label>
                    <input className={inp} type="email" placeholder="lecturer@example.com" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input
                        className={inp}
                        type={showPw ? "text" : "password"}
                        placeholder="Min. 6 characters"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Phone Number (optional)</label>
                    <input className={inp} placeholder="+1 234 567 8900" value={form.phoneNumber}
                      onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} />
                  </div>
                  {addErr && <p className="text-xs text-red-400">{addErr}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowAdd(false)}
                      className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addLecturer}
                      disabled={adding}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 py-2.5 text-sm font-medium text-white transition-colors"
                    >
                      {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {adding ? "Adding..." : "Add Lecturer"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
