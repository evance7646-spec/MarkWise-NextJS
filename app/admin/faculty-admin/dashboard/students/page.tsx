"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, X, Plus, AlertCircle, Building2 } from "lucide-react";
import { useFacultyAdmin } from "../../context";

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  email?: string;
  year: number;
  departmentId?: string;
  courseId?: string;
  courseName?: string;
}

interface Department { id: string; name: string }
interface Course { id: string; name: string; departmentId: string }

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function FacultyStudentsPage() {
  const admin = useFacultyAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;

  const fetchAll = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [s, d] = await Promise.all([
      fetch(`/api/students?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    setStudents(s.students ?? s.data ?? s ?? []);
    const depts = d.departments ?? d.data ?? d ?? [];
    setDepartments(depts);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = students
    .filter(s => deptFilter === "all" || s.departmentId === deptFilter)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.admissionNumber.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Students</h1>
        <p className="text-sm text-slate-500 mt-0.5">{students.length} student{students.length !== 1 ? "s" : ""} across the institution</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or admission no…"
            className={inp + " pl-9"} />
        </div>
      </div>

      {/* Dept filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setDeptFilter("all"); setPage(1); }}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${deptFilter === "all" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
          All Departments
        </button>
        {departments.map(d => (
          <button key={d.id} onClick={() => { setDeptFilter(d.id); setPage(1); }}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${deptFilter === d.id ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
            {d.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-3 px-4 py-3 border-b border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>Student</span><span>Admission No.</span><span>Year</span><span>Dept</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-xl bg-slate-800 animate-pulse" />)}</div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12"><Users className="h-8 w-8 text-slate-700" /><p className="text-sm text-slate-600">No students found</p></div>
        ) : paged.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center px-4 py-3 border-b border-slate-800/60 last:border-b-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                {s.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm text-slate-200">{s.name}</div>
                <div className="text-xs text-slate-500 sm:hidden">{s.admissionNumber}</div>
              </div>
            </div>
            <div className="hidden sm:block text-sm font-mono text-slate-400">{s.admissionNumber}</div>
            <div className="hidden sm:block text-xs text-slate-500">Yr {s.year}</div>
            <div className="hidden sm:block">
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400">
                {departments.find(d => d.id === s.departmentId)?.name?.split(" ")[0] ?? "—"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
