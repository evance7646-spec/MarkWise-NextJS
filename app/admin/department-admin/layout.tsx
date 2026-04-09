"use client";
import React, { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DepartmentAdminInfo, DepartmentAdminContext } from "./context";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, BookOpen, ClipboardCheck,
  GraduationCap, Menu, X, LogOut, ChevronRight,
  Building2, Calendar, ClipboardList, BarChart3,
  Bell, Search, Settings, ChevronDown, Sparkles,
  TrendingUp, CheckCircle2, AlertCircle, School,
} from "lucide-react";

const BASE = "/admin/department-admin";

const NAV_ITEMS = [
  { label: "Overview", href: `${BASE}/dashboard`, icon: LayoutDashboard, color: "#14B8A6", gradient: "from-teal-500/20 to-teal-600/10" },
  { label: "Timetable", href: `${BASE}/dashboard/timetable`, icon: Calendar, color: "#F97316", gradient: "from-orange-500/20 to-orange-600/10" },
  { label: "Curriculum", href: `${BASE}/dashboard/curriculum`, icon: ClipboardCheck, color: "#A855F7", gradient: "from-violet-500/20 to-violet-600/10" },
  { label: "Students", href: `${BASE}/dashboard/students`, icon: Users, color: "#10B981", gradient: "from-emerald-500/20 to-emerald-600/10" },
  { label: "Lecturers", href: `${BASE}/dashboard/lecturers`, icon: GraduationCap, color: "#F59E0B", gradient: "from-amber-500/20 to-amber-600/10" },
  { label: "Courses", href: `${BASE}/dashboard/courses`, icon: BookOpen, color: "#F59E0B", gradient: "from-amber-500/20 to-amber-600/10" },
  { label: "Attendance", href: `${BASE}/dashboard/attendance`, icon: ClipboardList, color: "#14B8A6", gradient: "from-teal-500/20 to-teal-600/10" },
  { label: "Analytics", href: `${BASE}/dashboard/analytics`, icon: BarChart3, color: "#06B6D4", gradient: "from-cyan-500/20 to-cyan-600/10" },
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================
function SidebarContent({ 
  admin, 
  pathname, 
  onClose,
  collapsed = false,
}: { 
  admin: DepartmentAdminInfo | null; 
  pathname: string; 
  onClose?: () => void;
  collapsed?: boolean;
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col relative">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent" />
      
      {/* Header */}
      <div className={`
        relative flex items-center border-b border-white/10 px-5 py-5
        ${collapsed ? 'justify-center' : 'justify-between'}
      `}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-teal-500 blur-lg opacity-50" />
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg">
                  <School className="h-4 w-4 text-white" />
                </div>
              </div>
              <span className="text-base font-bold text-white tracking-tight">MarkWise</span>
            </div>
            {onClose && (
              <button 
                onClick={onClose} 
                className="rounded-lg p-1 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-teal-500 blur-lg opacity-50" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg">
              <School className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Department Info Badge */}
      {admin && !collapsed && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-4 mt-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
        >
          <div className="flex items-start gap-2">
            <div className="rounded-lg bg-teal-500/20 p-1.5">
              <Building2 className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{admin.departmentName}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{admin.institutionName}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-6 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon, color, gradient }) => {
          const active = pathname === href || (href !== `${BASE}/dashboard` && pathname.startsWith(href));
          const isHovered = hoveredItem === href;
          
          return (
            <Link key={href} href={href} onClick={onClose}>
              <motion.div
                onMouseEnter={() => setHoveredItem(href)}
                onMouseLeave={() => setHoveredItem(null)}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative group rounded-xl transition-all duration-200
                  ${active ? 'bg-gradient-to-r shadow-lg' : 'hover:bg-white/5'}
                  ${gradient}
                `}
                style={active ? { backgroundImage: `linear-gradient(to right, ${color}15, transparent)` } : {}}
              >
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 text-sm font-medium
                  ${collapsed ? 'justify-center' : ''}
                `}>
                  <div className={`
                    relative rounded-lg p-1.5 transition-all duration-200
                    ${active ? 'bg-gradient-to-br shadow-md' : 'bg-white/5 group-hover:bg-white/10'}
                  `} style={active ? { backgroundImage: `linear-gradient(135deg, ${color}, ${color}cc)` } : {}}>
                    <Icon className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-white' : `text-${color.split('-')[1]}-400`}`} />
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 rounded-lg bg-white/20"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </div>
                  
                  {!collapsed && (
                    <>
                      <span className={`flex-1 transition-colors ${active ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {label}
                      </span>
                      {active && (
                        <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                      )}
                    </>
                  )}
                </div>

                {/* Hover tooltip for collapsed mode */}
                {collapsed && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-slate-800 rounded-md shadow-lg border border-white/10"
                  >
                    <span className="text-xs text-white whitespace-nowrap">{label}</span>
                  </motion.div>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative border-t border-white/10 px-3 py-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
            window.location.href = "/admin/login";
          }}
          className={`
            flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
            text-slate-400 transition-all hover:bg-red-500/15 hover:text-red-400
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </motion.button>
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATION DROPDOWN
// ============================================================================
function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  
  const notifications = [
    { id: 1, title: "New course request", message: "CS 301 needs approval", time: "5 min ago", type: "info" },
    { id: 2, title: "Attendance alert", message: "3 lecturers missed today", time: "1 hour ago", type: "warning" },
    { id: 3, title: "Timetable updated", message: "Changes pending review", time: "3 hours ago", type: "success" },
  ];

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          3
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-white/10 bg-slate-900 shadow-2xl backdrop-blur"
            >
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">Notifications</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map(notif => (
                  <div key={notif.id} className="border-b border-white/5 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2">
                      <div className={`
                        mt-0.5 h-2 w-2 rounded-full shrink-0
                        ${notif.type === 'info' ? 'bg-teal-500' : notif.type === 'warning' ? 'bg-orange-500' : 'bg-green-500'}
                      `} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{notif.title}</p>
                        <p className="text-xs text-slate-400">{notif.message}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{notif.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2">
                <button className="w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-teal-400 hover:bg-white/10 transition-colors">
                  View all notifications
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// USER PROFILE DROPDOWN
// ============================================================================
function UserProfileDropdown({ admin }: { admin: DepartmentAdminInfo | null }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-800"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 blur opacity-75" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600">
            <span className="text-xs font-bold text-white">
              {admin?.fullName?.[0]?.toUpperCase() || 'A'}
            </span>
          </div>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-white truncate max-w-32">{admin?.fullName}</p>
          <p className="text-[10px] text-slate-400">Department Admin</p>
        </div>
        <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-white/10 bg-slate-900 shadow-2xl"
            >
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-xs font-medium text-slate-400">Signed in as</p>
                <p className="text-sm font-semibold text-white">{admin?.fullName}</p>
                <p className="text-xs text-slate-400">{admin?.email}</p>
              </div>
              <div className="py-2">
                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5">
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================
export default function DepartmentAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<DepartmentAdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch admin data
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.role !== "department_admin") {
          router.push("/admin/login");
          return;
        }
        setAdmin({
          id: data.id,
          fullName: data.fullName ?? "Admin",
          email: data.email ?? "",
          role: data.role,
          institutionId: data.institutionId ?? "",
          institutionName: data.institution?.name ?? "Institution",
          departmentId: data.departmentId ?? "",
          departmentName: data.department?.name ?? data.departmentName ?? "Department",
        });
        setLoading(false);
      })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  // Get current page label
  const currentPage = NAV_ITEMS.find(n =>
    pathname === n.href || (n.href !== `${BASE}/dashboard` && pathname.startsWith(n.href))
  );
  const pageLabel = currentPage?.label ?? "Dashboard";
  const pageIcon = currentPage?.icon ?? LayoutDashboard;

  // Loading state with shimmer effect
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-teal-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <School className="h-6 w-6 text-teal-500" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-white">Loading Department Portal</p>
            <p className="text-xs text-slate-400">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DepartmentAdminContext.Provider value={admin}>
      <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <motion.aside 
          animate={{ width: sidebarCollapsed ? 80 : 224 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="hidden md:block shrink-0 overflow-hidden relative"
        >
          <SidebarContent admin={admin} pathname={pathname} collapsed={sidebarCollapsed} />
          
          {/* Collapse toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-slate-800 text-slate-400 transition-all hover:bg-slate-700 hover:text-white md:flex"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </motion.aside>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 z-50 h-full w-64"
              >
                <SidebarContent admin={admin} pathname={pathname} onClose={() => setDrawerOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          
          {/* Header */}
          <motion.header 
            animate={{ 
              backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.8)',
              borderBottomColor: scrolled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            }}
            className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-lg transition-all"
          >
            {/* Mobile menu button */}
            <button 
              onClick={() => setDrawerOpen(true)} 
              className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-200 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Page title with icon */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-lg bg-gradient-to-br from-teal-500/20 to-teal-600/10 p-1.5">
                {React.createElement(pageIcon, { className: "h-4 w-4 text-teal-400" })}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 hidden sm:inline">Department</span>
                <ChevronRight className="hidden sm:block h-3 w-3 text-slate-600" />
                <span className="font-semibold text-white truncate">{pageLabel}</span>
              </div>
            </div>

            {/* Search bar - hidden on mobile */}
            <div className="hidden md:flex flex-1 max-w-md ml-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search students, courses, or lecturers..."
                  className="w-full rounded-lg border border-white/10 bg-slate-800/50 py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <NotificationDropdown />
              <div className="hidden md:block h-5 w-px bg-white/10 mx-1" />
              <UserProfileDropdown admin={admin} />
            </div>
          </motion.header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            {/* Decorative gradient at top */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none" />
            
            {/* Page content with fade-in animation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="p-5 md:p-6"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </DepartmentAdminContext.Provider>
  );
}