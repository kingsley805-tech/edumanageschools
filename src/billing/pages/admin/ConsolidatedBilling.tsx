// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { BillingFeePageShell, BillingFeeLoadingState } from "@/billing/components/BillingFeePageShell";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, MessageCircle, Printer, RefreshCw, Users } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import {
  createFamilyInvoiceFromFees,
  fetchClassFeesForClassIds,
  fetchFamilyClasses,
  fetchParentsForStudentIds,
  fetchStudentsForClassIds,
  notifyFamilyInvoiceWhatsApp,
  previewFamilyInvoiceLines,
  type FamilyClassFee,
  type FamilyClassOption,
  type FamilyInvoiceLinePreview,
  type FamilyParentCandidate,
  type FamilyStudentRow,
} from "@/billing/lib/familyBilling";
import { printFamilyInvoice } from "@/billing/lib/familyInvoicePrint";

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function ConsolidatedBilling() {
  const { user } = useAuth();
  const { schoolId, loading: authLoading } = useBillingAuth();

  const [classes, setClasses] = useState<FamilyClassOption[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [students, setStudents] = useState<FamilyStudentRow[]>([]);
  const [classFees, setClassFees] = useState<FamilyClassFee[]>([]);
  const [parents, setParents] = useState<FamilyParentCandidate[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());
  const [selectedParentId, setSelectedParentId] = useState("");
  const [manualParentName, setManualParentName] = useState("");
  const [manualParentPhone, setManualParentPhone] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [previewLines, setPreviewLines] = useState<FamilyInvoiceLinePreview[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const classIds = useMemo(() => [...selectedClassIds], [selectedClassIds]);

  const selectedStudents = useMemo(
    () => students.filter((s) => selectedStudentIds.has(s.id)),
    [students, selectedStudentIds],
  );

  const selectedParent = useMemo(
    () => parents.find((p) => p.id === selectedParentId) ?? null,
    [parents, selectedParentId],
  );

  const parentOptions = useMemo(
    () =>
      parents.map((p) => ({
        value: p.id,
        label: p.name,
        description: `${p.linkedStudentIds.length} linked ${p.linkedStudentIds.length === 1 ? "child" : "children"}${p.phone ? ` · ${p.phone}` : ""}`,
      })),
    [parents],
  );

  const terms = useMemo(() => {
    const map = new Map<string, string>();
    for (const fee of classFees) {
      if (!map.has(fee.termId)) map.set(fee.termId, fee.termName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [classFees]);

  const [selectedTermId, setSelectedTermId] = useState("");

  const visibleFees = useMemo(
    () => classFees.filter((f) => !selectedTermId || f.termId === selectedTermId),
    [classFees, selectedTermId],
  );

  const previewTotal = useMemo(
    () => previewLines.reduce((sum, line) => sum + line.amount, 0),
    [previewLines],
  );

  const currency = previewLines[0]?.currency ?? classFees[0]?.currency ?? "GHS";

  const loadClasses = useCallback(async () => {
    if (!schoolId) return;
    setLoadingClasses(true);
    try {
      setClasses(await fetchFamilyClasses(schoolId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load classes");
    } finally {
      setLoadingClasses(false);
    }
  }, [schoolId]);

  const loadStudentsAndFees = useCallback(async () => {
    if (!schoolId || !classIds.length) {
      setStudents([]);
      setClassFees([]);
      setSelectedStudentIds(new Set());
      setSelectedFeeIds(new Set());
      setParents([]);
      setSelectedParentId("");
      return;
    }
    setLoadingStudents(true);
    try {
      const [studentRows, fees] = await Promise.all([
        fetchStudentsForClassIds(schoolId, classIds),
        fetchClassFeesForClassIds(schoolId, classIds),
      ]);
      setStudents(studentRows);
      setClassFees(fees);
      setSelectedStudentIds(new Set(studentRows.map((s) => s.id)));
      const termIds = [...new Set(fees.map((f) => f.termId))];
      setSelectedTermId(termIds[0] ?? "");
      const termFees = fees.filter((f) => f.termId === (termIds[0] ?? ""));
      setSelectedFeeIds(new Set(termFees.map((f) => f.id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load students or fees");
    } finally {
      setLoadingStudents(false);
    }
  }, [schoolId, classIds]);

  const loadParents = useCallback(async () => {
    if (!schoolId || !selectedStudentIds.size) {
      setParents([]);
      setSelectedParentId("");
      return;
    }
    try {
      const rows = await fetchParentsForStudentIds(schoolId, [...selectedStudentIds]);
      setParents(rows);
      const shared = rows.filter((p) =>
        selectedStudents.every((s) => p.linkedStudentIds.includes(s.id)),
      );
      if (shared.length === 1) {
        setSelectedParentId(shared[0].id);
        setManualParentName(shared[0].name);
        setManualParentPhone(shared[0].phone ?? "");
      } else if (shared.length > 1 && !selectedParentId) {
        setSelectedParentId(shared[0].id);
        setManualParentName(shared[0].name);
        setManualParentPhone(shared[0].phone ?? "");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load parents");
    }
  }, [schoolId, selectedStudentIds, selectedStudents, selectedParentId]);

  const loadPreview = useCallback(async () => {
    if (!schoolId || !selectedStudents.length || !selectedFeeIds.size) {
      setPreviewLines([]);
      return;
    }
    setLoadingPreview(true);
    try {
      const lines = await previewFamilyInvoiceLines(schoolId, selectedStudents, [...selectedFeeIds]);
      setPreviewLines(lines);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to preview invoice");
      setPreviewLines([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [schoolId, selectedStudents, selectedFeeIds]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    void loadStudentsAndFees();
  }, [loadStudentsAndFees]);

  useEffect(() => {
    void loadParents();
  }, [loadParents]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (!selectedParent) return;
    setManualParentName(selectedParent.name);
    setManualParentPhone(selectedParent.phone ?? "");
  }, [selectedParent]);

  useEffect(() => {
    if (!selectedTermId) return;
    const ids = visibleFees.map((f) => f.id);
    setSelectedFeeIds(new Set(ids));
  }, [selectedTermId, visibleFees]);

  const toggleClass = (id: string, checked: boolean) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleStudent = (id: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleFee = (id: string, checked: boolean) => {
    setSelectedFeeIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const validateBeforeCreate = () => {
    if (!schoolId || !user) return null;
    if (!classIds.length) {
      toast.error("Select at least one class.");
      return null;
    }
    if (!selectedStudents.length) {
      toast.error("Select at least one student.");
      return null;
    }
    if (!selectedFeeIds.size) {
      toast.error("Select at least one class fee.");
      return null;
    }
    if (!previewLines.length) {
      toast.error("No billable lines for this selection.");
      return null;
    }
    if (!manualParentName.trim() && !selectedParent) {
      toast.error("Enter or assign a parent name.");
      return null;
    }
    return {
      parentId: selectedParentId || null,
      parentName: manualParentName.trim() || selectedParent?.name || "Parent",
      parentPhone: manualParentPhone.trim() || selectedParent?.phone || null,
    };
  };

  const runCreate = async (action: "create" | "send" | "print") => {
    const validated = validateBeforeCreate();
    if (!validated || !schoolId || !user) return;

    if (action === "send" && !validated.parentPhone && !selectedParentId) {
      toast.error("Enter a phone number or select a linked parent to send via WhatsApp.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createFamilyInvoiceFromFees({
        schoolId,
        parentId: validated.parentId,
        parentName: validated.parentName,
        students: selectedStudents,
        feeItemIds: [...selectedFeeIds],
        dueDate,
        issuedBy: user.id,
        termId: selectedTermId || null,
      });

      const childNames = [...new Set(result.lineItems.map((l) => l.studentName))];

      if (action === "send") {
        const wa = await notifyFamilyInvoiceWhatsApp({
          schoolId,
          parentId: result.parentId,
          studentId: selectedStudents[0].id,
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          childNames,
          total: result.total,
          currency: result.currency,
          dueDate,
          createdBy: user.id,
          force: true,
          manualPhone: validated.parentPhone,
        });
        if (wa.errors.length) toast.error(wa.errors[0]);
        else toast.success(`Invoice ${result.invoiceNumber} sent via WhatsApp`);
      } else if (action === "print") {
        await printFamilyInvoice({
          schoolId,
          invoiceNumber: result.invoiceNumber,
          parentName: validated.parentName,
          parentPhone: validated.parentPhone,
          dueDate,
          currency: result.currency,
          total: result.total,
          lineItems: result.lineItems,
          childNames,
        });
        toast.success(`Invoice ${result.invoiceNumber} ready to print`);
      } else {
        toast.success(`Family invoice ${result.invoiceNumber} created`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create family invoice");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingClasses) {
    return (
      <BillingFeePageShell
        title="Family billing"
        description="Select classes and students, assign class fees to a parent, then send or print."
      >
        <BillingFeeLoadingState />
      </BillingFeePageShell>
    );
  }

  return (
    <BillingFeePageShell
      title="Family billing"
      description="Pick class(es) and students, use fees assigned to those classes, assign a parent, then send or print one combined invoice."
      actions={
        <Button variant="outline" size="sm" onClick={() => void loadClasses()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select class(es)</CardTitle>
            <CardDescription>Fees are loaded from assignments on each class.</CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes found. Add classes and assign fees first.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((cls) => (
                  <label
                    key={cls.id}
                    className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedClassIds.has(cls.id)}
                      onCheckedChange={(v) => toggleClass(cls.id, Boolean(v))}
                    />
                    <span className="text-sm font-medium">{cls.label}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {classIds.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Select students</CardTitle>
                <CardDescription>Students in the selected class(es).</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingStudents ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No students in selected classes.</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={students.length > 0 && selectedStudentIds.size === students.length}
                              onCheckedChange={(v) =>
                                setSelectedStudentIds(v ? new Set(students.map((s) => s.id)) : new Set())
                              }
                            />
                          </TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedStudentIds.has(student.id)}
                                onCheckedChange={(v) => toggleStudent(student.id, Boolean(v))}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.className}</TableCell>
                            <TableCell className="font-mono text-xs">{student.admission}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Class fees</CardTitle>
                <CardDescription>Fees assigned to the selected class(es).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingStudents ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                ) : classFees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No fees assigned to these classes. Assign fees on Fee Structure first.
                  </p>
                ) : (
                  <>
                    {terms.length > 1 && (
                      <div className="space-y-2 max-w-xs">
                        <Label>Term</Label>
                        <SearchableSelect
                          options={terms.map((t) => ({ value: t.id, label: t.name }))}
                          value={selectedTermId}
                          onChange={setSelectedTermId}
                          placeholder="Select term…"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      {visibleFees.map((fee) => (
                        <label
                          key={fee.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedFeeIds.has(fee.id)}
                              onCheckedChange={(v) => toggleFee(fee.id, Boolean(v))}
                            />
                            <div>
                              <p className="font-medium text-sm">{fee.feeName}</p>
                              <p className="text-xs text-muted-foreground">
                                {fee.classLabels.join(", ")} · {fee.termName}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">{formatMoney(fee.amount, fee.currency)}</Badge>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  4. Assign parent
                </CardTitle>
                <CardDescription>Pick a linked parent or enter contact details.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Linked parent</Label>
                  <SearchableSelect
                    options={parentOptions}
                    value={selectedParentId}
                    onChange={setSelectedParentId}
                    placeholder={parents.length ? "Choose parent…" : "No linked parents for selected students"}
                    emptyText="Link parents on Parent-Student Link page."
                    allowClear
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-name">Parent name</Label>
                  <Input
                    id="parent-name"
                    value={manualParentName}
                    onChange={(e) => setManualParentName(e.target.value)}
                    placeholder="Parent / guardian name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parent-phone">Phone / WhatsApp</Label>
                  <Input
                    id="parent-phone"
                    value={manualParentPhone}
                    onChange={(e) => setManualParentPhone(e.target.value)}
                    placeholder="e.g. 233XXXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice preview</CardTitle>
                <CardDescription>
                  {loadingPreview
                    ? "Calculating…"
                    : previewLines.length
                      ? `${previewLines.length} line(s) · ${formatMoney(previewTotal, currency)}`
                      : "Select students and fees to preview."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {previewLines.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Fee</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewLines.map((line, idx) => (
                          <TableRow key={`${line.studentId}-${line.feeName}-${idx}`}>
                            <TableCell>
                              <div className="font-medium">{line.studentName}</div>
                              <div className="text-xs text-muted-foreground">{line.className}</div>
                            </TableCell>
                            <TableCell>{line.feeName}</TableCell>
                            <TableCell className="text-right">{formatMoney(line.amount, line.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    onClick={() => void runCreate("create")}
                    disabled={submitting || !previewLines.length}
                    variant="outline"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create invoice
                  </Button>
                  <Button
                    onClick={() => void runCreate("send")}
                    disabled={submitting || !previewLines.length}
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                    Create &amp; send
                  </Button>
                  <Button
                    onClick={() => void runCreate("print")}
                    disabled={submitting || !previewLines.length}
                    variant="secondary"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    Create &amp; print
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BillingFeePageShell>
  );
}
