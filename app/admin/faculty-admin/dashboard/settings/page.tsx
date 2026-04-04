"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, Building2, Shield, LogOut, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useFacultyAdmin } from "../../context";
import { useRouter } from "next/navigation";

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${type === "success" ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}>
      {type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

export default function FacultySettingsPage() {
  const admin = useFacultyAdmin();
  const router = useRouter();

  const [profileFullName, setProfileFullName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (admin) { setProfileFullName(admin.fullName); setProfileEmail(admin.email); }
  }, [admin]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileFullName.trim()) return;
    setProfileSaving(true); setProfileMsg(null);
    try {
      const res = await fetch("/api/auth/me", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: profileFullName.trim() }) });
      setProfileMsg(res.ok ? { text: "Profile updated successfully", type: "success" } : { text: "Failed to update profile", type: "error" });
    } catch { setProfileMsg({ text: "Network error", type: "error" }); }
    setProfileSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) { setPwMsg({ text: "New passwords do not match", type: "error" }); return; }
    if (newPassword.length < 8) { setPwMsg({ text: "Password must be at least 8 characters", type: "error" }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      if (res.ok) { setPwMsg({ text: "Password changed successfully", type: "success" }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
      else { const d = await res.json().catch(() => ({})) as any; setPwMsg({ text: d.error ?? "Failed to change password", type: "error" }); }
    } catch { setPwMsg({ text: "Network error", type: "error" }); }
    setPwSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/admin/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.push("/faculty/login");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your profile and account security</p>
      </div>

      {/* Institution info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
            <Building2 className="h-4 w-4 text-blue-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200">Institution Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className={lbl}>Institution Name</div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-400 select-all">{admin?.institutionName ?? "—"}</div>
          </div>
          <div>
            <div className={lbl}>Institution ID</div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-400 font-mono select-all truncate">{admin?.institutionId ?? "—"}</div>
          </div>
          <div>
            <div className={lbl}>Role</div>
            <div className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-400 mt-1">
              <Shield className="h-3 w-3 mr-1.5" /> {admin?.role ?? "Faculty Admin"}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10"><User className="h-4 w-4 text-sky-400" /></div>
          <h2 className="text-sm font-semibold text-slate-200">Admin Profile</h2>
        </div>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div><label className={lbl}>Full Name <span className="text-red-400">*</span></label><input value={profileFullName} onChange={e => setProfileFullName(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Email Address</label><input value={profileEmail} disabled className={inp} /></div>
          {profileMsg && <Toast message={profileMsg.text} type={profileMsg.type} />}
          <div className="flex justify-end">
            <button type="submit" disabled={profileSaving || !profileFullName.trim()}
              className="flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors">
              {profileSaving ? "Saving…" : <><Check className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Change password */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10"><Lock className="h-4 w-4 text-amber-400" /></div>
          <h2 className="text-sm font-semibold text-slate-200">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className={lbl}>Current Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inp + " pr-10"} placeholder="Current password" />
              <button type="button" onClick={() => setShowCurrent(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>New Password <span className="text-red-400">*</span></label>
            <div className="relative">
              <input type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inp + " pr-10"} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inp} placeholder="Repeat new password" />
            {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-red-400 mt-1">Passwords do not match</p>}
          </div>
          {pwMsg && <Toast message={pwMsg.text} type={pwMsg.type} />}
          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors">
              {pwSaving ? "Updating…" : <><Lock className="h-4 w-4" /> Update Password</>}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Sign out */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl border border-red-500/20 bg-slate-900 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10"><AlertCircle className="h-4 w-4 text-red-400" /></div>
          <h2 className="text-sm font-semibold text-slate-200">Sign Out</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">You will be redirected to the login page.</p>
        <button onClick={handleLogout} disabled={loggingOut}
          className="flex items-center gap-2 rounded-xl border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 px-4 py-2 text-sm font-medium text-red-400 transition-colors">
          <LogOut className="h-4 w-4" /> {loggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </motion.div>
    </div>
  );
}
