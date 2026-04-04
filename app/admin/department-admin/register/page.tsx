"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";

function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");
  const [institutionId, setInstitutionId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState<string>("");
  const [institutions, setInstitutions] = useState<Array<{id: string; name: string; logoUrl: string;}>>([]);
  const [departments, setDepartments] = useState<Array<{id: string; name: string; institutionId: string}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    fetch("/api/institutions")
      .then((res) => res.json())
      .then((data) => {
        console.log("Institutions API response:", data);
        setInstitutions(data.data || []);
      });
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => setDepartments(data.data || []));
  }, []);

  const validatePasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return "Too short";
    if (!/[A-Z]/.test(pwd)) return "Add uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Add lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Add a number";
    if (!/[^A-Za-z0-9]/.test(pwd)) return "Add a special character";
    return "Strong";
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const strength = validatePasswordStrength(password);
    if (strength !== "Strong") {
      setError("Password is not strong enough: " + strength);
      return;
    }
    setLoading(true);
    if (!institutionId) {
      setError("Please select your institution.");
      setLoading(false);
      return;
    }
    let finalDepartmentId = departmentId;
    let departmentName: string | undefined = undefined;
    if (newDepartment.trim()) {
      departmentName = newDepartment.trim();
      // Always create department in backend, do not set locally
    }
    try {
      const response = await fetch("/api/auth/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          institutionId,
          departmentId: finalDepartmentId,
          departmentName: departmentName,
          role: "department_admin",
        }),
      });
      let payload: any = {};
      try {
        payload = await response.json();
      } catch (e) {
        setError("Server error: Invalid response.");
        setLoading(false);
        return;
      }
      if (!response.ok || !payload.success) {
        // Show detailed backend error if available
        setError(payload.error || `Unable to create account. [${response.status}]`);
        setLoading(false);
        return;
      }
      router.push("/admin/department-admin/dashboard");
      // No localStorage: backend now stores department info, just redirect
      // Redirect to dashboard after successful registration
      // router.push("/admin/department-admin/login");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-slate-950 dark:via-indigo-950 dark:to-cyan-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border-2 border-indigo-100 bg-white/90 shadow-xl p-8 flex flex-col items-center gap-4 dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg mb-2">
          <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 3v4M8 3v4M3 11h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <h1 className="text-2xl font-extrabold text-indigo-700 dark:text-cyan-300 mb-1 tracking-tight">Admin Sign Up</h1>
        <p className="text-sm text-zinc-700 dark:text-zinc-200 text-center">Create an admin account for institution or department operations.</p>
        <form className="mt-6 w-full space-y-4" onSubmit={onSubmit}>

          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Full name
            <input
              type="text"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
            />
          </label>
          <div className="mb-2">
            <span className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200 mb-1">Select Institution</span>
            <select
              className="w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
              value={institutionId}
              onChange={e => { setInstitutionId(e.target.value); setDepartmentId(""); }}
              required
            >
              <option value="" disabled>Select institution</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          {institutionId && (
            <div className="mb-2">
              <span className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200 mb-1">Create Department</span>
              <input
                type="text"
                placeholder="Enter department name"
                value={newDepartment}
                onChange={async e => {
                  const name = e.target.value;
                  setNewDepartment(name);
                  // Check for duplicate department
                  if (name.trim()) {
                    const exists = departments.find(
                      d => d.name.toLowerCase() === name.trim().toLowerCase() && d.institutionId === institutionId
                    );
                    if (exists) {
                      setError('A department with this name already exists in the selected institution. Please select it or use a different name.');
                    } else {
                      setError(null);
                    }
                  } else {
                    setError(null);
                  }
                }}
                className="w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
                name="departmentName"
                required
              />
              {error && error.includes('department') && (
                <span className="text-xs text-red-600 font-semibold mt-1 block">{error}</span>
              )}
            </div>
          )}
          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Password
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                minLength={6}
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setPasswordStrength(validatePasswordStrength(e.target.value));
                }}
                className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 pr-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
              />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" onClick={() => setShowPassword(v => !v)}>
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.402-3.22 1.125-4.575m1.875-2.425A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.402 3.22-1.125 4.575m-1.875 2.425A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.402-3.22 1.125-4.575" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-6 0a6 6 0 1112 0 6 6 0 01-12 0z" /></svg>
                )}
              </button>
            </div>
            {password && (
              <span className={`text-xs font-semibold mt-1 block ${passwordStrength === "Strong" ? "text-green-600" : "text-orange-600"}`}>Strength: {passwordStrength}</span>
            )}
          </label>
          <label className="block text-sm font-semibold text-indigo-700 dark:text-cyan-200">
            Confirm Password
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                minLength={6}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-indigo-100 dark:border-cyan-800 px-3 py-2 pr-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 text-sm"
              />
              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" onClick={() => setShowConfirmPassword(v => !v)}>
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.402-3.22 1.125-4.575m1.875-2.425A9.956 9.956 0 0112 3c5.523 0 10 4.477 10 10 0 1.657-.402 3.22-1.125 4.575m-1.875 2.425A9.956 9.956 0 0112 21c-5.523 0-10-4.477-10-10 0-1.657.402-3.22 1.125-4.575" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-6 0a6 6 0 1112 0 6 6 0 01-12 0z" /></svg>
                )}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <span className="text-xs font-semibold text-red-600 mt-1 block">Passwords do not match</span>
            )}
          </label>
          {error ? <p className="text-sm text-red-600 font-semibold">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 font-bold text-white shadow-lg hover:from-indigo-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-70 transition-all duration-200"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-300">
          Already have an account?{" "}
          <Link href="/admin/department-admin/login" className="font-bold text-indigo-700 dark:text-cyan-300 hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
