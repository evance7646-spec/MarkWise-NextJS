"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Menu } from "lucide-react";

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  return (
    <header className="bg-white dark:bg-slate-800 border-b-2 border-indigo-200 dark:border-indigo-800 shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Hamburger for mobile */}
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors md:hidden"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            </button>
          )}
          <div className="p-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg border-2 border-indigo-400 shadow-md relative group shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/" className="text-lg sm:text-xl font-bold text-indigo-800 dark:text-indigo-300 truncate">MarkWise</Link>
              <span className="hidden sm:inline-flex px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium border border-purple-300 dark:border-purple-700 items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI-Powered
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 hidden sm:block">Smart campus management • Real-time analytics</p>
          </div>
        </div>
      </div>
    </header>
  );
}
