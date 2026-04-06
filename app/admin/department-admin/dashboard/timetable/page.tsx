"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, Search, Plus, X } from "lucide-react";
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
}

interface Course    { id: string; name: string; departmentId: string }
interface SemYear   { id: string; name: string; course: { id: string } }
interface SemRef    { id: string; label: string; yearId: string; year: SemYear }
interface Unit      { id: string; code: string; title: string; semesters?: SemRef[] }
interface Lecturer  { id: string; fullName: string }
interface Room      { id: string; name: string; roomCode: string; capacity: number }

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-emerald-500/15 text-emerald-600",
  Pending:   "bg-amber-500/15 text-amber-600",
  Cancelled: "bg-red-500/15 text-red-600",
};

const EMPTY_FORM = {
  courseId: "", yearId: "", semesterId: "", unitId: "", lecturerId: "", roomId: "",
  day: "Monday", startTime: "08:00", endTime: "10:00", venueName: "",
};

export default function DeptTimetablePage() {
  const admin = useDepartmentAdmin();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState("Monday");
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const openModal = useCallback(async () => {
    if (!admin?.departmentId || !admin.institutionId) return;
    setForm({ ...EMPTY_FORM });
    setSubmitError(null);
    setShowModal(true);
    setModalLoading(true);
    try {
      const [c, u, l, r] = await Promise.all([
        fetch(`/api/courses?departmentId=${admin.departmentId}`, { credentials: "include" }).then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch(`/api/units?departmentId=${admin.departmentId}`, { credentials: "include" }).then(res => res.ok ? res.json() : {}).catch(() => ({})),
        fetch(`/api/lecturers?departmentId=${admin.departmentId}`, { credentials: "include" }).then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`/api/rooms?institutionId=${admin.institutionId}`, { credentials: "include" }).then(res => res.ok ? res.json() : {}).catch(() => ({})),
      ]);
      setCourses(Array.isArray(c) ? c : (c.courses ?? c.data ?? []));
      setUnits(Array.isArray(u) ? u : (u.units ?? u.data ?? []));
      setLecturers(Array.isArray(l) ? l : (l.lecturers ?? l.data ?? []));
      // Rooms API wraps via jsonOk: { apiVersion, data: { rooms: [...] } }
      const roomPayload = r?.data ?? r;
      setRooms(Array.isArray(roomPayload) ? roomPayload : (roomPayload?.rooms ?? []));
    } catch (err) {
      console.error("[timetable] openModal fetch error:", err);
    } finally {
      setModalLoading(false);
    }
  }, [admin?.departmentId, admin?.institutionId]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Cascade resets downstream
      if (field === "courseId") { next.yearId = ""; next.semesterId = ""; next.unitId = ""; }
      else if (field === "yearId") { next.semesterId = ""; next.unitId = ""; }
      else if (field === "semesterId") { next.unitId = ""; }
      // Auto-fill venueName when room is selected
      if (field === "roomId" && value && !prev.venueName) {
        const room = rooms.find(r => r.id === value);
        if (room) next.venueName = `${room.roomCode} – ${room.name}`;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseId || !form.yearId || !form.semesterId || !form.unitId || !form.lecturerId || !form.roomId || !form.venueName) {
      setSubmitError("Please fill in all required fields."); return;
    }
    setSubmitting(true); setSubmitError(null);
    try {
      const unit = units.find(u => u.id === form.unitId);
      const semObj = unit?.semesters?.find(s => s.id === form.semesterId);
      const yearOfStudy = semObj?.year?.name ?? "";
      const semester = semObj?.label ?? "";
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          courseId: form.courseId,
          departmentId: admin!.departmentId,
          unitId: form.unitId,
          lecturerId: form.lecturerId,
          roomId: form.roomId,
          day: form.day,
          startTime: form.startTime,
          endTime: form.endTime,
          venueName: form.venueName,
          semester: semester || null,
          yearOfStudy: yearOfStudy || null,
          unitCode: unit?.code ?? "",
        }),
      });
      if (res.status === 409) { const d = await res.json(); setSubmitError(d.message ?? d.error ?? "Time slot conflict."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSubmitError(d.error ?? `Error ${res.status}`); return; }
      setShowModal(false);
      fetchEntries();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const shown = entries
    .filter(e => e.day === activeDay)
    .filter(e => !search ||
      (e.unitCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.lecturerName ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Timetable</h1>
          <p className="text-sm text-gray-400 mt-0.5">{admin?.departmentName}</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit or lecturer…"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DAYS.map(d => (
          <button key={d} onClick={() => setActiveDay(d)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${activeDay === d ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {d.slice(0,3)} <span className="text-[10px] opacity-70 ml-1">{entries.filter(e => e.day === d).length}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-200 text-xs font-medium text-gray-400 uppercase tracking-wider">
          <span>Time</span><span>Unit</span><span>Lecturer</span><span>Status</span>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12"><Calendar className="h-8 w-8 text-slate-400" /><p className="text-sm text-gray-500">No sessions for {activeDay}</p></div>
        ) : shown.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-center px-4 py-3.5 border-b border-gray-100 last:border-b-0">
            <div className="text-xs font-mono text-gray-500 whitespace-nowrap">{e.startTime}–{e.endTime}</div>
            <div>
              <div className="text-sm font-medium text-gray-900">{e.unitCode ?? "—"}</div>
              <div className="text-xs text-gray-400">{e.unitTitle ?? e.courseName ?? ""}</div>
            </div>
            <div className="text-sm text-gray-500 truncate hidden sm:block">{e.lecturerName ?? "—"}</div>
            <div className="hidden sm:block">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? "bg-slate-100 text-gray-500"}`}>{e.status}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-gray-900 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-800">New Timetable Entry</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            {modalLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* 1. Course */}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Course <span className="text-red-500">*</span></label>
                    <select required value={form.courseId} onChange={e => handleChange("courseId", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                      <option value="">Select course…</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* 2. Year of Study */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Year of Study <span className="text-red-500">*</span></label>
                    <select required value={form.yearId} onChange={e => handleChange("yearId", e.target.value)}
                      disabled={!form.courseId || yearsForCourse.length === 0}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <option value="">{form.courseId ? (yearsForCourse.length === 0 ? "No years found" : "Select year…") : "Select course first"}</option>
                      {yearsForCourse.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>

                  {/* 3. Semester */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Semester <span className="text-red-500">*</span></label>
                    <select required value={form.semesterId} onChange={e => handleChange("semesterId", e.target.value)}
                      disabled={!form.yearId || semestersForYear.length === 0}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <option value="">{form.yearId ? (semestersForYear.length === 0 ? "No semesters found" : "Select semester…") : "Select year first"}</option>
                      {semestersForYear.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>

                  {/* 4. Unit — only after course + year + semester */}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Unit <span className="text-red-500">*</span></label>
                    <select required value={form.unitId} onChange={e => handleChange("unitId", e.target.value)}
                      disabled={!form.semesterId || filteredUnits.length === 0}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <option value="">{form.semesterId ? (filteredUnits.length === 0 ? "No units in this semester" : "Select unit…") : "Select semester first"}</option>
                      {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.code} – {u.title}</option>)}
                    </select>
                  </div>

                  {/* 5. Lecturer */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Lecturer <span className="text-red-500">*</span></label>
                    <select required value={form.lecturerId} onChange={e => handleChange("lecturerId", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                      <option value="">Select lecturer…</option>
                      {lecturers.map(l => <option key={l.id} value={l.id}>{l.fullName}</option>)}
                    </select>
                  </div>

                  {/* 6. Room */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Room <span className="text-red-500">*</span></label>
                    <select required value={form.roomId} onChange={e => handleChange("roomId", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                      <option value="">Select room…</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.roomCode} – {r.name} (cap: {r.capacity})</option>)}
                    </select>
                  </div>

                  {/* 7. Day */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Day <span className="text-red-500">*</span></label>
                    <select required value={form.day} onChange={e => handleChange("day", e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* 8. Venue Name */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Venue Name <span className="text-red-500">*</span></label>
                    <input required value={form.venueName} onChange={e => handleChange("venueName", e.target.value)} placeholder="e.g. Room 101"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                  </div>

                  {/* 9. Start Time | End Time */}
                  {(["startTime", "endTime"] as const).map(field => (
                    <div key={field}>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">{field === "startTime" ? "Start Time" : "End Time"} <span className="text-red-500">*</span></label>
                      <input required type="time" value={form[field]} onChange={e => handleChange(field, e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50" />
                    </div>
                  ))}

                </div>
                {submitError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{submitError}</div>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
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
