"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Building2, CalendarCheck, Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import { useSpaceAdmin } from "../../context";

interface Analytics {
  todayBookings: number;
  thisWeekBookings: number;
  totalBookings: number;
  cancellationRate: number;
  avgDurationMinutes: number;
  activeHolds: number;
  roomsSummary: { free: number; reserved: number; occupied: number; unavailable: number; total: number };
  bookingsByDay: { date: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  topRooms: { roomId: string; roomCode: string; buildingCode: string; name: string; count: number; totalMinutes: number }[];
  utilizationByType?: { type: string; utilization: number }[];
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-28 shrink-0 truncate text-xs text-slate-400 text-right">{label}</span>
      <div className="flex-1 h-5 rounded-lg bg-slate-800 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-lg ${color}`} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right shrink-0">{value}</span>
    </div>
  );
}

function SparkBars({ data, color }: { data: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map(d => {
        const h = Math.max(4, Math.round((d.count / max) * 72));
        return (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-0.5"
            title={`${d.label}: ${d.count}`}>
            <div className={`w-full rounded-t ${color} opacity-70 hover:opacity-100 transition-opacity`} style={{ height: `${h}px` }} />
            <span className="text-slate-700" style={{ fontSize: "9px" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const admin = useSpaceAdmin();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!admin?.institutionId) return;
    setLoading(true);
    const d = await fetch(`/api/bookings/analytics?institutionId=${admin.institutionId}`, { credentials: "include" }).then(r => r.ok ? r.json() : {}) as any;
    setAnalytics(d ?? null);
    setLoading(false);
  }, [admin?.institutionId]);

  useEffect(() => { load(); }, [load]);

  const a = analytics;

  const summaryCards = [
    { label: "Total Bookings",      value: a?.totalBookings ?? 0,     icon: CalendarCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Today",               value: a?.todayBookings ?? 0,     icon: TrendingUp,    color: "text-sky-400",     bg: "bg-sky-500/10" },
    { label: "This Week",           value: a?.thisWeekBookings ?? 0,  icon: Building2,     color: "text-violet-400",  bg: "bg-violet-500/10" },
    { label: "Avg Duration (min)",  value: a?.avgDurationMinutes ?? 0, icon: Clock,        color: "text-amber-400",   bg: "bg-amber-500/10" },
    { label: "Cancellation Rate",   value: a ? `${a.cancellationRate}%` : "—", icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10" },
    { label: "Active Holds",        value: a?.activeHolds ?? 0,       icon: Clock,         color: "text-orange-400",  bg: "bg-orange-500/10" },
  ];

  // Last 14 booking days
  const dayData = (a?.bookingsByDay ?? []).slice(-14).map(d => ({
    label: new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    count: d.count,
  }));

  // Peak hours (08:00–20:00 window)
  const hourData = (a?.peakHours ?? []).filter(h => h.hour >= 7 && h.hour <= 21).map(h => ({
    label: `${h.hour}:00`,
    count: h.count,
  }));

  const maxTopRoom = Math.max(...(a?.topRooms ?? []).map(r => r.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-violet-400" /> Analytics
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Booking and room utilisation overview — last 30 days</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {summaryCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-100">
              {loading ? <span className="inline-block h-6 w-12 rounded bg-slate-800 animate-pulse" /> : s.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Room status donut-style breakdown */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Current Room Status</h2>
          {loading ? <div className="h-28 rounded bg-slate-800 animate-pulse" /> : a?.roomsSummary ? (
            <div className="space-y-2">
              {(["free","reserved","occupied","unavailable"] as const).map(s => {
                const v = a.roomsSummary[s]; const pct = a.roomsSummary.total > 0 ? Math.round((v / a.roomsSummary.total) * 100) : 0;
                const colors: Record<string, string> = { free: "bg-emerald-500", reserved: "bg-amber-500", occupied: "bg-sky-500", unavailable: "bg-rose-500" };
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-slate-400 capitalize text-right">{s}</span>
                    <div className="flex-1 h-4 rounded-full bg-slate-800 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                        className={`h-full rounded-full ${colors[s]}`} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{v} ({pct}%)</span>
                  </div>
                );
              })}
              <div className="text-xs text-slate-600 pt-1 text-right">Total: {a.roomsSummary.total} rooms</div>
            </div>
          ) : <p className="text-slate-600 text-sm">No data</p>}
        </div>

        {/* Bookings last 14 days spark */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Bookings — Last 14 days</h2>
          {loading ? <div className="h-20 rounded bg-slate-800 animate-pulse" /> :
            dayData.length > 0 ? <SparkBars data={dayData} color="bg-emerald-500" /> :
              <p className="text-slate-600 text-sm">No data</p>
          }
        </div>
      </div>

      {/* Peak hours + Top rooms */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Peak Booking Hours</h2>
          {loading ? <div className="h-20 rounded bg-slate-800 animate-pulse" /> :
            hourData.length > 0 ? <SparkBars data={hourData} color="bg-violet-500" /> :
              <p className="text-slate-600 text-sm">No data</p>
          }
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Top Rooms by Bookings</h2>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-6 rounded bg-slate-800 animate-pulse" />)}</div>
          ) : (a?.topRooms ?? []).length === 0 ? (
            <p className="text-slate-600 text-sm">No booking data</p>
          ) : (a?.topRooms ?? []).slice(0, 8).map(r => (
            <HBar key={r.roomId} label={`${r.buildingCode}/${r.roomCode}`} value={r.count} max={maxTopRoom} color="bg-orange-500/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
