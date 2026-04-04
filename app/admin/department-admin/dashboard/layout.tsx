"use client";
import type { ReactNode } from "react";
import Navbar from "./Navbar";
import LogoutButton from "./LogoutButton";
import { useState, useEffect } from "react";

export default function DepartmentLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [departmentName, setDepartmentName] = useState<string>("");
  const router = typeof window !== "undefined" ? require("next/navigation").useRouter() : null;
  useEffect(() => {
    async function fetchDepartmentName() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router && router.push('/admin/department-admin/login');
          return;
        }
        const admin = await res.json();
        if (admin.department && admin.department.name) {
          setDepartmentName(admin.department.name);
        } else {
          setDepartmentName('Department');
        }
      } catch {
        setDepartmentName('Department');
      }
    }
    fetchDepartmentName();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <main className="grid min-h-screen w-full border border-indigo-100 bg-white/90 shadow-lg backdrop-blur-sm dark:border-indigo-500/30 dark:bg-slate-950/80 md:grid-cols-[15%_85%] md:items-start">
        {/* Sidebar: hidden on mobile, visible on md+ */}
        <div className="hidden md:block sticky top-0 h-screen overflow-y-auto">
          <Navbar />
        </div>
        {/* Drawer: visible on mobile when open */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="relative z-50 w-64 max-w-full bg-white dark:bg-slate-950 h-full shadow-xl animate-slide-in-left overflow-hidden md:overflow-auto">
              <Navbar />
            </aside>
          </div>
        )}
        <section className="p-2 md:p-4">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-indigo-100 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 pb-4 rounded-b-2xl shadow-md dark:border-indigo-500/30 dark:bg-gradient-to-r dark:from-indigo-900 dark:via-sky-900 dark:to-emerald-900">
            <div className="flex items-center gap-3">
              {/* Hamburger menu: visible on mobile only */}
              <button
                className="md:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Open sidebar menu"
                onClick={() => setDrawerOpen(true)}
              >
                <svg className="h-6 w-6 text-white dark:text-indigo-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Logo/Icon */}
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-white/80 shadow-md ring-2 ring-indigo-400 dark:bg-slate-900">
                <svg className="h-8 w-8 text-indigo-700 dark:text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h1 className="bg-gradient-to-r from-white via-indigo-100 to-emerald-100 bg-clip-text text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent drop-shadow dark:from-indigo-200 dark:to-emerald-200">
                  {departmentName || "Department"}
                </h1>
                <p className="text-xs sm:text-sm font-medium text-white/90 dark:text-indigo-200 mt-1 tracking-wide italic">
                  Empowering Growth & Discovery
                </p>
              </div>
            </div>
            <LogoutButton />
          </header>
          <div className="pt-2">{children}</div>
        </section>
      </main>
      <style jsx global>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
