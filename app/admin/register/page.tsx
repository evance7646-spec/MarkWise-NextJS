"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { FormField, AlertBanner } from "@/app/components/ui/form";

type Role =
  | "institution_admin"
  | "department_admin"
  | "compliance_admin"
  | "faculty_admin"
  | "registry_admin"
  | "space_admin";

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
    value: "institution_admin",
    label: "Institution Admin",
    description: "Manage an entire institution — departments, courses & staff.",
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
    value: "department_admin",
    label: "Department Admin",
    description: "Oversee a specific department within an institution.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: "text-purple-300",
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    needsInstitution: true,
    needsDepartment: true,
    canCreateInstitution: false,
  },
  {
    value: "faculty_admin",
    label: "Faculty Admin",
    description: "Manage faculty members and academic scheduling.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
    color: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: false,
  },
  {
    value: "registry_admin",
    label: "Registry Admin",
    description: "Handle student records, enrolment & official documentation.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "text-teal-300",
    border: "border-teal-500/40",
    bg: "bg-teal-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: false,
  },
  {
    value: "compliance_admin",
    label: "Compliance Admin",
    description: "Monitor regulatory compliance, audits & policy enforcement.",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: "text-green-300",
    border: "border-green-500/40",
    bg: "bg-green-500/10",
    needsInstitution: true,
    needsDepartment: false,
    canCreateInstitution: false,
  },
  {
    value: "space_admin",
    label: "Space Admin",
    description: "Manage room bookings, facilities & physical resources.",
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
  institution_admin: "/admin/institution-admin/dashboard",
  department_admin:  "/admin/department-admin/dashboard",
  compliance_admin:  "/admin/compliance-admin/dashboard",
  faculty_admin:     "/admin/faculty-admin/dashboard",
  registry_admin:    "/admin/registry-admin/dashboard",
  space_admin:       "/admin/space-admin/dashboard",
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
  const [createInstitution, setCreateInstitution] = useState(true); // institution_admin only
  const [institutionId, setInstitutionId] = useState("");
  const [institutionName, setInstitutionName] = useState("");

  // Department fields (department_admin)
  const [departmentName, setDepartmentName] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // showPassword is now handled per-field inside the Input component

  const handleRoleSelect = (option: RoleOption) => {
    setSelectedRole(option);
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
    const body: Record<string, string> = { fullName, email, password, role };

    if (role === "institution_admin") {
      if (createInstitution) {
        body.institutionName = institutionName;
      } else {
        body.institutionId = institutionId;
      }
    } else if (role === "department_admin") {
      body.institutionId = institutionId;
      body.departmentName = departmentName;
    } else {
      // compliance, faculty, registry, space
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

              {/* institution_admin: create or join */}
              {selectedRole.value === "institution_admin" && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-200">Institution</p>
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

              {/* department_admin: institution ID + department name */}
              {selectedRole.value === "department_admin" && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-200">Institution & Department</p>
                  <Input
                    type="text"
                    theme="dark"
                    required
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    placeholder="Institution ID (provided by institution admin)"
                  />
                  <Input
                    type="text"
                    theme="dark"
                    required
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="Department name (e.g. Computer Science)"
                  />
                </div>
              )}

              {/* Other institution-level roles: just institution ID */}
              {selectedRole.needsInstitution && !selectedRole.canCreateInstitution && selectedRole.value !== "department_admin" && (
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                  <FormField>
                    <Label htmlFor="reg-inst-id" theme="dark">Institution ID</Label>
                    <Input
                      id="reg-inst-id"
                      type="text"
                      theme="dark"
                      required
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      placeholder="Institution ID (provided by institution admin)"
                    />
                    <p className="text-xs text-slate-500 mt-0.5">Contact your Institution Admin to obtain this ID.</p>
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
