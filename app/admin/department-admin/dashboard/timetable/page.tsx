"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Search, Plus, X, Loader2, Users, ChevronRight } from "lucide-react";
import { useDepartmentAdmin } from "../../context";

interface Entry {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  unitCode?: string;
  unitTitle?: string;
  venueName?: string;
  roomId?: string;
  roomName?: string;
  status: string;
  lecturerName?: string;
  lecturerId?: string;
  courseName?: string;
  courseId?: string;
  departmentId?: string;
  semester?: string;
  yearOfStudy?: string;
  unitId?: string;
  mergeGroupId?: string | null;
}

interface Course    { id: string; name: string; departmentId: string }
interface SemYear   { id: string; name: string; course: { id: string } }
interface SemRef    { id: string; label: string; yearId: string; year: SemYear }
interface Unit      { id: string; code: string; title: string; semesters?: SemRef[] }
interface Lecturer  { id: string; fullName: string }
interface Room      { id: string; name: string; roomCode: string; capacity: number; status?: string }

interface MergeEntry {
  id: string;
  departmentName: string;
  courseName: string;
  courseCode: string;
  unitCode: string;
  unitTitle: string;
  lecturerName: string;
  roomName: string;
  roomCode: string;
  roomCapacity: number | null;
  day: string;
  startTime: string;
  endTime: string;
  yearOfStudy?: string;
  semester?: string;
  status: string;
  studentCount: number;
}

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-emerald-500/15 text-emerald-600",
  Pending:   "bg-amber-500/15 text-amber-600",
  Cancelled: "bg-red-500/15 text-red-600",
};

const EMPTY_FORM = {
  courseId: "", yearId: "", semesterId: "", unitId: "",
  lecturerId: "", roomId: "", venueName: "",
  day: "Monday", startTime: "08:00", endTime: "10:00",
};

// ── Build startAt / endAt ISO timestamps for a day-name + HH:mm window ────
// The rooms API derives day-of-week and time from UTC values, so we construct
// a UTC date falling on the correct day of week in the near future.
function buildWindowTimestamps(dayName: string, startTime: string, endTime: string) {
  const DAY_IDX: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const target = DAY_IDX[dayName] ?? 1;
  const now = new Date();
  const todayUTC = now.getUTCDay();
  let daysAhead = (target - todayUTC + 7) % 7;
  if (daysAhead === 0) daysAhead = 7; // always a future date
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const base = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead,
  ));
  const startAt = new Date(base); startAt.setUTCHours(sh, sm, 0, 0);
  const endAt   = new Date(base); endAt.setUTCHours(eh, em, 0, 0);
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

