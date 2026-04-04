"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Layers, Building2, ChevronDown, ChevronRight, Search, X, BookOpen } from "lucide-react";
import { useInstitutionAdmin } from "../../context";

interface Department { id: string; name: string }
interface YearBlock { id: string; name: string; semesters: { id: string; label: string }[] }
interface Program {
  id: string;
  name: string;
  durationYears: number;
  departmentId: string;
  years: YearBlock[];
}

export default function ProgramsPage() {
  const admin = useInstitutionAdmin();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programsByDept, setProgramsByDept] = useState<Record<string, Program[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!admin?.institutionId) { setLoading(false); return; }
    setLoading(true);
    const dRes = await fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" });
    if (!dRes.ok) { setLoading(false); return; }
    const dData = await dRes.json();
    const depts: Department[] = dData?.departments ?? dData?.data ?? (Array.isArray(dData) ? dData : []);
    setDepartments(depts);

    const progMap: Record<string, Program[]> = {};
    await Promise.all(
      depts.map(async (dept) => {
        const r = await fetch(`/api/programs?departmentId=${dept.id}`, { credentials: "include" });
        if (r.ok) {
          const pd = await r.json();
          progMap[dept.id] = pd?.programs ?? pd?.data ?? (Array.isArray(pd) ? pd : []);
        } else {
          progMap[dept.id] = [];
        }
      })
    );
    setProgramsByDept(progMap);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (deptId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const filteredDepts = departments.filter(d => {
    if (!search) return true;
    const matchDept = d.name.toLowerCase().includes(search.toLowerCase());
    const matchProg = (programsByDept[d.id] ?? []).some(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    return matchDept || matchProg;
  });

  const totalPrograms = Object.values(programsByDept).reduce((sum, progs) => sum + progs.length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Programs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {totalPrograms} program{totalPrograms !== 1 ? "s" : ""} across {departments.length} department{departments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          placeholder="Search departments or programs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-6 w-6 rounded-full border-2 border-cyan-500 border-t-transparent"
          />
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Layers className="h-10 w-10 text-slate-700 mb-3" />
          <p className="text-sm text-slate-500">
            {search ? "No programs match your search." : "No departments configured yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDepts.map((dept, i) => {
            const progs = (programsByDept[dept.id] ?? []).filter(p =>
              !search ||
              dept.name.toLowerCase().includes(search.toLowerCase()) ||
              p.name.toLowerCase().includes(search.toLowerCase())
            );
            const isOpen = expanded.has(dept.id);

            return (
              <motion.div
                key={dept.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(dept.id)}
                  className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                      <Building2 className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-200">{dept.name}</div>
                      <div className="text-xs text-slate-500">{progs.length} program{progs.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-800 px-5 pb-4 pt-3 space-y-3">
                    {progs.length === 0 ? (
                      <p className="text-xs text-slate-500 py-2">No programs in this department.</p>
                    ) : progs.map((prog) => (
                      <div key={prog.id} className="rounded-xl bg-slate-800/50 p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                          <span className="text-sm font-medium text-slate-200">{prog.name}</span>
                          <span className="ml-auto text-xs text-slate-500">{prog.durationYears} yr{prog.durationYears !== 1 ? "s" : ""}</span>
                        </div>
                        {prog.years.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {prog.years.map(yr => (
                              <div key={yr.id} className="rounded-lg bg-slate-700/50 px-3 py-1.5">
                                <div className="text-xs font-medium text-slate-300">{yr.name}</div>
                                {yr.semesters.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {yr.semesters.map(sem => (
                                      <span key={sem.id} className="rounded bg-slate-600/50 px-1.5 py-0.5 text-[10px] text-slate-400">
                                        {sem.label}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
