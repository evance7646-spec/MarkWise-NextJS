"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegistryAdminRoot() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/registry-admin/dashboard"); }, [router]);
  return null;
}
