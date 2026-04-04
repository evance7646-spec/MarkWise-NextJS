"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings2, Eye, EyeOff, LogOut } from "lucide-react";
import { useSuperAdmin } from "../../context";

const inp =
  "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

export default function SettingsPage() {
  const admin = useSuperAdmin();

  // Profile form
  const [fullName, setFullName]   = useState(admin?.fullName ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurr]  = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConf]  = useState(false);
  const [savingPw, setSavingPw]     = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!fullName.trim()) return setProfileMsg({ type: "err", text: "Name cannot be empty." });
    setSavingProfile(true);
    try {
      const r = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) return setProfileMsg({ type: "err", text: d.error ?? "Update failed." });
      setProfileMsg({ type: "ok", text: "Profile updated successfully." });
    } catch {
      setProfileMsg({ type: "err", text: "Network error." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPw || !newPw || !confirmPw) return setPwMsg({ type: "err", text: "All fields are required." });
    if (newPw.length < 6)         return setPwMsg({ type: "err", text: "New password must be at least 6 characters." });
    if (newPw !== confirmPw)      return setPwMsg({ type: "err", text: "Passwords do not match." });
    setSavingPw(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const d = await r.json();
      if (!r.ok) return setPwMsg({ type: "err", text: d.error ?? "Password change failed." });
      setPwMsg({ type: "ok", text: "Password changed successfully." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch {
      setPwMsg({ type: "err", text: "Network error." });
    } finally {
      setSavingPw(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/super/login";
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Manage your super-admin account</p>
      </div>

      {/* Account info */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-violet-400" />
          Account Info
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Email</dt>
            <dd className="text-slate-200 font-mono text-xs">{admin?.email ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Role</dt>
            <dd>
              <span className="inline-flex items-center rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-300">
                {admin?.role?.replace(/_/g, " ") ?? "—"}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-400">Admin ID</dt>
            <dd className="text-slate-500 font-mono text-xs">{admin?.id ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Profile */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Update Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className={lbl}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className={inp}
            />
          </div>
          <AnimatePresence>
            {profileMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-lg px-3 py-2 text-xs ${
                  profileMsg.type === "ok"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {profileMsg.text}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {[
            { label: "Current Password", value: currentPw, onChange: setCurrentPw, show: showCurrent, toggle: () => setShowCurr(v => !v) },
            { label: "New Password",     value: newPw,     onChange: setNewPw,     show: showNew,     toggle: () => setShowNew(v => !v) },
            { label: "Confirm New Password", value: confirmPw, onChange: setConfirmPw, show: showConfirm, toggle: () => setShowConf(v => !v) },
          ].map(({ label, value, onChange, show, toggle }) => (
            <div key={label}>
              <label className={lbl}>{label}</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  placeholder="••••••••"
                  className={`${inp} pr-10`}
                />
                <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <AnimatePresence>
            {pwMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-lg px-3 py-2 text-xs ${
                  pwMsg.type === "ok"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {pwMsg.text}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPw}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50 transition-colors"
            >
              {savingPw ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Sign out */}
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
        <h2 className="text-sm font-semibold text-red-400 mb-2">Sign Out</h2>
        <p className="text-xs text-slate-400 mb-4">You will be redirected to the super-admin login page.</p>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl border border-red-800/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
