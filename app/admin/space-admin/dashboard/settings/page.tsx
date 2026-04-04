"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Settings2, User, Lock, LogOut, Eye, EyeOff, CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSpaceAdmin } from "../../context";

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function SettingsPage() {
  const admin = useSpaceAdmin();
  const router = useRouter();

  const [fullName, setFullName] = useState(admin?.fullName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileOk, setProfileOk] = useState(false);
  const [profileErr, setProfileErr] = useState("");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [pwErr, setPwErr] = useState("");

  const saveProfile = async () => {
    if (!fullName.trim()) { setProfileErr("Name required"); return; }
    setSavingProfile(true); setProfileErr(""); setProfileOk(false);
    const r = await fetch("/api/auth/me", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName }),
    });
    if (r.ok) { setProfileOk(true); setTimeout(() => setProfileOk(false), 3000); }
    else { const j = await r.json(); setProfileErr(j.error ?? "Failed to update profile"); }
    setSavingProfile(false);
  };

  const changePw = async () => {
    if (!pw.current || !pw.next || !pw.confirm) { setPwErr("All fields required"); return; }
    if (pw.next !== pw.confirm) { setPwErr("New passwords do not match"); return; }
    if (pw.next.length < 8) { setPwErr("Password must be at least 8 characters"); return; }
    setSavingPw(true); setPwErr(""); setPwOk(false);
    const r = await fetch("/api/auth/change-password", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
    });
    if (r.ok) { setPwOk(true); setPw({ current: "", next: "", confirm: "" }); setTimeout(() => setPwOk(false), 3000); }
    else { const j = await r.json(); setPwErr(j.error ?? "Failed to change password"); }
    setSavingPw(false);
  };

  const signOut = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
    router.push("/admin/login");
  };

  const togglePw = (k: keyof typeof showPw) => setShowPw(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-slate-400" /> Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your space admin account</p>
      </div>

      {/* Institution readonly */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Institution</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Institution Name</label>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-400">{admin?.institutionName ?? "—"}</div>
          </div>
          <div>
            <label className={lbl}>Institution ID</label>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 font-mono text-xs text-slate-500 truncate">{admin?.institutionId ?? "—"}</div>
          </div>
        </div>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-orange-400" /> Profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className={inp} placeholder="Your full name" />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-500">{admin?.email ?? "—"}</div>
          </div>
          {profileErr && <p className="text-xs text-rose-400">{profileErr}</p>}
          {profileOk && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Profile updated</p>}
          <button onClick={saveProfile} disabled={savingProfile}
            className="w-full rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-60">
            {savingProfile ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-orange-400" /> Change Password
        </h2>
        <div className="space-y-3">
          {(["current", "next", "confirm"] as const).map(k => (
            <div key={k}>
              <label className={lbl}>
                {k === "current" ? "Current Password" : k === "next" ? "New Password" : "Confirm New Password"}
              </label>
              <div className="relative">
                <input type={showPw[k] ? "text" : "password"} value={pw[k]}
                  onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))}
                  className={inp + " pr-10"}
                  placeholder={k === "next" ? "At least 8 characters" : ""} />
                <button type="button" onClick={() => togglePw(k)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw[k] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          {pwErr && <p className="text-xs text-rose-400">{pwErr}</p>}
          {pwOk && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Password changed</p>}
          <button onClick={changePw} disabled={savingPw}
            className="w-full rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-60">
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </div>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
        <h2 className="text-sm font-semibold text-rose-300 mb-2 flex items-center gap-2">
          <LogOut className="h-4 w-4" /> Sign Out
        </h2>
        <p className="text-xs text-slate-500 mb-4">You will be redirected to the admin login page.</p>
        <button onClick={signOut}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors">
          Sign out of Space Admin
        </button>
      </motion.div>
    </div>
  );
}
