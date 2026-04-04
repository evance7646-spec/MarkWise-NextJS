"use client";

import { useEffect, useMemo, useState } from "react";

// Utility to save curriculum for department
async function saveCurriculum(programs: Program[], departmentId: string) {
  if (!departmentId) {
    throw new Error("Not authenticated — please log out and log back in.");
  }
  const res = await fetch("/api/curriculum", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ departmentId, programs }),
  });
  if (!res.ok) {
    let message = "Failed to save curriculum";
    try {
      const body = await res.json();
      if (body?.error) message = `Failed to save curriculum: ${body.error}`;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

type Unit = {
  id: string;
  title: string;
  code: string;
  courseId?: string;
};

type Semester = {
  id: string;
  label: string;
  units: Unit[];
};

type YearBlock = {
  id: string;
  name: string;
  semesters: Semester[];
};

// Utility to fetch department info (id) from backend
async function fetchDepartmentInfo() {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch department info");
  return res.json();
}

// Utility to fetch curriculum for department
async function fetchCurriculum(departmentId: string) {
  const res = await fetch(`/api/curriculum?departmentId=${encodeURIComponent(departmentId)}`);
  if (!res.ok) throw new Error("Failed to fetch curriculum");
  return res.json();
}

type ModalState =
  | { type: "add-program" }
  | { type: "edit-program"; programId: string }
  | { type: "delete-program"; programId: string }
  | { type: "add-unit"; programId: string; yearId: string; semesterId: string }
  | { type: "bulk-add-units"; programId: string; yearId: string; semesterId: string }
  | { type: "edit-unit"; programId: string; yearId: string; semesterId: string; unitId: string }
  | { type: "delete-unit"; programId: string; yearId: string; semesterId: string; unitId: string };

type Program = {
  id: string;
  name: string;
  durationYears: number;
  years: YearBlock[];
};

export default function DepartmentCurriculumPage() {
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string>("");
  const [openPrograms, setOpenPrograms] = useState<string[]>([]);
  const [openYears, setOpenYears] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [programName, setProgramName] = useState("");
  const [programDuration, setProgramDuration] = useState("4");
  const [unitTitle, setUnitTitle] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [bulkUnitText, setBulkUnitText] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const { department } = await fetchDepartmentInfo();
        if (!department?.id) throw new Error("No department info");
        setDepartmentId(department.id);
        const curriculum = await fetchCurriculum(department.id);
        
        // Sort programs by name
        const sortedPrograms = (curriculum.programs || []).sort((a: Program, b: Program) => 
          a.name.localeCompare(b.name)
        );
        
        setPrograms(sortedPrograms);
        // Expand all programs and years by default
        setOpenPrograms(sortedPrograms.map((program: Program) => program.id));
        setOpenYears(
          sortedPrograms.flatMap((program: Program) => 
            program.years.map((year: YearBlock) => `${program.id}-${year.id}`)
          ),
        );
      } catch (err: any) {
        setAuthError(err?.message || "Session expired. Please log in again.");
        setPrograms([]);
        setOpenPrograms([]);
        setOpenYears([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Save curriculum handler (kept for internal use but button removed from UI)
  const handleSaveCurriculum = async () => {
    setSaveStatus("");
    // Validate all required fields before saving
    for (const program of programs) {
      if (!program.id || !program.name || !Array.isArray(program.years)) {
        setSaveStatus("Missing program ID, name, or years.");
        alert("Missing program ID, name, or years.");
        return;
      }
      for (const year of program.years) {
        if (!year.id || !year.name || !Array.isArray(year.semesters)) {
          setSaveStatus("Missing year ID, name, or semesters.");
          alert("Missing year ID, name, or semesters.");
          return;
        }
        for (const semester of year.semesters) {
          if (!semester.id || !semester.label || !Array.isArray(semester.units)) {
            setSaveStatus("Missing semester ID, label, or units.");
            alert("Missing semester ID, label, or units.");
            return;
          }
          for (const unit of semester.units) {
            if (!unit.id || !unit.code || !unit.title) {
              setSaveStatus("Missing unit ID, code, or title.");
              alert("Missing unit ID, code, or title.");
              return;
            }
          }
        }
      }
    }
    console.log("Saving curriculum for departmentId:", departmentId);
    try {
      const res = await saveCurriculum(programs, departmentId);
      if (res.error) {
        setSaveStatus(`Failed to save curriculum: ${res.error}`);
        alert(`Failed to save curriculum: ${res.error}`);
        return;
      }
      setSaveStatus("Curriculum saved successfully.");
      console.log("Curriculum save response:", res);
    } catch (err: any) {
      let errorMsg = "Failed to save curriculum.";
      if (err && typeof err === "object" && "message" in err) {
        errorMsg = (err as any).message;
      } else if (typeof err === "string") {
        errorMsg = err;
      }
      setSaveStatus(errorMsg);
      console.error("Curriculum save error:", err);
      alert(errorMsg);
    }
  };

  const stats = useMemo(() => {
    const totalPrograms = programs.length;
    const totalSemesters = programs.reduce(
      (sum, program) => sum + program.years.reduce((yearSum, year) => yearSum + year.semesters.length, 0),
      0,
    );
    const totalUnits = programs.reduce(
      (sum, program) =>
        sum +
        program.years.reduce(
          (yearSum, year) =>
            yearSum + year.semesters.reduce((semesterSum, semester) => semesterSum + semester.units.length, 0),
          0,
        ),
      0,
    );
    const durationTypes = new Set(programs.map((program) => program.durationYears)).size;

    return {
      totalPrograms,
      totalSemesters,
      totalUnits,
      durationTypes,
    };
  }, [programs]);

  const findProgram = (programId: string) => programs.find((program) => program.id === programId);

  const findUnit = (modalState: Extract<ModalState, { type: "edit-unit" | "delete-unit" }>) => {
    const program = findProgram(modalState.programId);
    const year = program?.years.find((item) => item.id === modalState.yearId);
    const semester = year?.semesters.find((item) => item.id === modalState.semesterId);
    return semester?.units.find((item) => item.id === modalState.unitId);
  };

  const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const getDurationValue = () => {
    const parsed = Number.parseInt(programDuration, 10);
    if (Number.isNaN(parsed)) return 1;
    return Math.min(6, Math.max(1, parsed));
  };

  const ensureProgramStructureByDuration = (durationYears: number, existingYears?: YearBlock[]) => {
    const totalSemesters = durationYears * 2;
    const yearsToGenerate = durationYears;
    const years: YearBlock[] = [];

    for (let yearIndex = 0; yearIndex < yearsToGenerate; yearIndex += 1) {
      const yearNumber = yearIndex + 1;
      const existingYear = existingYears?.[yearIndex];
      const existingSemesterOne = existingYear?.semesters?.[0];
      const existingSemesterTwo = existingYear?.semesters?.[1];

      const semesterOneNumber = yearIndex * 2 + 1;
      const semesterTwoNumber = yearIndex * 2 + 2;

      years.push({
        id: existingYear?.id ?? createId(),
        name: `Year ${yearNumber}`,
        semesters: [
          {
            id: existingSemesterOne?.id ?? createId(),
            label: 'First Semester',
            units: semesterOneNumber <= totalSemesters ? (existingSemesterOne?.units ?? []) : [],
          },
          {
            id: existingSemesterTwo?.id ?? createId(),
            label: 'Second Semester',
            units: semesterTwoNumber <= totalSemesters ? (existingSemesterTwo?.units ?? []) : [],
          },
        ],
      });
    }

    return years;
  };

  const normalizeProgramsByDuration = (sourcePrograms: Program[]) => {
    return sourcePrograms.map((program) => {
      const normalizedDuration = Math.min(6, Math.max(1, Number(program.durationYears) || 1));
      return {
        ...program,
        durationYears: normalizedDuration,
        years: ensureProgramStructureByDuration(normalizedDuration, program.years),
      };
    });
  };

  const closeModal = () => {
    setModal(null);
    setProgramName("");
    setProgramDuration("4");
    setUnitTitle("");
    setUnitCode("");
    setBulkUnitText("");
  };

  const openAddProgramModal = () => {
    setProgramName("");
    setProgramDuration("4");
    setModal({ type: "add-program" });
  };

  const openEditProgramModal = (program: Program) => {
    setProgramName(program.name);
    setProgramDuration(String(program.durationYears));
    setModal({ type: "edit-program", programId: program.id });
  };

  const openAddUnitModal = (programId: string, yearId: string, semesterId: string) => {
    setUnitTitle("");
    setUnitCode("");
    setModal({ type: "add-unit", programId, yearId, semesterId });
  };

  const openBulkAddUnitsModal = (programId: string, yearId: string, semesterId: string) => {
    setBulkUnitText("");
    setModal({ type: "bulk-add-units", programId, yearId, semesterId });
  };

  const openEditUnitModal = (
    programId: string,
    yearId: string,
    semesterId: string,
    unit: Unit,
  ) => {
    setUnitTitle(unit.title);
    setUnitCode(unit.code);
    setModal({ type: "edit-unit", programId, yearId, semesterId, unitId: unit.id });
  };

  const submitProgramForm = () => {
    if (!programName.trim()) return;

    const durationValue = getDurationValue();

    const handle = async () => {
      if (modal?.type === "add-program") {
        const newProgram: Program = {
          id: createId(),
          name: programName.trim(),
          durationYears: durationValue,
          years: ensureProgramStructureByDuration(durationValue),
        };
        const updated = [...programs, newProgram].sort((a, b) => a.name.localeCompare(b.name));
        await saveCurriculum(updated, departmentId);
        const curriculum = await fetchCurriculum(departmentId);
        setPrograms(curriculum.programs || []);
        setOpenPrograms((prev) => [...prev, newProgram.id]);
        setOpenYears((prev) => [
          ...prev,
          ...newProgram.years.map((year) => `${newProgram.id}-${year.id}`),
        ]);
        closeModal();
        return;
      }

      if (modal?.type === "edit-program") {
        const updated = programs.map((program) =>
          program.id === modal.programId
            ? {
                ...program,
                name: programName.trim(),
                durationYears: durationValue,
                years: ensureProgramStructureByDuration(durationValue, program.years),
              }
            : program,
        ).sort((a, b) => a.name.localeCompare(b.name));
        
        await saveCurriculum(updated, departmentId);
        const curriculum = await fetchCurriculum(departmentId);
        setPrograms(curriculum.programs || []);
        // Expand all years for the edited program
        const editedProgram = updated.find((p) => p.id === modal.programId);
        const newYears = ensureProgramStructureByDuration(durationValue, editedProgram?.years).map(
          (year) => `${modal.programId}-${year.id}`
        );
        setOpenYears((prev) => Array.from(new Set([...prev, ...newYears])));
        closeModal();
      }
    };
    handle().catch((err: any) => {
      const msg = err?.message || "Failed to save curriculum";
      setSaveStatus(msg);
      alert(msg);
    });
  };

  const submitUnitForm = () => {
    if (!modal) return;
    if (!unitTitle.trim()) return;
    if (!unitCode.trim()) {
      alert("Unit code is required.");
      return;
    }

    const handle = async () => {
      if (modal.type === "add-unit") {
        const updated = programs.map((program) => {
          if (program.id !== modal.programId) return program;
          return {
            ...program,
            years: program.years.map((year) => {
              if (year.id !== modal.yearId) return year;
              return {
                ...year,
                semesters: year.semesters.map((semester) => {
                  if (semester.id !== modal.semesterId) return semester;
                  return {
                    ...semester,
                    units: [
                      ...semester.units,
                      {
                        id: createId(),
                        title: unitTitle.trim(),
                        code: unitCode.trim().toUpperCase(),
                        courseId: program.id,
                      },
                    ],
                  };
                }),
              };
            }),
          };
        });
        await saveCurriculum(updated, departmentId);
        const curriculum = await fetchCurriculum(departmentId);
        setPrograms(curriculum.programs || []);
        closeModal();
        return;
      }

      if (modal.type === "edit-unit") {
        const updated = programs.map((program) => {
          if (program.id !== modal.programId) return program;
          return {
            ...program,
            years: program.years.map((year) => {
              if (year.id !== modal.yearId) return year;
              return {
                ...year,
                semesters: year.semesters.map((semester) => {
                  if (semester.id !== modal.semesterId) return semester;
                  return {
                    ...semester,
                    units: semester.units.map((unit) =>
                      unit.id === modal.unitId
                        ? {
                            ...unit,
                            title: unitTitle.trim(),
                            code: unitCode.trim().toUpperCase(),
                          }
                        : unit
                    ),
                  };
                }),
              };
            }),
          };
        });
        await saveCurriculum(updated, departmentId);
        const curriculum = await fetchCurriculum(departmentId);
        setPrograms(curriculum.programs || []);
        closeModal();
      }
    };
    handle().catch((err: any) => {
      const msg = err?.message || "Failed to save curriculum";
      setSaveStatus(msg);
      alert(msg);
    });
  };

  const submitBulkUnitsForm = () => {
    if (!modal || modal.type !== "bulk-add-units") return;

    const parsedUnits = bulkUnitText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [titlePart, ...codeParts] = line.split(",");
        const title = titlePart?.trim() || "";
        const code = codeParts.join(",").trim().toUpperCase();
        return {
          id: createId(),
          title,
          code,
        };
      })
      .filter((unit) => unit.title.length > 0 && unit.code.length > 0);

    if (parsedUnits.length === 0) return;

    const handle = async () => {
      const updated = programs.map((program) => {
        if (program.id !== modal.programId) return program;
        return {
          ...program,
          years: program.years.map((year) => {
            if (year.id !== modal.yearId) return year;
            return {
              ...year,
              semesters: year.semesters.map((semester) => {
                if (semester.id !== modal.semesterId) return semester;
                return {
                  ...semester,
                  units: [
                    ...semester.units,
                    ...parsedUnits.map(unit => ({
                      ...unit,
                      courseId: program.id,
                    })),
                  ],
                };
              }),
            };
          }),
        };
      });
      await saveCurriculum(updated, departmentId);
      const curriculum = await fetchCurriculum(departmentId);
      setPrograms(curriculum.programs || []);
      closeModal();
    };
    handle().catch((err: any) => {
      const msg = err?.message || "Failed to save curriculum";
      setSaveStatus(msg);
      alert(msg);
    });
  };

  const confirmDelete = () => {
    if (!modal) return;

    const handle = async () => {
      if (modal.type === "delete-program") {
        // Delete program via API
        try {
          const res = await fetch(`/api/curriculum?programId=${modal.programId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          const result = await res.json();
          if (!res.ok || result.error) {
            setSaveStatus(`Failed to delete program: ${result.error || "Unknown error"}`);
            alert(`Failed to delete program: ${result.error || "Unknown error"}`);
            return;
          }
          const curriculum = await fetchCurriculum(departmentId);
          setPrograms(curriculum.programs || []);
          setOpenPrograms((prev) => prev.filter((id) => id !== modal.programId));
          closeModal();
        } catch (err) {
          setSaveStatus("Failed to delete program.");
          alert("Failed to delete program.");
        }
        return;
      }

      if (modal.type === "delete-unit") {
        const updated = programs.map((program) => {
          if (program.id !== modal.programId) return program;
          return {
            ...program,
            years: program.years.map((year) => {
              if (year.id !== modal.yearId) return year;
              return {
                ...year,
                semesters: year.semesters.map((semester) => {
                  if (semester.id !== modal.semesterId) return semester;
                  return {
                    ...semester,
                    units: semester.units.filter((unit) => unit.id !== modal.unitId),
                  };
                }),
              };
            }),
          };
        });
        await saveCurriculum(updated, departmentId);
        const curriculum = await fetchCurriculum(departmentId);
        setPrograms(curriculum.programs || []);
        closeModal();
        return;
      }
    };
    handle();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ department: "Department of Botany", programs }, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `department_of_botany_curriculum_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  const parseUnitEntry = (entry: string) => {
    const match = entry.trim().match(/^(.*)\(([^()]+)\)\s*$/);

    if (!match) {
      return {
        title: entry.trim(),
        code: "",
      };
    }

    return {
      title: match[1].trim(),
      code: match[2].trim().toUpperCase(),
    };
  };

  const syncUnitsFromReactNativeSource = async () => {
    try {
      setSyncStatus("");

      const targetProgram =
        programs.find((program) => program.name.toLowerCase().includes("microbiology")) ||
        programs[0];

      if (!targetProgram) {
        setSyncStatus("No program found to apply unit data.");
        return;
      }

      const response = await fetch("/api/units-by-year-semester", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setSyncStatus("Failed to fetch React Native units data.");
        return;
      }

      const data = (await response.json()) as {
        unitsByYearSemester?: Record<string, string[]>;
      };

      const map = data.unitsByYearSemester ?? {};

      setPrograms((prev) =>
        prev.map((program) => {
          if (program.id !== targetProgram.id) return program;

          return {
            ...program,
            years: program.years.map((year, yearIndex) => ({
              ...year,
              semesters: year.semesters.map((semester, semesterIndex) => {
                const key = `${yearIndex + 1}-${semesterIndex + 1}`;
                const unitEntries = map[key] ?? [];

                return {
                  ...semester,
                  units: unitEntries.map((entry) => {
                    const parsedUnit = parseUnitEntry(entry);
                    return {
                      id: createId(),
                      title: parsedUnit.title,
                      code: parsedUnit.code,
                    };
                  }),
                };
              }),
            })),
          };
        }),
      );

      setOpenPrograms((prev) => (prev.includes(targetProgram.id) ? prev : [...prev, targetProgram.id]));
      setOpenYears((prev) => {
        const yearKeys = targetProgram.years.map((year) => `${targetProgram.id}-${year.id}`);
        const merged = new Set([...prev, ...yearKeys]);
        return Array.from(merged);
      });

      setSyncStatus(`Synced units into ${targetProgram.name}.`);
    } catch {
      setSyncStatus("Failed to sync units. Please try again.");
    }
  };

  const buildUnitsByYearSemesterFromPrograms = (sourcePrograms: Program[]) => {
    const map: Record<string, string[]> = {};

    for (const program of sourcePrograms) {
      for (let yearIndex = 0; yearIndex < program.years.length; yearIndex += 1) {
        const year = program.years[yearIndex];

        for (let semesterIndex = 0; semesterIndex < year.semesters.length; semesterIndex += 1) {
          const semester = year.semesters[semesterIndex];
          const key = `${yearIndex + 1}-${semesterIndex + 1}`;

          const entries = semester.units.map((unit) => {
            const safeTitle = unit.title.trim();
            const safeCode = unit.code.trim();
            return safeCode ? `${safeTitle} (${safeCode})` : safeTitle;
          });

          if (!map[key]) {
            map[key] = [];
          }

          const unique = new Set([...map[key], ...entries]);
          map[key] = Array.from(unique);
        }
      }
    }

    return map;
  };

  useEffect(() => {
    if (isLoading) return;

    const timeout = window.setTimeout(() => {
      const unitsMap = buildUnitsByYearSemesterFromPrograms(programs);

      void fetch("/api/units-by-year-semester", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ unitsByYearSemester: unitsMap }),
      }).catch(() => {
        setSyncStatus("Auto-publish failed. Check API availability.");
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [programs, isLoading]);

  const toggleProgram = (id: string) => {
    setOpenPrograms((prev) =>
      prev.includes(id) ? prev.filter((programId) => programId !== id) : [...prev, id],
    );
  };

  const toggleYear = (yearKey: string) => {
    setOpenYears((prev) =>
      prev.includes(yearKey) ? prev.filter((key) => key !== yearKey) : [...prev, yearKey],
    );
  };

  // Sort years within each program from smallest to largest
  const sortedPrograms = useMemo(() => {
    return programs.map(program => ({
      ...program,
      years: [...program.years].sort((a, b) => {
        const yearNumA = parseInt(a.name.replace(/\D/g, '')) || 0;
        const yearNumB = parseInt(b.name.replace(/\D/g, '')) || 0;
        return yearNumA - yearNumB;
      })
    }));
  }, [programs]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-6 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-sky-500/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Curriculum Management</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Manage academic programs and course structure for Department of Botany.
            </p>
          </div>
          <button
            type="button"
            onClick={exportData}
            className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
          >
            Export Data
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Programs" value={stats.totalPrograms} />
          <StatCard label="Total Semesters" value={stats.totalSemesters} />
          <StatCard label="Total Units" value={stats.totalUnits} />
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-6 dark:border-indigo-500/30 dark:bg-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-foreground">Academic Programs</h3>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Add Program" onClick={openAddProgramModal} />
            <ActionButton
              label="Sync RN Units"
              onClick={() => {
                void syncUnitsFromReactNativeSource();
              }}
            />
          </div>
        </div>

        {syncStatus && (
          <p className="mt-3 text-sm text-indigo-700 dark:text-indigo-300">{syncStatus}</p>
        )}

        {authError && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300">
            <strong>Session error:</strong> {authError}{" "}
            <a href="/admin/department-admin/login" className="underline font-semibold">
              Log in again
            </a>
          </div>
        )}

        {isLoading ? (
          <div className="mt-5 rounded-lg border border-black/10 p-6 text-sm text-zinc-600 dark:border-white/15 dark:text-zinc-300">
            Loading curriculum data...
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {sortedPrograms.map((program) => {
              const semesterCount = program.years.reduce((sum, year) => sum + year.semesters.length, 0);
              const unitCount = program.years.reduce(
                (sum, year) => sum + year.semesters.reduce((inner, semester) => inner + semester.units.length, 0),
                0,
              );
              const isOpen = openPrograms.includes(program.id);

              return (
                <article
                  key={program.id}
                  className="overflow-hidden rounded-xl border border-black/10 dark:border-white/15"
                >
                  <div className="flex w-full items-center justify-between gap-4 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-4 text-left transition-colors hover:from-indigo-100 hover:to-sky-100 dark:from-indigo-500/10 dark:to-sky-500/10 dark:hover:from-indigo-500/20 dark:hover:to-sky-500/20">
                    <div>
                      <p className="font-semibold text-foreground">{program.name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        {program.durationYears} years • {semesterCount} semesters • {unitCount} units
                      </p>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <button
                        type="button"
                        onClick={() => openEditProgramModal(program)}
                        className="rounded-md border border-black/10 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ type: "delete-program", programId: program.id })}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProgram(program.id)}
                        aria-label={isOpen ? "Collapse program" : "Expand program"}
                        title={isOpen ? "Collapse program" : "Expand program"}
                        className="rounded-md border border-black/10 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                      >
                        {isOpen ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="space-y-4 p-4">
                      {program.years.map((year) => {
                        const yearKey = `${program.id}-${year.id}`;
                        const isYearOpen = openYears.includes(yearKey);

                        return (
                          <div key={year.id} className="rounded-xl border border-black/10 p-4 dark:border-white/15">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-base font-semibold text-foreground">{year.name}</h4>
                              <button
                                type="button"
                                onClick={() => toggleYear(yearKey)}
                                aria-label={isYearOpen ? "Collapse year" : "Expand year"}
                                title={isYearOpen ? "Collapse year" : "Expand year"}
                                className="rounded-md border border-black/10 px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                              >
                                {isYearOpen ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="18 15 12 9 6 15"></polyline>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                  </svg>
                                )}
                              </button>
                            </div>

                            {isYearOpen && (
                              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                {year.semesters.map((semester) => (
                                  <div
                                    key={semester.id}
                                    className="rounded-lg border border-black/10 p-3 dark:border-white/15"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-sm font-semibold text-foreground">{semester.label}</p>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openAddUnitModal(program.id, year.id, semester.id)}
                                          className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                                        >
                                          Add Unit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openBulkAddUnitsModal(program.id, year.id, semester.id)}
                                          className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                                        >
                                          Bulk Add
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-2 overflow-hidden rounded-md border border-black/10 dark:border-white/15">
                                      <table className="w-full text-left text-sm">
                                        <thead className="bg-indigo-50/70 dark:bg-indigo-500/10">
                                          <tr>
                                            <th className="px-3 py-2 font-medium">Unit Title</th>
                                            <th className="px-3 py-2 font-medium">Code</th>
                                            <th className="px-3 py-2 font-medium">Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {semester.units.length === 0 && (
                                            <tr>
                                              <td
                                                colSpan={3}
                                                className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400"
                                              >
                                                No units added yet.
                                              </td>
                                            </tr>
                                          )}
                                          {semester.units.map((unit) => (
                                            <tr key={unit.id} className="border-t border-black/10 dark:border-white/15">
                                              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                                                {unit.title}
                                              </td>
                                              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                                                {unit.code}
                                              </td>
                                              <td className="px-3 py-2">
                                                <div className="flex gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      openEditUnitModal(program.id, year.id, semester.id, unit)
                                                    }
                                                    className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setModal({
                                                        type: "delete-unit",
                                                        programId: program.id,
                                                        yearId: year.id,
                                                        semesterId: semester.id,
                                                        unitId: unit.id,
                                                      })
                                                    }
                                                    className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {!isYearOpen && (
                              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                                Semesters hidden.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}

            {programs.length === 0 && (
              <div className="rounded-lg border border-dashed border-black/20 p-8 text-center dark:border-white/25">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  No academic programs yet. Use <span className="font-semibold">Add Program</span> to begin.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-indigo-100 bg-white p-6 shadow-xl dark:border-indigo-500/30 dark:bg-slate-950">
            {(modal.type === "add-program" || modal.type === "edit-program") && (
              <>
                <h4 className="text-lg font-semibold text-foreground">
                  {modal.type === "add-program" ? "Add Program" : "Edit Program"}
                </h4>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Program Name</label>
                    <input
                      value={programName}
                      onChange={(event) => setProgramName(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
                      placeholder="e.g. BSc. Botany"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Duration (Years)</label>
                    <select
                      value={programDuration}
                      onChange={(event) => setProgramDuration(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
                    >
                      <option value="1">1 Year</option>
                      <option value="2">2 Years</option>
                      <option value="3">3 Years</option>
                      <option value="4">4 Years</option>
                      <option value="5">5 Years</option>
                      <option value="6">6 Years</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <ActionButton label="Cancel" onClick={closeModal} />
                  <ActionButton label="Save" onClick={submitProgramForm} primary />
                </div>
              </>
            )}

            {(modal.type === "add-unit" || modal.type === "edit-unit") && (
              <>
                <h4 className="text-lg font-semibold text-foreground">
                  {modal.type === "add-unit" ? "Add Unit" : "Edit Unit"}
                </h4>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Unit Title</label>
                    <input
                      value={unitTitle}
                      onChange={(event) => setUnitTitle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
                      placeholder="e.g. Plant Physiology"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Unit Code</label>
                    <input
                      value={unitCode}
                      onChange={(event) => setUnitCode(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
                      placeholder="e.g. BOT 2101"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <ActionButton label="Cancel" onClick={closeModal} />
                  <ActionButton label="Save" onClick={submitUnitForm} primary />
                </div>
              </>
            )}

            {modal.type === "bulk-add-units" && (
              <>
                <h4 className="text-lg font-semibold text-foreground">Bulk Add Units</h4>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  Enter one unit per line in this format: <span className="font-semibold">Unit Title, UNIT CODE</span>
                </p>
                <div className="mt-4">
                  <textarea
                    value={bulkUnitText}
                    onChange={(event) => setBulkUnitText(event.target.value)}
                    rows={8}
                    className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
                    placeholder={"Plant Anatomy, BOT 2301\nPlant Biochemistry, BOT 2302\nEthnobotany, BOT 2303"}
                  />
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <ActionButton label="Cancel" onClick={closeModal} />
                  <ActionButton label="Add Units" onClick={submitBulkUnitsForm} primary />
                </div>
              </>
            )}

            {(modal.type === "delete-program" || modal.type === "delete-unit") && (
              <>
                <h4 className="text-lg font-semibold text-foreground">Confirm Delete</h4>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                  {modal.type === "delete-program"
                    ? `Delete ${findProgram(modal.programId)?.name || "this program"}?`
                    : `Delete ${findUnit(modal)?.title || "this unit"}?`} This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <ActionButton label="Cancel" onClick={closeModal} />
                  <ActionButton label="Delete" onClick={confirmDelete} destructive />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-4 dark:border-indigo-500/30 dark:from-slate-950 dark:to-indigo-500/10">
      <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
  destructive,
}: {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        destructive
          ? "border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
          : primary
            ? "bg-gradient-to-r from-indigo-600 to-sky-600 text-white hover:opacity-90"
            : "border border-indigo-200 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
      }`}
    >
      {label}
    </button>
  );
}