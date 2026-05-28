// @ts-nocheck
﻿import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";
import {
  fetchInvoiceAssignableFees,
  type InvoiceAssignableFee,
} from "@/billing/lib/fee-assignments";
import {
  createBillingInvoiceWithRetry,
  formatSupabaseError,
  insertBillingInvoiceLineItems,
} from "@/billing/lib/invoices";

interface NewInvoiceDialogProps {
  onSuccess?: () => void;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_id: string | null;
  linkedProfile: { first_name: string; last_name: string } | null;
}

interface TermOption {
  id: string;
  name: string;
  end_date: string | null;
  is_current?: boolean | null;
}

type SavedFeeOption = InvoiceAssignableFee;

const buildInvoiceNumber = (prefix = "INV") => {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const stamp = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${date}-${stamp}-${rand}`;
};

export default function NewInvoiceDialog({ onSuccess }: NewInvoiceDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [schoolId, setOrgId] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [savedFees, setSavedFees] = useState<SavedFeeOption[]>([]);
  const [selectedSavedFeeIds, setSelectedSavedFeeIds] = useState<string[]>([]);
  const [loadingAssignedFees, setLoadingAssignedFees] = useState(false);
  const [assignedFeesHint, setAssignedFeesHint] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("none");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("Tuition Fees");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"draft" | "sent">("sent");

  useEffect(() => {
    if (!open || !user) return;

    const fetchData = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.school_id) {
        toast.error("Organization not found");
        return;
      }

      setOrgId(profile.school_id);

      const [orgRes, termsRes, studentRows] = await Promise.all([
        supabase.from("schools").select("school_name, name").eq("id", profile.school_id).maybeSingle(),
        supabase
          .from("terms")
          .select("id, name, end_date, is_current")
          .eq("school_id", profile.school_id)
          .order("start_date", { ascending: false }),
        fetchStudentsWithLinkedProfiles(profile.school_id),
      ]);

      setCurrency("GHS");
      setStudents(
        studentRows
          .filter((student) => student.is_active)
          .map((student) => ({
            id: student.id as string,
            first_name: student.first_name as string,
            last_name: student.last_name as string,
            student_id: student.student_id as string,
            class_id: (student.class_id as string | null) ?? null,
            linkedProfile: student.linkedProfile ?? null,
          })),
      );
      const termRows = (termsRes.data ?? []) as TermOption[];
      setTerms(termRows);

      const current = termRows.find((t) => t.is_current);
      if (current) setTermId(current.id);
    };

    void fetchData();
  }, [open, user]);

  const selectedTerm = useMemo(() => terms.find((term) => term.id === termId), [terms, termId]);
  const selectedStudent = useMemo(() => students.find((student) => student.id === studentId) ?? null, [students, studentId]);
  const selectedSavedFees = useMemo(
    () => savedFees.filter((fee) => selectedSavedFeeIds.includes(fee.id)),
    [savedFees, selectedSavedFeeIds],
  );
  const selectedSavedFeesTotal = useMemo(
    () => selectedSavedFees.reduce((sum, fee) => sum + Number(fee.amount), 0),
    [selectedSavedFees],
  );

  useEffect(() => {
    if (selectedTerm?.end_date) {
      setDueDate(selectedTerm.end_date);
    }
  }, [selectedTerm]);

  useEffect(() => {
    if (!open || !schoolId || !selectedStudent) {
      setSavedFees([]);
      setSelectedSavedFeeIds([]);
      setAssignedFeesHint(null);
      return;
    }

    let cancelled = false;

    const loadAssignedFees = async () => {
      setLoadingAssignedFees(true);
      setAssignedFeesHint(null);
      try {
        let classId = selectedStudent.class_id;
        if (!classId) {
          const { data: row } = await supabase
            .from("students")
            .select("class_id")
            .eq("id", selectedStudent.id)
            .maybeSingle();
          classId = (row?.class_id as string | null) ?? null;
        }

        const fees = await fetchInvoiceAssignableFees(schoolId, {
          studentId: selectedStudent.id,
          classId,
          termId: termId === "none" ? null : termId,
        });

        if (cancelled) return;

        const termFiltered =
          termId !== "none" && fees.some((f) => f.term_id === termId) && fees.some((f) => f.term_id !== termId);

        setSavedFees(fees);
        setSelectedSavedFeeIds(
          termId === "none" ? [] : fees.filter((f) => f.term_id === termId).map((f) => f.id)
        );

        if (fees.length === 0) {
          setAssignedFeesHint(
            classId
              ? "No fees are assigned to this student or their class yet. Assign fees under Billing → Fee Structure."
              : "No fees are assigned to this student. Assign a class fee in Fee Structure or set the student's class.",
          );
        } else if (termId !== "none" && !fees.some((f) => f.term_id === termId)) {
          setAssignedFeesHint(
            `No fees assigned for ${selectedTerm?.name ?? "this term"}. Showing all assigned fees — pick one or change term.`,
          );
        } else if (termFiltered) {
          setAssignedFeesHint("Fees for other terms are also listed below.");
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(formatSupabaseError(error));
          setSavedFees([]);
        }
      } finally {
        if (!cancelled) setLoadingAssignedFees(false);
      }
    };

    void loadAssignedFees();
    return () => {
      cancelled = true;
    };
  }, [open, schoolId, selectedStudent, termId, currency, selectedTerm?.name]);

  const resetForm = () => {
    setStudentId("");
    setTermId("none");
    setDueDate(new Date().toISOString().split("T")[0]);
    setDescription("Tuition Fees");
    setAmount("");
    setStatus("sent");
    setSavedFees([]);
    setSelectedSavedFeeIds([]);
    setAssignedFeesHint(null);
  };

  const handleCreate = async () => {
    const usingSavedFees = selectedSavedFeeIds.length > 0;
    const total = usingSavedFees ? selectedSavedFeesTotal : Number(amount);

    if (!user?.id || !schoolId || !studentId || (!usingSavedFees && !description.trim()) || Number.isNaN(total) || total <= 0) {
      toast.error("Please provide a student and a valid fee or amount.");
      return;
    }

    setLoading(true);
    let invoiceId: string | null = null;
    try {
      invoiceId = await createBillingInvoiceWithRetry({
        schoolId,
        studentId,
        termId: termId === "none" ? null : termId,
        invoiceNumber: buildInvoiceNumber(),
        status,
        currency,
        total,
        dueDate,
        issuedBy: user.id,
      });

      try {
        await insertBillingInvoiceLineItems(
          invoiceId,
          usingSavedFees
            ? selectedSavedFees.map((fee) => ({
                description: fee.fee_categories?.name || "Fee",
                amount: Number(fee.amount),
                feeItemId: fee.id,
              }))
            : [{ description: description.trim(), amount: total }],
        );
      } catch (lineError) {
        await supabase.from("billing_invoices").delete().eq("id", invoiceId);
        throw lineError;
      }

      toast.success("Invoice created successfully");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(formatSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-10 rounded-xl px-4 shadow-sm shadow-primary/15 transition-all hover:shadow-md hover:shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg border-border/80 bg-card/95 shadow-2xl backdrop-blur">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          <DialogDescription>
            Pick a student and reuse any fee already assigned to that student or the student's class.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {formatStudentDisplayName(
                      { first_name: student.first_name, last_name: student.last_name, student_id: student.student_id },
                      student.linkedProfile,
                    )}{" "}
                    ({student.student_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Term (optional)</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No term</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {studentId ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3">
              <div>
                <Label className="text-sm">Assigned Fees</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select created fees assigned to this student or their class. Leave empty to enter a manual amount below.
                </p>
              </div>
              {loadingAssignedFees ? (
                <p className="text-sm text-muted-foreground">Loading assigned fees…</p>
              ) : savedFees.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {assignedFeesHint ?? "No assigned fees found for this student."}
                </p>
              ) : (
                <>
                  {assignedFeesHint ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{assignedFeesHint}</p>
                  ) : null}
                  <div className="space-y-2">
                    {savedFees.map((fee) => {
                      const checked = selectedSavedFeeIds.includes(fee.id);
                      return (
                        <label key={fee.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const nextChecked = value === true;
                                setSelectedSavedFeeIds((prev) => (
                                  nextChecked ? (prev.includes(fee.id) ? prev : [...prev, fee.id]) : prev.filter((id) => id !== fee.id)
                                ));
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium">{fee.fee_categories?.name || "Fee"}</p>
                              <p className="text-xs text-muted-foreground">
                                {fee.terms?.name ?? "Term"}
                                {" · "}
                                {fee.assignmentSource === "class" ? "Class assignment" : "Student assignment"}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">{fee.currency || currency} {Number(fee.amount).toLocaleString()}</span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedSavedFeeIds.length > 0 ? (
                    <div className="flex items-center justify-between border-t border-border/80 pt-3 text-sm">
                      <span className="text-muted-foreground">{selectedSavedFeeIds.length} fee(s) selected</span>
                      <span className="font-semibold text-primary">Total {currency} {selectedSavedFeesTotal.toLocaleString()}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {selectedSavedFeeIds.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="e.g. Tuition Fees" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount ({currency})</Label>
                  <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as "draft" | "sent")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as "draft" | "sent")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading || !studentId || (selectedSavedFeeIds.length === 0 && (!amount || !description.trim()))}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Invoice
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}