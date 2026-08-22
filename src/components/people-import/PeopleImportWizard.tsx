import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  type BulkImportResponse,
  type BulkImportRowResult,
  type PeopleImportEntity,
  type ValidatedImportRow,
  downloadImportResultReport,
  downloadImportTemplate,
  downloadValidationErrorReport,
  loadImportLookups,
  ensureMissingImportLookups,
  parseWorkbookFile,
  validateRows,
} from "@/lib/people-import";

type Step = "upload" | "preview" | "importing" | "results";

const ENTITY_LABEL: Record<PeopleImportEntity, string> = {
  student: "Students",
  teacher: "Teachers",
  parent: "Parents",
};

const CHUNK_SIZE = 25;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: PeopleImportEntity;
  schoolId: string;
  onComplete?: () => void;
};

export function PeopleImportWizard({ open, onOpenChange, entity, schoolId, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ValidatedImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkImportRowResult[]>([]);
  const [summary, setSummary] = useState<BulkImportResponse["summary"] | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setRows([]);
    setImporting(false);
    setProgress(0);
    setResults([]);
    setSummary(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const validRows = useMemo(
    () => rows.filter((r) => r.status === "valid" || r.status === "update"),
    [rows],
  );
  const invalidRows = useMemo(() => rows.filter((r) => r.status === "invalid"), [rows]);
  const updateCount = useMemo(() => rows.filter((r) => r.status === "update").length, [rows]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Please upload an .xlsx or .xls file.");
      return;
    }
    try {
      const parsed = await parseWorkbookFile(file);
      if (!parsed.rows.length) {
        toast.error("No data rows found in the spreadsheet.");
        return;
      }
      const lookups = await loadImportLookups(schoolId, entity);
      const ensured = await ensureMissingImportLookups(schoolId, entity, parsed.rows, lookups);
      const validated = validateRows(entity, parsed.rows, ensured.lookups);
      setFileName(file.name);
      setRows(validated);
      setStep("preview");
      const createdBits = [
        ensured.createdClasses.length
          ? `${ensured.createdClasses.length} class(es) created`
          : null,
        ensured.createdSubjects.length
          ? `${ensured.createdSubjects.length} subject(s) created`
          : null,
      ].filter(Boolean);
      toast.success(
        createdBits.length
          ? `Validated ${validated.length} row(s). ${createdBits.join("; ")}.`
          : `Validated ${validated.length} row(s).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read spreadsheet");
    }
  };

  const runImport = async () => {
    if (!validRows.length) {
      toast.error("No valid rows to import.");
      return;
    }
    setStep("importing");
    setImporting(true);
    setProgress(0);
    const allResults: BulkImportRowResult[] = [];
    const agg = { total: validRows.length, created: 0, updated: 0, skipped: 0, failed: 0 };

    try {
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const data = await invokeEdgeFunction<BulkImportResponse>("bulk-import-people", {
          entity,
          mode: "create_or_update",
          school_id: schoolId,
          rows: chunk.map((r) => ({
            rowNumber: r.rowNumber,
            ...(r.payload ?? {}),
          })),
        });

        const chunkResults = data.results ?? [];
        allResults.push(...chunkResults);
        for (const r of chunkResults) {
          if (r.action === "created") agg.created += 1;
          else if (r.action === "updated") agg.updated += 1;
          else if (r.action === "skipped") agg.skipped += 1;
          else agg.failed += 1;
        }
        setProgress(Math.round(((i + chunk.length) / validRows.length) * 100));
      }

      // Count invalid as skipped in overall totals display
      agg.skipped += invalidRows.length;
      agg.total = rows.length;

      setResults(allResults);
      setSummary(agg);
      setStep("results");
      onComplete?.();
      toast.success(
        `Import finished: ${agg.created} created, ${agg.updated} updated, ${agg.failed} failed.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import {ENTITY_LABEL[entity]} from Excel</DialogTitle>
          <DialogDescription>
            Upload → Validate → Preview → Confirm. Existing records matched by ID are updated safely.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => downloadImportTemplate(entity)}>
                <Download className="h-4 w-4 mr-2" />
                Download template
              </Button>
            </div>
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-10 cursor-pointer hover:bg-muted/40 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div className="text-sm text-center">
                <span className="font-medium">Click to upload</span> or drop an .xlsx / .xls file
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 min-h-0 flex-1 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{fileName}</Badge>
              <Badge className="bg-success/10 text-success border-success/20">
                {validRows.length} ready
              </Badge>
              {updateCount > 0 && (
                <Badge variant="outline">{updateCount} will update</Badge>
              )}
              <Badge variant="destructive">{invalidRows.length} invalid</Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadValidationErrorReport(entity, rows)}
                disabled={!invalidRows.length}
              >
                Download errors
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Re-upload
              </Button>
            </div>

            <Tabs defaultValue={invalidRows.length ? "invalid" : "valid"} className="min-h-0 flex-1 flex flex-col">
              <TabsList>
                <TabsTrigger value="valid">Valid ({validRows.length})</TabsTrigger>
                <TabsTrigger value="invalid">Invalid ({invalidRows.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="valid" className="min-h-0 flex-1">
                <ScrollArea className="h-[320px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Warnings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No valid rows
                          </TableCell>
                        </TableRow>
                      ) : (
                        validRows.map((r) => (
                          <TableRow key={r.rowNumber}>
                            <TableCell>{r.rowNumber}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "update" ? "outline" : "default"}>
                                {r.status === "update" ? "Update" : "Create"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {(r.payload?.full_name as string) ?? "—"}
                              {r.payload?.admission_no
                                ? ` · ${String(r.payload.admission_no)}`
                                : r.payload?.employee_no
                                  ? ` · ${String(r.payload.employee_no)}`
                                  : r.payload?.email
                                    ? ` · ${String(r.payload.email)}`
                                    : ""}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.warnings.join("; ") || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="invalid" className="min-h-0 flex-1">
                <ScrollArea className="h-[320px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                            No invalid rows
                          </TableCell>
                        </TableRow>
                      ) : (
                        invalidRows.map((r) => (
                          <TableRow key={r.rowNumber}>
                            <TableCell>{r.rowNumber}</TableCell>
                            <TableCell className="text-sm text-destructive">
                              {r.errors.join("; ")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4 animate-pulse" />
              Importing valid rows…
            </div>
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "results" && summary && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "Total", value: summary.total },
                { label: "Created", value: summary.created },
                { label: "Updated", value: summary.updated },
                { label: "Skipped", value: summary.skipped },
                { label: "Failed", value: summary.failed },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {summary.failed > 0 ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              Invalid rows were skipped. Existing matches were updated without creating duplicates.
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadImportResultReport(entity, results)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download result details
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void runImport()} disabled={!validRows.length || importing}>
                Import {validRows.length} valid row{validRows.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "results" && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
