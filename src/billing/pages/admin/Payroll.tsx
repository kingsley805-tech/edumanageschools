// @ts-nocheck
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Banknote, History, Loader2, Plus, Settings2, Users, Wallet } from "lucide-react";
import { requestBillingDashboardRefetch } from "@/billing/lib/billingDashboardSync";
import { payoutSummaryFromSnapshot } from "@/billing/lib/payrollExport";
import {
  validateBankAccountNumber,
  validateContactPhone,
  validateMobileMoneyPair,
} from "@/billing/lib/staffPaymentValidation";

type TeacherRow = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  admission_number: string;
  class_label: string;
  subject_label: string | null;
  base_monthly_salary: number;
  default_allowances: number;
  default_deductions: number;
  payment_bank_name?: string | null;
  payment_bank_code?: string | null;
  payment_account_number?: string | null;
  payment_account_holder?: string | null;
  payment_mobile_money_number?: string | null;
  payment_mobile_money_provider?: string | null;
  payment_notes?: string | null;
  preferred_payout_method?: string | null;
};

type SalaryRow = {
  id: string;
  staff_user_id: string;
  month: string;
  amount: number;
  allowances: number | null;
  deductions: number | null;
  status: string;
  method: string;
  gateway: string;
  gateway_ref: string | null;
  paid_at: string | null;
  notes: string | null;
  payout_snapshot: Record<string, unknown> | null;
};

