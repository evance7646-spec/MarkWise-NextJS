"use client";

import { useEffect, useMemo, useState, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Search,
  Filter,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download,
  UserCircle,
  AlertTriangle,
  BookOpen,
  Zap,
  ChevronDown,
  LayoutGrid,
  List,
  Printer,
  Tag,
  SlidersHorizontal,
  CalendarDays,
  Info,
} from "lucide-react";

// ==================== TYPES ====================

type Unit = { id: string; title: string; code: string; courseId?: string };
type Semester = { id: string; label: string; units: Unit[] };
type YearBlock = { id: string; name: string; semesters: Semester[] };
type Course = { id: string; name: string; durationYears: number; code?: string; years: YearBlock[]; programId?: string };
type LecturerOption = { id: string; fullName: string; email: string; phoneNumber: string };
type RoomOption = { id: string; name: string; roomCode?: string; buildingCode?: string; capacity?: number; type?: string };
type TimetableEntry = {
  id: string;
  courseId: string;
  courseName?: string;
  yearOfStudy?: string;
  semester?: string;
  semesterLabel?: string;
  unitId: string;
  unitCode: string;
  unitTitle: string;
  venueName: string;
  roomCode?: string;
  lecturerId: string;
  lecturerName: string;
  roomId: string;
  day: string;
  startTime: string;
  endTime: string;
  status?: "Confirmed" | "Pending" | "Rescheduled" | "Canceled";
  departmentId: string;
  department?: { id: string; name: string } | null;
};
type UnitOption = { key: string; unitId: string; unitCode: string; unitTitle: string; label: string; courseId: string };
type SlotFormData = {
  unitId: string; lecturerId: string; roomId: string; day: string;
  startTime: string; endTime: string; venueName: string; courseId: string; semesterLabel: string;
};
type ConflictInfo = { conflictId: string; conflictDepartment?: { id: string; name?: string } | string | null; message?: string };

// ==================== CONSTANTS ====================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, "0")}:00`;
});

const STATUS_COLORS: Record<string, string> = {
  Confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  Pending:   "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  Rescheduled: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  Canceled:  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border-rose-200 dark:border-rose-700",
};

const ENTRY_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-purple-500 to-pink-600",
  "from-rose-500 to-orange-500",
  "from-teal-500 to-cyan-600",
  "from-amber-500 to-yellow-500",
  "from-green-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-fuchsia-500 to-purple-600",
];

const DAY_COLORS = [
  "bg-indigo-600",
  "bg-purple-600",
  "bg-pink-600",
  "bg-rose-600",
  "bg-orange-600",
];

const CACHE_DURATION = 5 * 60 * 1000;
const CACHE_KEYS = {
  lecturers: "tt_lecturers_v2",
  rooms: "tt_rooms_v2",
  entries: "tt_entries_v2",
};

// ==================== CACHE UTILS ====================

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_DURATION) { localStorage.removeItem(key); return null; }
    return data as T;
  } catch { return null; }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function clearAllCaches() {
  Object.values(CACHE_KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch {} });
}

// ==================== HELPERS ====================

const formatSemesterLabel = (label: string): string => {
  if (label === "First Semester" || label === "Second Semester") return label;
  if (label.includes(".")) {
    const n = parseInt(label.split(".")[1]);
    if (n === 1) return "First Semester";
    if (n === 2) return "Second Semester";
  }
  if (label.toLowerCase().includes("semester")) {
    if (label.includes("1")) return "First Semester";
    if (label.includes("2")) return "Second Semester";
  }
  return label;
};

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const gradientForEntry = (entry: TimetableEntry, allCourses: Course[]): string => {
  const idx = allCourses.findIndex((c) => c.id === entry.courseId);
  return ENTRY_GRADIENTS[(idx < 0 ? 0 : idx) % ENTRY_GRADIENTS.length];
};

const IDENTITY_CACHE_KEY = "tt_identity_v1";
const IDENTITY_CACHE_TTL = 30 * 60 * 1000; // 30 min

function readIdentityCache(): { deptId: string; instId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > IDENTITY_CACHE_TTL) { sessionStorage.removeItem(IDENTITY_CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}

function writeIdentityCache(deptId: string, instId: string) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify({ data: { deptId, instId }, ts: Date.now() })); } catch {}
}

// ==================== SKELETON ====================

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
);

// ==================== FORM SELECT ====================

