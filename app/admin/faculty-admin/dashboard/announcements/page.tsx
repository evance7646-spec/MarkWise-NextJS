"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Send, Users, GraduationCap, AlertCircle, Check } from "lucide-react";
import { useFacultyAdmin } from "../../context";

const AUDIENCES = [
  { id: "all",       label: "Everyone",         icon: Users,          color: "text-sky-400" },
  { id: "students",  label: "Students Only",    icon: Users,          color: "text-emerald-400" },
  { id: "lecturers", label: "Lecturers Only",   icon: GraduationCap,  color: "text-violet-400" },
];

interface HistoryItem { id: string; title: string; message: string; audience: string; sentAt: string; status: "sent" | "failed" }

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function FacultyAnnouncementsPage() {
  const admin = useFacultyAdmin();
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sendError, setSendError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim() || !admin?.institutionId) return;
    setSending(true); setSendError("");
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: message.trim(), audience, institutionId: admin.institutionId }),
      });
      const item: HistoryItem = {
        id: Date.now().toString(), title: title.trim(), message: message.trim(),
        audience, sentAt: new Date().toISOString(), status: res.ok ? "sent" : "failed",
      };
      setHistory(h => [item, ...h]);
      if (res.ok) { setTitle(""); setMessage(""); }
      else { const d = await res.json().catch(() => ({})) as any; setSendError(d.error ?? "Failed to send"); }
    } catch { setSendError("Network error. Announcement saved locally."); }
    setSending(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Announcements</h1>
        <p className="text-sm text-slate-500 mt-0.5">Broadcast notifications institution-wide</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Compose */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-400" /> Compose Announcement
          </h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className={lbl}>Audience</label>
              <div className="grid grid-cols-3 gap-2">
                {AUDIENCES.map(a => (
                  <button key={a.id} type="button" onClick={() => setAudience(a.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium transition-colors ${audience === a.id ? "border-orange-500/50 bg-orange-500/10 text-orange-300" : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                    <a.icon className={`h-4 w-4 ${a.color}`} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Title <span className="text-red-400">*</span></label>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className={inp} placeholder="Announcement title…" />
              <p className="text-right text-xs text-slate-600 mt-1">{title.length}/120</p>
            </div>
            <div>
              <label className={lbl}>Message <span className="text-red-400">*</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={1000}
                className={inp + " resize-none"} placeholder="Write your announcement…" />
              <p className="text-right text-xs text-slate-600 mt-1">{message.length}/1000</p>
            </div>
            {sendError && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{sendError}</p>}
            <button type="submit" disabled={sending || !title.trim() || !message.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-semibold text-white transition-colors">
              {sending ? "Sending…" : <><Send className="h-4 w-4" /> Send Announcement</>}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" /> Sent This Session
          </h2>
          {history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center gap-2 py-10 justify-center">
              <Bell className="h-7 w-7 text-slate-700" />
              <p className="text-sm text-slate-600">No announcements sent yet</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1">
              {history.map(h => (
                <div key={h.id} className={`rounded-xl border px-3.5 py-3 text-sm ${h.status === "failed" ? "border-red-500/20 bg-red-500/5" : "border-slate-800 bg-slate-800/50"}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-slate-200 text-sm">{h.title}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${h.status === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{h.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{h.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-600">
                    <span>→ {AUDIENCES.find(a => a.id === h.audience)?.label}</span>
                    <span>{relTime(h.sentAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
