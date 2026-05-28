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
}

interface SavedFeeOption {
  id: string;
  term_id: string;
  amount: number;
  currency: string | null;
  fee_categories: { name: string } | null;
}

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
          .select("id, name, end_date")
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
      setTerms((termsRes.data ?? []) as TermOption[]);
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
    if (!open || !schoolId || !selectedStudent || termId === "none") {
      setSavedFees([]);
      setSelectedSavedFeeIds([]);
      return;
    }

    const loadAssignedFees = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const studentFeesPromise = (supabase.from as any)("fee_assignments")
        .select("fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name))")
        .eq("school_id", schoolId)
        .eq("student_id", selectedStudent.id);

      const classFeesPromise = selectedStudent.class_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (supabase.from as any)("fee_assignments")
            .select("fee_item_id, fee_items(id, term_id, amount, currency, fee_categories(name))")
            .eq("school_id", schoolId)
            .eq("class_id", selectedStudent.class_id)
            .is("student_id", null)
        : Promise.resolve({ data: [], error: null });

      const [studentFeesRes, classFeesRes] = await Promise.all([studentFeesPromise, classFeesPromise]);

      if (studentFeesRes.error) {
        toast.error(studentFeesRes.error.message);
        return;
      }

      if (classFeesRes.error) {
        toast.error(classFeesRes.error.message);
        return;
      }

      const uniqueFees = new Map<string, SavedFeeOption>();
      for (const row of [...(studentFeesRes.data ?? []), ...(classFeesRes.data ?? [])]) {
        const fee = row.fee_items;
        if (!fee?.id || fee.term_id !== termId || uniqueFees.has(fee.id)) continue;
        uniqueFees.set(fee.id, {
          id: fee.id,
          term_id: fee.term_id,
          amount: Number(fee.amount),
          currency: fee.currency ?? currency,
          fee_categories: fee.fee_categories ?? null,
        });
      }

      setSavedFees(Array.from(uniqueFees.values()));
      setSelectedSavedFeeIds([]);
    };

    void loadAssignedFees();
  }, [open, schoolId, selectedStudent, termId, currency]);

  const resetForm = () => {
    setStudentId("");
    setTermId("none");
    setDueDate(new Date().toISOString().split("T")[0]);
    setDescription("Tuition Fees");
    setAmount("");
    setStatus("sent");
    setSavedFees([]);
    setSelectedSavedFeeIds([]);
  };

  const handleCreate = async () => {
    const usingSavedFees = selectedSavedFeeIds.length > 0;
    const total = usingSavedFees ? selectedSavedFeesTotal : Number(amount);

    if (!user?.id || !schoolId || !studentId || (!usingSavedFees && !description.trim()) || Number.isNaN(total) || total <= 0) {
      toast.error("Please provide a student and a valid fee or amount.");
      return;
    }

    setLoading(true);
    try {
      let { data: defaultClient } = await supabase
        .from("clients")
        .select("id")
        .eq("school_id", schoolId)
        .eq("client_type", "school")
        .maybeSingle();

      if (!defaultClient) {
        const { data: createdClient, error: createClientError } = await supabase
          .from("clients")
          .insert({ school_id: schoolId, name: "School Fees", client_type: "school" })
          .select("id")
          .single();

        if (createClientError) throw createClientError;
        defaultClient = createdClient;
      }

      if (!defaultClient) throw new Error("Could not create invoice client");

      let invoiceId = "";
      let lastError: Error | null = null;

      for (let i = 0; i < 4; i++) {
        const invoiceNumber = buildInvoiceNumber();
        const { data: createdInvoice, error: invoiceError } = await supabase
          .from("billing_invoices")
          .insert({
            school_id: schoolId,
            client_id: defaultClient.id,
            student_id: studentId,
            term_id: termId === "none" ? null : termId,
            invoice_number: invoiceNumber,
            status,
            currency,
            subtotal: total,
            total_amount: total,
            amount_paid: 0,
            balance_due: total,
            due_date: dueDate,
            issued_by: user.id,
          })
          .select("id")
          .single();

        if (invoiceError) {
          lastError = new Error(invoiceError.message);
          continue;
        }

        invoiceId = createdInvoice.id;
        break;
      }

      if (!invoiceId) {
        throw lastError || new Error("Failed to create invoice");
      }

      const lineItems = usingSavedFees
        ? selectedSavedFees.map((fee) => ({
            invoice_id: invoiceId,
            description: fee.fee_categories?.name || "Fee",
            quantity: 1,
            unit_price: Number(fee.amount),
            total: Number(fee.amount),
          }))
        : [{
            invoice_id: invoiceId,
            description: description.trim(),
            quantity: 1,
            unit_price: total,
            total,
          }];

      const { error: lineError } = await supabase.from("billing_invoice_line_items").insert(lineItems);
      if (lineError) throw lineError;

      toast.success("Invoice created successfully");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
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

          {termId !== "none" ? (
            <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3">
              <div>
                <Label className="text-sm">Assigned Fees</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select saved fees for this student or the student's class. Leave empty to enter a manual amount below.
                </p>
              </div>
              {savedFees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assigned fees found for this student and term.</p>
              ) : (
                <>
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
                              <p className="text-xs text-muted-foreground">Assigned from saved fees</p>
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