"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DepartmentAdminRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/department-admin/dashboard"); }, [router]);
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}
