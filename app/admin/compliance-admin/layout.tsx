"use client";
import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ClipboardList, CalendarCheck, FileCheck,
  Users, Shield, BarChart3, Settings2,
  Menu, X, LogOut, ChevronRight, ShieldCheck,
} from "lucide-react";
import { ComplianceAdminContext, type ComplianceAdminInfo } from "./context";

const BASE = "/admin/compliance-admin";

const NAV = [
  { label: "Overview",     href: `${BASE}/dashboard`,                     icon: LayoutDashboard, color: "text-teal-400" },
  { label: "Attendance",   href: `${BASE}/dashboard/attendance`,           icon: ClipboardList,   color: "text-emerald-400" },
  { label: "Sessions",     href: `${BASE}/dashboard/sessions`,             icon: CalendarCheck,   color: "text-sky-400" },
  { label: "Submissions",  href: `${BASE}/dashboard/submissions`,          icon: FileCheck,       color: "text-violet-400" },
  { label: "Enrollments",  href: `${BASE}/dashboard/enrollments`,          icon: Users,           color: "text-blue-400" },
  { label: "Audit Log",    href: `${BASE}/dashboard/audit`,                icon: Shield,          color: "text-rose-400" },
  { label: "Reports",      href: `${BASE}/dashboard/reports`,              icon: BarChart3,       color: "text-amber-400" },
  { label: "Settings",     href: `${BASE}/dashboard/settings`,             icon: Settings2,       color: "text-slate-400" },
];

function SidebarContent({ pathname, onClose }: { pathname: string; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 shadow-lg">
            <ShieldCheck className="h-4 w-4 text-white" />
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
            window.location.href = "/compliance/login";
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

export default function ComplianceAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<ComplianceAdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { router.replace("/compliance/login"); return; }
        setAdmin({
          id: data.id,
          fullName: data.fullName ?? "Compliance Admin",
          email: data.email ?? "",
          role: data.role ?? "compliance_admin",
          institutionId: data.institutionId ?? "",
          institutionName: data.institution?.name ?? "Institution",
        });
        setLoading(false);
      })
      .catch(() => router.replace("/compliance/login"));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <ComplianceAdminContext.Provider value={admin}>
      <div className="flex min-h-screen bg-slate-950">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-56 flex-col bg-gradient-to-b from-teal-950/60 to-slate-900 border-r border-white/8 fixed inset-y-0 left-0 z-30">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-56 bg-gradient-to-b from-teal-950/80 to-slate-900 border-r border-white/10 lg:hidden"
              >
                <SidebarContent pathname={pathname} onClose={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex flex-1 flex-col lg:pl-56">
          {/* Mobile topbar */}
          <header className="flex items-center justify-between border-b border-white/8 bg-slate-900/80 backdrop-blur-md px-4 py-3 lg:hidden">
            <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-white">Compliance Admin</span>
            <div className="h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
              {admin?.fullName?.[0] ?? "C"}
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ComplianceAdminContext.Provider>
  );
}
