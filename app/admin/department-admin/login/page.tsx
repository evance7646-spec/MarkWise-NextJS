"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Building2, ArrowLeft, LogIn } from "lucide-react";

export default function DepartmentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        admin?: { id: string; fullName: string; email: string; role: string; institutionId?: string; departmentId?: string; };
      };
      if (!response.ok || !payload.success || !payload.admin) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }
      router.push("/admin/department-admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors";
  const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 flex items-center justify-center px-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">MarkWise</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <div className="p-8">
            <div className="flex flex-col items-center gap-2 mb-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
                <Building2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-100">Department Sign In</h1>
              <p className="text-xs text-slate-500 text-center">
                Manage curriculum &amp; timetable operations
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {/* Email */}
              <div>
                <label className={lbl} htmlFor="dept-email">Email Address</label>
                <input
                  id="dept-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@department.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inp}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400" htmlFor="dept-password">Password</label>
                  <Link href="/admin/department-admin/forgot-password"
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="dept-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={inp + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
              >
                {loading ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/admin/department-admin/register"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to MarkWise Home
          </Link>
        </div>
      </div>
    </main>
  );
}
