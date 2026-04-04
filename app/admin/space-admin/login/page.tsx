
"use client";
import React, { useState } from "react";

export default function RoomManagerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/room-manager/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      setLoading(false);
      if (!res.ok) {
        setError(typeof data === "object" && data.error ? data.error : (typeof data === "string" ? data : "Authentication failed."));
        return;
      }
      // Store JWT token
      localStorage.setItem("roomManagerToken", data.token);
      // Redirect or show success
      window.location.href = "/admin/space-admin";
    } catch (err) {
      setLoading(false);
      setError("Authentication failed.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-cyan-50 dark:from-slate-900 dark:via-indigo-950 dark:to-cyan-950">
      <div className="w-full max-w-md rounded-2xl bg-white/90 p-8 shadow-xl border border-indigo-100 dark:bg-slate-900/90 dark:border-indigo-800">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center shadow-lg mb-2">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-indigo-700 dark:text-cyan-300 mb-1 tracking-tight">Room Manager Sign In</h1>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">Sign in to manage campus rooms and facilities</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200 mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-indigo-200 bg-white dark:bg-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200 mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-indigo-200 bg-white dark:bg-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm font-semibold">{error}</div>}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white py-2 rounded-lg font-bold shadow hover:from-indigo-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-300">
          Don't have an account? <a href="/admin/space-admin/register" className="text-indigo-600 dark:text-cyan-300 font-semibold hover:underline">Sign Up</a>
        </div>
      </div>
    </div>
  );
}
