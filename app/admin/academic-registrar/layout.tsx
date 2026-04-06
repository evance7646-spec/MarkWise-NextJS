"use client";
import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck, FileText,
  ShieldCheck, BarChart3, Settings2, GraduationCap,
  Menu, X, LogOut, ChevronRight, ClipboardList, Layers, Calendar,
} from "lucide-react";
import { AcademicRegistrarContext, type AcademicRegistrarInfo } from "./context";

const BASE = "/admin/academic-registrar";

const NAV = [
  { label: "Overview",     href: `${BASE}/dashboard`,                   icon: LayoutDashboard, color: "text-purple-400" },
  { label: "Students",     href: `${BASE}/dashboard/students`,           icon: Users,           color: "text-emerald-400" },
  { label: "Lecturers",    href: `${BASE}/dashboard/lecturers`,          icon: GraduationCap,   color: "text-amber-400" },
  { label: "Enrollments",  href: `${BASE}/dashboard/enrollments`,        icon: ClipboardList,   color: "text-sky-400" },
  { label: "Courses",      href: `${BASE}/dashboard/courses`,            icon: BookOpen,        color: "text-amber-400" },
  { label: "Programs",     href: `${BASE}/dashboard/programs`,           icon: Layers,          color: "text-cyan-400" },
  { label: "Curriculum",   href: `${BASE}/dashboard/curriculum`,         icon: ClipboardCheck,  color: "text-violet-400" },
  { label: "Timetable",    href: `${BASE}/dashboard/timetable`,          icon: Calendar,        color: "text-orange-400" },
  { label: "Attendance",   href: `${BASE}/dashboard/attendance`,         icon: ClipboardCheck,  color: "text-teal-400" },
  { label: "Transcripts",  href: `${BASE}/dashboard/transcripts`,        icon: FileText,        color: "text-violet-400" },
  { label: "Verification", href: `${BASE}/dashboard/verification`,       icon: ShieldCheck,     color: "text-rose-400" },
  { label: "Analytics",    href: `${BASE}/dashboard/analytics`,          icon: BarChart3,       color: "text-blue-400" },
  { label: "Reports",      href: `${BASE}/dashboard/reports`,            icon: BarChart3,       color: "text-cyan-400" },
  { label: "Settings",     href: `${BASE}/dashboard/settings`,           icon: Settings2,       color: "text-slate-400" },
];

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500 shadow-lg">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">MarkWise</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon, color }) => {
          const active = pathname === href || (href !== `${BASE}/dashboard` && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose}>
              <span className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active ? "bg-white/15 text-white shadow-sm" : "text-slate-400 hover:bg-white/8 hover:text-slate-200"
              }`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : color}`} />
                {label}
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/60" />}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={async () => {
            await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
            window.location.href = "/admin/login";
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-400"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function AcademicRegistrarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AcademicRegistrarInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.push("/admin/login"); return; }
        setAdmin({
          id: data.id,
          fullName: data.fullName ?? "Admin",
          email: data.email ?? "",
          role: data.role ?? "academic_registrar",
          institutionId: data.institutionId ?? "",
          institutionName: data.institution?.name ?? "Institution",
        });
        setLoading(false);
      })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  const pageLabel = NAV.find(n =>
    pathname === n.href || (n.href !== `${BASE}/dashboard` && pathname.startsWith(n.href))
  )?.label ?? "Dashboard";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading registry…</p>
        </div>
      </div>
    );
  }

  return (
    <AcademicRegistrarContext.Provider value={admin}>
      <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col bg-gradient-to-b from-purple-950 to-slate-900 border-r border-white/8 overflow-y-auto">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer overlay */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />
              <motion.aside initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }} transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 z-50 flex h-full w-56 flex-col bg-gradient-to-b from-purple-950 to-slate-900 md:hidden">
                <SidebarContent pathname={pathname} onClose={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur">
            <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-500">Registry</span>
              <span className="mx-1.5 text-slate-700">/</span>
              <span className="text-xs font-medium text-slate-300">{pageLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                {admin?.fullName?.[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:block text-sm text-slate-300 truncate max-w-24">{admin?.fullName}</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-gray-50 p-5 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AcademicRegistrarContext.Provider>
  );
}
