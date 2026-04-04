"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Search, CheckCircle2, XCircle, UserCircle, BookOpen, Building2, Calendar,
} from "lucide-react";
import { useRegistryAdmin } from "../../context";

interface VerifiedStudent {
  id: string; name: string; admissionNumber: string; email: string; year: number;
  course?: { name: string; code: string }; department?: { name: string };
  createdAt?: string;
}

export default function VerificationPage() {
  const admin = useRegistryAdmin();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifiedStudent | null | "notfound">(null);
  const [searched, setSearched] = useState(false);

  const verify = async () => {
    if (!query.trim() || !admin?.institutionId) return;
    setLoading(true); setSearched(true); setResult(null);
    const d = await fetch(
      `/api/students/verify?admissionNumber=${encodeURIComponent(query.trim())}&institutionId=${admin.institutionId}`,
      { credentials: "include" }
    ).then(r => r.ok ? r.json() : null) as any;
    const student = d?.student ?? d?.data ?? (d?.id ? d : null);
    setResult(student ?? "notfound");
    setLoading(false);
  };

  const found = result && result !== "notfound";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-rose-400" /> Student Verification
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Verify a student's identity using their admission number</p>
      </div>

      {/* Search bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <label className="block text-xs font-medium text-slate-400 mb-2">Admission Number</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && verify()}
              placeholder="e.g. CS/2024/001"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50" />
          </div>
          <button onClick={verify} disabled={loading || !query.trim()}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
            {loading ? "Looking up…" : "Verify"}
          </button>
        </div>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-8 flex justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-400">Searching registry…</p>
            </div>
          </motion.div>
        )}

        {!loading && searched && result === "notfound" && (
          <motion.div key="notfound" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15">
              <XCircle className="h-7 w-7 text-rose-400" />
            </div>
            <div>
              <p className="font-semibold text-rose-300">Student Not Found</p>
              <p className="text-sm text-slate-400 mt-0.5">No student with admission number <span className="font-mono text-rose-400">{query}</span> is registered at this institution.</p>
            </div>
          </motion.div>
        )}

        {!loading && found && typeof result === "object" && result !== null && (
          <motion.div key="found" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-slate-900 overflow-hidden">
            {/* Verified banner */}
            <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">VERIFIED — Student record found</span>
            </div>
            {/* Student details */}
            <div className="p-5 flex flex-col sm:flex-row gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 text-2xl font-bold self-start">
                {result.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><UserCircle className="h-3 w-3" /> Full Name</div>
                  <div className="text-slate-100 font-semibold">{result.name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Admission No.</div>
                  <div className="font-mono text-emerald-400 font-medium">{result.admissionNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Course</div>
                  <div className="text-slate-300">{result.course?.name ?? "—"} <span className="text-slate-500 text-xs">({result.course?.code})</span></div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Building2 className="h-3 w-3" /> Department</div>
                  <div className="text-slate-300">{result.department?.name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Email</div>
                  <div className="text-slate-300 text-sm">{result.email}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> Year of Study</div>
                  <div className="text-slate-300">Year {result.year}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
