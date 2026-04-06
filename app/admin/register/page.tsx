"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormField, AlertBanner } from "@/app/components/ui/form";

type Role =
  | "system_admin"
  | "academic_registrar"
  | "facilities_manager";

interface RoleOption {
  value: Role;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  bg: string;
  needsInstitution: boolean;
  needsDepartment: boolean;
  canCreateInstitution: boolean;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: "system_admin",
    label: "System Administrator",
    description: "Onboard and manage an entire institution — departments, staff & settings.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
    color: "text-indigo-300",
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: true,
  },
  {
    value: "academic_registrar",
    label: "Academic Registrar",
    description: "Manage students, lecturers, curriculum, timetable & academic records.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "text-purple-300",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: false,
  },
  {
    value: "facilities_manager",
    label: "Facilities Manager",
    description: "Manage room bookings, reservations and physical space resources.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    color: "text-orange-300",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: false,
  },
];

const ROLE_DASHBOARD: Record<Role, string> = {
  system_admin:       "/admin/system-admin/dashboard",
  academic_registrar: "/admin/academic-registrar/dashboard",
  facilities_manager: "/admin/facilities-manager/dashboard",
};

export default function AdminRegisterPage() {
  const router = useRouter();

  // Step 1: role selection; Step 2: form fields; Step 3: success
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Institution fields
  const [createInstitution, setCreateInstitution] = useState(true); // system_admin only
  const [institutionId, setInstitutionId] = useState("");
  const [institutionName, setInstitutionName] = useState("");

  // Institution picker (academic_registrar / facilities_manager)
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [institutionDropdownOpen, setInstitutionDropdownOpen] = useState(false);
  const institutionInputRef = useRef<HTMLInputElement>(null);

  // Fetch institutions list when entering step 2 for roles that need a picker
  useEffect(() => {
    if (
      step !== 2 ||
      !selectedRole ||
      selectedRole.canCreateInstitution
    ) return;

    setInstitutionsLoading(true);
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((data) => {
        setInstitutions(Array.isArray(data) ? data : (data.data ?? []));
      })
      .catch(() => setInstitutions([]))
      .finally(() => setInstitutionsLoading(false));
  }, [step, selectedRole]);

  // Department fields (kept for API compat, no longer shown in UI)
  const [departmentName, setDepartmentName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // showPassword is now handled per-field inside the Input component

  const handleRoleSelect = (option: RoleOption) => {
    setSelectedRole(option);
    setInstitutionId("");
    setInstitutionSearch("");
    setInstitutionDropdownOpen(false);
    setStep(2);
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const role = selectedRole!.value;

    // For roles that use the institution picker, ensure a selection was made
    if (
      selectedRole!.needsInstitution &&
      !selectedRole!.canCreateInstitution &&
      !institutionId
    ) {
      setError("Please select an institution from the list.");
      return;
    }

    const body: Record<string, string> = { fullName, email, password, role };

    if (role === "system_admin") {
      if (createInstitution) {
        body.institutionName = institutionName;
      } else {
        body.institutionId = institutionId;
      }
    } else {
      // academic_registrar, facilities_manager
      body.institutionId = institutionId;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        admin?: { id: string; email: string; role: string };
      };

      if (!response.ok || !payload.success) {
        setError(payload.error ?? "Registration failed. Please try again.");
        return;
      }

      setRegisteredEmail(payload.admin?.email ?? email);
      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">
            MarkWise
          </span>
        </div>

        {/* ── Step 1: Role Selector ─────────────────────────────────────────── */}
        {step === 1 && (
          <Card theme="dark" noPad className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Registration</h1>
              <p className="text-sm text-slate-400 mt-2">Select your role to get started.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleSelect(option)}
                  className={`group text-left rounded-xl border ${option.border} bg-slate-900 p-5 hover:bg-slate-700/80 focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition-all duration-200`}
                >
                  <div className={`mb-3 ${option.color}`}>{option.icon}</div>
                  <p className={`font-bold text-sm ${option.color}`}>{option.label}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{option.description}</p>
                </button>
              ))}
            </div>

            <p className="mt-8 text-sm text-slate-400 text-center">
              Already have an account?{" "}
              <Link href="/admin/login" className="font-bold text-violet-300 hover:text-violet-200 hover:underline transition-colors">
                Sign in here
              </Link>
            </p>
          </Card>
        )}

        {/* ── Step 2: Registration Form ─────────────────────────────────────── */}
        {step === 2 && selectedRole && (
          <Card theme="dark" noPad className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Back to role selection"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight">
                  Register as {selectedRole.label}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">{selectedRole.description}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              {/* Personal info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField>
                  <Label htmlFor="reg-fullname" theme="dark">Full Name</Label>
                  <Input
                    id="reg-fullname"
                    type="text"
                    theme="dark"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="reg-email" theme="dark">Email Address</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    theme="dark"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@institution.edu"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField>
                  <Label htmlFor="reg-password" theme="dark">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    theme="dark"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="reg-confirm" theme="dark">Confirm Password</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    theme="dark"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </FormField>
              </div>

              {/* system_admin: create or join */}
              {selectedRole.value === "system_admin" && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                  <p className="text-sm font-semibold text-white">Institution</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCreateInstitution(true)}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all ${createInstitution ? "border-violet-500/60 bg-violet-500/20 text-violet-300" : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"}`}
                    >
                      Create new institution
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateInstitution(false)}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-all ${!createInstitution ? "border-violet-500/60 bg-violet-500/20 text-violet-300" : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300"}`}
                    >
                      Join existing institution
                    </button>
                  </div>
                  {createInstitution ? (
                    <Input
                      type="text"
                      theme="dark"
                      required
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="Institution name (e.g. University of Lagos)"
                    />
                  ) : (
                    <Input
                      type="text"
                      theme="dark"
                      required
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      placeholder="Institution ID (provided by your super admin)"
                    />
                  )}
                </div>
              )}

              {/* Other institution-level roles: institution picker */}
              {selectedRole.needsInstitution && !selectedRole.canCreateInstitution && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <FormField>
                    <Label htmlFor="reg-inst-search" theme="dark">Institution</Label>
                    <div className="relative">
                      <input
                        id="reg-inst-search"
                        ref={institutionInputRef}
                        type="text"
                        autoComplete="off"
                        required
                        value={institutionSearch}
                        onChange={(e) => {
                          setInstitutionSearch(e.target.value);
                          setInstitutionId("");
                          setInstitutionDropdownOpen(true);
                        }}
                        onFocus={() => setInstitutionDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setInstitutionDropdownOpen(false), 150)}
                        placeholder={institutionsLoading ? "Loading institutions…" : "Search for your institution…"}
                        disabled={institutionsLoading}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                      />
                      {/* chevron icon */}
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>

                      {/* Dropdown */}
                      {institutionDropdownOpen && !institutionsLoading && (
                        <ul className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl shadow-black/40">
                          {institutions
                            .filter((inst) =>
                              inst.name.toLowerCase().includes(institutionSearch.toLowerCase())
                            )
                            .map((inst) => (
                              <li key={inst.id}>
                                <button
                                  type="button"
                                  onMouseDown={() => {
                                    setInstitutionId(inst.id);
                                    setInstitutionSearch(inst.name);
                                    setInstitutionDropdownOpen(false);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-violet-500/20 hover:text-violet-300 transition-colors"
                                >
                                  {inst.name}
                                </button>
                              </li>
                            ))}
                          {institutions.filter((inst) =>
                            inst.name.toLowerCase().includes(institutionSearch.toLowerCase())
                          ).length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-500">No institutions found.</li>
                          )}
                        </ul>
                      )}
                    </div>
                    {/* Hidden required input so form validation fires when no selection made */}
                    <input type="hidden" name="institutionId" value={institutionId} required />
                    <p className="text-xs text-slate-500 mt-1">
                      Select the institution you will be managing.
                    </p>
                  </FormField>
                </div>
              )}

              {/* Error */}
              {error && <AlertBanner intent="error">{error}</AlertBanner>}

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Create {selectedRole.label} Account
              </Button>

              <p className="text-sm text-slate-400 text-center">
                Already have an account?{" "}
                <Link href="/admin/login" className="font-bold text-violet-300 hover:text-violet-200 hover:underline transition-colors">
                  Sign in
                </Link>
              </p>
            </form>
          </Card>
        )}

        {/* ── Step 3: Success ───────────────────────────────────────────────── */}
        {step === 3 && selectedRole && (
          <Card theme="dark" noPad className="p-8 flex flex-col items-center gap-6">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-500/15 border border-green-500/30">
              <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Account Created!</h2>
              <p className="text-sm text-slate-400 mt-2">
                Your <span className="font-semibold text-violet-300">{selectedRole.label}</span> account for{" "}
                <span className="font-semibold text-white">{registeredEmail}</span> has been created.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => router.push("/admin/login")}
            >
              Sign In to Your Portal
            </Button>
          </Card>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to MarkWise Home
          </Link>
        </div>
      </div>
    </main>
  );
}
