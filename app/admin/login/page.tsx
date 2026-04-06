"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormField, AlertBanner } from "@/app/components/ui/form";

const ROLE_DASHBOARD: Record<string, string> = {
  super_admin:        "/admin/super-admin/dashboard",
  system_admin:       "/admin/system-admin/dashboard",
  academic_registrar: "/admin/academic-registrar/dashboard",
  facilities_manager: "/admin/facilities-manager/dashboard",
  department_admin:   "/admin/department-admin/dashboard",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin:        "Super Admin",
  system_admin:       "System Administrator",
  academic_registrar: "Academic Registrar",
  facilities_manager: "Facilities Manager",
  department_admin:   "Department Admin",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    setDetectedRole(null);

    try {
      const response = await fetch("/api/auth/admin/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        admin?: { id: string; fullName: string; email: string; role: string };
      };

      if (!response.ok || !payload.success || !payload.admin) {
        setError(payload.error ?? "Unable to sign in. Check your credentials.");
        return;
      }

      const role = payload.admin.role;
      const destination = ROLE_DASHBOARD[role] ?? "/admin";
      setDetectedRole(role);

      // Brief flash showing the detected role, then redirect
      setTimeout(() => router.push(destination), 800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">
            MarkWise
          </span>
        </div>

        <Card theme="dark" noPad className="p-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Portal</h1>
              <p className="text-sm text-slate-400 mt-1">
                Sign in to your role-based admin portal
              </p>
            </div>
          </div>

          {/* Success state */}
          {detectedRole && (
            <div className="mb-4">
              <AlertBanner intent="success">
                Signed in as <span className="font-bold">{ROLE_LABELS[detectedRole] ?? detectedRole}</span>. Redirecting…
              </AlertBanner>
            </div>
          )}

          <form className="space-y-5" onSubmit={onSubmit}>
            {/* Email */}
            <FormField>
              <Label htmlFor="admin-email" theme="dark">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                theme="dark"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@institution.edu"
              />
            </FormField>

            {/* Password */}
            <FormField>
              <Label htmlFor="admin-password" theme="dark">Password</Label>
              <Input
                id="admin-password"
                type="password"
                theme="dark"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            {/* Error */}
            {error && <AlertBanner intent="error">{error}</AlertBanner>}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={loading || !!detectedRole}
              className="mt-1"
            >
              Sign In to Admin Portal
            </Button>
          </form>

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href="/admin/forgot-password"
              className="text-sm text-slate-400 hover:text-violet-300 transition-colors"
            >
              Forgot your password?
            </Link>
            <p className="text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/admin/register"
                className="font-bold text-violet-300 hover:text-violet-200 hover:underline transition-colors"
              >
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-600/70 space-y-3">
            <p className="text-xs text-slate-500 text-center">
              Access is role-restricted. You&apos;ll be redirected to your portal after sign-in.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                { label: "Super Admin",        color: "text-amber-400  border-amber-500/30  bg-amber-500/10"  },
                { label: "System Admin",       color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10" },
                { label: "Academic Registrar", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
                { label: "Facilities Manager", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
                { label: "Department Admin",   color: "text-teal-400   border-teal-500/30   bg-teal-500/10"  },
              ].map(r => (
                <span key={r.label} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${r.color}`}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to MarkWise Home
          </Link>
        </div>
      </div>
    </main>
  );
}