export default function DeptTimetablePage() {
  const admin = useDepartmentAdmin();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState("Monday");
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal]           = useState(false);
  const [form, setForm]                     = useState({ ...EMPTY_FORM });
  const [courses, setCourses]               = useState<Course[]>([]);
  const [units, setUnits]                   = useState<Unit[]>([]);
  const [lecturers, setLecturers]           = useState<Lecturer[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [modalLoading, setModalLoading]     = useState(false);
  const [roomsLoading, setRoomsLoading]     = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState<string | null>(null);
  const [mergeConflict, setMergeConflict]   = useState<{ conflictId: string; message: string } | null>(null);

  // Joint-class detail drawer
  const [drawerGroupId, setDrawerGroupId]     = useState<string | null>(null);
  const [drawerEntries, setDrawerEntries]     = useState<MergeEntry[]>([]);
  const [drawerTotal, setDrawerTotal]         = useState<number>(0);
  const [drawerLoading, setDrawerLoading]     = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!admin?.departmentId) return;
    setLoading(true);
    const data = await fetch(`/api/timetable?departmentId=${admin.departmentId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : []) as any;
    setEntries(Array.isArray(data) ? data : data.entries ?? data.data ?? []);
    setLoading(false);
  }, [admin?.departmentId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const todayName = DAYS[new Date().getDay() - 1] ?? "Monday";
  useEffect(() => { setActiveDay(todayName); }, [todayName]);

  const openMergeDrawer = useCallback(async (groupId: string) => {
    setDrawerGroupId(groupId);
    setDrawerLoading(true);
    setDrawerEntries([]);
    try {
      const res = await fetch(`/api/timetable/merge-group/${groupId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setDrawerEntries(data.entries ?? []);
      setDrawerTotal(data.totalStudents ?? 0);
    } catch (err) {
      console.error("[drawer] fetchMergeGroup error:", err);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerGroupId(null);
    setDrawerEntries([]);
  }, []);

  // ── Open modal ─────────────────────────────────────────────────────
  // Open modal — load courses, units (with semester hierarchy), lecturers.
  // Rooms are intentionally NOT loaded here — they load dynamically after time is chosen.
  const openModal = useCallback(async () => {
    if (!admin?.departmentId) return;
    setForm({ ...EMPTY_FORM });
    setSubmitError(null);
    setMergeConflict(null);
    setAvailableRooms([]);
    setShowModal(true);
    setModalLoading(true);
    try {
      const [c, u, l] = await Promise.all([
        fetch(`/api/courses?departmentId=${admin.departmentId}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch(`/api/units?departmentId=${admin.departmentId}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch(`/api/lecturers?departmentId=${admin.departmentId}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setCourses(Array.isArray(c) ? c : ((c as any).courses ?? (c as any).data ?? []));
      setUnits(Array.isArray(u) ? u : ((u as any).units ?? (u as any).data ?? []));
      setLecturers(Array.isArray(l) ? l : ((l as any).lecturers ?? (l as any).data ?? []));
    } catch (err) {
      console.error("[timetable] openModal fetch error:", err);
    } finally {
      setModalLoading(false);
    }
  }, [admin?.departmentId]);

  // Fetch only rooms that are FREE for the chosen day + time slot.
  const fetchAvailableRooms = useCallback(async (day: string, startTime: string, endTime: string) => {
    if (!admin?.institutionId || !day || !startTime || !endTime) return;
    if (startTime >= endTime) return;
    setRoomsLoading(true);
    setAvailableRooms([]);
    try {
      const { startAt, endAt } = buildWindowTimestamps(day, startTime, endTime);
      const url = `/api/rooms?institutionId=${admin.institutionId}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      const raw: any[] = Array.isArray(payload) ? payload : (payload?.data?.rooms ?? payload?.rooms ?? []);
      // Only show rooms that are free for this window
      const free = raw.filter(r => !r.status || r.status === "free" || r.status === "available");
      setAvailableRooms(free.map(r => ({
        id: r.id,
        name: r.name,
        roomCode: r.roomCode ?? r.room_code ?? "",
        capacity: r.capacity ?? 0,
        status: r.status,
      })));
    } catch (err) {
      console.error("[timetable] fetchAvailableRooms error:", err);
    } finally {
      setRoomsLoading(false);
    }
  }, [admin?.institutionId]);

  const handleChange = useCallback((field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };

      // Cascade resets for scope fields
      if (field === "courseId") { next.yearId = ""; next.semesterId = ""; next.unitId = ""; }
      else if (field === "yearId")     { next.semesterId = ""; next.unitId = ""; }
      else if (field === "semesterId") { next.unitId = ""; }

      // Reset room when time/day changes
      if (field === "day" || field === "startTime" || field === "endTime") {
        next.roomId = "";
        next.venueName = "";
      }

      // Auto-fill venueName when room is selected
      if (field === "roomId" && value) {
        const room = availableRooms.find(r => r.id === value);
        if (room) next.venueName = `${room.roomCode} – ${room.name}`;
      }

      return next;
    });
  }, [availableRooms]);

  // Trigger room fetch whenever day or time changes (and all three are set)
  useEffect(() => {
    if (showModal && form.day && form.startTime && form.endTime && form.startTime < form.endTime) {
      fetchAvailableRooms(form.day, form.startTime, form.endTime);
    }
  }, [showModal, form.day, form.startTime, form.endTime, fetchAvailableRooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || !form.yearId || !form.semesterId || !form.unitId ||
        !form.lecturerId || !form.roomId) {
      setSubmitError("Please fill in all required fields."); return;
    }
    if (form.startTime >= form.endTime) {
      setSubmitError("End time must be after start time."); return;
    }
    setSubmitting(true); setSubmitError(null);
    try {
      const unit   = units.find(u => u.id === form.unitId);
      const semObj = unit?.semesters?.find(s => s.id === form.semesterId);
      const yearOfStudy = semObj?.year?.name ?? "";
      const semester    = semObj?.label ?? "";
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId:    form.courseId,
          departmentId: admin!.departmentId,
          unitId:      form.unitId,
          lecturerId:  form.lecturerId,
          roomId:      form.roomId,
          day:         form.day,
          startTime:   form.startTime,
          endTime:     form.endTime,
          venueName:   form.venueName,
          semester:    semester || null,
          yearOfStudy: yearOfStudy || null,
          unitCode:    unit?.code ?? "",
        }),
      });
      if (res.status === 409) {
        const d = await res.json();
        if (d.mergePrompt && d.conflictId) {
          setMergeConflict({
            conflictId: d.conflictId,
            message: d.message ?? "This unit is already scheduled at this time by another department.",
          });
          return;
        }
        setSubmitError(d.message ?? d.error ?? "Time slot conflict — please review.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.error ?? `Error ${res.status}`);
        return;
      }
      setShowModal(false);
      fetchEntries();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed to create entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeConflict || !admin) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const unit   = units.find(u => u.id === form.unitId);
      const semObj = unit?.semesters?.find(s => s.id === form.semesterId);
      const yearOfStudy = semObj?.year?.name ?? "";
      const semester    = semObj?.label ?? "";
      const res = await fetch(`/api/timetable/${mergeConflict.conflictId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departmentId: admin.departmentId,
          courseId:     form.courseId,
          lecturerId:   form.lecturerId || undefined,
          yearOfStudy:  yearOfStudy || undefined,
          semester:     semester || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.error ?? `Merge failed (${res.status})`);
        setMergeConflict(null);
        return;
      }
      setMergeConflict(null);
      setShowModal(false);
      fetchEntries();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Merge failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived lists ──────────────────────────────────────────────────────────

  const yearsForCourse = useMemo(() => {
    if (!form.courseId) return [];
    const map = new Map<string, { id: string; name: string }>();
    units.forEach(u => u.semesters?.forEach(s => {
      if (s.year?.course?.id === form.courseId && !map.has(s.year.id))
        map.set(s.year.id, { id: s.year.id, name: s.year.name });
    }));
    return Array.from(map.values());
  }, [units, form.courseId]);

  const semestersForYear = useMemo(() => {
    if (!form.yearId) return [];
    const map = new Map<string, { id: string; label: string }>();
    units.forEach(u => u.semesters?.forEach(s => {
      if (s.yearId === form.yearId && !map.has(s.id))
        map.set(s.id, { id: s.id, label: s.label });
    }));
    return Array.from(map.values());
  }, [units, form.yearId]);

  const filteredUnits = useMemo(() =>
    form.semesterId
      ? units.filter(u => u.semesters?.some(s => s.id === form.semesterId))
      : [],
    [units, form.semesterId]);

  const shown = entries
    .filter(e => e.day === activeDay)
    .filter(e => !search ||
      (e.unitCode  ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.lecturerName ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const timeSlotReady = form.day && form.startTime && form.endTime && form.startTime < form.endTime;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Timetable</h1>
          <p className="text-sm text-gray-400 mt-0.5">{admin?.departmentName}</p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search unit or lecturer…"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DAYS.map(d => (
          <button
            key={d}
            onClick={() => setActiveDay(d)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeDay === d
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {d.slice(0, 3)}{" "}
            <span className="text-[10px] opacity-70 ml-1">
              {entries.filter(e => e.day === d).length}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-200 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <span>Time</span><span>Unit</span><span>Lecturer</span><span>Status</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <Calendar className="h-8 w-8 text-slate-400" />
            <p className="text-sm text-gray-500">No sessions for {activeDay}</p>
          </div>
        ) : (
          shown.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center px-4 py-3.5 border-b border-gray-100 last:border-b-0"
            >
              <div className="text-xs font-mono text-gray-500 whitespace-nowrap">
                {e.startTime}–{e.endTime}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{e.unitCode ?? "—"}</div>
                <div className="text-xs text-gray-400">{e.unitTitle ?? e.courseName ?? ""}</div>
              </div>
              <div className="text-sm text-gray-500 truncate hidden sm:block">
                {e.lecturerName ?? "—"}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                {e.mergeGroupId && (
                  <button
                    onClick={() => openMergeDrawer(e.mergeGroupId!)}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-violet-500/15 text-violet-600 hover:bg-violet-500/25 transition-colors"
                  >
                    <Users className="h-3 w-3" />
                    Joint
                    <ChevronRight className="h-3 w-3 opacity-60" />
                  </button>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? "bg-slate-100 text-gray-500"}`}>
                  {e.status}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── Joint Class Detail Drawer ────────────────────────────────────── */}
      <AnimatePresence>
        {drawerGroupId && (
          <>
            {/* backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 z-40 bg-black/40"
            />
            {/* panel */}
            <motion.div
              key="drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col"
            >
              {/* header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-violet-600" />
                  <span className="font-semibold text-gray-800 text-sm">Joint Class</span>
                  {!drawerLoading && (
                    <span className="rounded-full bg-violet-100 text-violet-700 text-xs font-medium px-2 py-0.5">
                      {drawerEntries.length} dept{drawerEntries.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button onClick={closeDrawer} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {drawerLoading ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                  {/* summary bar */}
                  <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-violet-500 font-medium uppercase tracking-wider">Combined students</p>
                      <p className="text-2xl font-bold text-violet-700 mt-0.5">{drawerTotal}</p>
                    </div>
                    {drawerEntries[0] && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{drawerEntries[0].unitCode}</p>
                        <p className="text-xs text-gray-400">{drawerEntries[0].day} {drawerEntries[0].startTime}–{drawerEntries[0].endTime}</p>
                        <p className="text-xs text-gray-400">{drawerEntries[0].roomName}</p>
                      </div>
                    )}
                  </div>

                  {/* per-department cards */}
                  {drawerEntries.map((me, idx) => (
                    <div key={me.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{me.departmentName}</p>
                          <p className="text-xs text-gray-500">{me.courseName}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[me.status] ?? "bg-slate-100 text-gray-500"
                        }`}>{me.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="text-gray-400">Lecturer</span>
                        <span className="font-medium text-gray-700">{me.lecturerName || "—"}</span>
                        <span className="text-gray-400">Room</span>
                        <span className="font-medium text-gray-700">{me.roomName || "—"}</span>
                        <span className="text-gray-400">Year / Sem</span>
                        <span className="font-medium text-gray-700">{me.yearOfStudy ?? "—"} · {me.semester ?? "—"}</span>
                        <span className="text-gray-400">Students</span>
                        <span className="font-semibold text-violet-700">{me.studentCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── New Entry Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-gray-900 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">New Timetable Entry</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select scope → unit → lecturer → time → available room
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* ── Step 1: Scope ──────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-3">
                    1 · Scope
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                    {/* Course */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Course <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.courseId}
                        onChange={e => handleChange("courseId", e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      >
                        <option value="">Select course…</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Year of Study */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Year <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.yearId}
                        onChange={e => handleChange("yearId", e.target.value)}
                        disabled={!form.courseId || yearsForCourse.length === 0}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {!form.courseId
                            ? "Select course first"
                            : yearsForCourse.length === 0
                              ? "No years found"
                              : "Select year…"}
                        </option>
                        {yearsForCourse.map(y => (
                          <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Semester */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Semester <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.semesterId}
                        onChange={e => handleChange("semesterId", e.target.value)}
                        disabled={!form.yearId || semestersForYear.length === 0}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {!form.yearId
                            ? "Select year first"
                            : semestersForYear.length === 0
                              ? "No semesters found"
                              : "Select semester…"}
                        </option>
                        {semestersForYear.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Step 2: Unit ───────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-3">
                    2 · Unit
                  </p>
                  <select
                    required
                    value={form.unitId}
                    onChange={e => handleChange("unitId", e.target.value)}
                    disabled={!form.semesterId || filteredUnits.length === 0}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!form.semesterId
                        ? "Complete scope first"
                        : filteredUnits.length === 0
                          ? "No units in this semester"
                          : "Select unit…"}
                    </option>
                    {filteredUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.code} – {u.title}</option>
                    ))}
                  </select>
                </div>

                {/* ── Step 3: Lecturer ───────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-3">
                    3 · Lecturer
                  </p>
                  <select
                    required
                    value={form.lecturerId}
                    onChange={e => handleChange("lecturerId", e.target.value)}
                    disabled={!form.unitId}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!form.unitId ? "Select unit first" : "Select lecturer…"}
                    </option>
                    {lecturers.map(l => (
                      <option key={l.id} value={l.id}>{l.fullName}</option>
                    ))}
                  </select>
                </div>

                {/* ── Step 4: Time Slot ──────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-3">
                    4 · Time Slot
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                    {/* Day */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Day <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={form.day}
                        onChange={e => handleChange("day", e.target.value)}
                        disabled={!form.lecturerId}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {DAYS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Start Time */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        Start Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="time"
                        value={form.startTime}
                        onChange={e => handleChange("startTime", e.target.value)}
                        disabled={!form.lecturerId}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">
                        End Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        type="time"
                        value={form.endTime}
                        onChange={e => handleChange("endTime", e.target.value)}
                        disabled={!form.lecturerId}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  {form.startTime && form.endTime && form.startTime >= form.endTime && (
                    <p className="mt-1.5 text-xs text-red-600">End time must be after start time.</p>
                  )}
                </div>

                {/* ── Step 5: Room ───────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                      5 · Venue / Room
                    </p>
                    {roomsLoading && (
                      <span className="flex items-center gap-1.5 text-xs text-teal-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Checking availability…
                      </span>
                    )}
                    {!roomsLoading && timeSlotReady && availableRooms.length > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">
                        {availableRooms.length} room{availableRooms.length !== 1 ? "s" : ""} free
                      </span>
                    )}
                  </div>

                  <select
                    required
                    value={form.roomId}
                    onChange={e => handleChange("roomId", e.target.value)}
                    disabled={!timeSlotReady || roomsLoading || availableRooms.length === 0}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!timeSlotReady
                        ? "Select day and time first"
                        : roomsLoading
                          ? "Checking availability…"
                          : availableRooms.length === 0
                            ? "No rooms free for this time slot"
                            : "Select room…"}
                    </option>
                    {availableRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.roomCode} – {r.name} (capacity: {r.capacity})
                      </option>
                    ))}
                  </select>

                  {!roomsLoading && timeSlotReady && availableRooms.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      All rooms are booked for this time slot. Try a different time or day.
                    </p>
                  )}
                  {form.roomId && !roomsLoading && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      Venue: {form.venueName}
                    </p>
                  )}
                </div>

                {mergeConflict && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Joint Class Opportunity</p>
                        <p className="text-xs text-amber-700 mt-0.5">{mergeConflict.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Your department's students will share this session with the existing group.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMergeConflict(null)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleMerge}
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {submitting ? "Joining…" : "Join as Joint Class"}
                      </button>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !form.roomId}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? "Creating…" : "Create Entry"}
                  </button>
                </div>

              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
