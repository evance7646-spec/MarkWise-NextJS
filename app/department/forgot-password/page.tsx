"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Replace with your API endpoint for password reset
      const response = await fetch("/api/auth/admin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setError("Failed to send reset instructions. Please try again.");
        return;
      }
      setSubmitted(true);
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
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 2c-2.21 0-4 1.79-4 4v1h8v-1c0-2.21-1.79-4-4-4z" /></svg>
        </div>
        <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-cyan-300 mb-1 tracking-tight">Forgot Password</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 text-center">Enter your email address and we'll send you instructions to reset your password.</p>
        {submitted ? (
          <div className="text-green-600 dark:text-green-300 font-semibold text-center">
            If an account exists for this email, reset instructions have been sent.
          </div>
        ) : (
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
            {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 font-bold text-white shadow-lg hover:from-indigo-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-200"
            >
              {loading ? "Sending..." : "Send Reset Instructions"}
            </button>
          </form>
        )}
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/department/login" className="font-bold text-indigo-700 dark:text-cyan-300 hover:underline">
            Back to Sign In
          </Link>
        </p>
      </section>
    </main>
  );
}
