"use client";
import type { ReactNode } from "react";

// The parent layout (app/admin/department-admin/layout.tsx) handles auth,
// sidebar, topbar, and AdminContext. This file is a passthrough only.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
