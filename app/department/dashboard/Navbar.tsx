"use client";


import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { label: "Overview", href: "/department/dashboard" },
  { label: "Curriculum", href: "/department/dashboard/curriculum" },
  { label: "Students", href: "/department/dashboard/students" },
  { label: "Lecturers", href: "/department/dashboard/lecturers" },
  { label: "Representatives", href: "/department/dashboard/representatives" },
  { label: "Timetable", href: "/department/dashboard/timetable" },
  { label: "Reports", href: "/department/dashboard/reports" },
  { label: "Analytics", href: "/department/dashboard/analytics" },
  { label: "Settings", href: "/department/dashboard/settings" },
];


import { useEffect, useState } from "react";

export default function DepartmentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [departmentName, setDepartmentName] = useState<string>("");

  useEffect(() => {
    // Fetch department name from backend
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch department info");
        const { department } = await res.json();
        if (department?.name) setDepartmentName(department.name);
      } catch {
        setDepartmentName("");
      }
    })();
  }, []);

  const handleLogout = () => {
    // Optionally, call a logout API endpoint to clear cookies/session
    router.push("/department/login");
  };

  return (
    <aside className="border-b border-indigo-100 bg-gradient-to-b from-indigo-50/80 to-cyan-50/50 p-4 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-cyan-500/5 md:sticky md:top-0 md:h-screen md:self-start md:overflow-y-auto md:border-r md:border-b-0">
      <h2 className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">MarkWise</h2>
      <nav className="mt-5 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block w-full rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-indigo-100 dark:text-slate-200 dark:hover:bg-indigo-500/20"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Removed Back Home and Logout button from sidebar */}
    </aside>
  );
}
