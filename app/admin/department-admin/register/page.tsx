"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";
import { Eye, EyeOff, Building2, ArrowLeft, CheckCircle2 } from "lucide-react";

function strengthScore(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s;
}
const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong", "Very strong"];
const STRENGTH_COLORS = ["bg-red-500","bg-red-500","bg-orange-500","bg-yellow-500","bg-emerald-500","bg-emerald-500"];
const STRENGTH_TEXT   = ["text-red-400","text-red-400","text-orange-400","text-yellow-400","text-emerald-400","text-emerald-400"];

function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [institutionId, setInstitutionId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("");
  const [institutions, setInstitutions] = useState<Array<{id: string; name: string; logoUrl: string}>>([]);
  const [departments, setDepartments] = useState<Array<{id: string; name: string; institutionId: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const score = password ? strengthScore(password) : 0;
  const pwMatch = confirmPassword.length > 0 && password === confirmPassword;
  const pwMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    fetch("/api/institutions").then(r => r.json()).then(data => setInstitutions(data.data || []));
    fetch("/api/departments").then(r => r.json()).then(data => setDepartments(data.data || []));
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (score < 3) { setError("Please choose a stronger password."); return; }
    if (!institutionId) { setError("Please select your institution."); return; }
    setLoading(true);
    let finalDepartmentId = departmentId;
    let departmentName: string | undefined = undefined;
    if (newDepartment.trim()) departmentName = newDepartment.trim();
    try {
      const response = await fetch("/api/auth/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, institutionId, departmentId: finalDepartmentId, departmentName, role: "department_admin" }),
      });
      let payload: { success?: boolean; error?: string } = {};
      try { payload = await response.json(); } catch { setError("Server error: Invalid response."); setLoading(false); return; }
      if (!response.ok || !payload.success) { setError(payload.error || `Unable to create account. [${response.status}]`); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => router.push("/admin/department-admin/dashboard"), 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors";
  const sel = inp + " cursor-pointer";
  const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-950 flex items-center justify-center px-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">MarkWise</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <div className="p-8">
            {success ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">Account created!</h2>
                <p className="text-sm text-slate-400">Redirecting to dashboard…</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 mb-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
                    <Building2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-100">Create Department Account</h1>
                  <p className="text-xs text-slate-500 text-center">Register as a new department admin</p>
                </div>

                <form className="space-y-4" onSubmit={onSubmit}>
                  {/* Full name */}
                  <div>
                    <label className={lbl}>Full Name</label>
                    <input type="text" required placeholder="e.g. Dr. John Doe"
                      value={fullName} onChange={e => setFullName(e.target.value)} className={inp} />
                  </div>

                  {/* Institution */}
                  <div>
                    <label className={lbl}>Institution</label>
                    <select required value={institutionId}
                      onChange={e => { setInstitutionId(e.target.value); setDepartmentId(""); }}
                      className={sel}>
                      <option value="" disabled>Select your institution</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  {institutionId && (
                    <div>
                      <label className={lbl}>Department Name</label>
                      <input type="text" required placeholder="e.g. Computer Science"
                        value={newDepartment}
                        onChange={async e => {
                          const name = e.target.value;
                          setNewDepartment(name);
                          if (name.trim()) {
                            const exists = departments.find(d => d.name.toLowerCase() === name.trim().toLowerCase() && d.institutionId === institutionId);
                            setError(exists ? "This department already exists — it will be linked to your account." : null);
                          } else { setError(null); }
                        }}
                        className={inp} />
                      {error && error.includes("department") && (
                        <p className="mt-1 text-xs text-amber-400 flex items-center gap-1"><span>ℹ</span>{error}</p>
                      )}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label className={lbl}>Email Address</label>
                    <input type="email" required autoComplete="email" placeholder="admin@dept.edu"
                      value={email} onChange={e => setEmail(e.target.value)} className={inp} />
                  </div>

                  {/* Password */}
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required autoComplete="new-password"
                        placeholder="Min. 8 characters" value={password}
                        onChange={e => setPassword(e.target.value)} className={inp + " pr-10"} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? STRENGTH_COLORS[score] : "bg-slate-700"}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-medium ${STRENGTH_TEXT[score]}`}>{STRENGTH_LABELS[score]}</span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                          {[
                            [password.length >= 8, "8+ characters"],
                            [/[A-Z]/.test(password), "Uppercase"],
                            [/[a-z]/.test(password), "Lowercase"],
                            [/[0-9]/.test(password), "Number"],
                            [/[^A-Za-z0-9]/.test(password), "Special char"],
                          ].map(([ok, label], i) => (
                            <span key={i} className={`flex items-center gap-1 ${ok ? "text-emerald-400" : "text-slate-600"}`}>
                              <span>{ok ? "✓" : "○"}</span>{label as string}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className={lbl}>Confirm Password</label>
                    <div className="relative">
                      <input type={showConfirmPassword ? "text" : "password"} required autoComplete="new-password"
                        placeholder="Repeat your password" value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={inp + " pr-10 " + (pwMismatch ? "border-red-500/60" : pwMatch ? "border-emerald-500/60" : "")} />
                      <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showConfirmPassword ? "Hide" : "Show"}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwMismatch && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><span>⚠</span> Passwords do not match</p>}
                    {pwMatch && <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1"><span>✓</span> Passwords match</p>}
                  </div>

                  {/* Error (non-department ones) */}
                  {error && !error.includes("department") && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                      <span className="mt-0.5 shrink-0">⚠</span><span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || pwMismatch}
                    className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200"
                  >
                    {loading
                      ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creating account…</>
                      : "Create Department Account"
                    }
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                  Already have an account?{" "}
                  <Link href="/admin/department-admin/login"
                    className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to MarkWise Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default RegisterPage;
