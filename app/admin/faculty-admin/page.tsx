"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FacultyAdminRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/faculty-admin/dashboard"); }, [router]);
  return null;
}
