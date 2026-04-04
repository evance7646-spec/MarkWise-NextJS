"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Plus, X, UserPlus, ChevronLeft, ChevronRight,
  Upload, Filter, AlertTriangle,
} from "lucide-react";
import { useRegistryAdmin } from "../../context";

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";
const PAGE = 25;

interface Student {
  id: string; name: string; admissionNumber: string;
  email: string; year: number; courseId: string; departmentId: string;
  course?: { name: string }; department?: { name: string };
}
interface Dept { id: string; name: string }
interface Course { id: string; name: string; code: string; departmentId: string }

function AddStudentModal({ depts, courses, onClose, onSaved }: {
  depts: Dept[]; courses: Course[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", admissionNumber: "", email: "", year: "1", courseId: "", departmentId: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const filteredCourses = courses.filter(c => !form.departmentId || c.departmentId === form.departmentId);

  const save = async () => {
    if (!form.name || !form.admissionNumber || !form.email || !form.courseId || !form.departmentId) {
      setErr("All fields required"); return;
    }
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/students", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, year: Number(form.year) }),
      });
      if (!r.ok) { const j = await r.json(); setErr(j.error ?? "Failed"); setSaving(false); return; }
      onSaved();
    } catch { setErr("Network error"); setSaving(false); }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2"><UserPlus className="h-4 w-4 text-emerald-400" /> Admit Student</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div><label className={lbl}>Full Name</label><input value={form.name} onChange={f("name")} className={inp} placeholder="e.g. Jane Osei" /></div>
          <div><label className={lbl}>Admission Number</label><input value={form.admissionNumber} onChange={f("admissionNumber")} className={inp} placeholder="e.g. CS/2024/001" /></div>
          <div><label className={lbl}>Email Address</label><input type="email" value={form.email} onChange={f("email")} className={inp} placeholder="student@email.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Department</label>
              <select value={form.departmentId} onChange={f("departmentId")} className={inp}>
                <option value="">Select dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Year</label>
              <select value={form.year} onChange={f("year")} className={inp}>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          <div><label className={lbl}>Course / Programme</label>
            <select value={form.courseId} onChange={f("courseId")} className={inp}>
              <option value="">Select course</option>
              {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.code} – {c.name}</option>)}
            </select>
          </div>
          {err && <p className="text-xs text-rose-400">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 hover:bg-slate-800">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">
              {saving ? "Saving…" : "Admit"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BulkImportModal({ institutionId, depts, courses, onClose, onSaved }: {
  institutionId: string; depts: Dept[]; courses: Course[];
  onClose: () => void; onSaved: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [deptId, setDeptId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [year, setYear] = useState("1");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const filteredCourses = courses.filter(c => !deptId || c.departmentId === deptId);

  const save = async () => {
    const rows = csv.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (!rows.length || !courseId || !deptId) { setErr("CSV rows, department and course required"); return; }
    const students = rows.map(r => {
      const [name, admissionNumber, email] = r.split(",").map(s => s.trim());
      return { name, admissionNumber, email, courseId, departmentId: deptId, year: Number(year), institutionId };
    });
    setSaving(true); setErr(""); setResult(null);
    try {
      const r = await fetch("/api/students/bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
      });
      const j = await r.json() as any;
      if (!r.ok) { setErr(j.error ?? "Failed"); setSaving(false); return; }
      setResult({ created: j.created ?? students.length, skipped: j.skipped ?? 0 });
      onSaved();
    } catch { setErr("Network error"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100 flex items-center gap-2"><Upload className="h-4 w-4 text-sky-400" /> Bulk Import Students</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Paste CSV rows: <span className="font-mono text-slate-400">Name, AdmissionNumber, Email</span> (one per line)</p>
        <div className="space-y-3">
          <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={6}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder={"Jane Osei, CS/2024/001, jane@uni.edu\nKwame Asante, CS/2024/002, kwame@uni.edu"} />
          <div className="grid grid-cols-3 gap-2">
            <div><label className={lbl}>Department</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className={inp.replace("emerald","sky")}>
                <option value="">Dept</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Course</label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inp.replace("emerald","sky")}>
                <option value="">Course</option>
                {filteredCourses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Year</label>
              <select value={year} onChange={e => setYear(e.target.value)} className={inp.replace("emerald","sky")}>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>
          {err && <p className="text-xs text-rose-400">{err}</p>}
          {result && <p className="text-xs text-emerald-400">✓ Created {result.created}, skipped {result.skipped}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 hover:bg-slate-800">Close</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-sky-600 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60">
              {saving ? "Importing…" : "Import"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function StudentsPage() {
  const admin = useRegistryAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [s, d, c] = await Promise.all([
      fetch(`/api/students?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/courses?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    setStudents(s.students ?? s.data ?? s ?? []);
    setDepts(d.departments ?? d.data ?? d ?? []);
    setCourses(c.courses ?? c.data ?? c ?? []);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { load(); }, [load]);

  // debounce search → reset page
  useEffect(() => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => setPage(1), 300);
  }, [search]);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchDept = deptFilter === "all" || s.departmentId === deptFilter;
    return matchSearch && matchDept;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-400" /> Students
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{students.length} registered · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/20">
            <Upload className="h-4 w-4" /> Bulk Import
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> Admit Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, admission no, or email…"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-600" />
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300">
            <option value="all">All Departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Admission No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Course</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Year</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    {[1,2,3,4,5].map(j => (
                      <td key={j} className="px-4 py-3"><div className="h-5 rounded bg-slate-800 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : slice.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-7 w-7 text-slate-700" />
                      <p className="text-slate-500">{search ? "No students match your search" : "No students registered yet"}</p>
                    </div>
                  </td>
                </tr>
              ) : slice.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200 leading-tight">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.admissionNumber}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{s.department?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{s.course?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Yr {s.year}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {!loading && filtered.length > PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddStudentModal depts={depts} courses={courses} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
        {showBulk && admin && <BulkImportModal institutionId={admin.institutionId} depts={depts} courses={courses} onClose={() => setShowBulk(false)} onSaved={() => { setShowBulk(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}