function ym(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function netTotal(base: number, all: number, ded: number) {
  return Math.max(0, Number(base || 0) + Number(all || 0) - Number(ded || 0));
}

function buildPayoutSnapshot(
  teacher: TeacherRow,
  payMethod: string,
  payOtherLabel: string,
  payBank: string,
  payAcct: string,
  payAcctName: string,
): Record<string, unknown> {
  return {
    selected_method: payMethod,
    teacher_phone: teacher.phone ?? null,
    other_label: payMethod === "other" ? payOtherLabel.trim() || null : null,
    bank_name: teacher.payment_bank_name ?? null,
    bank_code: (payBank || teacher.payment_bank_code || "").trim() || null,
    account_number: (payAcct || teacher.payment_account_number || "").trim() || null,
    account_holder: (payAcctName || teacher.payment_account_holder || "").trim() || null,
    mobile_money_number: teacher.payment_mobile_money_number ?? null,
    mobile_money_provider: teacher.payment_mobile_money_provider ?? null,
    payment_notes: teacher.payment_notes ?? null,
  };
}

export default function PayrollPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { schoolId, isAdmin } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const perm = getPermission("payroll");
  const canManage = isAdmin || perm.manage;
  const canEdit = isAdmin || perm.edit || perm.manage;
  const canCreate = isAdmin || perm.create || perm.manage;

  const [monthFocus, setMonthFocus] = useState(ym());
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [historyFor, setHistoryFor] = useState<TeacherRow | null>(null);
  const [configFor, setConfigFor] = useState<TeacherRow | null>(null);
  const [payFor, setPayFor] = useState<TeacherRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [cfgBase, setCfgBase] = useState("");
  const [cfgAll, setCfgAll] = useState("");
  const [cfgDed, setCfgDed] = useState("");
  const [cfgSubject, setCfgSubject] = useState("");
  const [cfgClassId, setCfgClassId] = useState("");

  const [payMonth, setPayMonth] = useState(ym());
  const [payBase, setPayBase] = useState("");
  const [payAll, setPayAll] = useState("");
  const [payDed, setPayDed] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payStatus, setPayStatus] = useState("paid");
  const [payNotes, setPayNotes] = useState("");
  const [payBank, setPayBank] = useState("");
  const [payAcct, setPayAcct] = useState("");
  const [payAcctName, setPayAcctName] = useState("");
  const [payOverrideDup, setPayOverrideDup] = useState(false);
  const [payOtherLabel, setPayOtherLabel] = useState("");

  const [paymentDetailsFor, setPaymentDetailsFor] = useState<TeacherRow | null>(null);
  const [pdBankName, setPdBankName] = useState("");
  const [pdBankCode, setPdBankCode] = useState("");
  const [pdAcctNum, setPdAcctNum] = useState("");
  const [pdAcctName, setPdAcctName] = useState("");
  const [pdMomo, setPdMomo] = useState("");
  const [pdMomoProvider, setPdMomoProvider] = useState("");
  const [pdNotes, setPdNotes] = useState("");
  const [pdPrefMethod, setPdPrefMethod] = useState("__none__");

  const [addAdmissionId, setAddAdmissionId] = useState("");
  const [addFirst, setAddFirst] = useState("");
  const [addLast, setAddLast] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");

  const { data: currency = "GHS" } = useQuery({
    queryKey: ["org-currency", schoolId],
    queryFn: async () => {
      if (!schoolId) return "GHS";
      const { data } = await supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle();
      return (data as { currency?: string } | null)?.currency || "GHS";
    },
    enabled: !!schoolId,
  });

  const { data: teachers = [], isLoading: tLoading, error: teachersError, refetch: refetchTeachers } = useQuery({
    queryKey: ["payroll-teachers", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase.rpc("list_teachers_for_payroll", { p_school_id: schoolId });
      if (error) throw error;
      return (data ?? []) as TeacherRow[];
    },
    enabled: !!schoolId && perm.view,
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ["payroll-salaries", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("staff_salaries")
        .select(
          "id, staff_user_id, month, amount, allowances, deductions, status, method, gateway, gateway_ref, paid_at, notes, payout_snapshot",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SalaryRow[];
    },
    enabled: !!schoolId && perm.view,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["payroll-classes", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase.from("classes").select("id, name, stream").eq("school_id", schoolId).order("level");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId && canEdit,
  });

  const { data: teacherAdmissions = [] } = useQuery({
    queryKey: ["payroll-unused-teacher-admissions", schoolId],
    queryFn: async () => [] as { id: string; admission_number: string }[],
    enabled: false,
  });

  const salaryByUserMonth = useMemo(() => {
    const m = new Map<string, SalaryRow>();
    for (const s of salaries) {
      m.set(`${s.staff_user_id}|${s.month}`, s);
    }
    return m;
  }, [salaries]);

  const upsertConfig = useMutation({
    mutationFn: async () => {
      if (!schoolId || !configFor || !canEdit) throw new Error("Not allowed");
      const base = Number(cfgBase);
      const al = Number(cfgAll || 0);
      const de = Number(cfgDed || 0);
      if (Number.isNaN(base) || base < 0) throw new Error("Invalid base salary");
      const { error } = await supabase.from("teacher_payroll_config").upsert(
        {
          school_id: schoolId,
          staff_user_id: configFor.user_id,
          base_monthly_salary: base,
          default_allowances: al,
          default_deductions: de,
          subject_label: cfgSubject.trim() || null,
          class_id: cfgClassId && cfgClassId !== "__none__" ? cfgClassId : null,
        } as never,
        { onConflict: "school_id,staff_user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payroll settings saved");
      setConfigFor(null);
      void qc.invalidateQueries({ queryKey: ["payroll-teachers"] });
      requestBillingDashboardRefetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePaymentDetails = useMutation({
    mutationFn: async () => {
      if (!schoolId || !paymentDetailsFor || !canManage) throw new Error("Not allowed");
      const bankName = pdBankName.trim();
      const bankCode = pdBankCode.trim();
      const acctNum = pdAcctNum.trim();
      const acctName = pdAcctName.trim();
      if (bankName || bankCode || acctNum || acctName) {
        if (!acctNum) throw new Error("Account number is required when entering bank details");
        const accErr = validateBankAccountNumber(acctNum);
        if (accErr) throw new Error(accErr);
        if (!bankName && !bankCode) throw new Error("Enter bank name or bank code");
      }
      const momoErr = validateMobileMoneyPair(pdMomo, pdMomoProvider);
      if (momoErr) throw new Error(momoErr);
      const payload = {
        school_id: schoolId,
        staff_user_id: paymentDetailsFor.user_id,
        bank_name: bankName || null,
        bank_code: bankCode || null,
        account_number: acctNum || null,
        account_name: acctName || null,
        mobile_money_number: pdMomo.trim() || null,
        mobile_money_provider: pdMomoProvider.trim() || null,
        payment_notes: pdNotes.trim() || null,
        preferred_payout_method: pdPrefMethod && pdPrefMethod !== "__none__" ? pdPrefMethod : null,
      };
      const { data: existing, error: exErr } = await supabase
        .from("staff_bank_accounts")
        .select("id")
        .eq("school_id", schoolId)
        .eq("staff_user_id", paymentDetailsFor.user_id)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing?.id) {
        const { error } = await supabase.from("staff_bank_accounts").update(payload as never).eq("id", (existing as { id: string }).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("staff_bank_accounts").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Payment details saved");
      setPaymentDetailsFor(null);
      void qc.invalidateQueries({ queryKey: ["payroll-teachers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paySalary = useMutation({
    mutationFn: async (opts: { teacher: TeacherRow; bulk?: boolean }) => {
      if (!schoolId || !user || !canManage) throw new Error("Not allowed");
      const teacher = opts.teacher;
      const base = Number(payBase);
      const al = Number(payAll || 0);
      const de = Number(payDed || 0);
      if (Number.isNaN(base) || Number.isNaN(al) || Number.isNaN(de)) throw new Error("Invalid amounts");
      const total = netTotal(base, al, de);
      if (total <= 0) throw new Error("Total payable must be positive");

      if (payMethod === "other" && !payOtherLabel.trim()) {
        throw new Error("Enter a label for the custom payment method");
      }
      if (payMethod === "paystack") {
        const bc = (payBank || teacher.payment_bank_code || "").trim();
        const an = (payAcct || teacher.payment_account_number || "").trim();
        if (!bc || !an) throw new Error("Bank code and account number are required for Paystack");
        const accErr = validateBankAccountNumber(an);
        if (accErr) throw new Error(accErr);
      }

      const { data: dupRows, error: dupErr } = await supabase
        .from("staff_salaries")
        .select("id, status")
        .eq("school_id", schoolId)
        .eq("staff_user_id", teacher.user_id)
        .eq("month", payMonth)
        .in("status", ["paid", "processing", "pending"]);
      if (dupErr) throw dupErr;
      if ((dupRows?.length ?? 0) > 0 && !payOverrideDup) {
        throw new Error("DUPLICATE_MONTH");
      }

      const initialStatus = payMethod === "paystack" ? "processing" : payStatus;
      const paidAt = payMethod !== "paystack" && payStatus === "paid" ? new Date().toISOString() : null;

      const snapshot = buildPayoutSnapshot(teacher, payMethod, payOtherLabel, payBank, payAcct, payAcctName);

      const { data: row, error: insErr } = await supabase
        .from("staff_salaries")
        .insert({
          school_id: schoolId,
          staff_user_id: teacher.user_id,
          amount: total,
          allowances: al,
          deductions: de,
          month: payMonth,
          method: payMethod,
          status: initialStatus,
          gateway: payMethod === "paystack" ? "paystack" : "manual",
          paid_at: paidAt,
          notes: payNotes || null,
          recorded_by: user.id,
          duplicate_override: payOverrideDup,
          payout_snapshot: snapshot,
        } as never)
        .select("id")
        .single();
      if (insErr) throw insErr;

      if (payMethod === "paystack") {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session?.access_token) throw new Error("Please sign in again.");
        const { data: transferData, error: transferErr } = await supabase.functions.invoke("paystack", {
          body: {
            action: "transfer",
            salary_id: row.id,
            amount: total,
            staff_user_id: teacher.user_id,
            month: payMonth,
            description: payNotes || `Salary ${payMonth}`,
            bank_code: payBank || undefined,
            account_number: payAcct || undefined,
            account_name: payAcctName || undefined,
          },
        });
        if (transferErr) throw new Error(transferErr.message || "Paystack transfer failed");
        const td = transferData as { success?: boolean; error?: string } | null;
        if (!td?.success) throw new Error(typeof td?.error === "string" ? td.error : "Paystack transfer failed");
      }
    },
    onSuccess: (_, v) => {
      if (!v.bulk) {
        toast.success("Salary saved");
        setPayFor(null);
      }
      void qc.invalidateQueries({ queryKey: ["payroll-salaries"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      requestBillingDashboardRefetch();
    },
    onError: (e: Error) => {
      if (e.message === "DUPLICATE_MONTH") {
        toast.error("This teacher already has a payroll entry for that month. Enable override to continue.");
        return;
      }
      toast.error(e.message);
    },
  });

  const provisionTeacher = useMutation({
    mutationFn: async () => {
      if (!addAdmissionId || !addFirst.trim() || !addLast.trim() || addPassword.length < 8) {
        throw new Error("Admission, name, and password (min 8) are required");
      }
      const phoneErr = validateContactPhone(addPhone, 9);
      if (phoneErr) throw new Error(phoneErr);
      const row = teacherAdmissions.find((a) => a.id === addAdmissionId);
      if (!row) throw new Error("Admission not found");
      const { data, error } = await supabase.functions.invoke("admin-provision-teacher", {
        body: {
          school_id: schoolId,
          admission_number: row.admission_number,
          first_name: addFirst.trim(),
          last_name: addLast.trim(),
          phone: addPhone.trim() || undefined,
          temp_password: addPassword,
        },
      });
      if (error) throw new Error(error.message);
      const body = data as { error?: string; email?: string };
      if (body?.error) throw new Error(body.error);
      return body;
    },
    onSuccess: () => {
      toast.success("Teacher created and admission marked used");
      setAddOpen(false);
      setAddAdmissionId("");
      setAddFirst("");
      setAddLast("");
      setAddPhone("");
      setAddPassword("");
      void qc.invalidateQueries({ queryKey: ["payroll-teachers"] });
      void qc.invalidateQueries({ queryKey: ["admission-numbers"] });
      void qc.invalidateQueries({ queryKey: ["payroll-unused-teacher-admissions"] });
      requestBillingDashboardRefetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openConfig = (t: TeacherRow) => {
    setConfigFor(t);
    setCfgBase(String(t.base_monthly_salary ?? 0));
    setCfgAll(String(t.default_allowances ?? 0));
    setCfgDed(String(t.default_deductions ?? 0));
    setCfgSubject(t.subject_label || "");
    setCfgClassId("__none__");
  };

  const openPay = (t: TeacherRow) => {
    setPayFor(t);
    setPayMonth(monthFocus);
    setPayBase(String(t.base_monthly_salary ?? 0));
    setPayAll(String(t.default_allowances ?? 0));
    setPayDed(String(t.default_deductions ?? 0));
    setPayMethod("bank_transfer");
    setPayStatus("paid");
    setPayNotes("");
    setPayBank((t.payment_bank_code || "").trim());
    setPayAcct((t.payment_account_number || "").trim());
    setPayAcctName((t.payment_account_holder || "").trim());
    setPayOverrideDup(false);
    setPayOtherLabel("");
  };

  const openPaymentDetails = (t: TeacherRow) => {
    setPaymentDetailsFor(t);
    setPdBankName((t.payment_bank_name || "").trim());
    setPdBankCode((t.payment_bank_code || "").trim());
    setPdAcctNum((t.payment_account_number || "").trim());
    setPdAcctName((t.payment_account_holder || "").trim());
    setPdMomo((t.payment_mobile_money_number || "").trim());
    setPdMomoProvider((t.payment_mobile_money_provider || "").trim());
    setPdNotes((t.payment_notes || "").trim());
    setPdPrefMethod(t.preferred_payout_method && t.preferred_payout_method !== "" ? t.preferred_payout_method : "__none__");
  };

  const selectedTeachers = teachers.filter((t) => selected[t.user_id]);
  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    if (on) teachers.forEach((t) => (next[t.user_id] = true));
    setSelected(next);
  };

  const fmt = (n: number) => `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  if (!perm.view) {
    return <div className="py-16 text-center text-muted-foreground">You do not have access to payroll.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Teachers, compensation, and salary payments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/billing/payroll/history">
              <History className="mr-2 h-4 w-4" />
              History &amp; export
            </Link>
          </Button>
          {canCreate ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/teachers">
                <Plus className="mr-2 h-4 w-4" />
                Manage teachers
              </Link>
            </Button>
          ) : null}
          {canManage && selectedTeachers.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Pay selected ({selectedTeachers.length})
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payroll month (for status column)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="payroll-month">Month</Label>
            <Input id="payroll-month" type="month" value={monthFocus} onChange={(e) => setMonthFocus(e.target.value)} className="w-[200px]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {teachersError ? (
            <div className="space-y-2 p-4 text-sm">
              <p className="text-destructive">Could not load teachers: {(teachersError as Error).message}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchTeachers()}>
                Retry
              </Button>
            </div>
          ) : null}
          {tLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage ? (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={teachers.length > 0 && selectedTeachers.length === teachers.length}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all"
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>Teacher</TableHead>
                  <TableHead>Admission</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Class / subject</TableHead>
                  <TableHead className="text-right">Monthly net (config)</TableHead>
                  <TableHead>Status ({monthFocus})</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => {
                  const net = netTotal(Number(t.base_monthly_salary), Number(t.default_allowances), Number(t.default_deductions));
                  const slot = salaryByUserMonth.get(`${t.user_id}|${monthFocus}`);
                  const label = [t.class_label, t.subject_label].filter(Boolean).join(" · ") || "—";
                  return (
                    <TableRow key={t.user_id}>
                      {canManage ? (
                        <TableCell>
                          <Checkbox
                            checked={Boolean(selected[t.user_id])}
                            onCheckedChange={(c) => setSelected((s) => ({ ...s, [t.user_id]: Boolean(c) }))}
                            aria-label={`Select ${t.first_name}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="font-medium">
                        {t.first_name} {t.last_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{t.admission_number || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{t.email || "—"}</TableCell>
                      <TableCell className="text-sm">{t.phone || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{label}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(net)}</TableCell>
                      <TableCell>
                        {slot ? (
                          <Badge variant={slot.status === "paid" ? "default" : "secondary"}>{slot.status}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No entry</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {perm.view ? (
                            <Button variant="ghost" size="sm" onClick={() => openPaymentDetails(t)} title="Payment details">
                              <Wallet className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="sm" onClick={() => setHistoryFor(t)}>
                            <History className="h-4 w-4" />
                          </Button>
                          {canEdit ? (
                            <Button variant="ghost" size="sm" onClick={() => openConfig(t)} title="Configure payroll">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {canManage ? (
                            <Button variant="ghost" size="sm" onClick={() => openPay(t)} title="Pay salary">
                              <Banknote className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(paymentDetailsFor)} onOpenChange={(o) => !o && setPaymentDetailsFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Payment details — {paymentDetailsFor?.first_name} {paymentDetailsFor?.last_name}
            </DialogTitle>
          </DialogHeader>
          {!canManage ? (
            <p className="text-xs text-muted-foreground">View only. Payroll managers can edit payout details.</p>
          ) : null}
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Bank name</Label>
                <Input value={pdBankName} onChange={(e) => setPdBankName(e.target.value)} disabled={!canManage} />
              </div>
              <div>
                <Label>Bank / Paystack code</Label>
                <Input value={pdBankCode} onChange={(e) => setPdBankCode(e.target.value)} disabled={!canManage} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Account number</Label>
                <Input value={pdAcctNum} onChange={(e) => setPdAcctNum(e.target.value)} disabled={!canManage} />
              </div>
              <div>
                <Label>Account holder name</Label>
                <Input value={pdAcctName} onChange={(e) => setPdAcctName(e.target.value)} disabled={!canManage} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Mobile money number (optional)</Label>
                <Input value={pdMomo} onChange={(e) => setPdMomo(e.target.value)} disabled={!canManage} />
              </div>
              <div>
                <Label>MoMo network</Label>
                <Input
                  value={pdMomoProvider}
                  onChange={(e) => setPdMomoProvider(e.target.value)}
                  placeholder="e.g. MTN, Vodafone"
                  disabled={!canManage}
                />
              </div>
            </div>
            <div>
              <Label>Preferred payout method</Label>
              <Select value={pdPrefMethod} onValueChange={setPdPrefMethod} disabled={!canManage}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No preference</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="paystack">Paystack</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Other payment notes</Label>
              <Textarea value={pdNotes} onChange={(e) => setPdNotes(e.target.value)} rows={2} disabled={!canManage} />
            </div>
            {canManage ? (
              <Button type="button" onClick={() => savePaymentDetails.mutate()} disabled={savePaymentDetails.isPending}>
                {savePaymentDetails.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save payment details"}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyFor)} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Salary history — {historyFor?.first_name} {historyFor?.last_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {salaries
              .filter((s) => s.staff_user_id === historyFor?.user_id)
              .map((s) => (
                <div key={s.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">{s.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {payoutSummaryFromSnapshot(s.payout_snapshot, s.method)} · {s.gateway}
                      {s.gateway_ref ? ` · ref ${s.gateway_ref}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{fmt(s.amount)}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            {salaries.filter((s) => s.staff_user_id === historyFor?.user_id).length === 0 ? (
              <p className="text-muted-foreground">No payments recorded yet.</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(configFor)} onOpenChange={(o) => !o && setConfigFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payroll settings — {configFor?.first_name} {configFor?.last_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label>Base salary</Label>
                <Input type="number" min={0} step="0.01" value={cfgBase} onChange={(e) => setCfgBase(e.target.value)} />
              </div>
              <div>
                <Label>Default allowances</Label>
                <Input type="number" min={0} step="0.01" value={cfgAll} onChange={(e) => setCfgAll(e.target.value)} />
              </div>
              <div>
                <Label>Default deductions</Label>
                <Input type="number" min={0} step="0.01" value={cfgDed} onChange={(e) => setCfgDed(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Subject label</Label>
              <Input value={cfgSubject} onChange={(e) => setCfgSubject(e.target.value)} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <Label>Assigned class</Label>
              <Select value={cfgClassId} onValueChange={setCfgClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {classes.map((c: { id: string; name: string; stream?: string | null }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.stream ? ` ${c.stream}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => upsertConfig.mutate()} disabled={upsertConfig.isPending}>
              {upsertConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(payFor)} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay salary — {payFor?.first_name} {payFor?.last_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Payment month</Label>
              <Input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Base</Label>
                <Input type="number" value={payBase} onChange={(e) => setPayBase(e.target.value)} />
              </div>
              <div>
                <Label>Allowances</Label>
                <Input type="number" value={payAll} onChange={(e) => setPayAll(e.target.value)} />
              </div>
              <div>
                <Label>Deductions</Label>
                <Input type="number" value={payDed} onChange={(e) => setPayDed(e.target.value)} />
              </div>
            </div>
            <p className="text-sm font-medium">
              Total payable: {fmt(netTotal(Number(payBase || 0), Number(payAll || 0), Number(payDed || 0)))}
            </p>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer (manual)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="paystack">Paystack transfer</SelectItem>
                  <SelectItem value="other">Other (custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === "other" ? (
              <div>
                <Label>Custom payment method</Label>
                <Input
                  value={payOtherLabel}
                  onChange={(e) => setPayOtherLabel(e.target.value)}
                  placeholder="e.g. Cheque, in-person pickup"
                />
              </div>
            ) : null}
            {payMethod !== "paystack" ? (
              <div>
                <Label>Payment status</Label>
                <Select value={payStatus} onValueChange={setPayStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Bank code</Label>
                  <Input value={payBank} onChange={(e) => setPayBank(e.target.value)} placeholder="Paystack bank code" />
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input value={payAcct} onChange={(e) => setPayAcct(e.target.value)} />
                </div>
                <div>
                  <Label>Account name (optional)</Label>
                  <Input value={payAcctName} onChange={(e) => setPayAcctName(e.target.value)} />
                </div>
              </>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="dup" checked={payOverrideDup} onCheckedChange={(c) => setPayOverrideDup(Boolean(c))} />
              <Label htmlFor="dup" className="text-xs font-normal leading-snug">
                Allow duplicate for this month (override guard)
              </Label>
            </div>
            <Button
              disabled={!payFor || paySalary.isPending}
              onClick={() => payFor && paySalary.mutate({ teacher: payFor })}
            >
              {paySalary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add teacher (manual)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Select an unused auto-generated teacher admission number. A login will be created at the provisioned @schoolbill.app email.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Admission number</Label>
              <Select value={addAdmissionId} onValueChange={setAddAdmissionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unused teacher code" />
                </SelectTrigger>
                <SelectContent>
                  {teacherAdmissions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.admission_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>First name</Label>
                <Input value={addFirst} onChange={(e) => setAddFirst(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={addLast} onChange={(e) => setAddLast(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Required (min 9 digits)" />
            </div>
            <div>
              <Label>Temporary password (min 8)</Label>
              <Input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
            </div>
            <Button onClick={() => provisionTeacher.mutate()} disabled={provisionTeacher.isPending}>
              {provisionTeacher.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create teacher"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk pay ({selectedTeachers.length})</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Uses the same amounts and method as the single-pay form below. Runs one payment after another; Paystack transfers may take a few seconds each.
          </p>
          <div className="space-y-3">
            <div>
              <Label>Payment month</Label>
              <Input type="month" value={payMonth} onChange={(e) => setPayMonth(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Base (each)</Label>
                <Input type="number" value={payBase} onChange={(e) => setPayBase(e.target.value)} />
              </div>
              <div>
                <Label>Allowances</Label>
                <Input type="number" value={payAll} onChange={(e) => setPayAll(e.target.value)} />
              </div>
              <div>
                <Label>Deductions</Label>
                <Input type="number" value={payDed} onChange={(e) => setPayDed(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer (manual)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="paystack">Paystack transfer</SelectItem>
                  <SelectItem value="other">Other (custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === "other" ? (
              <div>
                <Label>Custom payment method</Label>
                <Input value={payOtherLabel} onChange={(e) => setPayOtherLabel(e.target.value)} placeholder="Describe method" />
              </div>
            ) : null}
            {payMethod === "paystack" ? (
              <>
                <div>
                  <Label>Bank code</Label>
                  <Input value={payBank} onChange={(e) => setPayBank(e.target.value)} />
                </div>
                <div>
                  <Label>Account number</Label>
                  <Input value={payAcct} onChange={(e) => setPayAcct(e.target.value)} />
                </div>
                <div>
                  <Label>Account name</Label>
                  <Input value={payAcctName} onChange={(e) => setPayAcctName(e.target.value)} />
                </div>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <Checkbox id="dupb" checked={payOverrideDup} onCheckedChange={(c) => setPayOverrideDup(Boolean(c))} />
              <Label htmlFor="dupb" className="text-xs font-normal">
                Override duplicate month guard
              </Label>
            </div>
            <Button
              disabled={paySalary.isPending || selectedTeachers.length === 0}
              onClick={async () => {
                try {
                  for (const t of selectedTeachers) {
                    await paySalary.mutateAsync({ teacher: t, bulk: true });
                  }
                  setBulkOpen(false);
                  setSelected({});
                  toast.success("Bulk payments finished");
                } catch {
                  /* toast in mutation */
                }
              }}
            >
              {paySalary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run bulk pay"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}