const FormSelect = ({
  label, value, onChange, disabled, required, children,
}: {
  label: string; value: string; onChange: (v: string) => void;
  disabled?: boolean; required?: boolean; children: React.ReactNode;
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed pr-8"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

// ==================== ENTRY CARD ====================

const EntryCard = ({
  entry, gradient, onDelete, onClick,
}: {
  entry: TimetableEntry; gradient: string;
  onDelete: (e: TimetableEntry) => void; onClick: (e: TimetableEntry) => void;
}) => (
  <motion.div
    layoutId={entry.id}
    whileHover={{ scale: 1.02, zIndex: 20 }}
    onClick={() => onClick(entry)}
    className="group relative rounded-lg overflow-hidden shadow-sm cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700"
  >
    <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${gradient}`} />
    <div className="pl-3 pr-2 py-2.5">
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {entry.startTime}–{entry.endTime}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="font-semibold text-slate-800 dark:text-white text-xs leading-tight">{entry.unitTitle}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{entry.unitCode}</p>
      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
          <UserCircle className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{entry.lecturerName}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{entry.roomCode || entry.venueName}</span>
        </div>
      </div>
      <span className={`inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[entry.status || "Confirmed"]}`}>
        {entry.status || "Confirmed"}
      </span>
    </div>
  </motion.div>
);

// ==================== MAIN COMPONENT ====================

export default function DepartmentTimetablePage() {
  const router = useRouter();

  // --- Core identity ------------------------------------------------------------
  const [departmentId, setDepartmentId] = useState("");
  const [institutionId, setInstitutionId] = useState("");

  // --- Data ---------------------------------------------------------------------
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<LecturerOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  // --- Loading flags -------------------------------------------------------------
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);

  // --- UI -----------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<"view" | "create">("view");
  const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // --- Programme selectors ------------------------------------------------------
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  // --- Modals -------------------------------------------------------------------
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<TimetableEntry | null>(null);
  const [viewEntry, setViewEntry] = useState<TimetableEntry | null>(null);
  const [mergePrompt, setMergePrompt] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  // --- Form ---------------------------------------------------------------------
  const [formData, setFormData] = useState<SlotFormData>({
    unitId: "", lecturerId: "", roomId: "", day: "Monday",
    startTime: "", endTime: "", venueName: "", courseId: "", semesterLabel: "",
  });

  // --- Feedback -----------------------------------------------------------------
  const [modalError, setModalError] = useState("");
  const [pageError, setPageError] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ==================== COMPUTED ====================

  const selectedCourse = useMemo(() => courses.find((c) => c.id === selectedCourseId) ?? null, [courses, selectedCourseId]);

  const availableYears = useMemo((): string[] => {
    if (!selectedCourse) return [];
    if (selectedCourse.years?.length > 0)
      return selectedCourse.years.map((y) => (y.name?.match(/\d+/) ?? [])[0] ?? y.name).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));
    if (selectedCourse.durationYears) return Array.from({ length: selectedCourse.durationYears }, (_, i) => String(i + 1));
    return [];
  }, [selectedCourse]);

  const semestersForYear = useMemo(() => {
    if (!selectedCourse || !selectedYear) return [];
    const yb = selectedCourse.years?.find((y) => y.name === `Year ${selectedYear}` || y.name === selectedYear);
    if (!yb?.semesters) return [];
    return [...yb.semesters].sort((a, b) => {
      if (a.label.includes("First")) return -1;
      if (b.label.includes("First")) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [selectedCourse, selectedYear]);

  const unitsForSelection = useMemo((): UnitOption[] => {
    if (!selectedCourse || !selectedYear || !selectedSemester) return [];
    const yb = selectedCourse.years?.find((y) => y.name === `Year ${selectedYear}` || y.name === selectedYear);
    const sem = yb?.semesters?.find((s) => String(s.id) === String(selectedSemester));
    if (!sem?.units) return [];
    return sem.units.map((u) => ({
      key: u.id, unitId: u.id,
      unitCode: u.code?.trim().toUpperCase() || "",
      unitTitle: u.title?.trim() || "",
      label: `${u.title?.trim()} (${u.code?.trim().toUpperCase()})`,
      courseId: selectedCourse.id,
    }));
  }, [selectedCourse, selectedYear, selectedSemester]);

  const semesterDisplay = useMemo(() => {
    const sem = semestersForYear.find((s) => String(s.id) === String(selectedSemester));
    return sem ? formatSemesterLabel(sem.label) : "";
  }, [semestersForYear, selectedSemester]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (activeTab === "create") {
      list = list.filter((e) => e.courseId === selectedCourseId && e.yearOfStudy === selectedYear && e.semester === selectedSemester);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((e) =>
        e.unitTitle.toLowerCase().includes(q) ||
        e.unitCode.toLowerCase().includes(q) ||
        e.lecturerName.toLowerCase().includes(q) ||
        (e.venueName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter((e) => (e.status ?? "Confirmed") === filterStatus);
    if (filterCourse !== "all") list = list.filter((e) => e.courseId === filterCourse);
    return list;
  }, [entries, activeTab, selectedCourseId, selectedYear, selectedSemester, searchTerm, filterStatus, filterCourse]);

  const stats = useMemo(() => ({
    total: entries.length,
    confirmed: entries.filter((e) => (e.status ?? "Confirmed") === "Confirmed").length,
    pending: entries.filter((e) => e.status === "Pending").length,
    uniqueLecturers: new Set(entries.map((e) => e.lecturerId)).size,
  }), [entries]);

  // ==================== FETCH HELPERS ====================

  const apiFetch = useCallback(async (url: string, opts: RequestInit = {}, timeout = 20000) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store", credentials: "include" });
      clearTimeout(tid);
      return res;
    } catch (e) { clearTimeout(tid); throw e; }
  }, []);

  const loadEntries = useCallback(async (deptId: string, bustCache = false) => {
    if (!bustCache) {
      const cached = readCache<TimetableEntry[]>(CACHE_KEYS.entries);
      if (cached) { setEntries(cached); return; }
    }
    const res = await apiFetch(`/api/timetable?departmentId=${deptId}`);
    if (!res.ok) throw new Error("Failed to load timetable");
    const data = await res.json();
    const list: TimetableEntry[] = Array.isArray(data) ? data : (data.timetable ?? []);
    setEntries(list);
    writeCache(CACHE_KEYS.entries, list);
  }, [apiFetch]);

  const loadLecturers = useCallback(async (deptId: string, bustCache = false) => {
    if (!bustCache) {
      const cached = readCache<LecturerOption[]>(CACHE_KEYS.lecturers);
      if (cached) { setLecturers(cached); return; }
    }
    const res = await apiFetch(`/api/lecturers?departmentId=${deptId}`);
    if (!res.ok) return;
    const data = await res.json();
    const list: LecturerOption[] = Array.isArray(data) ? data : (data.lecturers ?? []);
    const sorted = list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    setLecturers(sorted);
    writeCache(CACHE_KEYS.lecturers, sorted);
  }, [apiFetch]);

  const loadRooms = useCallback(async (instId: string, bustCache = false) => {
    if (!instId) return;
    if (!bustCache) {
      const cached = readCache<RoomOption[]>(CACHE_KEYS.rooms);
      if (cached) { setRooms(cached); return; }
    }
    const res = await apiFetch(`/api/rooms?institutionId=${instId}`);
    if (!res.ok) return;
    const data = await res.json();
    const list: RoomOption[] = Array.isArray(data.rooms) ? data.rooms :
      (Array.isArray(data.data?.rooms) ? data.data.rooms : (Array.isArray(data) ? data : []));
    setRooms(list);
    writeCache(CACHE_KEYS.rooms, list);
  }, [apiFetch]);

  const loadCurriculum = useCallback(async (deptId: string) => {
    // Primary: fetch Course entities — timetable entries require a valid Course.id FK
    const res = await apiFetch(`/api/courses?departmentId=${deptId}`);
    if (!res.ok) throw new Error("Failed to load curriculum");
    const data = await res.json();
    let allCourses: Course[] = Array.isArray(data) ? data : (data.courses ?? []);

    // Fallback: if no Course records exist yet, map Programs from the curriculum API
    // Note: program IDs can't be used as courseId FK — this only provides read-only display
    if (allCourses.length === 0) {
      try {
        const cr = await apiFetch(`/api/curriculum?departmentId=${deptId}`);
        if (cr.ok) {
          const cd = await cr.json();
          const programs: any[] = Array.isArray(cd.programs) ? cd.programs : [];
          allCourses = programs.map((p: any) => ({
            id: p.id,
            name: p.name,
            durationYears: p.durationYears || p.years?.length || 0,
            code: p.code || "",
            years: p.years || [],
            programId: p.id,
          }));
        }
      } catch {}
    }
    setCourses(allCourses);
  }, [apiFetch]);

  // ==================== PARALLEL INITIALIZER ====================

  useEffect(() => {
    let alive = true;
    abortRef.current = new AbortController();

    const boot = async () => {
      setInitializing(true);
      try {
        // Step 1: identify – check sessionStorage first, then API
        let deptId: string;
        let instId: string;
        const cached = readIdentityCache();
        if (cached) {
          deptId = cached.deptId;
          instId = cached.instId;
          console.log("[Timetable] Identity from cache — deptId:", deptId, "| instId:", instId);
        } else {
          const meRes = await apiFetch("/api/auth/me", {}, 5000);
          if (!meRes.ok) throw new Error("Unauthorized");
          const me = await meRes.json();
          deptId = me.department?.id || me.departmentId || "";
          instId = me.institution?.id || me.institutionId || "";
          console.log("[Timetable] Auth OK — deptId:", deptId, "| instId:", instId);
          if (deptId) writeIdentityCache(deptId, instId);
        }
        if (!deptId) {
          setPageError("Please sign in to access timetable management.");
          setTimeout(() => router.push("/admin/department-admin/login"), 2000);
          return;
        }
        if (!alive) return;
        setDepartmentId(deptId);
        setInstitutionId(instId);

        // Step 2: ALL data in parallel — no sequential waterfalls
        const [currResult, lectResult, roomResult, entryResult] = await Promise.allSettled([
          loadCurriculum(deptId),
          loadLecturers(deptId, false),
          loadRooms(instId, false),
          loadEntries(deptId, false),
        ]);

        if (!alive) return;

        if (currResult.status === "rejected") console.error("[Timetable] Curriculum load failed:", currResult.reason);
        else console.log("[Timetable] Curriculum OK — deptId:", deptId);
        if (lectResult.status === "rejected") console.error("[Timetable] Lecturers load failed:", lectResult.reason);
        else console.log("[Timetable] Lecturers OK — deptId:", deptId);
        if (roomResult.status === "rejected") console.error("[Timetable] Rooms load failed:", roomResult.reason);
        else console.log("[Timetable] Rooms OK — instId:", instId);
        if (entryResult.status === "rejected") console.error("[Timetable] Entries load failed:", entryResult.reason);
        else console.log("[Timetable] Entries OK — deptId:", deptId);
      } catch (err: any) {
        if (alive) setPageError(err.message || "Failed to initialize. Please refresh.");
      } finally {
        if (alive) setInitializing(false);
      }
    };

    boot();
    return () => { alive = false; abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first year when course changes
  useEffect(() => {
    if (!selectedCourse) { setSelectedYear(""); setSelectedSemester(""); return; }
    if (availableYears.length > 0 && !selectedYear) setSelectedYear(availableYears[0]);
  }, [selectedCourse, availableYears]);

  useEffect(() => { setSelectedSemester(""); }, [selectedYear]);
  useEffect(() => { setFormData((p) => ({ ...p, semesterLabel: semesterDisplay })); }, [semesterDisplay]);
  useEffect(() => { setFormData((p) => ({ ...p, courseId: selectedCourse?.id ?? "" })); }, [selectedCourse]);

  // ==================== HANDLERS ====================

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRefresh = useCallback(async () => {
    if (!departmentId || refreshing) return;
    clearAllCaches();
    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadCurriculum(departmentId),
        loadLecturers(departmentId, true),
        loadRooms(institutionId, true),
        loadEntries(departmentId, true),
      ]);
      showToast("success", "Data refreshed successfully");
    } catch {
      showToast("error", "Some data failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [departmentId, institutionId, refreshing, loadCurriculum, loadLecturers, loadRooms, loadEntries]);

  const openAddModal = () => {
    setModalError("");
    if (!selectedCourse || !selectedYear || !selectedSemester) { setModalError("Please select course, year, and semester first."); return; }
    if (unitsForSelection.length === 0) { setModalError("No units found for this semester."); return; }
    if (lecturers.length === 0) { setModalError("No lecturers available."); return; }
    if (rooms.length === 0) { setModalError("No rooms available."); return; }
    setFormData({
      unitId: unitsForSelection[0].unitId, lecturerId: lecturers[0].id, roomId: rooms[0].id,
      day: "Monday", startTime: "", endTime: "", venueName: rooms[0].name,
      courseId: selectedCourse.id, semesterLabel: semesterDisplay,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    if (!formData.courseId) { setModalError("Course not set."); return; }
    if (formData.startTime >= formData.endTime) { setModalError("End time must be after start time."); return; }
    const unit = unitsForSelection.find((u) => u.unitId === formData.unitId);
    const lecturer = lecturers.find((l) => l.id === formData.lecturerId);
    const room = rooms.find((r) => r.id === formData.roomId);
    if (!unit || !lecturer || !room) { setModalError("Invalid unit / lecturer / room selection."); return; }

    setSavingEntry(true);
    try {
      const payload = {
        courseId: formData.courseId, departmentId, unitId: formData.unitId,
        lecturerId: formData.lecturerId, roomId: formData.roomId, day: formData.day,
        startTime: formData.startTime, endTime: formData.endTime, venueName: formData.venueName,
        courseName: selectedCourse?.name, yearOfStudy: selectedYear, semester: selectedSemester,
        semesterLabel: formData.semesterLabel, unitCode: unit.unitCode, unitTitle: unit.unitTitle,
        lecturerName: lecturer.fullName,
      };
      const res = await fetch("/api/timetable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.mergePrompt) { setMergePrompt(true); setConflictInfo(data); return; }
        throw new Error(data.error || "Failed to save entry");
      }
      setIsAddModalOpen(false);
      await loadEntries(departmentId, true);
      showToast("success", "Schedule entry added!");
    } catch (err: any) {
      setModalError(err.message || "Failed to save. Please try again.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDelete = async () => {
    if (!slotToDelete) return;
    setSavingEntry(true);
    try {
      const res = await fetch(`/api/timetable/${slotToDelete.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      setSlotToDelete(null);
      await loadEntries(departmentId, true);
      showToast("success", "Entry deleted.");
    } catch (err: any) {
      showToast("error", err.message || "Delete failed.");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleMerge = async () => {
    if (!conflictInfo) return;
    setSavingEntry(true);
    try {
      const res = await fetch(`/api/timetable/${conflictInfo.conflictId}/merge`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departmentId,
          courseId: formData.courseId,
          lecturerId: formData.lecturerId,
          yearOfStudy: selectedYear,
          semester: selectedSemester,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Merge failed");
      setMergePrompt(false); setConflictInfo(null); setIsAddModalOpen(false);
      await loadEntries(departmentId, true);
      showToast("success", "Schedules merged!");
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSavingEntry(false);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `timetable-${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== LOADING SCREEN ====================

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 flex flex-col items-center justify-center gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 p-4 shadow-xl">
          <Calendar className="h-10 w-10 text-white" />
        </motion.div>
        <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">Loading timetable data…</p>
        <p className="text-sm text-slate-400 dark:text-slate-500">Fetching curriculum, lecturers, rooms &amp; entries in parallel</p>
      </div>
    );
  }

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* -- PAGE HEADER -- */}
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm shadow-inner">
                  <Calendar className="h-9 w-9 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Timetable Management</h1>
                  <p className="mt-1 text-white/80 text-sm">Build, view and manage weekly class schedules across courses</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium backdrop-blur-sm transition-colors">
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button onClick={exportJSON}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium backdrop-blur-sm transition-colors">
                  <Download className="h-4 w-4" /> Export
                </button>
                <button onClick={handleRefresh} disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium backdrop-blur-sm transition-colors disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            {/* quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: "Total Slots", value: stats.total, icon: CalendarDays },
                { label: "Confirmed", value: stats.confirmed, icon: CheckCircle2 },
                { label: "Pending", value: stats.pending, icon: Clock },
                { label: "Lecturers Active", value: stats.uniqueLecturers, icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 text-white border border-white/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 opacity-80" />
                    <span className="text-xs font-medium opacity-80">{label}</span>
                  </div>
                  <div className="text-2xl font-bold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* -- GLOBAL ERROR -- */}
        <AnimatePresence>
          {pageError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{pageError}</span>
              <button onClick={() => setPageError("")} className="ml-auto"><X className="h-4 w-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- TAB BAR -- */}
        <div className="flex gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-1 shadow-sm w-fit">
          {(["view", "create"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/50"
              }`}>
              {tab === "view" ? "View Timetable" : "Create Schedule"}
            </button>
          ))}
        </div>

        {/* -- TAB CONTENT -- */}
        <AnimatePresence mode="wait">

          {/* ---- VIEW TAB ---- */}
          {activeTab === "view" && (
            <motion.div key="view" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">

              {/* Toolbar */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-white/50 dark:border-slate-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search unit, lecturer, venue…"
                      className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowFilters((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        showFilters
                          ? "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}>
                      <SlidersHorizontal className="h-4 w-4" /> Filters
                    </button>
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                      <button onClick={() => setViewMode("timeline")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === "timeline" ? "bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}
                        title="Weekly Timeline"><LayoutGrid className="h-4 w-4" /></button>
                      <button onClick={() => setViewMode("list")}
                        className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}
                        title="List"><List className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm">
                            <option value="all">All Status</option>
                            {["Confirmed", "Pending", "Rescheduled", "Canceled"].map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Course</label>
                          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm">
                            <option value="all">All Courses</option>
                            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button onClick={() => { setFilterStatus("all"); setFilterCourse("all"); setSearchTerm(""); }}
                            className="px-3 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 w-full">
                            Clear Filters
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Empty state */}
              {filteredEntries.length === 0 && (
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-14 text-center shadow-sm">
                  <Calendar className="h-14 w-14 text-indigo-300 dark:text-indigo-700 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">No schedules yet</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {searchTerm || filterStatus !== "all" || filterCourse !== "all"
                      ? "No entries match your filters." : "Switch to the Create tab to get started."}
                  </p>
                  <button onClick={() => setActiveTab("create")}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:opacity-90">
                    Create Schedule
                  </button>
                </div>
              )}

              {/* -- TIMELINE VIEW -- */}
              {filteredEntries.length > 0 && viewMode === "timeline" && (
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 dark:border-slate-700/50 overflow-hidden">
                    {/* Day header */}
                    <div className="grid grid-cols-5 border-b border-slate-100 dark:border-slate-700">
                      {DAYS.map((d, i) => (
                        <div key={d} className={`py-3 text-center text-sm font-bold text-white ${DAY_COLORS[i]}`}>
                          {d}
                          <span className="ml-2 text-xs font-normal opacity-80">
                            ({filteredEntries.filter((e) => e.day === d).length})
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Card grid */}
                    <div className="grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-700">
                      {DAYS.map((day) => {
                        const dayEntries = filteredEntries
                          .filter((e) => e.day === day)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));
                        return (
                          <div key={day} className="flex flex-col">
                            <div className="flex-1 space-y-2 p-2 min-h-[200px] bg-slate-50/50 dark:bg-slate-900/20">
                              {dayEntries.map((entry) => (
                                <EntryCard key={entry.id} entry={entry}
                                  gradient={gradientForEntry(entry, courses)}
                                  onDelete={setSlotToDelete} onClick={setViewEntry} />
                              ))}
                              {dayEntries.length === 0 && (
                                <div className="h-full min-h-[80px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-400 dark:text-slate-600">
                                  No classes
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
              )}

              {/* -- LIST VIEW -- */}
              {filteredEntries.length > 0 && viewMode === "list" && (
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden border border-white/50 dark:border-slate-700/50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-left">
                        {["Day", "Time", "Unit", "Code", "Lecturer", "Venue", "Status", ""].map((h) => (
                          <th key={h} className="px-4 py-3 font-semibold text-xs uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {[...filteredEntries]
                        .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime))
                        .map((entry) => (
                          <motion.tr key={entry.id} whileHover={{ backgroundColor: "rgba(99,102,241,0.05)" }} className="transition-colors group">
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-white text-xs font-semibold ${DAY_COLORS[DAYS.indexOf(entry.day)] ?? "bg-slate-500"}`}>
                                {entry.day.substring(0, 3)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <Clock className="inline h-3.5 w-3.5 mr-1 opacity-60" />{entry.startTime}–{entry.endTime}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-white max-w-[180px] truncate">{entry.unitTitle}</td>
                            <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{entry.unitCode}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              <UserCircle className="inline h-3.5 w-3.5 mr-1 opacity-60" />{entry.lecturerName}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              <MapPin className="inline h-3.5 w-3.5 mr-1 opacity-60" />{entry.roomCode || entry.venueName}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[entry.status ?? "Confirmed"]}`}>
                                {entry.status ?? "Confirmed"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setViewEntry(entry)} className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                                  <Info className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setSlotToDelete(entry)} className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ---- CREATE TAB ---- */}
          {activeTab === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">

              {/* Selectors */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm p-5 border border-white/50 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Select Programme
                </h3>
                {courses.length === 0 && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>No courses found for this department. Please set up the curriculum first in the <a href="/admin/department-admin/dashboard/curriculum" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">Curriculum page</a>.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormSelect label="Course" value={selectedCourseId} onChange={setSelectedCourseId} disabled={courses.length === 0}>
                    {courses.length === 0
                      ? <option value="">No courses available</option>
                      : <><option value="">— Choose a course —</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>}
                  </FormSelect>
                  <FormSelect label="Year of Study" value={selectedYear} onChange={setSelectedYear} disabled={!selectedCourseId || availableYears.length === 0}>
                    {!selectedCourseId ? <option value="">Select course first</option>
                      : availableYears.length === 0 ? <option value="">No years available</option>
                      : <><option value="">— Choose year —</option>{availableYears.map((y) => <option key={y} value={y}>Year {y}</option>)}</>}
                  </FormSelect>
                  <FormSelect label="Semester" value={selectedSemester} onChange={setSelectedSemester} disabled={!selectedYear || semestersForYear.length === 0}>
                    {!selectedYear ? <option value="">Select year first</option>
                      : semestersForYear.length === 0 ? <option value="">No semesters available</option>
                      : <><option value="">— Choose semester —</option>{semestersForYear.map((s) => <option key={s.id} value={s.id}>{formatSemesterLabel(s.label)}</option>)}</>}
                  </FormSelect>
                </div>
              </div>

              {/* Context banner */}
              {selectedCourse && selectedYear && selectedSemester && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-xl px-5 py-4 border border-indigo-100 dark:border-indigo-800">
                  <div>
                    <p className="font-semibold text-indigo-800 dark:text-indigo-200">
                      {selectedCourse.name} · Year {selectedYear} · {semesterDisplay}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {unitsForSelection.length} unit{unitsForSelection.length !== 1 ? "s" : ""} · {filteredEntries.length} scheduled
                    </p>
                  </div>
                  <button onClick={openAddModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 shadow-md whitespace-nowrap">
                    <Plus className="h-4 w-4" /> Add Schedule
                  </button>
                </motion.div>
              )}

              {/* Inline error when Add Schedule is blocked */}
              {modalError && !isAddModalOpen && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />{modalError}
                </div>
              )}

              {/* Timetable grid */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl shadow-sm border border-white/50 dark:border-slate-700/50 overflow-hidden">
                {!selectedCourse || !selectedYear || !selectedSemester ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <BookOpen className="h-12 w-12 text-indigo-300 dark:text-indigo-700 mb-3" />
                    <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-1">Nothing selected yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Choose a course, year, and semester above to manage its schedule.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile day selector */}
                    <div className="md:hidden p-4 border-b border-slate-100 dark:border-slate-700">
                      <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm">
                        {DAYS.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </div>

                    {/* Desktop grid */}
                    <div className="hidden md:grid md:grid-cols-5 divide-x divide-slate-100 dark:divide-slate-700">
                      {DAYS.map((day, i) => {
                        const dayEntries = filteredEntries.filter((e) => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                        return (
                          <div key={day} className="flex flex-col">
                            <div className={`text-center font-bold text-white py-2.5 text-sm ${DAY_COLORS[i]}`}>
                              {day}
                              {dayEntries.length > 0 && (
                                <span className="ml-1.5 bg-white/25 text-xs rounded-full px-1.5 py-0.5">{dayEntries.length}</span>
                              )}
                            </div>
                            <div className="flex-1 space-y-2 p-2 min-h-[200px] bg-slate-50/50 dark:bg-slate-900/20">
                              {dayEntries.map((entry) => (
                                <EntryCard key={entry.id} entry={entry} gradient={gradientForEntry(entry, courses)}
                                  onDelete={setSlotToDelete} onClick={setViewEntry} />
                              ))}
                              {dayEntries.length === 0 && (
                                <div className="h-full min-h-[80px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-400 dark:text-slate-600">
                                  No classes
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile single-day */}
                    <div className="md:hidden p-3 space-y-3">
                      {filteredEntries.filter((e) => e.day === selectedDay)
                        .sort((a, b) => a.startTime.localeCompare(b.startTime))
                        .map((entry) => (
                          <EntryCard key={entry.id} entry={entry} gradient={gradientForEntry(entry, courses)}
                            onDelete={setSlotToDelete} onClick={setViewEntry} />
                        ))}
                      {filteredEntries.filter((e) => e.day === selectedDay).length === 0 && (
                        <div className="text-center py-10 text-slate-400 dark:text-slate-600">No classes on {selectedDay}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- ADD SCHEDULE MODAL --- */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setIsAddModalOpen(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Add Schedule Entry</h2>
                  <p className="text-white/75 text-xs mt-0.5">{selectedCourse?.name} · Year {selectedYear} · {semesterDisplay}</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSaveSlot} className="p-6 overflow-y-auto space-y-4">
                {modalError && (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 rounded-lg px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />{modalError}
                  </div>
                )}
                <FormSelect label="Unit" value={formData.unitId} onChange={(v) => setFormData((p) => ({ ...p, unitId: v }))} required>
                  {unitsForSelection.map((u) => <option key={u.unitId} value={u.unitId}>{u.label}</option>)}
                </FormSelect>
                <FormSelect label="Lecturer" value={formData.lecturerId} onChange={(v) => setFormData((p) => ({ ...p, lecturerId: v }))} required>
                  {lecturers.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
                </FormSelect>
                <FormSelect label="Room" value={formData.roomId}
                  onChange={(v) => { const r = rooms.find((rm) => rm.id === v); setFormData((p) => ({ ...p, roomId: v, venueName: r?.roomCode || r?.name || p.venueName })); }} required>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.roomCode ? `${r.roomCode} — ${r.name}` : r.name}{r.capacity ? ` (cap. ${r.capacity})` : ""}</option>)}
                </FormSelect>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Venue Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.venueName} required
                    onChange={(e) => setFormData((p) => ({ ...p, venueName: e.target.value }))}
                    placeholder="e.g., Room 101, Lab A"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <FormSelect label="Day" value={formData.day} onChange={(v) => setFormData((p) => ({ ...p, day: v }))} required>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </FormSelect>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Start Time <span className="text-red-500">*</span></label>
                    <input type="time" value={formData.startTime} required
                      onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">End Time <span className="text-red-500">*</span></label>
                    <input type="time" value={formData.endTime} required
                      onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <button type="submit" disabled={savingEntry}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {savingEntry ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Zap className="h-4 w-4" />Save Schedule</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ENTRY DETAIL MODAL --- */}
      <AnimatePresence>
        {viewEntry && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setViewEntry(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className={`bg-gradient-to-r ${gradientForEntry(viewEntry, courses)} px-6 py-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{viewEntry.unitTitle}</h2>
                    <p className="text-white/75 text-sm font-mono">{viewEntry.unitCode}</p>
                  </div>
                  <button onClick={() => setViewEntry(null)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"><X className="h-4 w-4" /></button>
                </div>
                <span className={`inline-block mt-3 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[viewEntry.status ?? "Confirmed"]}`}>
                  {viewEntry.status ?? "Confirmed"}
                </span>
              </div>
              <div className="p-6 space-y-3">
                {[
                  { icon: CalendarDays, label: "Day", value: viewEntry.day },
                  { icon: Clock, label: "Time", value: `${viewEntry.startTime} – ${viewEntry.endTime}` },
                  { icon: UserCircle, label: "Lecturer", value: viewEntry.lecturerName },
                  { icon: MapPin, label: "Venue", value: viewEntry.venueName },
                  { icon: BookOpen, label: "Course", value: viewEntry.courseName ?? "—" },
                  { icon: Tag, label: "Semester", value: viewEntry.semesterLabel ?? viewEntry.semester ?? "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{value}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <button onClick={() => { setSlotToDelete(viewEntry); setViewEntry(null); }}
                    className="w-full py-2 rounded-lg border-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                    Delete This Entry
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DELETE CONFIRM MODAL --- */}
      <AnimatePresence>
        {slotToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center justify-center w-14 h-14 bg-rose-100 dark:bg-rose-900/30 rounded-2xl mx-auto mb-4">
                <AlertTriangle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-lg font-bold text-center text-slate-800 dark:text-white mb-1">Delete Schedule?</h2>
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-2">
                <span className="font-medium text-slate-700 dark:text-slate-200">{slotToDelete.unitTitle}</span> on {slotToDelete.day} ({slotToDelete.startTime}–{slotToDelete.endTime})
              </p>
              <p className="text-xs text-center text-slate-400 dark:text-slate-500 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setSlotToDelete(null)} disabled={savingEntry}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={savingEntry}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingEntry ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MERGE CONFLICT MODAL --- */}
      <AnimatePresence>
        {mergePrompt && conflictInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-center text-slate-800 dark:text-white mb-2">Schedule Conflict</h2>
              <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6">
                {conflictInfo.message ?? "A conflict was detected. Merge the schedules?"}
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setMergePrompt(false); setConflictInfo(null); }} disabled={savingEntry}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleMerge} disabled={savingEntry}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingEntry ? <><Loader2 className="h-4 w-4 animate-spin" />Merging…</> : "Merge"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TOAST --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 60, scale: 0.95 }}
            className={`fixed bottom-5 right-5 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium z-[60] ${
              toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}>
            {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          body > *:not(.print-area) { display: none; }
          .min-w-\\[800px\\] { min-width: 100%; }
        }
      `}</style>
    </div>
  );
}
