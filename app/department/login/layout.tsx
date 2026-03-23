"use client";
import React, { ReactNode } from "react";

export default function DepartmentLoginLayout({ children }: { children: ReactNode }) {
  const router = typeof window !== "undefined" ? require("next/navigation").useRouter() : null;
  React.useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("adminLoggedIn")) {
      router && router.push("/department/dashboard");
    }
  }, [router]);
  return <>{children}</>;
}
