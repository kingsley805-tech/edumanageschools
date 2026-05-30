// @ts-nocheck
﻿import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";

interface Props {
  onSuccess?: () => void;
}

type ManualPaymentMethod = Extract<Database["public"]["Enums"]["payment_method"], "cash" | "bank_transfer" | "mobile_money">;
type AppRole = Database["public"]["Enums"]["app_role"];

export default function RecordPaymentDialog({ onSuccess }: Props) {
  const { user } = useAuth();
  const { isAdmin, isAccountant, primaryRole } = useBillingAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [classes, setClasses] = useState<{ id: string; name: string; stream: string | null }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; student_id: string; class_id: string | null }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; balance: number; currency: string }[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  const fetchStudents = useCallback(async () => {
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
    if (!profile?.school_id) return;

    const [rows, classesResult] = await Promise.all([
      fetchStudentsWithLinkedProfiles(profile.school_id),
      supabase
        .from("classes")
        .select("id, name, stream, level")
        .eq("school_id", profile.school_id)
        .neq("is_active", false)
        .order("level", { ascending: true })
        .order("name", { ascending: true }),
    ]);
    if (classesResult.error) {
      throw classesResult.error;
    }

    setClasses((classesResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      stream: row.stream,
    })));
    setStudents(
      rows
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: s.id as string,
          student_id: s.student_id as string,
          class_id: (s.class_id as string | null | undefined) ?? null,
          name: formatStudentDisplayName(
            { first_name: s.first_name as string, last_name: s.last_name as string, student_id: s.student_id as string },
            s.linkedProfile ?? null,
          ),
        })),
    );
  }, [user]);

  const fetchInvoices = useCallback(async () => {
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
    if (!profile?.school_id) return;

    const { data } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, total_amount, amount_paid, balance_due, currency")
      .eq("school_id", profile.school_id)
      .eq("student_id", selectedStudentId)
      .in("status", ["sent", "partially_paid", "overdue", "viewed"])
      .order("due_date");

    setInvoices(
      (data || []).map((i) => ({
        id: i.id,
        invoice_number: i.invoice_number,
        balance: Number(i.balance_due ?? (Number(i.total_amount) - Number(i.amount_paid))),
        currency: i.currency,
      }))
    );
  }, [selectedStudentId, user]);

  useEffect(() => {
    if (open && user) fetchStudents();
  }, [fetchStudents, open, user]);

  useEffect(() => {
    if (selectedStudentId) fetchInvoices();
  }, [fetchInvoices, selectedStudentId]);

  useEffect(() => {
    if (!selectedClassId) return;
    const selectedStudent = students.find((student) => student.id === selectedStudentId);
    if (selectedStudent && selectedStudent.class_id !== selectedClassId) {
      setSelectedStudentId("");
      setSelectedInvoiceId("");
      setInvoices([]);
    }
  }, [selectedClassId, selectedStudentId, students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !amount) return;
    setSaving(true);

    try {
      const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user!.id).maybeSingle();
      if (!profile?.school_id) throw new Error("Organization not found");

      const invoice = invoices.find((i) => i.id === selectedInvoiceId);
      if (!invoice) throw new Error("Invoice not found");

      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error("Invalid amount");
      if (paymentAmount > invoice.balance) throw new Error("Amount exceeds invoice balance");

      // Record payment
      const { data: invRow } = await supabase
        .from("billing_invoices")
        .select("student_id, students ( guardian_id )")
        .eq("id", selectedInvoiceId)
        .maybeSingle();

      const studentId = invRow?.student_id ?? null;
      const guardianId =
        invRow?.students && typeof invRow.students === "object" && "guardian_id" in invRow.students
          ? (invRow.students as { guardian_id?: string }).guardian_id
          : null;

      const fullPaymentRow = {
        school_id: profile.school_id,
        invoice_id: selectedInvoiceId,
        student_id: studentId,
        parent_id: guardianId ?? null,
        amount: paymentAmount,
        currency: invoice.currency,
        method,
        gateway: "manual" as const,
        status: "paid" as const,
        paid_at: new Date(paidDate).toISOString(),
        recorded_by: user!.id,
        payer_user_id: user!.id,
        payer_role: (primaryRole || "org_admin") as AppRole,
        payer_name: user?.user_metadata?.full_name || user?.email || "School Admin",
        payment_context: "school_fee",
        notes: notes || null,
      };

      let { error: payError } = await supabase.from("billing_payments").insert(fullPaymentRow);

      if (payError && /student_id|parent_id|does not exist/i.test(payError.message ?? "")) {
        const {
          student_id: _s,
          parent_id: _p,
          recorded_by: _r,
          payer_user_id: _u,
          ...legacyRow
        } = fullPaymentRow;
        const retry = await supabase.from("billing_payments").insert(legacyRow);
        payError = retry.error;
      }

      if (payError) throw payError;

      await supabase.from("audit_logs").insert({
        school_id: profile.school_id,
        user_id: user!.id,
        action: "manual_payment_recorded",
        entity: "payments",
        entity_id: selectedInvoiceId,
        after_data: {
          invoice_id: selectedInvoiceId,
          amount: paymentAmount,
          method,
          paid_date: paidDate,
          actor_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          actor_platform: typeof navigator !== "undefined" ? navigator.platform : null,
        },
      });

      // Update invoice
      const { data: inv } = await supabase
        .from("billing_invoices")
        .select("total_amount, amount_paid")
        .eq("school_id", profile.school_id)
        .eq("id", selectedInvoiceId)
        .single();

      if (inv) {
        const newAmountPaid = Number(inv.amount_paid) + paymentAmount;
        const totalAmount = Number(inv.total_amount);
        const newBalance = totalAmount - newAmountPaid;
        const newStatus = newBalance <= 0 ? "paid" : "partially_paid";

        await supabase
          .from("billing_invoices")
          .update({
            amount_paid: newAmountPaid,
            balance_due: Math.max(0, newBalance),
            status: newStatus,
            paid_at: newBalance <= 0 ? new Date().toISOString() : null,
          })
          .eq("school_id", profile.school_id)
          .eq("id", selectedInvoiceId);
      }

      toast.success("Payment recorded successfully");
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedClassId("");
    setSelectedStudentId("");
    setSelectedInvoiceId("");
    setAmount("");
    setMethod("cash");
    setPaidDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setStudentPickerOpen(false);
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);
  const filteredStudents = selectedClassId
    ? students.filter((student) => student.class_id === selectedClassId)
    : students;
  const canRecordManualPayment = isAdmin || isAccountant;

  if (!canRecordManualPayment) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Manual Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select
              value={selectedClassId}
              onValueChange={(value) => {
                setSelectedClassId(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by class..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((schoolClass) => (
                  <SelectItem key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}{schoolClass.stream ? ` (${schoolClass.stream})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Student</Label>
            <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={studentPickerOpen}
                  className="w-full justify-between font-normal"
                  disabled={filteredStudents.length === 0}
                >
                  <span className="truncate">
                    {selectedStudent ? `${selectedStudent.name} (${selectedStudent.student_id})` : "Select student..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name or student ID..." />
                  <CommandList>
                    <CommandEmpty>
                      {selectedClassId ? "No students found in this class." : "No student found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredStudents.map((s) => {
                        const label = `${s.name} (${s.student_id})`;
                        const searchValue = `${s.name} ${s.student_id} ${s.id}`;
                        return (
                          <CommandItem
                            key={s.id}
                            value={searchValue}
                            onSelect={() => {
                              setSelectedStudentId(s.id);
                              setStudentPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedStudentId === s.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedStudentId && (
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                <SelectContent>
                  {invoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_number} — {i.currency} {i.balance.toLocaleString()} due
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedInvoice && (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Balance due: </span>
              <span className="font-semibold">{selectedInvoice.currency} {selectedInvoice.balance.toLocaleString()}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="e.g. Paid by mother at school office" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !selectedInvoiceId || !amount}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}