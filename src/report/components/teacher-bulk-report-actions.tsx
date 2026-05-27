import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, List, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BulkReportPrintStack,
  type BulkReportExportHandle,
} from "@/report/components/bulk-report-export";
import { useGradingFormat } from "@/report/hooks/use-school-data";
import { useReportSignatures } from "@/report/hooks/use-report-signatures";
import { canExportPdf, statusBadgeVariant, statusLabel } from "@/report/lib/report-card-status";
import {
  exportElementToPdf,
  exportElementsToMergedPdf,
  printBulkReportCards,
  waitForReportAssets,
} from "@/report/lib/report-pdf";
import { fetchClassTermExportableReports } from "@/report/lib/term-report";

type Props = {
  classId: string;
  termId: string;
  teacherId: string;
  schoolId: string;
  className?: string;
  termLabel?: string;
  students?: { id: string; full_name: string }[];
  onSelectStudent?: (studentId: string) => void;
};

export function TeacherBulkReportActions({
  classId,
  termId,
  teacherId,
  schoolId,
  className,
  termLabel,
  students,
  onSelectStudent,
}: Props) {
  const gradingFormat = useGradingFormat();
  const stackRef = useRef<BulkReportExportHandle>(null);
  const [busy, setBusy] = useState<"print" | "pdf" | string | null>(null);
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);

  const { data: exportable = [], isLoading, refetch } = useQuery({
    queryKey: ["class-term-exportable-reports", classId, termId, teacherId, gradingFormat],
    enabled: !!classId && !!termId && !!teacherId,
    queryFn: () =>
      fetchClassTermExportableReports({ classId, termId, teacherId }, gradingFormat),
  });

  const { teacherSignatureUrl, headSignatureUrl, isLoading: sigLoading } = useReportSignatures({
    schoolId,
    teacherId,
    enabled: exportable.length > 0,
  });

  const byStudentId = new Map(exportable.map((r) => [r.studentId, r]));
  const count = exportable.length;

  const waitForStack = async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const runBulkPrint = async () => {
    if (!count) {
      toast.message("No printable reports for this class and term yet.");
      return;
    }
    setBusy("print");
    try {
      await waitForStack();
      const container = document.querySelector(".bulk-report-stack");
      if (!(container instanceof HTMLElement)) {
        throw new Error("Could not prepare reports for printing.");
      }
      await printBulkReportCards(container);
      toast.success(`Sent ${count} report card${count === 1 ? "" : "s"} to printer`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Bulk print failed");
    } finally {
      setBusy(null);
    }
  };

  const runBulkPdf = async () => {
    if (!count) {
      toast.message("No printable reports for this class and term yet.");
      return;
    }
    setBusy("pdf");
    try {
      await waitForStack();
      const cards = stackRef.current?.getCardElements() ?? [];
      if (!cards.length) throw new Error("Could not capture report cards.");
      const safeClass = (className ?? "class").replace(/\s+/g, "_");
      const safeTerm = (termLabel ?? "term").replace(/\s+/g, "_");
      await exportElementsToMergedPdf(
        cards,
        `Reports_${safeClass}_${safeTerm}.pdf`,
      );
      toast.success(`Downloaded ${count} report card${count === 1 ? "" : "s"} as one PDF`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Bulk PDF failed");
    } finally {
      setBusy(null);
    }
  };

  const runSinglePrint = async (studentId: string) => {
    if (!byStudentId.has(studentId)) return;
    setBusy(`print-${studentId}`);
    try {
      await waitForStack();
      const stack = document.querySelector(".bulk-report-stack");
      const activePage = stack?.querySelector(
        `.bulk-report-page[data-student-id="${studentId}"]`,
      );
      if (!(activePage instanceof HTMLElement)) {
        throw new Error("Report not ready for printing.");
      }
      stack?.querySelectorAll(".bulk-report-page").forEach((el) => {
        el.classList.remove("print-active");
      });
      activePage.classList.add("print-active");
      const card = activePage.querySelector(".rc-card");
      if (card instanceof HTMLElement) await waitForReportAssets(card);
      document.body.classList.add("printing-report", "printing-single");
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          document.body.classList.remove("printing-report", "printing-single");
          activePage.classList.remove("print-active");
          window.removeEventListener("afterprint", onAfter);
        };
        const onAfter = () => {
          cleanup();
          resolve();
        };
        window.addEventListener("afterprint", onAfter, { once: true });
        try {
          window.print();
        } catch (e) {
          cleanup();
          reject(e);
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setBusy(null);
    }
  };

  const runSinglePdf = async (studentId: string) => {
    const item = byStudentId.get(studentId);
    if (!item) return;
    setBusy(`pdf-${studentId}`);
    try {
      await waitForStack();
      const card = document.querySelector(
        `.bulk-report-page[data-student-id="${studentId}"] .rc-card`,
      );
      if (!(card instanceof HTMLElement)) {
        throw new Error("Report not ready for PDF.");
      }
      await exportElementToPdf(card, `Report_${item.studentName.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setBusy(null);
    }
  };

  const roster = students ?? exportable.map((r) => ({ id: r.studentId, full_name: r.studentName }));

  const studentsTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roster.map((s) => {
          const report = byStudentId.get(s.id);
          const exportableRow = report && canExportPdf(report.status);
          return (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.full_name}</TableCell>
              <TableCell>
                {report ? (
                  <Badge variant={statusBadgeVariant(report.status)}>
                    {statusLabel(report.status)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Not submitted</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1 flex-wrap">
                  {onSelectStudent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onSelectStudent(s.id);
                        setStudentsModalOpen(false);
                      }}
                    >
                      Open
                    </Button>
                  )}
                  {exportableRow ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Print ${s.full_name}`}
                        disabled={busy !== null || sigLoading}
                        onClick={() => void runSinglePrint(s.id)}
                      >
                        {busy === `print-${s.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Download PDF for ${s.full_name}`}
                        disabled={busy !== null || sigLoading}
                        onClick={() => void runSinglePdf(s.id)}
                      >
                        {busy === `pdf-${s.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground py-2">
                      Submit for review to print
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <>
      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Print &amp; PDF — current term</CardTitle>
          <CardDescription>
            {className && termLabel
              ? `${className} · ${termLabel}. `
              : null}
            Bulk actions include all submitted report cards for this class (
            {isLoading || sigLoading ? "…" : count} ready
            {roster.length ? ` of ${roster.length} students` : ""}).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!count || busy !== null || isLoading || sigLoading}
            onClick={() => void runBulkPrint()}
          >
            {busy === "print" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-1 h-4 w-4" />
            )}
            Print all ({count})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!count || busy !== null || isLoading || sigLoading}
            onClick={() => void runBulkPdf()}
          >
            {busy === "pdf" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1 h-4 w-4" />
            )}
            PDF all ({count})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => void refetch()}
          >
            Refresh list
          </Button>
          {roster.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => setStudentsModalOpen(true)}
            >
              <List className="mr-1 h-4 w-4" />
              View available reports
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={studentsModalOpen} onOpenChange={setStudentsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Students — single print / PDF</DialogTitle>
            <DialogDescription>
              {className && termLabel
                ? `${className} · ${termLabel}. `
                : null}
              Print or download one report per student. Reports must be submitted for review before
              print/PDF is available.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto px-6 pb-6 flex-1 min-h-0">
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No students in this class.</p>
            ) : (
              studentsTable
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BulkReportPrintStack
        ref={stackRef}
        items={exportable}
        schoolId={schoolId}
        teacherSignatureUrl={teacherSignatureUrl}
        headSignatureUrl={headSignatureUrl}
      />
    </>
  );
}
