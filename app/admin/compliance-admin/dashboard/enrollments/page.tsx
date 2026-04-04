"use client";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, BookOpen, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { useComplianceAdmin } from "../../context";

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  courseId: string;
  departmentId: string;
  year: number;
}

interface Department {
  id: string;
  name: string;
}

interface Enrollment {
  id: string;
  unitId: string;
  unit?: { code: string; title: string; };
}

interface EnrollmentSnapshot {
  unitCodes: string[];
  year: string;
  semester: string;
  updatedAt: string;
}

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const MIN_UNITS = 3;
const PAGE_SIZE = 20;

export default function EnrollmentsCompliancePage() {
  const admin = useComplianceAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment[]>>({});
  const [snapshots, setSnapshots] = useState<Record<string, EnrollmentSnapshot>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!admin?.institutionId) return;
    const iid = admin.institutionId;
    fetch(`/api/departments?institutionId=${iid}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((data: any) => {
        const depts: Department[] = data.departments ?? data.data ?? [];
        setDepartments(depts);
        if (depts.length === 0) { setLoading(false); return; }
        return fetch(`/api/students?departmentId=${depts[0].id}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : {}) as Promise<any>;
      })
      .then((stuData: any) => {
        if (!stuData) { setLoading(false); return; }
        setStudents(stuData.students ?? stuData.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [admin]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = s.name.toLowerCase().includes(q) || s.admissionNumber.toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || s.departmentId === deptFilter;
      return matchSearch && matchDept;
    });
  }, [students, search, deptFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDeptChange = async (deptId: string) => {
    setDeptFilter(deptId);
    setPage(1);
    setExpanded(null);
    if (deptId === "all") return;
    setLoading(true);
    const data = await fetch(`/api/students?departmentId=${deptId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {}) as any;
    setStudents(data.students ?? data.data ?? []);
    setLoading(false);
  };

  const loadEnrollments = async (studentId: string) => {
    if (enrollments[studentId]) return;
    const data = await fetch(`/api/students/${studentId}/units`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {}) as any;
    const units: Enrollment[] = (data.units ?? data.data ?? []).map((u: any) => ({
      id: u.enrollmentId ?? u.id,
      unitId: u.id ?? u.unitId,
      unit: { code: u.code ?? "", title: u.title ?? u.name ?? "" },
    }));
    setEnrollments(prev => ({ ...prev, [studentId]: units }));

    // Also try to get snapshot
    // Snapshot is stored per-student, check if it's embedded in units response
    if (data.snapshot) {
      setSnapshots(prev => ({ ...prev, [studentId]: data.snapshot }));
    }
  };

  const toggleRow = async (studentId: string) => {
    if (expanded === studentId) { setExpanded(null); return; }
    setExpanded(studentId);
    await loadEnrollments(studentId);
  };

  const deptName = (id: string) => departments.find(d => d.id === id)?.name ?? "—";

  const underEnrolled = students.filter(s => {
    const enr = enrollments[s.id] ?? [];
    return enr.length > 0 && enr.length < MIN_UNITS;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-400" />
          Enrollment Compliance
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Verify students are enrolled in the required minimum of {MIN_UNITS} units
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Students", value: students.length, color: "text-blue-400", icon: Users, border: "border-slate-800" },
          { label: "Under-Enrolled", value: underEnrolled, color: "text-rose-400", icon: AlertTriangle, border: "border-rose-500/30" },
          { label: "Departments", value: departments.length, color: "text-teal-400", icon: BookOpen, border: "border-slate-800" },
        ].map(({ label, value, color, icon: Icon, border }) => (
          <div key={label} className={`rounded-2xl border ${border} bg-slate-900 p-5 flex items-center gap-4`}>
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
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
            placeholder="Search students…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className={`${inp} w-auto`} value={deptFilter} onChange={e => handleDeptChange(e.target.value)}>
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Student accordion */}
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
          <div className="divide-y divide-slate-800">
            {paginated.map(s => {
              const isOpen = expanded === s.id;
              const enr = enrollments[s.id];
              const unitCount = enr?.length ?? null;
              const compliant = unitCount == null || unitCount >= MIN_UNITS;

              return (
                <div key={s.id}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
                    onClick={() => toggleRow(s.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                        {s.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.admissionNumber} · {deptName(s.departmentId)} · Year {s.year}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {unitCount != null && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          compliant ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                        }`}>
                          {compliant ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {unitCount} unit{unitCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-800 px-5 py-4 bg-slate-800/20">
                          {enr == null ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                                className="h-4 w-4 rounded-full border-2 border-teal-500 border-t-transparent" />
                              Loading enrollments…
                            </div>
                          ) : enr.length === 0 ? (
                            <p className="text-sm text-rose-400 py-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" /> Not enrolled in any units
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {enr.map(e => (
                                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                                  <BookOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-white truncate">{e.unit?.code ?? "—"}</p>
                                    <p className="text-xs text-slate-500 truncate">{e.unit?.title ?? ""}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {enr != null && enr.length < MIN_UNITS && (
                            <p className="mt-3 text-xs text-rose-400 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Under-enrolled: {enr.length} of {MIN_UNITS} minimum units
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
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
