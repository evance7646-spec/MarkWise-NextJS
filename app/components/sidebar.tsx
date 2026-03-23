"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calendar, BarChart3, Zap, CalendarClock, X } from "lucide-react";

const defaultNavItems = [
  { name: "Rooms",        href: "/room-manager",              icon: Building2 },
  { name: "Bookings",     href: "/room-manager/bookings",     icon: Calendar  },
  { name: "Reservations", href: "/room-manager/reservations", icon: CalendarClock },
  { name: "Analytics",    href: "/room-manager/analytics",    icon: BarChart3 },
  { name: "Optimizer",    href: "/room-manager/optimizer",    icon: Zap, highlight: true },
];

function NavLinks({ navItems, pathname, onNavigate }: { navItems: typeof defaultNavItems; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-2 py-8 px-4">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/room-manager" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all mb-1 ${
              item.highlight
                ? "bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/20 text-purple-700 dark:text-purple-300 border-l-4 border-purple-500"
                : isActive
                ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-l-4 border-indigo-500"
                : "text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            }`}
          >
            <item.icon
              className={`w-5 h-5 flex-shrink-0 ${
                item.highlight ? "text-purple-500" : isActive ? "text-indigo-600 dark:text-indigo-400" : ""
              }`}
            />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({
  navItems = defaultNavItems,
  mobileOpen = false,
  onMobileClose,
}: {
  navItems?: typeof defaultNavItems;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    onMobileClose?.();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white dark:bg-slate-800 border-r-2 border-indigo-200 dark:border-indigo-800 shadow-lg fixed top-0 left-0 z-40">
        <NavLinks navItems={navItems} pathname={pathname} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-dvh w-72 max-w-[85vw] bg-white dark:bg-slate-800 border-r-2 border-indigo-200 dark:border-indigo-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">MarkWise</span>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <NavLinks navItems={navItems} pathname={pathname} onNavigate={onMobileClose} />
      </aside>
    </>
  );
}
