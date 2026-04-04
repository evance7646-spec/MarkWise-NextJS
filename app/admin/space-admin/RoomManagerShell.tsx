"use client";

import React, { useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/sidebar";
import Header from "../../components/header";
import Footer from "../../components/footer";
import { Sparkles } from "lucide-react";

export default function RoomManagerShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
      {/* Sidebar (desktop + mobile drawer) */}
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen ml-0 md:ml-64">
        {/* Header with hamburger */}
        <Header onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        {/* Main Content */}
        <main className="py-4 sm:py-6 flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {children}
          </div>
        </main>
        {/* Footer */}
        <Footer />
        {/* Floating Action Button — quick link to Optimizer */}
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-20">
          <Link href="/admin/space-admin/optimizer" className="group relative">
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
  );
}
