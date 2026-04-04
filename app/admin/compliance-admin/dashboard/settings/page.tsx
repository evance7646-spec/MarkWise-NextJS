"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings2, User, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, Building2 } from "lucide-react";
import { useComplianceAdmin } from "../../context";

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function ComplianceAdminSettings() {
  const admin = useComplianceAdmin();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!admin) return;
    setFullName(admin.fullName);
    setEmail(admin.email);
  }, [admin]);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const data = await r.json();
      if (!r.ok) { setProfileMsg({ ok: false, text: data.error ?? "Failed to save" }); }
      else { setProfileMsg({ ok: true, text: "Profile updated successfully" }); }
    } catch { setProfileMsg({ ok: false, text: "Network error" }); }
    finally { setProfileSaving(false); }
  };

  const changePassword = async () => {
    if (!newPw || newPw.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters" }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "Passwords do not match" }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await r.json();
      if (!r.ok) { setPwMsg({ ok: false, text: data.error ?? "Failed to change password" }); }
      else { setPwMsg({ ok: true, text: "Password changed successfully" }); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    } catch { setPwMsg({ ok: false, text: "Network error" }); }
    finally { setPwSaving(false); }
  };

  const signOut = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/compliance/login";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-slate-400" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Institution info (read-only) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-teal-400" />
          Institution
        </h2>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
          <p className="text-xs text-slate-500 mb-0.5">Institution Name</p>
          <p className="text-sm font-medium text-white">{admin?.institutionName ?? "—"}</p>
        </div>
        <p className="mt-2 text-xs text-slate-600">Institution details can only be changed by a super admin.</p>
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-teal-400" />
          Profile
        </h2>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Full Name</label>
            <input className={inp} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className={lbl}>Email Address</label>
            <input className={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@institution.edu" />
          </div>
          {profileMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
              profileMsg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            }`}>
              {profileMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {profileMsg.text}
            </div>
          )}
          <button
            onClick={saveProfile}
            disabled={profileSaving}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {profileSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* Password */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-teal-400" />
          Change Password
        </h2>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Current Password</label>
            <div className="relative">
              <input className={`${inp} pr-10`} type={showCurrent ? "text" : "password"} value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} placeholder="Current password" />
              <button onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>New Password</label>
            <div className="relative">
              <input className={`${inp} pr-10`} type={showNew ? "text" : "password"} value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 characters" />
              <button onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Confirm New Password</label>
            <input className={inp} type="password" value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
          </div>
          {pwMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
              pwMsg.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
            }`}>
              {pwMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {pwMsg.text}
            </div>
          )}
          <button
            onClick={changePassword}
            disabled={pwSaving}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pwSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Sign Out</h2>
        <p className="text-xs text-slate-400 mb-4">You will be redirected to the login page.</p>
        <button
          onClick={signOut}
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
        >
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}
