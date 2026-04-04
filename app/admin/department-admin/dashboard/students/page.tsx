"use client";

import type { StudentAuthUser } from "@/lib/studentAuthStore";



type Student = {
  id: string;
  name: string;
  admissionNumber: string;
  courseId?: string;
};

type CourseOption = {
  id: string;
  name: string;
};


const BIOCHEMISTRY_COURSE_ID = "bsc-biochemistry";
const BIOCHEMISTRY_COURSE_NAME = "BSc. Biochemistry";

export default function DepartmentStudentsPage() {
  const [name, setName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [courseId, setCourseId] = useState("");
  const [activeCourseId, setActiveCourseId] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [authUsers, setAuthUsers] = useState<StudentAuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);


  // Get departmentId from backend
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch department info");
        const { department } = await res.json();
        if (department?.id) setDepartmentId(department.id);
      } catch {
        setDepartmentId("");
      }
    })();
  }, []);

  useEffect(() => {
    // Fetch all student auth users for status
    fetch("/api/auth/student/list", { method: "GET" })
      .then((res) => res.ok ? res.json() : { users: [] })
      .then((data) => setAuthUsers(data.users ?? []));
    if (departmentId) {
      loadCoursesFromAPI();
    }
  }, [departmentId]);


  useEffect(() => {
    if (!departmentId) return;
    if (!activeCourseId) {
      // Fetch all students for this department
      (async () => {
        setIsLoading(true);
        setError("");
        try {
          const response = await fetch(`/api/students?departmentId=${encodeURIComponent(departmentId)}`);
          if (!response.ok) {
            setError("Failed to load students from backend.");
            setStudents([]);
            return;
          }
          const data = (await response.json()) as { students?: Student[] };
          setStudents(data.students ?? []);
        } catch {
          setError("Failed to load students from backend.");
          setStudents([]);
        } finally {
          setIsLoading(false);
        }
      })();
      return;
    }
    void fetchStudents(activeCourseId);
  }, [activeCourseId, departmentId]);


  // Fetch courses for this department from backend
  const loadCoursesFromAPI = async () => {
    if (!departmentId) return;
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`/api/courses?departmentId=${encodeURIComponent(departmentId)}`);
      if (!response.ok) {
        setCourses([]);
        setError("Failed to load courses from backend.");
        return;
      }
      const data = (await response.json()) as { courses?: CourseOption[] };
      const allCoursesOption = { id: "", name: "All Courses" };
      setCourses([allCoursesOption, ...(data.courses ?? [])]);
      setActiveCourseId("");
      setCourseId("");
    } catch {
      setCourses([]);
      setActiveCourseId("");
      setCourseId("");
      setError("Failed to load courses from backend.");
    } finally {
      setIsLoading(false);
    }
  };


  // Fetch all students for this department
  const fetchAllStudents = async () => {
    if (!departmentId) return;
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`/api/students?departmentId=${encodeURIComponent(departmentId)}`);
      if (!response.ok) {
        setError("Failed to load students from backend.");
        return;
      }
      const data = (await response.json()) as { students?: Student[] };
      setStudents(data.students ?? []);
    } catch {
      setError("Failed to load students from backend.");
    } finally {
      setIsLoading(false);
    }
  };


  // Fetch students for the selected course for display only
  const fetchStudents = async (selectedCourseId: string) => {
    if (!departmentId) return;
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch(`/api/students?departmentId=${encodeURIComponent(departmentId)}&courseId=${encodeURIComponent(selectedCourseId)}`);
      if (!response.ok) {
        setError("Failed to load students from backend.");
        return;
      }
      const data = (await response.json()) as { students?: Student[] };
      setStudents(data.students ?? []);
    } catch {
      setError("Failed to load students from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedAdmission = admissionNumber.trim().toUpperCase();
    const trimmedCourseId = courseId.trim();

    if (!trimmedName || !trimmedAdmission || !trimmedCourseId) {
      setError("Please enter student name, admission number, and course.");
      return;
    }


    try {
      if (!departmentId) {
        setError("Missing department context.");
        return;
      }
      if (editingStudentId) {
        const response = await fetch(`/api/students/${editingStudentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            admissionNumber: trimmedAdmission,
            courseId: trimmedCourseId,
            departmentId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Failed to update student.");
          return;
        }

        setEditingStudentId(null);
      } else {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            admissionNumber: trimmedAdmission,
            courseId: trimmedCourseId,
            departmentId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Failed to add student.");
          return;
        }
      }

      await fetchStudents(activeCourseId || trimmedCourseId);
      await fetchAllStudents();
    } catch {
      setError("Failed to save student.");
      return;
    }

    setName("");
    setAdmissionNumber("");

    if (!editingStudentId) {
      setCourseId(activeCourseId);
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setAdmissionNumber(student.admissionNumber);
    setCourseId(student.courseId ?? activeCourseId);
    setError("");
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setName("");
    setAdmissionNumber("");
    setCourseId(activeCourseId);
    setError("");
  };

  const handleBulkAddStudents = async () => {
    setError("");

    const lines = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Add at least one line in the format: Name, Admission Number.");
      return;
    }

    if (!activeCourseId) {
      setError("Select a course first.");
      return;
    }

    const parsedStudents: Array<{ name: string; admissionNumber: string }> = [];

    for (const line of lines) {
      const [namePart, ...admissionParts] = line.split(",");
      const parsedName = namePart?.trim() ?? "";
      const parsedAdmission = admissionParts.join(",").trim().toUpperCase();

      if (!parsedName || !parsedAdmission) {
        continue;
      }

      parsedStudents.push({
        name: parsedName,
        admissionNumber: parsedAdmission,
      });
    }

    if (parsedStudents.length === 0) {
      setError("No valid new records found. Use: Name, Admission Number.");
      return;
    }

    try {
      const response = await fetch("/api/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: activeCourseId, students: parsedStudents }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Failed to bulk add students.");
        return;
      }

      await fetchStudents(activeCourseId);
      await fetchAllStudents();
    } catch {
      setError("Failed to bulk add students.");
      return;
    }

    setBulkText("");
    setShowBulkAdd(false);
  };

  const handleRemoveStudent = async (id: string) => {
    setError("");
    try {
      const response = await fetch(`/api/students/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Failed to remove student.");
        return;
      }

      if (activeCourseId) {
        await fetchStudents(activeCourseId);
        await fetchAllStudents();
      }
    } catch {
      setError("Failed to remove student.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-6 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-sky-500/10">
        <h1 className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl dark:from-indigo-300 dark:to-sky-300">
          Students
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          View student records, enrollment, and academic progress.
        </p>
      </section>

      <section className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Student Management
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingStudentId(null);
                setName("");
                setAdmissionNumber("");
                setCourseId(activeCourseId);
                setShowBulkAdd(false);
              }}
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              disabled={!activeCourseId}
              title={!activeCourseId ? "Select a course to add students" : undefined}
            >
              Add Student
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAdd((prev) => !prev)}
              className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              disabled={!activeCourseId}
              title={!activeCourseId ? "Select a course to bulk add students" : undefined}
            >
              {showBulkAdd ? "Close Bulk Add" : "Bulk Add"}
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-md">
          <label className="text-sm font-medium text-foreground">Selected Course</label>
          <select
            value={activeCourseId}
            onChange={(event) => {
              const nextCourseId = event.target.value;
              setActiveCourseId(nextCourseId);
              if (!editingStudentId) {
                setCourseId(nextCourseId);
              }
            }}
            className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-400/40 dark:bg-slate-950/80 dark:focus:border-indigo-300"
          >
            {courses.length === 0 && <option value="">No courses available</option>}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          {activeCourseId && (
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span>Course ID: {activeCourseId}</span>
              {courses.find(c => c.id === activeCourseId)?.name && (
                <span> &mdash; {courses.find(c => c.id === activeCourseId)?.name}</span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSaveStudent} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <div>
            <label className="text-sm font-medium text-foreground">Student Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jane Doe"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-400/40 dark:bg-slate-950/80 dark:focus:border-indigo-300"
              disabled={!activeCourseId}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Admission Number</label>
            <input
              value={admissionNumber}
              onChange={(event) => setAdmissionNumber(event.target.value)}
              placeholder="e.g. BOT/2026/001"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-400/40 dark:bg-slate-950/80 dark:focus:border-indigo-300"
              disabled={!activeCourseId}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Course</label>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-400/40 dark:bg-slate-950/80 dark:focus:border-indigo-300"
            >
              {courses.length === 0 && <option value="">No courses available</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:w-auto"
            >
              {editingStudentId ? "Save Changes" : "Add Student"}
            </button>
          </div>

          {editingStudentId && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-full rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20 md:w-auto"
              >
                Cancel
              </button>
            </div>
          )}
        </form>

        {showBulkAdd && (
          <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-400/40 dark:bg-indigo-500/10">
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-200">
              Bulk Add Students
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Enter one student per line using: Name, Admission Number. They will be added to the selected course.
            </p>
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={6}
              placeholder={"Jane Doe, BOT/2026/001\nJohn Smith, BOT/2026/002"}
              className="mt-3 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-indigo-400/40 dark:bg-slate-950/80 dark:focus:border-indigo-300"
            />
            <div className="mt-3">
              <button
                type="button"
                onClick={handleBulkAddStudents}
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Add All
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section className="rounded-xl border border-indigo-100 bg-white/90 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Student List</h2>
          <span className="rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
            {students.length} in selected course
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-indigo-100 dark:border-indigo-500/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-indigo-50/70 dark:bg-indigo-500/10">
              <tr>
                <th className="px-4 py-2 font-medium">Student Name</th>
                <th className="px-4 py-2 font-medium">Admission Number</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    No students added yet.
                  </td>
                </tr>
              )}

              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    Loading students...
                  </td>
                </tr>
              )}

              {students.map((student) => {
                const isRegistered = authUsers.some((u) => u.studentId === student.id);
                return (
                  <tr key={student.id} className="border-t border-indigo-100 dark:border-indigo-500/30">
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{student.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{student.admissionNumber}</td>
                    <td className="px-4 py-3">
                      {isRegistered ? (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-200">Registered</span>
                      ) : (
                        <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200">Not Registered</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditStudent(student)}
                          className="rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-400/40 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                          title="Edit student details"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student.id)}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
                          title="Remove student from course"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-sky-300 px-2 py-1 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-50 dark:border-sky-500/50 dark:text-sky-400 dark:hover:bg-sky-500/10"
                          title="View student profile"
                          onClick={() => alert(`Student profile for ${student.name}`)}
                        >
                          Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
