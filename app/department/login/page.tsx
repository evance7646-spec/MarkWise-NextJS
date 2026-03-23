"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function DepartmentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        admin?: {
          id: string;
          fullName: string;
          email: string;
          role: string;
          institutionId?: string;
          departmentId?: string;
        };
      };


      if (!response.ok || !payload.success || !payload.admin) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }

      const admin = payload.admin;

      // No localStorage: just redirect to dashboard
      router.push("/department/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-indigo-950 dark:to-cyan-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border-2 border-indigo-100 bg-white/90 shadow-xl p-8 flex flex-col items-center gap-4 dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg mb-2">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-cyan-300 mb-1 tracking-tight">Department Sign In</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 text-center">Sign in to manage curriculum timetable operations.</p>
        <form className="mt-6 w-full space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
            />
            <div className="mt-2 text-right">
              <Link href="/department/forgot-password" className="text-xs text-indigo-600 dark:text-cyan-300 hover:underline font-semibold">
                Forgot Password?
              </Link>
            </div>
          </label>
          {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 font-bold text-white shadow-lg hover:from-indigo-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-200"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
          Don't have an account?{" "}
          <Link href="/department/register" className="font-bold text-indigo-700 dark:text-cyan-300 hover:underline">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
