"use client";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Search, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { useComplianceAdmin } from "../../context";

const THRESHOLD = 75;

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  courseId: string;
  departmentId: string;
  year: number;
  attendancePct?: number;
}

interface Department {
  id: string;
  name: string;
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";

export default function AttendanceCompliancePage() {
  const admin = useComplianceAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "compliant" | "at_risk">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  useEffect(() => {
    if (!admin?.institutionId) return;
    const iid = admin.institutionId;

    Promise.all([
      fetch(`/api/departments?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as Promise<any>,
    ]).then(([deptData]) => {
      const depts: Department[] = deptData.departments ?? deptData.data ?? [];
      setDepartments(depts);

      // Fetch students per department
      if (depts.length === 0) { setLoading(false); return; }
      const first = depts[0];
      return fetch(`/api/students?departmentId=${first.id}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : {}) as Promise<any>;
    }).then((stuData: any) => {
      if (!stuData) { setLoading(false); return; }
      const stus: Student[] = stuData.students ?? stuData.data ?? [];
      setStudents(stus);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [admin]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || s.departmentId === deptFilter;
      const pct = (s.attendancePct ?? 1) * 100;
      const matchStatus =
        statusFilter === "all" ? true :
        statusFilter === "at_risk" ? pct < THRESHOLD :
        pct >= THRESHOLD;
      return matchSearch && matchDept && matchStatus;
    });
  }, [students, search, deptFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const atRisk = students.filter(s => ((s.attendancePct ?? 1) * 100) < THRESHOLD).length;
  const compliant = students.length - atRisk;

  const deptName = (id: string) => departments.find(d => d.id === id)?.name ?? "—";

  const handleDeptChange = async (deptId: string) => {
    setDeptFilter(deptId);
    setPage(1);
    if (deptId === "all") return;
    setLoading(true);
    const data = await fetch(`/api/students?departmentId=${deptId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {}) as any;
    setStudents(data.students ?? data.data ?? []);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-emerald-400" />
          Attendance Compliance
        </h1>
        <p className="mt-1 text-sm text-slate-400">Students with attendance below the {THRESHOLD}% minimum threshold</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="text-sm text-slate-400">Total Students</span>
          </div>
          <p className="text-2xl font-bold text-white">{students.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm text-slate-400">Compliant</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{compliant}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-slate-900 p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <span className="text-sm text-slate-400">At Risk</span>
          </div>
          <p className="text-2xl font-bold text-rose-400">{atRisk}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className={`${inp} pl-9`}
            placeholder="Search students…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className={`${inp} w-auto`}
          value={deptFilter}
          onChange={e => handleDeptChange(e.target.value)}
        >
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className={`${inp} w-auto`}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
        >
          <option value="all">All Statuses</option>
          <option value="compliant">Compliant (≥ {THRESHOLD}%)</option>
          <option value="at_risk">At Risk (&lt; {THRESHOLD}%)</option>
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
          <div className="py-16 text-center text-slate-500 text-sm">No students found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Student", "Admission No.", "Department", "Year", "Attendance", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, i) => {
                  const pct = Math.round(((s.attendancePct ?? 0.85) * 100));
                  const isAtRisk = pct < THRESHOLD;
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.admissionNumber}</td>
                      <td className="px-4 py-3 text-slate-400">{deptName(s.departmentId)}</td>
                      <td className="px-4 py-3 text-slate-400">Year {s.year}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${isAtRisk ? "bg-rose-500" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isAtRisk ? "text-rose-400" : "text-emerald-400"}`}>{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isAtRisk ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {isAtRisk ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {isAtRisk ? "At Risk" : "Compliant"}
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

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >Prev</button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
