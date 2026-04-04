"use client";

import { useEffect, useState } from "react";

type Lecturer = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  institutionId: string;
  createdAt: string;
};

export default function DepartmentLecturersPage() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLecturers = async () => {
      try {
        setIsLoading(true);
        setError("");

        // Fetch admin info to get departmentId
        const adminRes = await fetch("/api/auth/me", { method: "GET", credentials: "include" });
        if (!adminRes.ok) {
          setError("Failed to load admin info.");
          setIsLoading(false);
          return;
        }
        const adminData = await adminRes.json();
        const departmentId = adminData.departmentId;
        if (!departmentId) {
          setError("Missing department ID.");
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/lecturers?departmentId=${departmentId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          setError("Failed to load lecturers.");
          return;
        }

        const data = await response.json();
        // Handle both array and {lecturers: array} responses
        if (Array.isArray(data)) {
          setLecturers(data);
        } else if (Array.isArray(data.lecturers)) {
          setLecturers(data.lecturers);
        } else {
          setLecturers([]);
        }
      } catch {
        setError("Failed to load lecturers.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadLecturers();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-emerald-50 p-6 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-emerald-500/10">
        <h1 className="bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-emerald-300">
          Lecturers
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          List of lecturer accounts created from the React Native app.
        </p>
      </section>

      <article className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Teaching Staff</h2>
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
            {lecturers.length} total
          </span>
        </div>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          A lecturer appears here only after creating an account through the mobile app.
        </p>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-4 overflow-hidden rounded-lg border border-indigo-100 dark:border-indigo-500/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-indigo-50/70 dark:bg-indigo-500/10">
              <tr>
                <th className="px-4 py-2 font-medium">Lecturer Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    Loading lecturers...
                  </td>
                </tr>
              )}

              {!isLoading && lecturers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    No lecturers found yet.
                  </td>
                </tr>
              )}

              {!isLoading &&
                lecturers.map((lecturer) => (
                  <tr key={lecturer.id} className="border-t border-indigo-100 dark:border-indigo-500/30">
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{lecturer.fullName}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{lecturer.email}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{lecturer.phoneNumber}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
