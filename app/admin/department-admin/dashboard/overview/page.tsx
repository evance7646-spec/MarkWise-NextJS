"use client";

import { useEffect, useState } from "react";

export default function DepartmentOverviewPage() {
  // Example advanced features: stats, quick links, recent activity, department health
  const [stats, setStats] = useState<any>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch department stats and recent activity from backend
    async function fetchOverview() {
      setIsLoading(true);
      // Replace with actual API endpoints
      const statsRes = await fetch("/api/department/stats", { method: "GET", cache: "no-store" });
      const activityRes = await fetch("/api/department/activity", { method: "GET", cache: "no-store" });
      const statsData = statsRes.ok ? await statsRes.json() : {};
      const activityData = activityRes.ok ? await activityRes.json() : [];
      setStats(statsData);
      setRecentActivity(activityData);
      setIsLoading(false);
    }
    fetchOverview();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-emerald-50 p-6 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-emerald-500/10">
        <h1 className="bg-gradient-to-r from-indigo-600 to-emerald-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-emerald-300">
          Department Overview
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          Quick summary, stats, and recent activity for your department.
        </p>
      </section>

      <article className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <h2 className="text-base font-semibold text-foreground mb-4">Department Stats</h2>
        {isLoading ? (
          <div>Loading stats...</div>
        ) : (
          <ul className="grid grid-cols-2 gap-4">
            <li>Total Students: {stats.totalStudents ?? "-"}</li>
            <li>Total Lecturers: {stats.totalLecturers ?? "-"}</li>
            <li>Total Units: {stats.totalUnits ?? "-"}</li>
            <li>Total Courses: {stats.totalCourses ?? "-"}</li>
          </ul>
        )}
      </article>

      <article className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <h2 className="text-base font-semibold text-foreground mb-4">Recent Activity</h2>
        {isLoading ? (
          <div>Loading activity...</div>
        ) : (
          <ul className="space-y-2">
            {recentActivity.length === 0 ? (
              <li>No recent activity.</li>
            ) : (
              recentActivity.map((item, idx) => (
                <li key={idx}>{item.description ?? "-"}</li>
              ))
            )}
          </ul>
        )}
      </article>
    </div>
  );
}
