"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Search, X, Filter } from "lucide-react";
import { useInstitutionAdmin } from "../../context";

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  email?: string | null;
  year: number;
  departmentId: string;
  courseId: string;
  department?: { name: string } | null;
  course?: { name: string; code: string } | null;
  attendancePct?: number | null;
}

interface Department { id: string; name: string }

const PAGE_SIZE = 30;

export default function StudentsPage() {
  const admin = useInstitutionAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    if (!admin?.institutionId) { setLoading(false); return; }
    const iid = admin.institutionId;
    setLoading(true);
    const [sRes, dRes] = await Promise.all([
      fetch(`/api/students?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`/api/departments?institutionId=${iid}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]);
    setStudents(sRes?.students ?? sRes?.data ?? (Array.isArray(sRes) ? sRes : []));
    setDepartments(dRes?.departments ?? dRes?.data ?? (Array.isArray(dRes) ? dRes : []));
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const years = [...new Set(students.map(s => s.year))].sort((a, b) => a - b);

  const filtered = students.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNumber.toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || s.departmentId === deptFilter;
    const matchYear = yearFilter === "all" || String(s.year) === yearFilter;
    return matchSearch && matchDept && matchYear;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => { setSearch(""); setDeptFilter("all"); setYearFilter("all"); setPage(1); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Students</h1>
          <p className="text-xs text-slate-500 mt-0.5">{students.length} student{students.length !== 1 ? "s" : ""} enrolled</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Students", value: students.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Departments",    value: departments.length, color: "text-sky-400",    bg: "bg-sky-500/10" },
          { label: "Year Groups",    value: years.length,       color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Showing",        value: filtered.length,    color: "text-amber-400",  bg: "bg-amber-500/10" },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
          >
            <div className={`text-2xl font-bold ${c.color}`}>
              {loading ? <span className="inline-block h-6 w-8 rounded bg-slate-800 animate-pulse" /> : c.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Search name, admission no., email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          value={deptFilter}
          onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          value={yearFilter}
          onChange={e => { setYearFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Years</option>
          {years.map(y => <option key={y} value={String(y)}>Year {y}</option>)}
        </select>
        {(search || deptFilter !== "all" || yearFilter !== "all") && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
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
              className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent"
            />
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">
              {search || deptFilter !== "all" || yearFilter !== "all"
                ? "No students match your filters."
                : "No students enrolled yet."}
            </p>
            {(search || deptFilter !== "all" || yearFilter !== "all") && (
              <button onClick={resetFilters} className="mt-2 text-xs text-emerald-400 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Admission No.</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Department</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Year</th>
                <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paged.map((s, i) => {
                const atPct = s.attendancePct != null ? Math.round(s.attendancePct * 100) : null;
                return (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 shrink-0">
                          <Users className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">{s.name}</div>
                          {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-400 font-mono text-xs">
                      {s.admissionNumber}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                      {departments.find(d => d.id === s.departmentId)?.name ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="inline-flex items-center rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                        Year {s.year}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {atPct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 w-16">
                            <div
                              className={`h-1.5 rounded-full transition-all ${atPct >= 75 ? "bg-emerald-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, atPct)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${atPct >= 75 ? "text-emerald-400" : "text-red-400"}`}>
                            {atPct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
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
    </div>
  );
}
