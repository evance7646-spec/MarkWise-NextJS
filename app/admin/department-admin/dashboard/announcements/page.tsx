"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Send, Users, GraduationCap, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useAdmin } from "../../context";

type Audience = "all" | "students" | "lecturers";
type Announcement = { id: string; title: string; message: string; audience: Audience; sentAt: string; status: "sent" | "failed" };

const AUDIENCE_OPTS: { value: Audience; label: string; icon: React.ElementType; color: string }[] = [
  { value: "all",       label: "Everyone",  icon: Users,         color: "text-indigo-400" },
  { value: "students",  label: "Students",  icon: Users,         color: "text-emerald-400" },
  { value: "lecturers", label: "Lecturers", icon: GraduationCap, color: "text-violet-400" },
];

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function AnnouncementsPage() {
  const admin = useAdmin();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<Announcement[]>([]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { setError("Title and message are required."); return; }
    setSending(true); setError(""); setSuccess("");

    const payload = {
      title,
      message,
      audience,
      departmentId: admin?.departmentId,
      sentBy: admin?.id,
    };

    // Post to notifications send endpoint
    const res = await fetch("/api/notifications/send", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res || !res.ok) {
      // Store as local record even if push fails
      setHistory(h => [{
        id: Date.now().toString(), title, message, audience, sentAt: new Date().toISOString(), status: "failed"
      }, ...h]);
      setError("Could not deliver push notifications, but announcement was recorded.");
    } else {
      setHistory(h => [{
        id: Date.now().toString(), title, message, audience, sentAt: new Date().toISOString(), status: "sent"
      }, ...h]);
      setSuccess("Announcement sent successfully.");
      setTitle(""); setMessage("");
    }
    setSending(false);
  };

  const audienceLabel = (a: Audience) => AUDIENCE_OPTS.find(o => o.value === a)?.label ?? a;
  const relativeTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Announcements</h1>
        <p className="text-sm text-slate-500 mt-0.5">Broadcast messages to students, lecturers, or everyone in your department</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Compose */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-slate-200">New Announcement</h2>
          </div>

          <div className="space-y-4">
            {/* Audience selector */}
            <div>
              <label className={lbl}>Send To</label>
              <div className="flex gap-2">
                {AUDIENCE_OPTS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button key={opt.value} onClick={() => setAudience(opt.value)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                        audience === opt.value
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                          : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}>
                      <Icon className={`h-3.5 w-3.5 ${audience === opt.value ? "text-indigo-400" : opt.color}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={lbl}>Title *</label>
              <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Class Rescheduled — Monday 14th April" maxLength={120} />
              <p className="text-xs text-slate-600 mt-1">{title.length}/120</p>
            </div>

            <div>
              <label className={lbl}>Message *</label>
              <textarea className={`${inp} h-28 resize-none`} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your announcement here…" maxLength={500} />
              <p className="text-xs text-slate-600 mt-1">{message.length}/500</p>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />{success}
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={handleSend} disabled={sending || !title || !message}
            className="mt-5 flex items-center justify-center gap-2 w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : `Send to ${audienceLabel(audience)}`}
          </button>
        </div>

        {/* History */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-200">Recent Announcements</h2>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-700">
              <Bell className="h-10 w-10 mb-2" />
              <p className="text-sm">No announcements sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {history.map(item => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    className="rounded-xl border border-slate-800 bg-slate-800/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 leading-tight truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.message}</p>
                      </div>
                      {item.status === "sent"
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      }
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{audienceLabel(item.audience)}</span>
                      <span className="text-xs text-slate-600">{relativeTime(item.sentAt)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
