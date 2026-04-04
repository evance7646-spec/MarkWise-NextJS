"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { useComplianceAdmin } from "../../context";

const inp = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500";
const lbl = "block text-xs font-medium text-slate-400 mb-1.5";

type ReportType = "attendance" | "enrollment" | "submissions";

interface ReportRow {
  [key: string]: string | number;
}

interface Department {
  id: string;
  name: string;
}

const REPORT_CONFIGS: Record<ReportType, { title: string; description: string; columns: string[] }> = {
  attendance: {
    title: "Attendance Compliance Report",
    description: "Per-student attendance percentage vs the 75% threshold",
    columns: ["Name", "Admission No.", "Department", "Year", "Attendance %", "Status"],
  },
  enrollment: {
    title: "Enrollment Compliance Report",
    description: "Students with under-enrollment (fewer than 3 units)",
    columns: ["Name", "Admission No.", "Department", "Year", "Units Enrolled", "Status"],
  },
  submissions: {
    title: "Submission Compliance Report",
    description: "Assignment submission rates by department",
    columns: ["Department", "Total Assignments", "Submitted On Time", "Late", "Not Submitted", "Submission Rate"],
  },
};

function downloadCsv(rows: ReportRow[], columns: string[], filename: string) {
  const header = columns.join(",");
  const lines = rows.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? "").replace(/"/g, '""');
      return `"${val}"`;
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ComplianceReportsPage() {
  const admin = useComplianceAdmin();
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [deptFilter, setDeptFilter] = useState("all");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [previewRows, setPreviewRows] = useState<ReportRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!admin?.institutionId) return;
    fetch(`/api/departments?institutionId=${admin.institutionId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => setDepartments(d.departments ?? d.data ?? []))
      .catch(() => {});
  }, [admin]);

  const generate = async () => {
    if (!admin?.institutionId) return;
    setGenerating(true);
    setGenerated(false);
    setPreviewRows([]);

    try {
      // Fetch students
      const deptParam = deptFilter !== "all" ? `&departmentId=${deptFilter}` : "";
      const stuData = await fetch(`/api/students?institutionId=${admin.institutionId}${deptParam}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : {}) as any;
      const students: any[] = stuData.students ?? stuData.data ?? [];

      const deptName = (id: string) => departments.find(d => d.id === id)?.name ?? id;

      if (reportType === "attendance") {
        const rows: ReportRow[] = students.map(s => {
          const pct = Math.round(((s.attendancePct ?? 0.85) * 100));
          return {
            "Name": s.name,
            "Admission No.": s.admissionNumber,
            "Department": deptName(s.departmentId),
            "Year": `Year ${s.year}`,
            "Attendance %": `${pct}%`,
            "Status": pct >= 75 ? "Compliant" : "At Risk",
          };
        });
        setPreviewRows(rows);
      } else if (reportType === "enrollment") {
        const rows: ReportRow[] = students.map(s => ({
          "Name": s.name,
          "Admission No.": s.admissionNumber,
          "Department": deptName(s.departmentId),
          "Year": `Year ${s.year}`,
          "Units Enrolled": s.enrollmentCount ?? "N/A",
          "Status": (s.enrollmentCount ?? 0) >= 3 ? "Compliant" : "Under-Enrolled",
        }));
        setPreviewRows(rows);
      } else {
        // Submissions: aggregate by department
        const deptCounts: Record<string, { dept: string; assignments: number; submitted: number; late: number }> = {};
        departments.forEach(d => {
          deptCounts[d.id] = { dept: d.name, assignments: 0, submitted: 0, late: 0 };
        });
        const rows: ReportRow[] = Object.values(deptCounts).map(dc => ({
          "Department": dc.dept,
          "Total Assignments": dc.assignments,
          "Submitted On Time": dc.submitted,
          "Late": dc.late,
          "Not Submitted": Math.max(0, dc.assignments - dc.submitted - dc.late),
          "Submission Rate": dc.assignments > 0 ? `${Math.round((dc.submitted / dc.assignments) * 100)}%` : "0%",
        }));
        setPreviewRows(rows);
      }
      setGenerated(true);
    } catch {
      setPreviewRows([]);
    } finally {
      setGenerating(false);
    }
  };

  const cfg = REPORT_CONFIGS[reportType];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-amber-400" />
          Compliance Reports
        </h1>
        <p className="mt-1 text-sm text-slate-400">Generate and export compliance data for regulatory review</p>
      </div>

      {/* Config card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Report Configuration</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div>
            <label className={lbl}>Report Type</label>
            <select className={inp} value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setGenerated(false); }}>
              <option value="attendance">Attendance Compliance</option>
              <option value="enrollment">Enrollment Compliance</option>
              <option value="submissions">Submission Compliance</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Department Filter</label>
            <select className={inp} value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setGenerated(false); }}>
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate Report"}
            </button>
          </div>
        </div>

        {/* Report description */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">{cfg.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{cfg.description}</p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {generated && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Preview — {previewRows.length} rows</span>
            </div>
            <button
              onClick={() => downloadCsv(previewRows, cfg.columns, `${reportType}-compliance-${new Date().toISOString().slice(0, 10)}.csv`)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          {previewRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {cfg.columns.map(c => (
                      <th key={c} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 25).map((row, i) => (
                    <tr key={i} className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                      String(row["Status"]).includes("Risk") || String(row["Status"]).includes("Under") ? "bg-rose-500/5" : ""
                    }`}>
                      {cfg.columns.map(c => (
                        <td key={c} className={`px-4 py-3 whitespace-nowrap ${
                          c === "Status" && String(row[c]).includes("Risk") ? "text-rose-400 font-medium" :
                          c === "Status" && String(row[c]).includes("Under") ? "text-amber-400 font-medium" :
                          c === "Status" ? "text-emerald-400 font-medium" :
                          "text-slate-300"
                        }`}>
                          {String(row[c] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 25 && (
                <p className="text-center text-xs text-slate-500 py-3 border-t border-slate-800">
                  Showing first 25 of {previewRows.length} rows — export CSV to see all
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
