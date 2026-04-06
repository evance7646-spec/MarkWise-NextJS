"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/sidebar";
import Header from "../../components/header";
import Footer from "../../components/footer";
import { Sparkles, LogOut } from "lucide-react";
import { FacilitiesManagerContext, FacilitiesManagerInfo } from "./context";

export default function RoomManagerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [admin, setAdmin] = useState<FacilitiesManagerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
    router.push("/admin/login");
  };

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.id) { router.push("/admin/login"); return; }
        setAdmin({
          id: data.id,
          fullName: data.fullName ?? "Admin",
          email: data.email ?? "",
          role: data.role ?? "facilities_manager",
          institutionId: data.institutionId ?? "",
          institutionName: data.institutionName ?? data.institution?.name ?? "Institution",
        });
        setLoading(false);
      })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <FacilitiesManagerContext.Provider value={admin}>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-h-screen ml-0 md:ml-64">
          <div className="bg-white dark:bg-slate-800 border-b-2 border-indigo-200 dark:border-indigo-800 shadow-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
            <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
          <main className="py-4 sm:py-6 flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              {children}
            </div>
          </main>
          <Footer />
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-20">
            <Link href="/admin/facilities-manager/optimizer" className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all border-2 border-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 shrink-0" />
                <span className="max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-500 whitespace-nowrap text-sm font-medium hidden sm:inline">
                  AI Optimizer
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </FacilitiesManagerContext.Provider>
  );
}

