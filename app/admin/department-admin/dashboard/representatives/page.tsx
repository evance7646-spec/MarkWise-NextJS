"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  UserPlus, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Star,
  Award
} from "lucide-react";

type Course = {
  id: string;
  name: string;
  code?: string;
  credits?: number;
  departmentId: string;
  programId?: string; // Keep for reference if needed
  durationYears?: number; // Added: fetched from backend
};

type Student = {
  id: string;
  name: string;
  admissionNumber: string;
  courseId: string;
  email?: string;
  phone?: string;
  year: number; // Add year field to student
};

type RepresentativeSelection = {
  [courseId: string]: {
    [year: number]: {
      repId: string;
      repName?: string;
      assistantId: string;
      assistantName?: string;
    };
  };
};

export default function DepartmentRepresentativesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selections, setSelections] = useState<RepresentativeSelection>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchDepartmentId() {
      try {
        const deptRes = await fetch("/api/auth/me");
        if (!deptRes.ok) {
          throw new Error("Failed to fetch admin info");
        }
        const deptData = await deptRes.json();
        const deptId = deptData.departmentId;
        if (!deptId) {
          setError("Department ID not found. Please log in as a department admin.");
          setDepartmentId(null);
          return;
        }
        setDepartmentId(deptId);
      } catch (err) {
        setError("Failed to load department information.");
        setDepartmentId(null);
      }
    }
    fetchDepartmentId();
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setIsLoading(false);
      return;
    }

    async function fetchStudentsAndCourses() {
      try {
        setIsLoading(true);
        
        // Fetch students
        const studentRes = await fetch(`/api/students?departmentId=${departmentId}`);
        if (!studentRes.ok) {
          throw new Error("Failed to fetch students");
        }
        const studentData = await studentRes.json();
        setStudents(studentData.students || []);
        
        // Fetch courses
        const courseRes = await fetch(`/api/courses?departmentId=${departmentId}`);
        if (!courseRes.ok) {
          throw new Error("Failed to fetch courses");
        }
        const courseData = await courseRes.json();
        setCourses(courseData.courses || []);
        
        // Load saved selections if they exist
        await loadSavedSelections();
        
        setError("");
      } catch (err) {
        setError("Failed to load data from the database.");
        setStudents([]);
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchStudentsAndCourses();
  }, [departmentId]);

  const loadSavedSelections = async () => {
    try {
      const res = await fetch(`/api/department/representatives?departmentId=${departmentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.selections) {
          setSelections(data.selections);
        }
      }
    } catch (err) {
      console.error("Failed to load saved selections:", err);
    }
  };

  const handleSelect = (
    courseId: string, 
    year: number, 
    role: "repId" | "assistantId", 
    studentId: string
  ) => {
    const student = students.find(s => s.id === studentId);
    const studentName = student ? `${student.name} (${student.admissionNumber})` : "";

    setSelections((prev) => {
      // Initialize course if not exists
      const courseSelections = prev[courseId] || {};
      
      // Initialize year if not exists
      const yearSelections = courseSelections[year] || { repId: "", assistantId: "" };
      
      // Create updated selections
      const updatedYearSelections = {
        ...yearSelections,
        [role]: studentId,
        ...(role === "repId" ? { repName: studentName } : { assistantName: studentName }),
      };

      return {
        ...prev,
        [courseId]: {
          ...courseSelections,
          [year]: updatedYearSelections,
        },
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccess("");
    setError("");

    try {
      const res = await fetch("/api/department/representatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId,
          selections,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save representatives");
      }

      setSuccess("Representatives saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save representatives. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setExpandedCourses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedCourses(new Set(courses.map(c => c.id)));
  };

  const collapseAll = () => {
    setExpandedCourses(new Set());
  };

  const getFilteredStudents = (courseId: string, year?: number) => {
    return students
      .filter((student) => student.courseId === courseId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getAvailableYears = (courseId: string): number[] => {
    const course = courses.find(c => c.id === courseId);
    const duration = course?.durationYears || 4;
    // Always show all years for the course duration
    return Array.from({ length: duration }, (_, i) => i + 1);
  };

  const getStudentCount = (courseId: string, year?: number) => {
    return students.filter(s => 
      s.courseId === courseId && (!year || s.year === year)
    ).length;
  };

  const getSelectionCount = (courseId: string) => {
    const courseSelections = selections[courseId] || {};
    return Object.values(courseSelections).filter(y => y.repId || y.assistantId).length;
  };

  const getYearSelectionStatus = (courseId: string, year: number) => {
    const yearSelections = selections[courseId]?.[year];
    return {
      hasRep: !!yearSelections?.repId,
      hasAssistant: !!yearSelections?.assistantId,
      repName: yearSelections?.repName,
      assistantName: yearSelections?.assistantName,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
            <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-indigo-600" />
          </div>
          <p className="mt-4 text-lg font-medium text-zinc-600 dark:text-zinc-400">Loading representatives data...</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">Fetching students and courses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950">
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/[0.1] bg-[length:16px_16px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <div className="relative px-8 py-12">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                <Users className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white">
                  Course Representatives
                </h1>
                <p className="mt-2 text-lg text-white/90">
                  Select and manage student leaders for each course and year
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-md border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-md border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Star className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Courses</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{courses.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-md border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Representatives</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Object.values(selections).reduce((acc, course) => 
                    acc + Object.values(course).filter(y => y.repId).length, 0
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-md border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <UserPlus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Assistants</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Object.values(selections).reduce((acc, course) => 
                    acc + Object.values(course).filter(y => y.assistantId).length, 0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="rounded-xl border border-indigo-100 bg-white/90 p-6 shadow-lg dark:border-indigo-500/30 dark:bg-slate-950/80 backdrop-blur-sm">
          {/* Header with actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Leadership</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Select representatives and assistants for each year in every course
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              {success}
            </div>
          )}

          {!error && !departmentId && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              Department ID not set. Please log in as a department admin.
            </div>
          )}

          {!error && departmentId && students.length === 0 && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
              No students found. Please add students in the Students page first.
            </div>
          )}

          {/* Courses List */}
          <div className="space-y-4">
            {courses.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-indigo-300 mx-auto mb-4" />
                <p className="text-zinc-500 dark:text-zinc-400">No courses found for this department</p>
              </div>
            ) : (
              courses.map((course) => {
                const isExpanded = expandedCourses.has(course.id);
                const availableYears = getAvailableYears(course.id);
                const totalStudents = getStudentCount(course.id);
                const selectionCount = getSelectionCount(course.id);
                
                return (
                  <div
                    key={course.id}
                    className="rounded-xl border border-indigo-200 bg-white dark:bg-slate-900 shadow-md overflow-hidden"
                  >
                    {/* Course Header */}
                    <button
                      onClick={() => toggleCourse(course.id)}
                      className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 hover:from-indigo-100 dark:hover:from-indigo-900/70 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">
                            {course.name}
                            {course.code && <span className="ml-2 text-sm font-normal text-zinc-500">({course.code})</span>}
                          </h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {availableYears.length} years • {totalStudents} students • {selectionCount} selections
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {selectionCount}/{availableYears.length * 2} filled
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        )}
                      </div>
                    </button>

                    {/* Course Years */}
                    {isExpanded && (
                      <div className="p-6 space-y-6">
                        {availableYears.map((year) => {
                          const yearStudents = getFilteredStudents(course.id, year);
                          const yearStatus = getYearSelectionStatus(course.id, year);
                          
                          return (
                            <div
                              key={`${course.id}-year-${year}`}
                              className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-4 py-2"
                            >
                              <h4 className="text-md font-semibold text-indigo-800 dark:text-indigo-300 mb-4">
                                Year {year}
                                <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
                                  ({yearStudents.length} students)
                                </span>
                              </h4>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Class Representative Selection */}
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    <Star className="h-4 w-4 text-amber-500" />
                                    Class Representative
                                  </label>
                                  <select
                                    className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm text-gray-900 dark:bg-slate-800 dark:text-gray-100 dark:border-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all"
                                    value={yearStatus.hasRep ? selections[course.id]?.[year]?.repId || "" : ""}
                                    onChange={(e) => handleSelect(course.id, year, "repId", e.target.value)}
                                  >
                                    <option value="">Select representative</option>
                                    {yearStudents.map((student) => (
                                      <option key={student.id} value={student.id}>
                                        {student.name} ({student.admissionNumber})
                                        {student.email && ` - ${student.email}`}
                                      </option>
                                    ))}
                                  </select>
                                  {yearStatus.repName && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Selected: {yearStatus.repName}
                                    </p>
                                  )}
                                </div>

                                {/* Assistant Representative Selection */}
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    <UserPlus className="h-4 w-4 text-purple-500" />
                                    Assistant Representative
                                  </label>
                                  <select
                                    className="w-full rounded-lg border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm text-gray-900 dark:bg-slate-800 dark:text-gray-100 dark:border-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 transition-all"
                                    value={yearStatus.hasAssistant ? selections[course.id]?.[year]?.assistantId || "" : ""}
                                    onChange={(e) => handleSelect(course.id, year, "assistantId", e.target.value)}
                                  >
                                    <option value="">Select assistant</option>
                                    {yearStudents
                                      .filter(s => s.id !== selections[course.id]?.[year]?.repId) // Prevent selecting same person
                                      .map((student) => (
                                        <option key={student.id} value={student.id}>
                                          {student.name} ({student.admissionNumber})
                                          {student.email && ` - ${student.email}`}
                                        </option>
                                      ))}
                                  </select>
                                  {yearStatus.assistantName && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Selected: {yearStatus.assistantName}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Summary for this year */}
                              {(yearStatus.hasRep || yearStatus.hasAssistant) && (
                                <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                                    Year {year} Summary:
                                  </p>
                                  <div className="mt-1 space-y-1">
                                    {yearStatus.hasRep && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        • Representative: {yearStatus.repName}
                                      </p>
                                    )}
                                    {yearStatus.hasAssistant && (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        • Assistant: {yearStatus.assistantName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Save Button */}
          {!error && departmentId && courses.length > 0 && students.length > 0 && (
            <div className="mt-8 flex justify-end border-t border-indigo-100 dark:border-indigo-800 pt-6">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Save All Representatives
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="rounded-xl border border-indigo-100 bg-white/90 p-4 shadow-sm dark:border-indigo-500/30 dark:bg-slate-950/80">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-zinc-500 dark:text-zinc-400">Total Courses:</span>
              <span className="font-semibold text-indigo-600">{courses.length}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span className="text-zinc-500 dark:text-zinc-400">Total Students:</span>
              <span className="font-semibold text-indigo-600">{students.length}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span className="text-zinc-500 dark:text-zinc-400">Selections Made:</span>
              <span className="font-semibold text-indigo-600">
                {Object.values(selections).reduce((acc, course) => 
                  acc + Object.values(course).filter(y => y.repId).length, 0
                )} reps, {
                  Object.values(selections).reduce((acc, course) => 
                    acc + Object.values(course).filter(y => y.assistantId).length, 0
                  )} assistants
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}