import { useEffect, useRef, useState } from "react";
import { FileDown, FileSpreadsheet, FileText, Loader2, Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatRankLabel,
  type OverallClassReportData,
  type OverallClassStudentRow,
} from "@/report/lib/overall-class-report";
import { exportOverallClassReport } from "@/report/lib/overall-class-report-export";
import { exportElementToPdf, waitForReportAssets } from "@/report/lib/report-pdf";
import { SCHOOL_DISPLAY_NAME } from "@/report/lib/school-brand";
import { canExportClassReport } from "@/report/lib/report-card-status";
import type { ExportFormat } from "@/modules/lib/exportTable";

type Props = {
  data: OverallClassReportData | undefined;
  loading?: boolean;
  schoolName?: string | null;
  /** Workflow status from term_class_reports — print/download require approved. */
  status?: string | null;
  /** When true, allow print/download even without approval (admin preview). */
  allowExportOverride?: boolean;
  onSelectStudent?: (studentId: string) => void;
};

function formatScore(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function StudentMobileCard({
  student,
  index,
  subjects,
  onSelectStudent,
}: {
  student: OverallClassStudentRow;
  index: number;
  subjects: string[];
  onSelectStudent?: (studentId: string) => void;
}) {
  return (
    <article
      className={`rounded-xl border border-neutral-300 p-3.5 ${
        index % 2 === 1 ? "bg-neutral-50" : "bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            #{index + 1}
            {!student.hasReport && " · No card yet"}
          </p>
          {onSelectStudent ? (
            <button
              type="button"
              className="mt-0.5 text-left text-sm font-semibold underline-offset-2 hover:underline"
              onClick={() => onSelectStudent(student.studentId)}
            >
              {student.name}
            </button>
          ) : (
            <p className="mt-0.5 text-sm font-semibold">{student.name}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Position</p>
          {student.overallRank != null ? (
            <span
              className={
                student.overallRank <= 3
                  ? "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-black text-sm font-bold"
                  : "text-sm font-semibold"
              }
            >
              {student.overallRank}
            </span>
          ) : (
            <span className="text-sm text-neutral-400">—</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg bg-neutral-100 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Total</p>
          <p className="font-semibold tabular-nums">
            {student.total != null ? formatScore(student.total) : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-100 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">Average</p>
          <p className="font-semibold tabular-nums">
            {student.average != null ? student.average.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-neutral-200 border-t border-neutral-200">
        {subjects.map((subj, j) => {
          const cell = student.scores[j];
          return (
            <li key={subj} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span className="min-w-0 truncate text-neutral-600">{subj}</span>
              <span className="shrink-0 tabular-nums">
                {cell?.score != null ? (
                  <>
                    <span className="font-semibold">{formatScore(cell.score)}</span>
                    {cell.rank != null && (
                      <span className="ml-1 text-neutral-500">({formatRankLabel(cell.rank)})</span>
                    )}
                  </>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function OverallClassReport({
  data,
  loading,
  schoolName,
  status,
  allowExportOverride = false,
  onSelectStudent,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | "excel" | "word" | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const displaySchool = (schoolName ?? "").trim() || SCHOOL_DISPLAY_NAME;
  const canExport = allowExportOverride || canExportClassReport(status);

  const guardExport = () => {
    if (canExport) return true;
    toast.message("Send this class report to admin for review first. Print and download unlock after approval.");
    return false;
  };

  const handlePrint = async () => {
    if (!guardExport() || !printRef.current) return;
    setBusy("print");
    try {
      await waitForReportAssets(printRef.current);
      document.body.classList.add("printing-report", "printing-overall-class");
      window.addEventListener(
        "afterprint",
        () => {
          document.body.classList.remove("printing-report", "printing-overall-class");
          setBusy(null);
          toast.success("Overall Class Report sent to printer");
        },
        { once: true },
      );
      window.print();
    } catch (err) {
      console.error(err);
      document.body.classList.remove("printing-report", "printing-overall-class");
      setBusy(null);
      toast.error(err instanceof Error ? err.message : "Print failed");
    }
  };

  const handlePdfVisual = async () => {
    if (!guardExport() || !printRef.current || !data) return;
    setBusy("pdf");
    try {
      const safeClass = data.className.replace(/\s+/g, "_");
      const safeTerm = data.termLabel.replace(/\s+/g, "_");
      await exportElementToPdf(
        printRef.current,
        `Overall_Class_Report_${safeClass}_${safeTerm}.pdf`,
      );
      toast.success("Overall Class Report PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  };

  const handleTableExport = (format: ExportFormat) => {
    if (!guardExport() || !data) return;
    setBusy(format === "excel" ? "excel" : format === "word" ? "word" : "pdf");
    try {
      exportOverallClassReport(data, format);
      toast.success(
        format === "excel"
          ? "Excel downloaded"
          : format === "word"
            ? "Word document downloaded"
            : "PDF table downloaded",
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <Skeleton className="mx-auto h-[640px] w-full max-w-6xl" />;
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 sm:p-12 text-center text-sm text-muted-foreground">
        Select a class to view the Overall Class Report.
      </div>
    );
  }

  if (!data.subjects.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 sm:p-12 text-center text-sm text-muted-foreground">
        No subjects assigned to this class yet. Ask your admin to assign subjects under Classes &amp;
        Subjects, then fill individual report cards — scores will appear here automatically.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm text-muted-foreground">
            Synced from each student&apos;s individual report card. Edit a student card to update scores
            here — no re-entry needed.
          </p>
          {!canExport && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Print and download unlock after an admin approves this Overall Class Report.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={!!busy || data.students.length === 0 || !canExport}
            onClick={() => void handlePrint()}
          >
            {busy === "print" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-1 h-4 w-4" />
            )}
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!!busy || data.students.length === 0 || !canExport}
              >
                {busy && busy !== "print" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-1 h-4 w-4" />
                )}
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handlePdfVisual()}>
                <FileText className="mr-2 h-4 w-4" />
                PDF (formatted report)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTableExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" />
                PDF (table)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTableExport("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTableExport("word")}>
                <FileText className="mr-2 h-4 w-4" />
                Word (.doc)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile card list — screen only */}
      <div className="no-print space-y-3 md:hidden">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Office of the Registrar
          </p>
          <h2
            className="mt-1 text-xl font-semibold leading-tight"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {displaySchool}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Overall Class Performance &amp; Position Report
          </p>
          <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{data.academicYear || "Academic Year"}</p>
            <p>{data.termLabel}</p>
            <p>Class: {data.className}</p>
          </div>
        </div>

        {data.students.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No students enrolled in this class.
          </p>
        ) : (
          data.students.map((student, idx) => (
            <StudentMobileCard
              key={student.studentId}
              student={student}
              index={idx}
              subjects={data.subjects}
              onSelectStudent={onSelectStudent}
            />
          ))
        )}
      </div>

      {/* Desktop table + print/PDF source (kept off-screen on mobile so capture still works) */}
      <div
        className="max-md:absolute max-md:-left-[9999px] max-md:top-0 max-md:w-[1024px] md:relative md:left-auto md:w-full md:min-h-screen md:bg-neutral-200 md:py-10 md:px-4 print:relative print:left-0 print:top-auto print:w-auto print:min-h-0 print:bg-white print:p-0 print:block"
        aria-hidden={isMobileViewport || undefined}
        {...(isMobileViewport ? ({ inert: "" } as Record<string, string>) : {})}
      >
        <div
          ref={printRef}
          className="ocr-page mx-auto max-w-6xl overflow-hidden bg-white text-black shadow-lg print:shadow-none"
        >
          <div className="border-b-4 border-black px-4 pt-6 pb-4 sm:px-8 sm:pt-8 md:px-10 md:pt-10 md:pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.35em] text-neutral-500">
                  Office of the Registrar
                </p>
                <h1
                  className="mt-1 text-2xl sm:text-3xl md:text-4xl leading-tight sm:leading-none break-words"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {displaySchool}
                </h1>
                <p className="mt-2 text-sm text-neutral-600">
                  Overall Class Performance &amp; Position Report
                </p>
              </div>
              <div className="text-left sm:text-right text-sm text-neutral-600 shrink-0">
                <p className="font-semibold text-black">
                  {data.academicYear || "Academic Year"}
                </p>
                <p>{data.termLabel}</p>
                <p>Class: {data.className}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overscroll-x-contain px-2 pt-4 sm:px-6 sm:pt-6 md:px-10 md:pt-8 [-webkit-overflow-scrolling:touch]">
            <p className="mb-2 text-[10px] text-neutral-500 md:hidden print:hidden">
              Swipe sideways to see all subjects
            </p>
            <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-black text-white">
                  <th className="sticky left-0 z-20 border border-black bg-black px-2 py-2 sm:px-3 sm:py-3 text-left font-semibold w-10 sm:w-14">
                    No.
                  </th>
                  <th className="sticky left-10 sm:left-14 z-20 border border-black bg-black px-2 py-2 sm:px-3 sm:py-3 text-left font-semibold min-w-[120px] sm:min-w-[170px]">
                    Student Name
                  </th>
                  {data.subjects.map((subj) => (
                    <th
                      key={subj}
                      className="border border-black px-2 py-2 sm:px-3 sm:py-3 text-center font-semibold min-w-[88px]"
                    >
                      <span className="block leading-tight">{subj}</span>
                      <span className="mt-0.5 block text-[9px] font-normal uppercase tracking-wider text-neutral-300">
                        Score / Pos.
                      </span>
                    </th>
                  ))}
                  <th className="border border-black px-2 py-2 sm:px-3 sm:py-3 text-center font-semibold">
                    Total
                  </th>
                  <th className="border border-black px-2 py-2 sm:px-3 sm:py-3 text-center font-semibold">
                    Average
                  </th>
                  <th className="border border-black px-2 py-2 sm:px-3 sm:py-3 text-center font-semibold">
                    Overall
                    <span className="block text-[9px] font-normal uppercase tracking-wider text-neutral-300">
                      Position
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.subjects.length + 5}
                      className="border border-neutral-300 px-3 py-8 text-center text-neutral-500"
                    >
                      No students enrolled in this class.
                    </td>
                  </tr>
                ) : (
                  data.students.map((student, idx) => (
                    <tr
                      key={student.studentId}
                      className={idx % 2 === 1 ? "bg-neutral-100" : "bg-white"}
                    >
                      <td
                        className={`sticky left-0 z-10 border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 text-center tabular-nums text-neutral-600 ${
                          idx % 2 === 1 ? "bg-neutral-100" : "bg-white"
                        }`}
                      >
                        {idx + 1}
                      </td>
                      <td
                        className={`sticky left-10 sm:left-14 z-10 border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 font-medium ${
                          idx % 2 === 1 ? "bg-neutral-100" : "bg-white"
                        }`}
                      >
                        {onSelectStudent ? (
                          <>
                            <button
                              type="button"
                              className="no-print text-left underline-offset-2 hover:underline"
                              onClick={() => onSelectStudent(student.studentId)}
                              title="Open this student's individual report card"
                            >
                              {student.name}
                              {!student.hasReport && (
                                <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-neutral-400">
                                  No card yet
                                </span>
                              )}
                            </button>
                            <span className="hidden print:inline">{student.name}</span>
                          </>
                        ) : (
                          student.name
                        )}
                      </td>
                      {student.scores.map((cell, j) => (
                        <td
                          key={j}
                          className="border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 text-center tabular-nums whitespace-nowrap"
                        >
                          {cell.score != null ? (
                            <>
                              <span className="font-semibold">{formatScore(cell.score)}</span>
                              {cell.rank != null && (
                                <span className="ml-1 text-[11px] text-neutral-500">
                                  ({formatRankLabel(cell.rank)})
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      ))}
                      <td className="border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 text-center font-semibold tabular-nums">
                        {student.total != null ? formatScore(student.total) : "—"}
                      </td>
                      <td className="border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 text-center tabular-nums">
                        {student.average != null ? student.average.toFixed(1) : "—"}
                      </td>
                      <td className="border border-neutral-300 px-2 py-2 sm:px-3 sm:py-2.5 text-center">
                        {student.overallRank != null ? (
                          <span
                            className={
                              student.overallRank <= 3
                                ? "inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-black font-bold"
                                : "font-semibold"
                            }
                          >
                            {student.overallRank}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 pt-4 pb-3 sm:px-8 sm:pt-6 sm:pb-4 md:px-10">
            <p className="text-[11px] text-neutral-500">
              Figures in parentheses denote each student&apos;s rank within that subject for the
              class. Circled numbers under Overall Position mark the top three students by total
              score. Ranking method: standard competition ranking (equal scores share equal rank).
              Scores are taken from each student&apos;s individual report card for this term.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 border-t border-black px-4 py-6 sm:grid-cols-3 sm:gap-8 sm:px-8 sm:py-8 md:px-10 md:py-10">
            <div>
              <div className="h-10 border-b border-black" />
              <p className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">
                Class Teacher
              </p>
            </div>
            <div>
              <div className="h-10 border-b border-black" />
              <p className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">
                Head Teacher
              </p>
            </div>
            <div>
              <div className="h-10 border-b border-black" />
              <p className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">
                Date Issued
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
