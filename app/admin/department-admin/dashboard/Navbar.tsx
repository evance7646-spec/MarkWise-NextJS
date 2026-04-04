"use client";


import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const menuItems = [
  { label: "Overview", href: "/admin/department-admin/dashboard" },
  { label: "Curriculum", href: "/admin/department-admin/dashboard/curriculum" },
  { label: "Students", href: "/admin/department-admin/dashboard/students" },
  { label: "Lecturers", href: "/admin/department-admin/dashboard/lecturers" },
  { label: "Representatives", href: "/admin/department-admin/dashboard/representatives" },
  { label: "Timetable", href: "/admin/department-admin/dashboard/timetable" },
  { label: "Reports", href: "/admin/department-admin/dashboard/reports" },
  { label: "Analytics", href: "/admin/department-admin/dashboard/analytics" },
  { label: "Settings", href: "/admin/department-admin/dashboard/settings" },
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
    router.push("/admin/department-admin/login");
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
