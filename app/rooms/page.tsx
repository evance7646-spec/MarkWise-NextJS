"use client";

import { useEffect, useMemo, useState } from "react";

type RoomStatus = "free" | "reserved" | "occupied" | "unavailable";

type RoomRecord = {
  id: string;
  institutionId: string;
  buildingCode: string;
  roomCode: string;
  name: string;
  capacity: number;
  type: string;
  floor: number;
  status: RoomStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Optionally include booking info for countdown
  bookingEndTime?: string; // ISO string
};

const statusMeta: Record<RoomStatus, { label: string; dot: string; badge: string }> = {
  free: {
    label: "Free",
    dot: "🟢",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  reserved: {
    label: "Reserved",
    dot: "🟡",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  },
  occupied: {
    label: "Occupied",
    dot: "🔴",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  },
  unavailable: {
    label: "Unavailable",
    dot: "⚫",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200",
  },
};


function getCountdown(endTime: string) {
  const now = new Date();
  const end = new Date(endTime);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0) return `Free in ${hours}h ${mins}m`;
  return `Free in ${mins}m`;
}

export default function PublicRoomsPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setTick] = useState(0); // for countdown refresh

  // Refresh countdown every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchRooms() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch("/api/rooms", { method: "GET" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message || "Failed to load rooms.");
        // Try to extract bookingEndTime if present in API response
        setRooms(payload.data?.rooms || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRooms();
  }, []);

  const buildingCodes = useMemo(() => {
    return [...new Set(rooms.map((room) => room.buildingCode))].sort();
  }, [rooms]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-indigo-950 dark:to-cyan-950 p-8">
      <section className="w-full max-w-4xl mx-auto rounded-2xl border-2 border-indigo-100 bg-white/90 shadow-xl p-8 flex flex-col gap-4 dark:border-indigo-500/30 dark:bg-slate-950/80">
        <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-cyan-300 mb-2 tracking-tight">Institution Rooms Directory</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 mb-4">Browse all rooms and their current statuses. This page is read-only and available to everyone.</p>
        {isLoading ? (
          <div className="text-zinc-500 dark:text-zinc-400">Loading rooms...</div>
        ) : error ? (
          <div className="text-red-600 font-semibold">{error}</div>
        ) : rooms.length === 0 ? (
          <div className="text-zinc-500 dark:text-zinc-400">No rooms found.</div>
        ) : (
          buildingCodes.map((buildingCode) => (
            <section key={buildingCode} className="mb-6">
              <h2 className="text-lg font-bold text-indigo-700 dark:text-cyan-200 mb-2">Building: {buildingCode}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.filter((room) => room.buildingCode === buildingCode).map((room) => {
                  // Show countdown if reserved/occupied and bookingEndTime is present
                  let countdown = null;
                  if ((room.status === "reserved" || room.status === "occupied") && room.bookingEndTime) {
                    countdown = getCountdown(room.bookingEndTime);
                  }
                  return (
                    <div key={room.id} className="rounded-xl border border-indigo-100 bg-white/95 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80 p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-700 dark:text-cyan-200">{room.roomCode}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusMeta[room.status].badge}`}>{statusMeta[room.status].label}</span>
                      </div>
                      <div className="text-sm text-zinc-700 dark:text-zinc-300">{room.name}</div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Type: {room.type}</span>
                        <span>•</span>
                        <span>Capacity: {room.capacity}</span>
                        <span>•</span>
                        <span>Floor: {room.floor}</span>
                      </div>
                      {countdown && (
                        <div className="text-xs text-blue-600 dark:text-blue-300 font-semibold mt-1">{countdown}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </section>
    </main>
  );
}
