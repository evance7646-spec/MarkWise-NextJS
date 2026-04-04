"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormField, AlertBanner } from "@/app/components/ui/form";

export default function InstitutionLoginPage() {
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
        admin?: { id: string; fullName: string; email: string; role: string };
      };

      if (!response.ok || !payload.success || !payload.admin) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }

      router.push("/admin/institution-admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-indigo-950 dark:to-cyan-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">
            MarkWise
          </span>
        </div>

        <Card theme="light" noPad className="p-8 border-2 border-indigo-100 dark:border-indigo-500/30">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-cyan-300 tracking-tight">
                Institution Sign In
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                Sign in to access institution-level administration.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <FormField>
              <Label htmlFor="inst-email" theme="light">Email</Label>
              <Input
                id="inst-email"
                type="email"
                theme="light"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@institution.edu"
              />
            </FormField>

            <FormField>
              <Label htmlFor="inst-password" theme="light">Password</Label>
              <Input
                id="inst-password"
                type="password"
                theme="light"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            {error && <AlertBanner intent="error">{error}</AlertBanner>}

            <Button
              type="submit"
              variant="accent"
              size="lg"
              fullWidth
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-slate-500 dark:text-slate-300">
            Don&apos;t have an account?{" "}
            <Link
              href="/admin/institution-admin/register"
              className="font-bold text-indigo-600 dark:text-cyan-300 hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </Card>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
          >
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
