"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { 
  Building2, 
  Search, 
  Plus, 
  X, 
  Edit, 
  Trash2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Grid,
  List,
  Map as MapIcon,
  Users,
  DoorOpen,
  Hash,
  Layers,
  Zap,
  Download,
  Upload,
  Filter,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  MoreVertical,
  Copy,
  CheckCircle2,
  Clock,
  HelpCircle
} from "lucide-react";

// ==================== TYPES ====================

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
  bookingEndTime?: string; // ISO string
};

type RoomForm = {
  institutionId: string;
  buildingCode: string;
  roomCode: string;
  name: string;
  capacity: string;
  type: string;
  floor: string;
  status: RoomStatus;
  isActive: boolean;
};

type RoomFormErrors = Partial<Record<"institutionId" | "buildingCode" | "roomCode" | "name" | "capacity" | "type" | "floor", string>>;

type BuildingGroup = {
  buildingCode: string;
  rooms: RoomRecord[];
  floors: Array<{ floor: number; rooms: RoomRecord[] }>;
};

// ==================== CONSTANTS ====================

const initialForm: RoomForm = {
  institutionId: "",
  buildingCode: "",
  roomCode: "",
  name: "",
  capacity: "",
  type: "",
  floor: "0",
  status: "free",
  isActive: true,
};

const statusMeta: Record<RoomStatus, { 
  label: string; 
  icon: React.ReactNode;
  color: string;
  gradient: string;
  badge: string;
  lightBg: string;
  darkBg: string;
}> = {
  free: {
    label: "Free",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-600 dark:text-emerald-400",
    gradient: "from-emerald-500 to-green-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700",
    lightBg: "bg-emerald-50",
    darkBg: "dark:bg-emerald-500/10",
  },
  reserved: {
    label: "Reserved",
    icon: <Clock className="h-4 w-4" />,
    color: "text-amber-600 dark:text-amber-400",
    gradient: "from-amber-500 to-orange-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
    lightBg: "bg-amber-50",
    darkBg: "dark:bg-amber-500/10",
  },
  occupied: {
    label: "Occupied",
    icon: <Users className="h-4 w-4" />,
    color: "text-rose-600 dark:text-rose-400",
    gradient: "from-rose-500 to-red-500",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-700",
    lightBg: "bg-rose-50",
    darkBg: "dark:bg-rose-500/10",
  },
  unavailable: {
    label: "Unavailable",
    icon: <X className="h-4 w-4" />,
    color: "text-slate-600 dark:text-slate-400",
    gradient: "from-slate-500 to-gray-500",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300 border border-slate-300 dark:border-slate-700",
    lightBg: "bg-slate-50",
    darkBg: "dark:bg-slate-800/50",
  },
};

const floorOptions = [
  { label: "Ground Floor", value: 0 },
  { label: "First Floor", value: 1 },
  { label: "Second Floor", value: 2 },
  { label: "Third Floor", value: 3 },
  { label: "Fourth Floor", value: 4 },
  { label: "Fifth Floor", value: 5 },
];

const roomTypes = [
  { value: "lecture", label: "Lecture Hall", icon: "🎓" },
  { value: "lab", label: "Laboratory", icon: "🔬" },
  { value: "seminar", label: "Seminar Room", icon: "📚" },
  { value: "office", label: "Office", icon: "💼" },
  { value: "conference", label: "Conference Room", icon: "🤝" },
  { value: "study", label: "Study Room", icon: "📖" },
];

// ==================== ANIMATION VARIANTS ====================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
    },
  },
};

// ==================== COMPONENTS ====================

