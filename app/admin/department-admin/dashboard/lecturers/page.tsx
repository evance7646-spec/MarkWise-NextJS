"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Plus, Search, X, AlertCircle, Mail, Phone } from "lucide-react";
import { useDepartmentAdmin } from "../../context";

interface Lecturer {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
}

const inp = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const lbl = "block text-xs font-medium text-gray-500 mb-1.5";
const EMPTY = { fullName: "", email: "", password: "", phoneNumber: "" };

export default function DeptLecturersPage() {
  const admin = useDepartmentAdmin();
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    if (!admin?.departmentId) return;
    setLoading(true);
    const data = await fetch(`/api/lecturers?departmentId=${admin.departmentId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {}) as any;
    setLecturers(data.lecturers ?? data.data ?? data ?? []);
    setLoading(false);
  }, [admin?.departmentId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const visible = lecturers.filter(l =>
    !search || l.fullName.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!form.fullName || !form.email || !form.password) { setError("Full name, email and password are required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/lecturers", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, institutionId: admin?.institutionId, departmentId: admin?.departmentId }),
    });
    if (res.ok) { setShowAdd(false); setForm(EMPTY); fetchAll(); }
    else { const d = await res.json().catch(() => ({})) as any; setError(d.error ?? "Failed to add lecturer"); }
    setSaving(false);
  }

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Lecturers</h1>
          <p className="text-sm text-gray-400 mt-0.5">{lecturers.length} in {admin?.departmentName}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm(EMPTY); setError(""); }}
          className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors">
          <Plus className="h-4 w-4" /> Add Lecturer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className={inp + " pl-9"} />
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-2xl bg-gray-200 animate-pulse" />)}</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_2fr_auto] gap-3 px-4 py-3 border-b border-gray-200 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <span>Lecturer</span><span>Contact</span><span>ID</span>
          </div>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <GraduationCap className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-gray-500">No lecturers found</p>
            </div>
          ) : visible.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_auto] gap-2 items-center px-4 py-3.5 border-b border-gray-200/60 last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/20 text-teal-600 font-bold text-sm shrink-0">
                  {l.fullName[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{l.fullName}</div>
                  <div className="text-xs text-gray-400 sm:hidden">{l.email}</div>
                </div>
              </div>
              <div className="hidden sm:flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="h-3.5 w-3.5" />{l.email}</span>
                {l.phoneNumber && <span className="flex items-center gap-1.5 text-xs text-gray-400"><Phone className="h-3.5 w-3.5" />{l.phoneNumber}</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono hidden sm:block">{l.id.slice(0, 8)}…</div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div key="lecturer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowAdd(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div key="lecturer-card" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white text-gray-900 p-6 shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-800">Add Lecturer</h2>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div><label className={lbl}>Full Name <span className="text-red-600">*</span></label><input value={form.fullName} onChange={f("fullName")} className={inp} placeholder="Dr. Jane Smith" /></div>
                <div><label className={lbl}>Email <span className="text-red-600">*</span></label><input type="email" value={form.email} onChange={f("email")} className={inp} placeholder="jane@university.edu" /></div>
                <div><label className={lbl}>Password <span className="text-red-600">*</span></label><input type="password" value={form.password} onChange={f("password")} className={inp} placeholder="Min. 8 characters" /></div>
                <div><label className={lbl}>Phone Number</label><input value={form.phoneNumber} onChange={f("phoneNumber")} className={inp} placeholder="+254 7XX XXX XXX" /></div>
                {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setShowAdd(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white">
                  {saving ? "Saving…" : <><Plus className="h-4 w-4" /> Add Lecturer</>}
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
