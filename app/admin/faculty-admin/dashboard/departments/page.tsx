"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Trash2, Users, BookOpen, Search, X, AlertCircle } from "lucide-react";
import { useFacultyAdmin } from "../../context";

interface Department {
  id: string;
  name: string;
  _count?: { students?: number; courses?: number; admins?: number };
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function DepartmentsPage() {
  const admin = useFacultyAdmin();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchDepts = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const res = await fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" });
    const data = res.ok ? await res.json() : {} as any;
    setDepartments(data.departments ?? data.data ?? data ?? []);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const visible = departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!newName.trim() || !admin?.institutionId) { setError("Department name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/departments", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), institutionId: admin.institutionId }),
    });
    if (res.ok) { setNewName(""); setShowAdd(false); fetchDepts(); }
    else { const d = await res.json().catch(() => ({})) as any; setError(d.error ?? "Failed to create department"); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    await fetch(`/api/departments/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleteTarget(null); setSaving(false); fetchDepts();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">All departments under this institution</p>
        </div>
        <button onClick={() => { setShowAdd(true); setNewName(""); setError(""); }}
          className="flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors">
          <Plus className="h-4 w-4" /> Add Department
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments…"
          className={inp + " pl-9"} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-900 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-2 py-12">
              <Building2 className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">No departments found</p>
            </div>
          ) : visible.map((dept, i) => (
            <motion.div key={dept.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 font-bold text-sm">
                    {dept.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{dept.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{dept.id.slice(0, 8)}…</div>
                  </div>
                </div>
                <button onClick={() => setDeleteTarget(dept)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{dept._count?.students ?? "—"} students</span>
                <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{dept._count?.courses ?? "—"} courses</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add department modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-100">New Department</h2>
                <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Department Name <span className="text-red-400">*</span></label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} className={inp} placeholder="e.g. Computer Science" />
                </div>
                {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setShowAdd(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors">
                  {saving ? "Creating…" : <><Plus className="h-4 w-4" /> Create</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-slate-900 p-6 shadow-2xl">
              <h2 className="text-base font-bold text-slate-100 mb-2">Delete Department?</h2>
              <p className="text-sm text-slate-400 mb-5">This will permanently remove <strong className="text-slate-200">{deleteTarget.name}</strong> and all associated data.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={saving}
                  className="rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors">
                  {saving ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
