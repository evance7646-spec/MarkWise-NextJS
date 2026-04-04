"use client";
import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Calendar, Users, GraduationCap, BookOpen,
  ClipboardCheck, Bell, Star, BarChart3, RefreshCw, Settings2,
  Menu, X, LogOut, Building2, ChevronRight,
} from "lucide-react";
import { AdminContext, type AdminInfo } from "./context";

const NAV = [
  { label: "Overview",        href: "/admin/department-admin/dashboard",               icon: LayoutDashboard, color: "text-indigo-400" },
  { label: "Timetable",       href: "/admin/department-admin/dashboard/timetable",      icon: Calendar,         color: "text-sky-400" },
  { label: "Students",        href: "/admin/department-admin/dashboard/students",       icon: Users,            color: "text-emerald-400" },
  { label: "Lecturers",       href: "/admin/department-admin/dashboard/lecturers",      icon: GraduationCap,    color: "text-violet-400" },
  { label: "Curriculum",      href: "/admin/department-admin/dashboard/curriculum",     icon: BookOpen,         color: "text-amber-400" },
  { label: "Attendance",      href: "/admin/department-admin/dashboard/attendance",     icon: ClipboardCheck,   color: "text-teal-400" },
  { label: "Announcements",   href: "/admin/department-admin/dashboard/announcements",  icon: Bell,             color: "text-orange-400" },
  { label: "Representatives", href: "/admin/department-admin/dashboard/representatives",icon: Star,             color: "text-pink-400" },
  { label: "Analytics",       href: "/admin/department-admin/dashboard/analytics",      icon: BarChart3,        color: "text-cyan-400" },
  { label: "Substitutions",   href: "/admin/department-admin/dashboard/substitutions",  icon: RefreshCw,        color: "text-lime-400" },
  { label: "Settings",        href: "/admin/department-admin/dashboard/settings",       icon: Settings2,        color: "text-slate-400" },
];

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-lg">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">MarkWise</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon, color }) => {
          const active = pathname === href || (href !== "/admin/department-admin/dashboard" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose}>
              <span className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-slate-400 hover:bg-white/8 hover:text-slate-200"
              }`}>
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : color}`} />
                {label}
                {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-white/60" />}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={async () => {
            await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
            window.location.href = "/admin/department-admin/login";
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

export default function DepartmentAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.push("/admin/department-admin/login"); return; }
        setAdmin({
          id: data.id,
          fullName: data.fullName ?? "Admin",
          email: data.email ?? "",
          role: data.role ?? "department_admin",
          departmentId: data.departmentId ?? data.department?.id ?? "",
          departmentName: data.department?.name ?? "Department",
          institutionId: data.institutionId ?? "",
        });
        setLoading(false);
      })
      .catch(() => router.push("/admin/department-admin/login"));
  }, [router]);

  const pageLabel = NAV.find(n =>
    pathname === n.href || (n.href !== "/admin/department-admin/dashboard" && pathname.startsWith(n.href))
  )?.label ?? "Dashboard";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={admin}>
      <div className="flex h-screen overflow-hidden bg-slate-950">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 md:flex flex-col bg-gradient-to-b from-slate-900 to-indigo-950 border-r border-white/8">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 z-50 h-full w-56 bg-gradient-to-b from-slate-900 to-indigo-950 md:hidden"
              >
                <SidebarContent pathname={pathname} onClose={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4">
            <button
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="text-xs text-slate-500 truncate hidden sm:block">{admin?.departmentName}</span>
              <span className="text-slate-600 hidden sm:block">/</span>
              <span className="text-sm font-semibold text-slate-200 truncate">{pageLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
                <span className="text-xs font-bold text-indigo-300">
                  {admin?.fullName?.charAt(0).toUpperCase() ?? "A"}
                </span>
              </div>
              <span className="hidden sm:block text-xs text-slate-400 truncate max-w-24">{admin?.fullName}</span>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
