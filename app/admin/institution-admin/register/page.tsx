"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Landmark, ArrowLeft, CheckCircle2, Upload } from "lucide-react";

function strengthScore(pwd: string) {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[a-z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  return s; // 0–5
}

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong", "Very strong"];
const STRENGTH_COLORS = [
  "bg-red-500", "bg-red-500", "bg-orange-500",
  "bg-yellow-500", "bg-emerald-500", "bg-emerald-500",
];
const STRENGTH_TEXT = [
  "text-red-400", "text-red-400", "text-orange-400",
  "text-yellow-400", "text-emerald-400", "text-emerald-400",
];

export default function InstitutionSignUpPage() {
  const router = useRouter();
  const [institutionName, setInstitutionName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const score = password ? strengthScore(password) : 0;
  const pwMatch = confirmPassword.length > 0 && password === confirmPassword;
  const pwMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogo(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (score < 3) { setError("Please choose a stronger password."); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("institutionName", institutionName);
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("password", password);
      formData.append("role", "institution_admin");
      if (logo) formData.append("logo", logo);
      const response = await fetch("/api/auth/admin/signup", { method: "POST", body: formData });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Unable to create account.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/admin/institution-admin/login"), 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors";
  const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 flex items-center justify-center px-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-sky-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 shadow-lg shadow-indigo-500/30">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">MarkWise</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-sm shadow-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500" />

          <div className="p-8">
            {success ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">Account created!</h2>
                <p className="text-sm text-slate-400">Redirecting to sign in…</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 mb-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 border border-indigo-500/30">
                    <Landmark className="h-6 w-6 text-indigo-400" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-100">Create Institution Account</h1>
                  <p className="text-xs text-slate-500 text-center">Register your institution on MarkWise</p>
                </div>

                <form className="space-y-4" onSubmit={onSubmit}>
                  {/* Institution Name */}
                  <div>
                    <label className={lbl}>Institution Name</label>
                    <input type="text" required placeholder="e.g. University of Excellence"
                      value={institutionName} onChange={e => setInstitutionName(e.target.value)} className={inp} />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className={lbl}>Your Full Name</label>
                    <input type="text" required placeholder="e.g. Dr. Jane Doe"
                      value={fullName} onChange={e => setFullName(e.target.value)} className={inp} />
                  </div>

                  {/* Email */}
                  <div>
                    <label className={lbl}>Email Address</label>
                    <input type="email" required autoComplete="email" placeholder="admin@institution.edu"
                      value={email} onChange={e => setEmail(e.target.value)} className={inp} />
                  </div>

                  {/* Password */}
                  <div>
                    <label className={lbl}>Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"} required autoComplete="new-password"
                        placeholder="Min. 8 characters" value={password}
                        onChange={e => setPassword(e.target.value)} className={inp + " pr-10"}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Strength meter */}
                    {password && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? STRENGTH_COLORS[score] : "bg-slate-700"}`} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium ${STRENGTH_TEXT[score]}`}>{STRENGTH_LABELS[score]}</span>
                          <span className="text-xs text-slate-600">{score}/5</span>
                        </div>
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

                  {/* Confirm password */}
                  <div>
                    <label className={lbl}>Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"} required autoComplete="new-password"
                        placeholder="Repeat your password" value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={inp + " pr-10 " + (pwMismatch ? "border-red-500/60 focus:ring-red-500/30 focus:border-red-500" : pwMatch ? "border-emerald-500/60 focus:ring-emerald-500/30 focus:border-emerald-500" : "")}
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showConfirmPassword ? "Hide" : "Show"}>
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwMismatch && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><span>⚠</span> Passwords do not match</p>}
                    {pwMatch && <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1"><span>✓</span> Passwords match</p>}
                  </div>

                  {/* Logo upload */}
                  <div>
                    <label className={lbl}>Institution Logo <span className="text-slate-600">(optional)</span></label>
                    {logoPreview ? (
                      <div className="flex items-center gap-3">
                        <img src={logoPreview} alt="Logo preview" className="h-12 w-12 rounded-xl object-cover border border-slate-700" />
                        <button type="button" onClick={() => { setLogo(null); setLogoPreview(null); }}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer w-full rounded-xl border border-dashed border-slate-700 bg-slate-800/40 px-4 py-3 text-sm text-slate-500 hover:border-indigo-500/60 hover:text-slate-400 transition-colors">
                        <Upload className="h-4 w-4 shrink-0" />
                        <span>Click to upload logo</span>
                        <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
                      </label>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                      <span className="mt-0.5 shrink-0">⚠</span><span>{error}</span>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || pwMismatch}
                    className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200"
                  >
                    {loading
                      ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creating account…</>
                      : "Create Institution Account"
                    }
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                  Already have an account?{" "}
                  <Link href="/admin/institution-admin/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
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
