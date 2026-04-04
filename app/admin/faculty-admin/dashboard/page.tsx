"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, GraduationCap, Users, BookOpen, BarChart3, Bell, Calendar, Settings2, ArrowRight } from "lucide-react";
import { useFacultyAdmin } from "../context";

interface Stat { label: string; value: number | string; icon: React.ElementType; color: string; bg: string }

const BASE = "/admin/faculty-admin/dashboard";

const QUICK_ACTIONS = [
  { label: "Manage Departments", href: `${BASE}/departments`, icon: Building2,    color: "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20" },
  { label: "View Lecturers",     href: `${BASE}/lecturers`,   icon: GraduationCap, color: "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" },
  { label: "Browse Students",    href: `${BASE}/students`,    icon: Users,         color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  { label: "Timetable",          href: `${BASE}/timetable`,   icon: Calendar,      color: "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20" },
  { label: "Analytics",          href: `${BASE}/analytics`,   icon: BarChart3,     color: "bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20" },
  { label: "Announcements",      href: `${BASE}/announcements`,icon: Bell,         color: "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" },
];

export default function FacultyDashboard() {
  const admin = useFacultyAdmin();
  const [stats, setStats] = useState({ departments: 0, lecturers: 0, students: 0, programs: 0 });
  const [recentDepts, setRecentDepts] = useState<{ id: string; name: string; _count?: { students?: number; courses?: number } }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const [d, l, s] = await Promise.all([
      fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/lecturers?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
      fetch(`/api/students?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any,
    ]);
    const depts = d.departments ?? d.data ?? d ?? [];
    const lecturers = l.lecturers ?? l.data ?? l ?? [];
    const students = s.students ?? s.data ?? s ?? [];
    setStats({
      departments: depts.length,
      lecturers: lecturers.length,
      students: students.length,
      programs: 0,
    });
    setRecentDepts(depts.slice(0, 5));
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statCards: Stat[] = [
    { label: "Departments",  value: stats.departments, icon: Building2,    color: "text-sky-400",    bg: "bg-sky-500/10" },
    { label: "Lecturers",    value: stats.lecturers,   icon: GraduationCap, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Students",     value: stats.students,    icon: Users,         color: "text-emerald-400",bg: "bg-emerald-500/10" },
    { label: "Modules",      value: stats.programs,    icon: BookOpen,      color: "text-amber-400",  bg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-900/40 to-slate-900/60 border border-blue-500/20 p-5">
        <p className="text-sm text-blue-300 font-medium">Welcome back,</p>
        <h1 className="text-2xl font-bold text-white mt-0.5">{admin?.fullName?.split(" ")[0] ?? "Admin"} 👋</h1>
        <p className="text-sm text-slate-400 mt-1">Faculty admin · {admin?.institutionName ?? "Institution"}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${s.bg}`}>
              <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {loading ? <span className="inline-block h-6 w-10 rounded bg-slate-800 animate-pulse" /> : s.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.href} href={a.href}>
                <span className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${a.color}`}>
                  <a.icon className="h-4 w-4 shrink-0" />
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Departments list */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-200">Departments</h2>
            <Link href={`${BASE}/departments`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-slate-800 animate-pulse" />)}</div>
          ) : recentDepts.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">No departments found</p>
          ) : recentDepts.map((dept, i) => (
            <motion.div key={dept.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-800/30 px-3 py-2.5 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 text-xs font-bold">
                {dept.name[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-sm text-slate-300 truncate">{dept.name}</span>
              <Link href={`${BASE}/departments`} className="text-slate-600 hover:text-sky-400 transition-colors">
                <Settings2 className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