function StatusLegend() {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border-2 border-indigo-300 bg-white/90 p-4 shadow-sm dark:border-indigo-700 dark:bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          ROOM STATUS LEGEND
        </p>
        <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Click for details</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(statusMeta) as RoomStatus[]).map((status) => (
          <motion.div
            key={status}
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-indigo-300 px-3 py-1.5 dark:border-indigo-700 cursor-pointer hover:shadow-md transition-all bg-white dark:bg-slate-900"
          >
            <span className={statusMeta[status].color}>{statusMeta[status].icon}</span>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{statusMeta[status].label}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function QuickStats({ rooms, buildingCodes, totalFloors }: { 
  rooms: RoomRecord[]; 
  buildingCodes: string[];
  totalFloors: number;
}) {
  const stats = useMemo(() => {
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const activeRooms = rooms.filter(r => r.isActive).length;
    const availableRooms = rooms.filter(r => r.status === "free").length;
    
    return {
      totalCapacity,
      activeRooms,
      availableRooms,
      utilization: rooms.length ? Math.round((rooms.filter(r => r.status !== "free").length / rooms.length) * 100) : 0,
    };
  }, [rooms]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 p-4 text-white shadow-lg border-2 border-indigo-300 dark:border-indigo-700"
      >
        <div className="flex items-center justify-between">
          <DoorOpen className="h-5 w-5 opacity-80" />
          <span className="text-xs font-medium opacity-80">Total</span>
        </div>
        <p className="mt-2 text-2xl font-bold">{rooms.length}</p>
        <p className="text-xs opacity-90">Rooms</p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white shadow-lg border-2 border-emerald-300 dark:border-emerald-700"
      >
        <div className="flex items-center justify-between">
          <CheckCircle2 className="h-5 w-5 opacity-80" />
          <span className="text-xs font-medium opacity-80">Free</span>
        </div>
        <p className="mt-2 text-2xl font-bold">{stats.availableRooms}</p>
        <p className="text-xs opacity-90">Available Now</p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white shadow-lg border-2 border-amber-300 dark:border-amber-700"
      >
        <div className="flex items-center justify-between">
          <Users className="h-5 w-5 opacity-80" />
          <span className="text-xs font-medium opacity-80">Capacity</span>
        </div>
        <p className="mt-2 text-2xl font-bold">{stats.totalCapacity.toLocaleString()}</p>
        <p className="text-xs opacity-90">Total Seats</p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 p-4 text-white shadow-lg border-2 border-cyan-300 dark:border-cyan-700"
      >
        <div className="flex items-center justify-between">
          <Building2 className="h-5 w-5 opacity-80" />
          <span className="text-xs font-medium opacity-80">Buildings</span>
        </div>
        <p className="mt-2 text-2xl font-bold">{buildingCodes.length}</p>
        <p className="text-xs opacity-90">{totalFloors} Floors</p>
      </motion.div>
    </div>
  );
}

function RoomFormSection({
  form,
  fieldErrors,
  onChange,
  onSubmit,
  isSaving,
  editingRoomId,
  onCancelEdit,
}: {
  form: RoomForm;
  fieldErrors: RoomFormErrors;
  onChange: (updater: (prev: RoomForm) => RoomForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isSaving: boolean;
  editingRoomId: string | null;
  onCancelEdit: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="rounded-xl border-2 border-indigo-300 bg-white/90 p-5 shadow-sm dark:border-indigo-700 dark:bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
          {editingRoomId ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {editingRoomId ? "Edit Room" : "Create New Room"}
        </h2>
      </div>

      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Institution ID
          </label>
          <input
            value={form.institutionId}
            onChange={(event) => onChange((prev) => ({ ...prev, institutionId: event.target.value }))}
            placeholder="Institution ID"
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.institutionId 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          />
          {fieldErrors.institutionId && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.institutionId}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Building Code
          </label>
          <input
            value={form.buildingCode}
            onChange={(event) => onChange((prev) => ({ ...prev, buildingCode: event.target.value }))}
            placeholder="e.g., HRD"
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.buildingCode 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          />
          {fieldErrors.buildingCode && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.buildingCode}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <DoorOpen className="h-3 w-3" />
            Room Code
          </label>
          <input
            value={form.roomCode}
            onChange={(event) => onChange((prev) => ({ ...prev, roomCode: event.target.value }))}
            placeholder="e.g., HRD 101"
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.roomCode 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          />
          {fieldErrors.roomCode && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.roomCode}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Room Name</label>
          <input
            value={form.name}
            onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="e.g., Main Lecture Hall"
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.name 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          />
          {fieldErrors.name && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Capacity
          </label>
          <input
            type="number"
            value={form.capacity}
            onChange={(event) => onChange((prev) => ({ ...prev, capacity: event.target.value }))}
            placeholder="Number of seats"
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.capacity 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          />
          {fieldErrors.capacity && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.capacity}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Room Type</label>
          <select
            value={form.type}
            onChange={(event) => onChange((prev) => ({ ...prev, type: event.target.value }))}
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-indigo-700 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.type 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          >
            <option value="">Select type</option>
            {roomTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
          {fieldErrors.type && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.type}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Floor
          </label>
          <select
            value={form.floor}
            onChange={(event) => onChange((prev) => ({ ...prev, floor: event.target.value }))}
            className={`w-full rounded-lg border-2 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-indigo-700 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all ${
              fieldErrors.floor 
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200" 
                : "border-indigo-300 dark:border-indigo-700"
            }`}
          >
            {floorOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {fieldErrors.floor && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.floor}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Status</label>
          <select
            value={form.status}
            onChange={(event) => onChange((prev) => ({ ...prev, status: event.target.value as RoomStatus }))}
            className="w-full rounded-lg border-2 border-indigo-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-indigo-700 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all"
          >
            {(Object.keys(statusMeta) as RoomStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusMeta[status].label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => onChange((prev) => ({ ...prev, isActive: event.target.checked }))}
              className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4 text-zinc-500" />
              Active room (visible for booking)
            </span>
          </label>
        </div>

        <div className="md:col-span-2 flex gap-3 pt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-70 transition-all border-2 border-indigo-400"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {editingRoomId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingRoomId ? "Update Room" : "Create Room"}
              </span>
            )}
          </motion.button>
          {editingRoomId && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border-2 border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-200 dark:hover:bg-indigo-800 transition-all bg-white dark:bg-slate-900"
            >
              Cancel Edit
            </motion.button>
          )}
        </div>
      </form>
    </motion.section>
  );
}

function BulkRoomAutoGenerator({ onRoomsCreated }: { onRoomsCreated: () => void }) {
  const [buildingName, setBuildingName] = useState("");
  const [buildingCode, setBuildingCode] = useState("");
  const [floor, setFloor] = useState(0);
  const [numRooms, setNumRooms] = useState(1);
  const [roomPrefix, setRoomPrefix] = useState("");
  const [capacity, setCapacity] = useState(40);
  const [roomType, setRoomType] = useState("lecture");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!buildingName || !buildingCode || !numRooms || numRooms < 1) {
      setError("Please fill all fields and enter a valid number of rooms.");
      return;
    }

    const prefix = roomPrefix || buildingCode;
    // Get institutionId from localStorage (JWT) or fallback
    let institutionId = "";
    if (typeof window !== "undefined") {
      const storedToken = window.localStorage.getItem("roomManagerToken");
      if (storedToken) {
        try {
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          if (payload && payload.institutionId) {
            institutionId = payload.institutionId;
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
    }
    const rooms = Array.from({ length: numRooms }, (_, i) => {
      const code = `${prefix.trim().toUpperCase()} ${String(i + 1).padStart(3, "0")}`;
      return {
        institutionId,
        buildingCode: buildingCode.trim().toUpperCase(),
        roomCode: code,
        name: `${buildingName} Room ${i + 1}`,
        capacity: capacity,
        type: roomType,
        floor: Number(floor),
        status: "free" as RoomStatus,
        isActive: true,
      };
    });

    setIsSaving(true);
    try {
      const response = await fetch("/api/rooms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms }),
      });
      
      if (!response.ok) throw new Error("Failed to create rooms");
      
      setSuccess(`${numRooms} rooms generated successfully!`);
      onRoomsCreated();
      
      setBuildingName("");
      setBuildingCode("");
      setNumRooms(1);
      setRoomPrefix("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-indigo-950 dark:to-cyan-950 shadow-xl overflow-hidden"
    >
      <button
        onClick={() => setShowGenerator(!showGenerator)}
        className="w-full px-6 py-4 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 transition-colors border-b-2 border-indigo-200 dark:border-indigo-800"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-lg">
            <Zap className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-indigo-700 dark:text-cyan-300">Bulk Room Generator</h2>
            <p className="text-xs text-zinc-700 dark:text-zinc-300">Create multiple rooms at once</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: showGenerator ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="h-5 w-5 text-indigo-600 dark:text-cyan-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {showGenerator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Building Name
                  </label>
                  <input
                    value={buildingName}
                    onChange={e => setBuildingName(e.target.value)}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                    placeholder="e.g., Human Resource Development"
                  />
                </div>
                
                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Building Code
                  </label>
                  <input
                    value={buildingCode}
                    onChange={e => setBuildingCode(e.target.value)}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                    placeholder="e.g., HRD"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Room Prefix (optional)
                  </label>
                  <input
                    value={roomPrefix}
                    onChange={e => setRoomPrefix(e.target.value)}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                    placeholder="Leave empty to use building code"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Floor
                  </label>
                  <select
                    value={floor}
                    onChange={e => setFloor(Number(e.target.value))}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                  >
                    {floorOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Number of Rooms
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={numRooms}
                    onChange={e => setNumRooms(Number(e.target.value))}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Capacity per Room
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={e => setCapacity(Number(e.target.value))}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-indigo-700 dark:text-cyan-200">
                    Room Type
                  </label>
                  <select
                    value={roomType}
                    onChange={e => setRoomType(e.target.value)}
                    className="w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 px-3 py-2 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm transition-all"
                  >
                    {roomTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setShowGenerator(false)}
                  className="px-6 py-2 rounded-lg border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-cyan-300 dark:hover:bg-indigo-800 transition-all bg-white dark:bg-slate-900"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-semibold shadow-lg hover:from-indigo-700 hover:to-cyan-700 disabled:opacity-70 transition-all border-2 border-indigo-400"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Generate {numRooms} Rooms
                    </span>
                  )}
                </motion.button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-rose-50 border-2 border-rose-300 text-rose-700 text-sm flex items-center gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {success}
                </motion.div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ==================== MAIN CONTENT COMPONENT ====================

function RoomManagerContent() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [form, setForm] = useState<RoomForm>(initialForm);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RoomFormErrors>({});
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  
  // Authentication state
  const [adminId, setAdminId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState("");

  // Helper function for countdown display
  const getCountdown = (bookingEndTime: string) => {
    try {
      const end = new Date(bookingEndTime);
      const now = new Date();
      const diffMs = end.getTime() - now.getTime();
      
      if (diffMs <= 0) return "Ended";
      
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins} min remaining`;
      
      const diffHours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${diffHours}h ${mins}m remaining`;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAdminId = window.localStorage.getItem("adminId");
      const storedToken = window.localStorage.getItem("roomManagerToken");
      setAdminId(storedAdminId);
      setToken(storedToken);
      // Decode JWT to get institutionId
      if (storedToken) {
        try {
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          if (payload && payload.institutionId) {
            setForm((prev) => ({ ...prev, institutionId: payload.institutionId }));
          }
        } catch (e) {
          // Ignore decode errors
        }
      }
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const headers: Record<string, string> = {};
      if (adminId) headers["x-admin-id"] = adminId;
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const response = await fetch("/api/rooms", {
        method: "GET",
        cache: "no-store",
        headers,
      });
      const payload = await response.json();
      setDebugInfo({ status: response.status, ok: response.ok, payload });
      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to load rooms.");
        return;
      }
      setRooms(payload.data?.rooms ?? []);
    } catch (e) {
      setError("Failed to load rooms.");
      setDebugInfo({ error: e });
    } finally {
      setIsLoading(false);
    }
  }, [adminId, token]);

  useEffect(() => {
    if (token) {
      void loadRooms();
    }
  }, [loadRooms, token]);

  // Reset form function
  const resetForm = () => {
    setForm({
      ...initialForm,
      institutionId: form.institutionId, // Preserve institutionId
    });
    setEditingRoomId(null);
    setFieldErrors({});
    setShowForm(false);
  };

  // Get unique building codes
  const buildingCodes = useMemo(() => {
    const codes = rooms.map(room => room.buildingCode);
    return [...new Set(codes)].sort();
  }, [rooms]);

  // Calculate total floors (unique floor numbers across all buildings)
  const totalFloors = useMemo(() => {
    const floors = rooms.map(room => room.floor);
    return new Set(floors).size;
  }, [rooms]);

  // Filter rooms based on search and building filter
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      // Search filter
      const matchesSearch = search === "" || 
        room.roomCode.toLowerCase().includes(search.toLowerCase()) ||
        room.name.toLowerCase().includes(search.toLowerCase()) ||
        room.buildingCode.toLowerCase().includes(search.toLowerCase()) ||
        room.type.toLowerCase().includes(search.toLowerCase()) ||
        room.status.toLowerCase().includes(search.toLowerCase());
      
      // Building filter
      const matchesBuilding = showAll || selectedBuilding === room.buildingCode;
      
      return matchesSearch && matchesBuilding;
    });
  }, [rooms, search, showAll, selectedBuilding]);

  // Group rooms by building and floor
  const groupedBuildings = useMemo(() => {
    const buildingMap = new Map<string, BuildingGroup>();
    
    filteredRooms.forEach(room => {
      if (!buildingMap.has(room.buildingCode)) {
        buildingMap.set(room.buildingCode, {
          buildingCode: room.buildingCode,
          rooms: [],
          floors: [],
        });
      }
      buildingMap.get(room.buildingCode)!.rooms.push(room);
    });

    // Sort rooms within each building and group by floor
    buildingMap.forEach(group => {
      // Sort rooms by floor then by room code
      group.rooms.sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.roomCode.localeCompare(b.roomCode);
      });

      // Group by floor
      const floorMap = new Map<number, RoomRecord[]>();
      group.rooms.forEach(room => {
        if (!floorMap.has(room.floor)) {
          floorMap.set(room.floor, []);
        }
        floorMap.get(room.floor)!.push(room);
      });

      group.floors = Array.from(floorMap.entries())
        .map(([floor, rooms]) => ({ floor, rooms }))
        .sort((a, b) => a.floor - b.floor);
    });

    return Array.from(buildingMap.values()).sort((a, b) => 
      a.buildingCode.localeCompare(b.buildingCode)
    );
  }, [filteredRooms]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});

    const payload = {
      institutionId: form.institutionId,
      buildingCode: form.buildingCode,
      roomCode: form.roomCode,
      name: form.name,
      capacity: parseInt(form.capacity, 10),
      type: form.type,
      floor: parseInt(form.floor, 10),
      status: form.status,
      isActive: form.isActive,
    };

    try {
      setIsSaving(true);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminId) headers["x-admin-id"] = adminId;
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const response = await fetch(editingRoomId ? `/api/rooms/${editingRoomId}` : "/api/rooms", {
        method: editingRoomId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      
      const result = (await response.json()) as {
        data?: { room?: RoomRecord };
        error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      };
      
      if (!response.ok) {
        const apiFieldErrors = result.error?.details?.fieldErrors;
        if (apiFieldErrors) {
          const nextErrors: RoomFormErrors = {};
          if (apiFieldErrors.institutionId?.[0]) nextErrors.institutionId = apiFieldErrors.institutionId[0];
          if (apiFieldErrors.buildingCode?.[0]) nextErrors.buildingCode = apiFieldErrors.buildingCode[0];
          if (apiFieldErrors.roomCode?.[0]) nextErrors.roomCode = apiFieldErrors.roomCode[0];
          if (apiFieldErrors.name?.[0]) nextErrors.name = apiFieldErrors.name[0];
          if (apiFieldErrors.capacity?.[0]) nextErrors.capacity = apiFieldErrors.capacity[0];
          if (apiFieldErrors.type?.[0]) nextErrors.type = apiFieldErrors.type[0];
          if (apiFieldErrors.floor?.[0]) nextErrors.floor = apiFieldErrors.floor[0];
          setFieldErrors(nextErrors);
        }
        // Show backend error message clearly
        setError(result.error?.message ?? "Failed to save room.");
        return;
      }

      setSuccess(editingRoomId ? "Room updated successfully!" : "Room created successfully!");
      resetForm();
      await loadRooms();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save room.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (room: RoomRecord) => {
    setEditingRoomId(room.id);
    setForm({
      institutionId: room.institutionId,
      buildingCode: room.buildingCode,
      roomCode: room.roomCode,
      name: room.name,
      capacity: String(room.capacity),
      type: room.type,
      floor: String(room.floor),
      status: room.status,
      isActive: room.isActive,
    });
    setFieldErrors({});
    setError("");
    setSuccess("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Building Section Component with fixed visibility
  const BuildingSection = ({ group, onEdit, onDelete }: { group: BuildingGroup; onEdit?: (room: RoomRecord) => void; onDelete?: (room: RoomRecord) => void }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Calculate availability percentage for building
    const totalRooms = group.rooms.length;
    const freeRooms = group.rooms.filter(r => r.status === "free").length;
    const availablePct = totalRooms > 0 ? Math.round((freeRooms / totalRooms) * 100) : 0;

    // Helper for status counts per floor
    function getStatusCounts(rooms: RoomRecord[]) {
      const counts: Record<RoomStatus, number> = { free: 0, reserved: 0, occupied: 0, unavailable: 0 };
      rooms.forEach(r => counts[r.status]++);
      return counts;
    }

    return (
      <div className="mb-8 bg-indigo-50/50 dark:bg-slate-900 rounded-xl p-5 border-2 border-indigo-300 dark:border-indigo-700 shadow-md hover:shadow-lg transition-all">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left focus:outline-none group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-indigo-800 dark:text-cyan-300">
                Building: {group.buildingCode} 
                <span className="ml-2 text-base font-normal text-zinc-600 dark:text-zinc-400">
                  [{availablePct}% Available]
                </span>
              </h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {group.floors.length} floors • {group.rooms.length} rooms
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-5 w-5 text-indigo-600 dark:text-cyan-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-6 space-y-6">
                {group.floors.map(({ floor, rooms }) => {
                  const statusCounts = getStatusCounts(rooms);
                  return (
                    <div key={floor} className="space-y-3">
                      <h3 className="text-md font-semibold text-zinc-800 dark:text-zinc-200 flex items-center bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-lg border-2 border-indigo-300 dark:border-indigo-700">
                        <Layers className="h-4 w-4 mr-2 text-indigo-600 dark:text-cyan-400" />
                        {`Floor ${floor}`} 
                        <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">[
                          {statusCounts.free} Free
                          {statusCounts.reserved ? `, ${statusCounts.reserved} Reserved` : ''}
                          {statusCounts.occupied ? `, ${statusCounts.occupied} Occupied` : ''}
                          {statusCounts.unavailable ? `, ${statusCounts.unavailable} Unavailable` : ''}
                        ]</span>
                      </h3>
                      {rooms.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic p-4 bg-zinc-100 dark:bg-slate-800 rounded-lg border-2 border-zinc-200 dark:border-zinc-700">
                          No rooms on this floor
                        </p>
                      ) : (
                        <ul className="pl-6 border-l-2 border-indigo-300 dark:border-indigo-700">
                          {rooms.map((room, idx) => {
                            // Show countdown if reserved/occupied and bookingEndTime is present
                            let countdown = null;
                            if ((room.status === "reserved" || room.status === "occupied") && room.bookingEndTime) {
                              countdown = getCountdown(room.bookingEndTime);
                            }
                            // Alternate background: even = white, odd = gray-50
                            const cardBg = idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-gray-50 dark:bg-slate-800";
                            return (
                              <li key={room.id} className="mb-3">
                                <div className={`flex items-center gap-3 ${cardBg} border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-3 shadow-md hover:shadow-lg transition-all`}>
                                  <span className="font-mono font-bold text-indigo-900 dark:text-cyan-200 min-w-[100px] text-base">
                                    {room.roomCode}
                                  </span>
                                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusMeta[room.status]?.badge || 'bg-zinc-100 text-zinc-700 border border-zinc-300'}`}>
                                    {statusMeta[room.status]?.label || room.status}
                                  </span>
                                  <span className="text-sm text-zinc-800 dark:text-zinc-200 flex-1 font-medium">
                                    {room.name}
                                  </span>
                                  <span className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-slate-800 px-3 py-1 rounded-full border-2 border-zinc-200 dark:border-zinc-700">
                                    {room.type}
                                  </span>
                                  {countdown && (
                                    <span className="text-xs text-blue-600 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border-2 border-blue-200 dark:border-blue-800">
                                      {countdown}
                                    </span>
                                  )}
                                  {onEdit && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(room);
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors border border-indigo-300 dark:border-indigo-700"
                                    >
                                      <Edit className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    </button>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{authError}</p>
          <p className="text-sm text-zinc-500 mt-2">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border-2 border-red-300 text-red-700 p-4 rounded-xl shadow-lg">
          <h2 className="font-bold text-lg mb-2">Error Loading Rooms</h2>
          <p>{error}</p>
          {debugInfo && (
            <pre className="mt-4 bg-white text-xs p-3 rounded-lg overflow-x-auto max-w-full border border-red-200">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6 p-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl border-4 border-indigo-400 dark:border-indigo-800">
        <div className="absolute inset-0 bg-grid-white/[0.1] bg-[length:16px_16px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative px-8 py-12">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm border-2 border-white/30">
              <Building2 className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Room Manager
              </h1>
              <p className="mt-2 text-lg text-white/90">
                Effortlessly manage and organize campus facilities
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants}>
        <QuickStats rooms={rooms} buildingCodes={buildingCodes} totalFloors={totalFloors} />
      </motion.div>

      {/* Action Bar */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all border-2 border-indigo-400"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Hide Form" : "Add Room"}
          </motion.button>
          
          <div className="flex items-center gap-1 rounded-lg border-2 border-indigo-300 p-1 dark:border-indigo-700 bg-white dark:bg-slate-900">
            <button 
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-white" : "text-zinc-500"}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${viewMode === "list" ? "bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-white" : "text-zinc-500"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg border-2 border-indigo-300 p-1">
          <button className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors">
            <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </button>
          <button className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors">
            <Upload className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </button>
          <motion.button
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
            onClick={() => loadRooms()}
            className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </motion.button>
        </div>
      </motion.div>

      {/* Form Section */}
      <AnimatePresence>
        {showForm && (
          <RoomFormSection
            form={form}
            fieldErrors={fieldErrors}
            onChange={(updater) => setForm(updater)}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            editingRoomId={editingRoomId}
            onCancelEdit={resetForm}
          />
        )}
      </AnimatePresence>

      {/* Bulk Generator */}
      <motion.div variants={itemVariants}>
        <BulkRoomAutoGenerator onRoomsCreated={loadRooms} />
      </motion.div>

      {/* Search and Filters */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="rounded-xl border-2 border-indigo-300 bg-white/90 p-4 shadow-sm dark:border-indigo-700 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rooms by code, name, type, status, or building..."
              className="w-full rounded-lg border-2 border-indigo-300 bg-white pl-10 pr-10 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-indigo-700 dark:bg-slate-950/80 dark:focus:ring-indigo-800 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors border border-indigo-300 dark:border-indigo-700"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <StatusLegend />

        {/* Building Filters */}
        <div className="rounded-xl border-2 border-indigo-300 bg-white/90 p-4 shadow-sm dark:border-indigo-700 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">FILTER BY BUILDING</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowAll(true);
                setSelectedBuilding(null);
              }}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-all border-2 ${
                showAll 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                  : "bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:bg-slate-800 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-slate-700"
              }`}
            >
              ALL BUILDINGS
            </motion.button>
            {buildingCodes.map((buildingCode) => (
              <motion.button
                key={buildingCode}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedBuilding(buildingCode);
                  setShowAll(false);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-all border-2 ${
                  !showAll && selectedBuilding === buildingCode
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                    : "bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:bg-slate-800 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-slate-700"
                }`}
              >
                {buildingCode}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 bg-white/90 dark:bg-slate-900/90 rounded-xl border-2 border-indigo-300"
        >
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Loading rooms...</p>
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 rounded-lg bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          {success}
        </motion.div>
      )}

      {/* Buildings Grid */}
      {!isLoading && (
        <motion.section variants={itemVariants} className="space-y-4">
          {groupedBuildings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 rounded-xl border-4 border-dashed border-indigo-300 bg-white/90 dark:border-indigo-700 dark:bg-slate-900/90"
            >
              <Building2 className="h-12 w-12 text-indigo-400 mb-4" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2 font-medium">No rooms match your current filters</p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedBuilding(null);
                  setShowAll(true);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-lg border-2 border-indigo-300"
              >
                Clear all filters
              </button>
            </motion.div>
          ) : (
            groupedBuildings.map((group) => (
              <BuildingSection
                key={group.buildingCode}
                group={group}
                onEdit={startEdit}
                onDelete={undefined}
              />
            ))
          )}
        </motion.section>
      )}

      {/* Summary Footer */}
      <motion.section
        variants={itemVariants}
        className="rounded-xl border-2 border-indigo-300 bg-white/90 p-5 shadow-sm dark:border-indigo-700 dark:bg-slate-950/80 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
            <MapIcon className="h-3 w-3" />
            CAMPUS OVERVIEW
          </p>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-indigo-300 dark:border-indigo-700">
            Last updated {new Date().toLocaleTimeString()}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(statusMeta) as RoomStatus[]).map((status) => {
            const total = rooms.length || 1;
            const count = rooms.filter(r => r.status === status).length;
            const percentage = Math.round((count / total) * 100);

            return (
              <div key={status} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border-2 border-indigo-300 dark:border-indigo-700">
                <div className={`p-2 rounded-lg ${statusMeta[status].lightBg} ${statusMeta[status].darkBg} border border-indigo-200 dark:border-indigo-800`}>
                  <span className={statusMeta[status].color}>{statusMeta[status].icon}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{statusMeta[status].label}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {count} <span className="text-xs font-normal text-zinc-500">({percentage}%)</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t-2 border-indigo-300 dark:border-indigo-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                TOTAL ROOMS: <span className="text-indigo-600 text-lg ml-1">{rooms.length}</span>
              </p>
              <span className="text-zinc-400 hidden sm:inline">|</span>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                BUILDINGS: <span className="text-indigo-600 text-lg ml-1">{buildingCodes.length}</span>
              </p>
              <span className="text-zinc-400 hidden sm:inline">|</span>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                FLOORS: <span className="text-indigo-600 text-lg ml-1">{totalFloors}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border-2 border-indigo-300">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {rooms.filter(r => r.isActive).length} active rooms
              </span>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

// ==================== MAIN EXPORT ====================

export default function RoomManagerPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("roomManagerToken") : null;
    if (!token) {
      setIsAuthenticated(false);
      setAuthChecked(true);
      router.replace("/admin/space-admin/login");
      return;
    }
    setIsAuthenticated(true);
    setAuthChecked(true);
  }, [router]);

  if (!authChecked) return null;
  if (!isAuthenticated) return null;

  return <RoomManagerContent />;
}