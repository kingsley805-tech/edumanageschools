// @ts-nocheck
﻿import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { formatStudentDisplayName } from "@/billing/lib/studentDisplayName";

interface Props {
  onSuccess?: () => void;
}

type ClassOption = {
  id: string;
  name: string;
  stream: string | null;
};

type TermOption = {
  id: string;
  name: string;
  fees_due_date: string;
};

type FeeItemOption = {
  id: string;
  term_id: string;
  amount: number;
  currency: string | null;
  fee_categories: { name: string } | null;
  terms: { name: string; fees_due_date: string } | null;
};

type ClassStudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
};

function dedupeClassStudents(rows: ClassStudentOption[]): ClassStudentOption[] {
  const seenAdmission = new Set<string>();
  const seenId = new Set<string>();
  const out: ClassStudentOption[] = [];
  for (const row of rows) {
    if (seenId.has(row.id)) continue;
    seenId.add(row.id);
    const admissionKey = row.student_id.trim().toLowerCase() || row.id;
    if (seenAdmission.has(admissionKey)) continue;
    seenAdmission.add(admissionKey);
    out.push(row);
  }
  return out;
}

const buildBulkInvoiceNumber = (studentKey: string) => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const safeStudent = studentKey.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "STD";
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SCH-${date}-${stamp}-${safeStudent}-${rand}`;
};

function isDuplicateInvoiceNumberError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("duplicate") || msg.includes("unique") || msg.includes("billing_invoices_school_id_invoice_number");
}

const createBulkInvoiceForStudent = async ({
  schoolId,
  clientId,
  studentId,
  termId,
  invoiceNumberSeed,
  currency,
  total,
  dueDate,
  issuedBy,
}: {
  schoolId: string;
  clientId: string;
  studentId: string;
  termId: string;
  invoiceNumberSeed: string;
  currency: string;
  total: number;
  dueDate: string;
  issuedBy: string;
}) => {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    const invoiceNumber = attempt === 0 ? invoiceNumberSeed : buildBulkInvoiceNumber(`${invoiceNumberSeed}-${attempt}`);
    const row = {
      school_id: schoolId,
      client_id: clientId,
      student_id: studentId,
      term_id: termId,
      invoice_number: invoiceNumber,
      status: "sent" as const,
      currency,
      subtotal: total,
      total_amount: total,
      amount_paid: 0,
      balance_due: total,
      due_date: dueDate,
      issued_by: issuedBy,
    };

    const { data, error } = await supabase.from("billing_invoices").insert(row).select("id").single();

    if (!error && data?.id) {
      return { data, error: null };
    }

    const { data: existing } = await supabase
      .from("billing_invoices")
      .select("id")
      .eq("school_id", schoolId)
      .eq("invoice_number", invoiceNumber)
      .maybeSingle();
    if (existing?.id) {
      return { data: existing, error: null };
    }

    if (error && isDuplicateInvoiceNumberError(error)) {
      lastError = error.message;
      continue;
    }

    if (error) {
      return { data: null, error: error.message };
    }
  }

  return { data: null, error: lastError ?? "Failed to create invoice." };
};

export default function BulkGenerateDialog({ onSuccess }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const generateInFlightRef = useRef(false);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [feeItems, setFeeItems] = useState<FeeItemOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedFeeItemIds, setSelectedFeeItemIds] = useState<string[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudentOption[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [schoolId, setOrgId] = useState("");
  const [currency, setCurrency] = useState("GHS");

  useEffect(() => {
    if (!open || !user) return;
    const loadData = async () => {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
      if (!profile?.school_id) return;

      setOrgId(profile.school_id);

      const [orgRes, classRes] = await Promise.all([
        supabase.from("schools").select("school_name, name").eq("id", profile.school_id).single(),
        supabase
          .from("classes")
          .select("id, name, stream")
          .eq("school_id", profile.school_id)
          .eq("is_active", true)
          .order("level"),
      ]);

      setCurrency("GHS");
      setClasses((classRes.data || []) as ClassOption[]);
    };

    void loadData();
  }, [open, user]);

  useEffect(() => {
    if (!open || !schoolId || !selectedClassId) {
      setClassStudents([]);
      setSelectedStudentIds([]);
      setFeeItems([]);
      setSelectedTermId("");
      setSelectedFeeItemIds([]);
      return;
    }

    let cancelled = false;
    setLoadingStudents(true);
    void (async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_id")
        .eq("class_id", selectedClassId)
        .eq("school_id", schoolId)
        .or("is_active.is.null,is_active.eq.true")
        .order("student_id");

      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setClassStudents([]);
        setSelectedStudentIds([]);
      } else {
        const deduped = dedupeClassStudents((data ?? []) as ClassStudentOption[]);
        setClassStudents(deduped);
        setSelectedStudentIds(deduped.map((s) => s.id));
      }
      setLoadingStudents(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, schoolId, selectedClassId]);

  useEffect(() => {
    if (!open || !schoolId || !selectedClassId) {
      return;
    }

    const loadAssignedFees = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("fee_assignments")
        .select("fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name), terms(name, fees_due_date))")
        .eq("school_id", schoolId)
        .eq("class_id", selectedClassId)
        .is("student_id", null);

      if (error) {
        toast.error(error.message);
        return;
      }

      const uniqueFees = new Map<string, FeeItemOption>();
      for (const row of data ?? []) {
        const fee = row.fee_items;
        if (!fee?.id || uniqueFees.has(fee.id)) continue;
        uniqueFees.set(fee.id, {
          id: fee.id,
          term_id: fee.term_id,
          amount: Number(fee.amount),
          currency: fee.currency ?? currency,
          fee_categories: fee.fee_categories ?? null,
          terms: fee.terms ?? null,
        });
      }

      setFeeItems(Array.from(uniqueFees.values()));
      setSelectedTermId("");
      setSelectedFeeItemIds([]);
    };

    void loadAssignedFees();
  }, [open, schoolId, selectedClassId, currency]);

  const terms = useMemo(() => {
    const uniqueTerms = new Map<string, TermOption>();
    for (const fee of feeItems) {
      if (!fee.term_id || uniqueTerms.has(fee.term_id)) continue;
      uniqueTerms.set(fee.term_id, {
        id: fee.term_id,
        name: fee.terms?.name ?? "Term",
        fees_due_date: fee.terms?.fees_due_date ?? "",
      });
    }
    return Array.from(uniqueTerms.values());
  }, [feeItems]);

  const selectedTerm = useMemo(
    () => terms.find((item) => item.id === selectedTermId) ?? null,
    [terms, selectedTermId],
  );

  const visibleFeeItems = useMemo(
    () => feeItems.filter((item) => item.term_id === selectedTermId),
    [feeItems, selectedTermId],
  );

  useEffect(() => {
    if (!selectedTermId) {
      setSelectedFeeItemIds([]);
      return;
    }
    setSelectedFeeItemIds(visibleFeeItems.map((item) => item.id));
  }, [selectedTermId, visibleFeeItems]);

  const selectedFeeItems = useMemo(
    () => visibleFeeItems.filter((item) => selectedFeeItemIds.includes(item.id)),
    [visibleFeeItems, selectedFeeItemIds],
  );

  const selectedTotal = useMemo(
    () => selectedFeeItems.reduce((sum, item) => sum + Number(item.amount), 0),
    [selectedFeeItems],
  );

  const toggleFeeItem = (feeItemId: string, checked: boolean) => {
    setSelectedFeeItemIds((prev) => {
      if (checked) return prev.includes(feeItemId) ? prev : [...prev, feeItemId];
      return prev.filter((id) => id !== feeItemId);
    });
  };

  const resetModal = () => {
    setSelectedClassId("");
    setSelectedTermId("");
    setSelectedFeeItemIds([]);
    setFeeItems([]);
    setClassStudents([]);
    setSelectedStudentIds([]);
  };

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) return prev.includes(studentId) ? prev : [...prev, studentId];
      return prev.filter((id) => id !== studentId);
    });
  };

  const selectedStudents = useMemo(
    () => classStudents.filter((s) => selectedStudentIds.includes(s.id)),
    [classStudents, selectedStudentIds],
  );

  const handleGenerate = async () => {
    if (generateInFlightRef.current || generating) return;
    if (!selectedClassId || !selectedTerm || !schoolId) return;
    if (selectedFeeItems.length === 0) {
      toast.error("Select at least one assigned fee.");
      return;
    }
    if (selectedStudents.length === 0) {
      toast.error("Select at least one student.");
      return;
    }

    generateInFlightRef.current = true;
    setGenerating(true);
    try {
      const students = selectedStudents;

      let { data: defaultClient } = await supabase
        .from("clients")
        .select("id")
        .eq("school_id", schoolId)
        .eq("client_type", "school")
        .maybeSingle();

      if (!defaultClient) {
        const { data: newClient } = await supabase
          .from("clients")
          .insert({ school_id: schoolId, name: "School Fees", client_type: "school" })
          .select()
          .single();
        defaultClient = newClient;
      }

      if (!defaultClient) throw new Error("Could not create default client");

      let created = 0;
      const failures: string[] = [];
      for (const student of students) {
        const seededInvoiceNumber = buildBulkInvoiceNumber(student.student_id);
        const { data: invoice, error: invoiceError } = await createBulkInvoiceForStudent({
          schoolId,
          clientId: defaultClient.id,
          studentId: student.id,
          termId: selectedTerm.id,
          invoiceNumberSeed: seededInvoiceNumber,
          currency,
          total: selectedTotal,
          dueDate: selectedTerm.fees_due_date || new Date().toISOString().split("T")[0],
          issuedBy: user!.id,
        });

        if (invoiceError || !invoice) {
          failures.push(`${student.student_id}: ${invoiceError ?? "Could not create invoice."}`);
          continue;
        }

        let lineItemFailed = false;
        for (const item of selectedFeeItems) {
          const { error: lineItemError } = await supabase.from("billing_invoice_line_items").insert({
            invoice_id: invoice.id,
            description: item.fee_categories?.name || "Fee",
            quantity: 1,
            unit_price: Number(item.amount),
            amount: Number(item.amount),
          });
          if (lineItemError) {
            lineItemFailed = true;
            failures.push(`${student.student_id}: ${lineItemError.message}`);
            break;
          }
        }

        if (lineItemFailed) {
          await supabase.from("billing_invoices").delete().eq("id", invoice.id);
          continue;
        }

        created++;
      }

      if (created === 0) {
        throw new Error(failures[0] ?? "No invoices were created.");
      }

      if (failures.length > 0) {
        toast.success(`${created} invoices generated. ${failures.length} student(s) were skipped.`);
      } else {
        toast.success(`${created} invoices generated successfully!`);
      }
      setOpen(false);
      resetModal();
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invoices");
    } finally {
      generateInFlightRef.current = false;
      setGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetModal();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 rounded-xl border-border/80 bg-card/80 px-4 shadow-sm transition-all hover:bg-muted/70">
          <FileText className="mr-2 h-4 w-4" />
          Bulk Invoices
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex max-h-[85vh] flex-col overflow-hidden border-border/80 bg-card/95 shadow-2xl backdrop-blur">
        <DialogHeader>
          <DialogTitle>Bulk Invoices</DialogTitle>
          <DialogDescription>
            Creates one invoice per selected student. Pick class, students, term, and fees — not one invoice per fee line.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder={classes.length > 0 ? "Select class..." : "No classes available"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}{item.stream ? ` ${item.stream}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClassId ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Students</p>
                  <p className="text-xs text-muted-foreground">
                    {loadingStudents
                      ? "Loading class roster…"
                      : `${selectedStudentIds.length} of ${classStudents.length} selected · ${selectedStudentIds.length} invoice(s) will be created`}
                  </p>
                </div>
                {!loadingStudents && classStudents.length > 0 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStudentIds(classStudents.map((s) => s.id))}
                    >
                      All
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedStudentIds([])}>
                      None
                    </Button>
                  </div>
                ) : null}
              </div>
              {loadingStudents ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : classStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active students in this class.</p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {classStudents.map((student) => {
                    const checked = selectedStudentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleStudent(student.id, value === true)}
                        />
                        <span className="text-sm">
                          {formatStudentDisplayName({
                            first_name: student.first_name,
                            last_name: student.last_name,
                            student_id: student.student_id,
                          })}{" "}
                          <span className="text-muted-foreground">({student.student_id})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder={selectedClassId ? (terms.length > 0 ? "Select term..." : "No assigned fees for this class") : "Select class first"} />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                    {term.fees_due_date ? ` · Due ${term.fees_due_date}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTerm ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {selectedTerm.name}
              {selectedTerm.fees_due_date ? ` · Due ${selectedTerm.fees_due_date}` : ""}
            </div>
          ) : null}

          {visibleFeeItems.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Assigned fees</p>
                  <p className="text-xs text-muted-foreground">Choose the saved fees to include on each invoice.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedFeeItemIds(visibleFeeItems.map((item) => item.id))}>
                    Select all
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedFeeItemIds([])}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {visibleFeeItems.map((item) => {
                  const checked = selectedFeeItemIds.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleFeeItem(item.id, value === true)} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.fee_categories?.name ?? "Fee"}</p>
                          <p className="text-xs text-muted-foreground">{item.terms?.name ?? "Term"}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {item.currency || currency} {Number(item.amount).toLocaleString()}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-border/80 pt-3 text-sm">
                <span className="text-muted-foreground">{selectedFeeItems.length} fee(s) selected</span>
                <span className="font-semibold text-primary">
                  Total {currency} {selectedTotal.toLocaleString()}
                </span>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">Use `New Invoice` if you only need one student invoice.</p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={
                generating ||
                !selectedClassId ||
                !selectedTermId ||
                selectedFeeItemIds.length === 0 ||
                selectedStudentIds.length === 0 ||
                loadingStudents
              }
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create {selectedStudentIds.length || 0} invoice{selectedStudentIds.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}