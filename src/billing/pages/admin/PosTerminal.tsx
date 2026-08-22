// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/currency";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  MessageCircle,
  Printer,
  Search,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchSchoolLetterhead } from "@/billing/lib/schoolLetterhead";
import { recordManualPayment, type ManualPaymentMethod } from "@/billing/lib/recordManualPayment";
import {
  loadPosStudentContext,
  searchPosStudents,
  type PosOpenInvoice,
  type PosStudentContext,
  type PosStudentSummary,
} from "@/billing/lib/posStudentSearch";
import { loadPosSchoolSettings, ALL_PAYMENT_METHODS } from "@/billing/lib/posSettings";
import { downloadPosReceiptPdf, printPosReceipt } from "@/billing/lib/posReceipt";
import { sendPaymentReceiptWhatsApp } from "@/billing/lib/posWhatsAppActions";
import {
  ensurePosInvoiceForFee,
  findOpenInvoiceForFeeItem,
  loadPosStudentFeeOptions,
  type PosFeeOption,
} from "@/billing/lib/posInvoiceFees";
import { formatReceiptPaidTime } from "@/billing/lib/paymentTransactions";
import { PosInvoiceRef } from "@/billing/components/payments/PosInvoiceRef";
import { shortInvoiceRef } from "@/billing/lib/posInvoiceFees";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Created",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partial",
  overdue: "Overdue",
};

type SuccessState = {
  paymentId: string;
  receiptNumber: string;
  transactionRef: string;
  amount: number;
  currency: string;
  method: string;
  remainingBalance: number;
  receiptUrl: string | null;
  paidAt: string;
  whatsappStatus: string;
  whatsappErrors: string[];
};

export default function PosTerminal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { schoolId, role } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const perm = getPermission("manual_payments");
  const canPay = perm.create || perm.manage;

  const [now, setNow] = useState(new Date());
  const [schoolName, setSchoolName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [posSettings, setPosSettings] = useState<Awaited<ReturnType<typeof loadPosSchoolSettings>> | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PosStudentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [studentCtx, setStudentCtx] = useState<PosStudentContext | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [assignableFees, setAssignableFees] = useState<PosFeeOption[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [loadingAssignableFees, setLoadingAssignableFees] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<PosOpenInvoice | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0]);
  const [gatewayRef, setGatewayRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [printing, setPrinting] = useState(false);

  const idempotencyRef = useRef<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cashierName, setCashierName] = useState("Cashier");

  const selectedInvoice: PosOpenInvoice | null = useMemo(
    () => studentCtx?.invoices.find((i) => i.id === selectedInvoiceId) ?? null,
    [studentCtx, selectedInvoiceId],
  );

  const feeOptions = assignableFees;
  const loadingFees = loadingAssignableFees;
  const feeOnlyMode = Boolean(studentCtx && studentCtx.invoices.length === 0);

  const selectedFee: PosFeeOption | null = useMemo(
    () => feeOptions.find((f) => f.id === selectedFeeId) ?? null,
    [feeOptions, selectedFeeId],
  );

  const activeInvoice = selectedInvoice ?? paymentInvoice;

  const effectiveFeeCategory = selectedFee?.feeCategory ?? activeInvoice?.feeCategory ?? null;
  const effectiveTerm = selectedFee?.termName ?? activeInvoice?.termName ?? null;
  const effectiveAcademicYear = selectedFee?.academicYear ?? activeInvoice?.academicYear ?? null;
  const effectiveCurrency = selectedFee?.currency ?? activeInvoice?.currency ?? "GHS";
  const effectiveBalance = activeInvoice?.balance ?? selectedFee?.amount ?? 0;
  const effectiveTotal = activeInvoice?.totalAmount ?? selectedFee?.amount ?? 0;
  const effectivePaid = activeInvoice?.amountPaid ?? 0;
  const effectiveFeeType = effectiveFeeCategory;
  const canCollectPayment = Boolean(
    studentCtx && (assignableFees.length > 0 || studentCtx.invoices.length > 0),
  );

  const methodOptions = useMemo(() => {
    const enabled = new Set(posSettings?.enabledMethods ?? ["cash", "mobile_money", "bank_transfer"]);
    return ALL_PAYMENT_METHODS.filter((m) => enabled.has(m.value)).map((m) =>
      m.value === "pos_terminal" && posSettings?.posTerminalLabel
        ? { ...m, label: posSettings.posTerminalLabel }
        : m,
    );
  }, [posSettings]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCashierName(data?.full_name?.trim() || user.email || "Cashier");
      })
      .catch(() => setCashierName(user.email || "Cashier"));
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const [lh, settings] = await Promise.all([
        fetchSchoolLetterhead(schoolId),
        loadPosSchoolSettings(schoolId),
      ]);
      setSchoolName(lh?.schoolName ?? "School");
      setLogoUrl(lh?.logoUrl ?? null);
      setPosSettings(settings);
      if (settings.enabledMethods[0]) setMethod(settings.enabledMethods[0]);
    })().catch(() => {});
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPosStudents(schoolId, searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [schoolId, searchQuery]);

  const selectStudent = useCallback(
    async (student: PosStudentSummary) => {
      if (!schoolId) return;
      setLoadingStudent(true);
      setStudentCtx(null);
      setSelectedInvoiceId("");
      setAssignableFees([]);
      setSelectedFeeId("");
      setPaymentInvoice(null);
      setAmount("");
      setSuccess(null);
      idempotencyRef.current = null;
      try {
        const ctx = await loadPosStudentContext(schoolId, student.id);
        if (!ctx) {
          toast.error("Student not found.");
          return;
        }
        setStudentCtx(ctx);
        setSearchQuery(ctx.student.displayName);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load student");
      } finally {
        setLoadingStudent(false);
      }
    },
    [schoolId],
  );

  const applyFeeSelection = useCallback(
    async (feeId: string, feeOverride?: PosFeeOption) => {
      setSelectedFeeId(feeId);
      setPaymentInvoice(null);
      const fee = feeOverride ?? assignableFees.find((f) => f.id === feeId);
      if (!fee || !schoolId || !studentCtx) {
        if (fee) setAmount(String(fee.amount));
        return;
      }

      if (fee.feeItemId) {
        try {
          const inv = await findOpenInvoiceForFeeItem(
            schoolId,
            studentCtx.student.id,
            fee.feeItemId,
          );
          if (inv) {
            setSelectedInvoiceId(inv.id);
            setAmount(String(Math.min(fee.amount, inv.balance)));
            return;
          }
        } catch {
          /* fall through — fee-first payment */
        }
      }

      setSelectedInvoiceId("");
      setAmount(String(fee.amount));
    },
    [assignableFees, schoolId, studentCtx],
  );

  const studentIdForFees = studentCtx?.student.id ?? null;

  useEffect(() => {
    if (!schoolId || !studentIdForFees) {
      setAssignableFees([]);
      setSelectedFeeId("");
      return;
    }

    let cancelled = false;
    setLoadingAssignableFees(true);

    loadPosStudentFeeOptions(schoolId, {
      studentId: studentIdForFees,
      classId: studentCtx!.student.classId,
    })
      .then((opts) => {
        if (cancelled) return;
        setAssignableFees(opts);
        if (opts.length === 1) {
          const fee = opts[0];
          setSelectedFeeId(fee.id);
          setAmount(String(fee.amount));
          if (fee.feeItemId) {
            findOpenInvoiceForFeeItem(schoolId, studentIdForFees, fee.feeItemId)
              .then((inv) => {
                if (cancelled || !inv) return;
                setSelectedInvoiceId(inv.id);
                setAmount(String(Math.min(fee.amount, inv.balance)));
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAssignableFees([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignableFees(false);
      });

    return () => {
      cancelled = true;
    };
  }, [schoolId, studentIdForFees]);

  const buildReceiptCtx = (s: SuccessState) => ({
    schoolId: schoolId!,
    receiptNumber: s.receiptNumber,
    transactionRef: s.transactionRef,
    studentName: studentCtx!.student.displayName,
    admissionNumber: studentCtx!.student.admissionNumber,
    className: studentCtx!.student.className,
    parentName: studentCtx!.parentDisplayName,
    invoiceNumber: activeInvoice!.invoiceNumber,
    amount: s.amount,
    currency: s.currency,
    method: s.method,
    paidAt: s.paidAt,
    balanceDue: s.remainingBalance,
    previousBalance: activeInvoice!.balance,
    cashierName,
    academicYear: effectiveAcademicYear,
    term: effectiveTerm,
    feeCategory: effectiveFeeType,
    feeType: effectiveFeeType,
    notes,
    posTerminalLabel: posSettings?.posTerminalLabel,
  });

  const handleRecordPayment = async () => {
    if (!schoolId || !user || !studentCtx) return;
    if (saving) return;

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }

    if (assignableFees.length > 0 && !selectedFeeId) {
      toast.error("Select the created fee you are collecting payment for.");
      return;
    }

    if (
      method === "pos_terminal" &&
      posSettings?.posRequireReference &&
      !gatewayRef.trim()
    ) {
      toast.error("Transaction reference is required for POS terminal payments.");
      return;
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = crypto.randomUUID();
    }

    setSaving(true);
    let invoiceForPayment = selectedInvoice;

    try {
      if (!invoiceForPayment) {
        if (!selectedFee) {
          toast.error("Select a created fee to collect payment.");
          return;
        }
        invoiceForPayment = await ensurePosInvoiceForFee({
          schoolId,
          studentId: studentCtx.student.id,
          fee: selectedFee,
          issuedBy: user.id,
        });
        setPaymentInvoice(invoiceForPayment);
      }

      if (paymentAmount > invoiceForPayment.balance + 0.005) {
        toast.error(
          `Amount exceeds outstanding balance (${formatMoney(invoiceForPayment.balance, invoiceForPayment.currency)}).`,
        );
        return;
      }

      const result = await recordManualPayment({
        schoolId,
        invoiceId: invoiceForPayment.id,
        amount: paymentAmount,
        method,
        paidAt: paidDate,
        notes: notes || null,
        gatewayRef: gatewayRef.trim() || null,
        idempotencyKey: idempotencyRef.current,
        userId: user.id,
        userDisplayName: cashierName,
        userRole: role || "admin",
        studentName: studentCtx.student.displayName,
        admissionNumber: studentCtx.student.admissionNumber,
        className: studentCtx.student.className,
        parentName: studentCtx.parentDisplayName,
        invoiceNumber: invoiceForPayment.invoiceNumber,
        currency: invoiceForPayment.currency,
        feeCategory: effectiveFeeType,
        feeItemId: selectedFee?.feeItemId ?? null,
        academicYear: effectiveAcademicYear,
        term: effectiveTerm,
        studentId: studentCtx.student.id,
        parentId: studentCtx.parentId,
        posTerminalLabel: posSettings?.posTerminalLabel,
        autoSendWhatsApp: posSettings?.whatsappAutoSendFeeReceipt,
      });

      setSuccess({
        paymentId: result.paymentId,
        receiptNumber: result.receiptNumber,
        transactionRef: result.transactionRef,
        amount: paymentAmount,
        currency: invoiceForPayment.currency,
        method,
        remainingBalance: result.remainingBalance,
        receiptUrl: result.receiptUrl,
        paidAt: new Date(paidDate).toISOString(),
        whatsappStatus: result.whatsapp.status,
        whatsappErrors: result.whatsapp.errors,
      });

      if (result.whatsapp.errors.length) {
        toast.warning(
          "Payment saved. WhatsApp delivery failed — retry from Payment History.",
        );
      } else if (result.whatsapp.queued > 0) {
        toast.success("Payment recorded. Receipt queued for WhatsApp.");
      } else if (feeOnlyMode) {
        toast.success("Invoice created and payment recorded.");
      } else {
        toast.success("Payment recorded successfully.");
      }

      if (posSettings?.autoPrintReceipt) {
        try {
          await printPosReceipt(buildReceiptCtx({
            paymentId: result.paymentId,
            receiptNumber: result.receiptNumber,
            transactionRef: result.transactionRef,
            amount: paymentAmount,
            currency: invoiceForPayment.currency,
            method,
            remainingBalance: result.remainingBalance,
            receiptUrl: result.receiptUrl,
            paidAt: new Date(paidDate).toISOString(),
            whatsappStatus: result.whatsapp.status,
            whatsappErrors: result.whatsapp.errors,
          }), { paperWidthMm: posSettings.paperWidthMm });
        } catch {
          /* non-blocking */
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!success || !studentCtx || !activeInvoice) return;
    setPrinting(true);
    try {
      await printPosReceipt(buildReceiptCtx(success), {
        paperWidthMm: posSettings?.paperWidthMm ?? 80,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrinting(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!success || !schoolId || !user || !studentCtx || !activeInvoice) return;
    if (!studentCtx.parentWhatsApp) {
      toast.error("No linked parent WhatsApp number. Update Parent Contacts.");
      return;
    }
    setSendingWhatsApp(true);
    try {
      const res = await sendPaymentReceiptWhatsApp({
        schoolId,
        paymentId: success.paymentId,
        studentId: studentCtx.student.id,
        studentName: studentCtx.student.displayName,
        amount: success.amount,
        currency: success.currency,
        method: success.method,
        invoiceNumber: activeInvoice.invoiceNumber,
        balance: success.remainingBalance,
        receiptNumber: success.receiptNumber,
        paidAt: success.paidAt,
        receiptUrl: success.receiptUrl,
        feeType: effectiveFeeType,
        createdBy: user.id,
      });
      if (res.ok) {
        toast.success("Receipt queued for WhatsApp delivery.");
        setSuccess((s) => (s ? { ...s, whatsappStatus: res.status, whatsappErrors: [] } : s));
      } else {
        toast.error(res.errors[0] || "WhatsApp delivery failed. Payment is saved.");
        setSuccess((s) => (s ? { ...s, whatsappStatus: res.status, whatsappErrors: res.errors } : s));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp failed");
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handlePrintAndWhatsApp = async () => {
    await handlePrint();
    await handleWhatsApp();
  };

  const resetTerminal = () => {
    setSuccess(null);
    setStudentCtx(null);
    setSearchQuery("");
    setSelectedInvoiceId("");
    setAssignableFees([]);
    setSelectedFeeId("");
    setPaymentInvoice(null);
    setAmount("");
    setGatewayRef("");
    setNotes("");
    idempotencyRef.current = null;
  };

  if (!schoolId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Please set up your organization first in Settings.
      </div>
    );
  }

  if (!canPay) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have permission to record payments.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/30">
      {/* POS Header */}
      <header className="border-b bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/admin/billing/manual-payments">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-10 w-10 rounded-md object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">{schoolName}</h1>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                School Fee POS Terminal
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="font-mono font-semibold text-foreground">
                {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{cashierName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        {success ? (
          /* Success screen */
          <div className="mx-auto max-w-lg">
            <div className="rounded-xl border bg-background p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h2 className="mt-4 text-2xl font-bold">Payment Successful</h2>
              <p className="mt-1 text-muted-foreground">Transaction saved and receipt generated.</p>

              <dl className="mt-6 space-y-2 text-left text-sm">
                {[
                  ["Receipt No.", success.receiptNumber],
                  ["Transaction", success.transactionRef],
                  ["Fee type", effectiveFeeType || "—"],
                  ["Paid at", formatReceiptPaidTime(success.paidAt)],
                  ["Student", studentCtx?.student.displayName],
                  ["Amount paid", formatMoney(success.amount, success.currency)],
                  ["Method", success.method.replace(/_/g, " ")],
                  ["Remaining balance", formatMoney(success.remainingBalance, success.currency)],
                  ["WhatsApp", success.whatsappStatus.replace(/_/g, " ")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>

              {studentCtx?.parentWhatsApp ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Parent WhatsApp: <span className="font-mono font-medium text-foreground">+{studentCtx.parentWhatsApp}</span>
                </p>
              ) : (
                <p className="mt-4 text-sm text-amber-600">No linked parent WhatsApp number.</p>
              )}

              {success.whatsappErrors.length > 0 ? (
                <p className="mt-2 text-sm text-destructive">{success.whatsappErrors[0]}</p>
              ) : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={handlePrint} disabled={printing}>
                  <Printer className="mr-2 h-4 w-4" />
                  {printing ? "Printing…" : "Print Receipt"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleWhatsApp}
                  disabled={sendingWhatsApp || !studentCtx?.parentWhatsApp}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {sendingWhatsApp ? "Sending…" : "Send via WhatsApp"}
                </Button>
                <Button onClick={handlePrintAndWhatsApp} disabled={printing || sendingWhatsApp}>
                  Print &amp; WhatsApp
                </Button>
                <Button variant="secondary" onClick={resetTerminal}>
                  New Payment
                </Button>
              </div>
              <Button
                variant="link"
                className="mt-4"
                onClick={() => navigate("/admin/billing/manual-payments")}
              >
                View payment history
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Student search & info */}
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-xl border bg-background p-5 shadow-sm">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Student search
                </Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Name, ID, admission, parent name or phone…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {searchQuery && !studentCtx && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border">
                    {searching ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
                    ) : searchResults.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted-foreground">No students found.</li>
                    ) : (
                      searchResults.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => selectStudent(s)}
                          >
                            <span className="font-medium">{s.displayName}</span>
                            <span className="ml-2 text-muted-foreground">
                              {s.admissionNumber} · {s.className}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {loadingStudent ? (
                <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground">
                  Loading student…
                </div>
              ) : studentCtx ? (
                <div className="rounded-xl border bg-background p-5 shadow-sm">
                  <h3 className="font-semibold">{studentCtx.student.displayName}</h3>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Student ID</span>
                      <span className="font-mono">{studentCtx.student.admissionNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Class</span>
                      <span>{studentCtx.student.className}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parent / Guardian</span>
                      <span>{studentCtx.parentDisplayName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parent WhatsApp</span>
                      <span className="font-mono text-xs">
                        {studentCtx.parentWhatsApp ? `+${studentCtx.parentWhatsApp}` : "Not linked"}
                      </span>
                    </div>
                  </div>

                  {studentCtx.invoices.length === 0 ? (
                    assignableFees.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Assigned fees</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          No invoice yet — pick a fee on the right. An invoice is created when you record payment.
                        </p>
                        <ul className="mt-2 space-y-2">
                          {assignableFees.map((fee) => (
                            <li
                              key={fee.id}
                              className={cn(
                                "cursor-pointer rounded-lg border p-3 transition-colors",
                                selectedFeeId === fee.id && !selectedInvoiceId
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50",
                              )}
                              onClick={() => void applyFeeSelection(fee.id, fee)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium">{fee.label}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {[fee.termName, fee.academicYear].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                                <Badge variant="outline" className="shrink-0 font-semibold">
                                  {formatMoney(fee.amount, fee.currency)}
                                </Badge>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : loadingAssignableFees ? (
                      <p className="mt-4 text-sm text-muted-foreground">Loading assigned fees…</p>
                    ) : (
                      <p className="mt-4 text-sm text-amber-600">
                        No fees assigned to this student. Assign fees under Billing → Fee Structure first.
                      </p>
                    )
                  ) : (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Invoices &amp; outstanding fees</p>
                      <ul className="mt-2 space-y-2">
                        {studentCtx.invoices.map((inv) => (
                          <li
                            key={inv.id}
                            className={cn(
                              "cursor-pointer rounded-lg border p-3 transition-colors",
                              selectedInvoiceId === inv.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50",
                            )}
                            onClick={() => setSelectedInvoiceId(inv.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">
                                    <PosInvoiceRef value={inv.invoiceNumber} />
                                  </p>
                                  <Badge variant="secondary" className="text-[10px] font-medium uppercase">
                                    {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {[inv.feeCategory, inv.termName, inv.academicYear].filter(Boolean).join(" · ")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Due {new Date(inv.dueDate).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge variant="outline" className="shrink-0 font-semibold">
                                {formatMoney(inv.balance, inv.currency)}
                              </Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {studentCtx.recentPayments.length > 0 ? (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Recent payments</p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {studentCtx.recentPayments.map((p) => (
                          <li key={p.id} className="flex justify-between">
                            <span>{p.receiptNumber || p.id.slice(0, 8)}</span>
                            <span>{formatMoney(p.amount, p.currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-background/50 p-8 text-center text-muted-foreground">
                  Search and select a student to begin.
                </div>
              )}
            </div>

            {/* Payment form */}
            <div className="lg:col-span-3">
              <div className="rounded-xl border bg-background p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Payment details</h2>

                {!studentCtx ? (
                  <p className="mt-6 text-muted-foreground">Select a student to begin.</p>
                ) : !canCollectPayment ? (
                  <p className="mt-6 text-muted-foreground">
                    No fees or invoices for this student. Assign fees under Billing → Fee Structure, or create an invoice under Billing → Invoices.
                  </p>
                ) : (
                  <div className="mt-6 space-y-5">
                    {assignableFees.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Select created fee
                        </Label>
                        {loadingFees && assignableFees.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Loading fees…</p>
                        ) : (
                          <Select
                            value={selectedFeeId || undefined}
                            onValueChange={(feeId) => void applyFeeSelection(feeId)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select created fee..." />
                            </SelectTrigger>
                            <SelectContent>
                              {assignableFees.map((fee) => (
                                <SelectItem key={fee.id} value={fee.id}>
                                  {fee.label}
                                  {fee.description ? ` · ${fee.description}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {!selectedFeeId ? (
                          <p className="text-xs text-muted-foreground">
                            Choose the assigned fee for this payment.
                          </p>
                        ) : feeOnlyMode ? (
                          <p className="text-xs text-muted-foreground">
                            Invoice will be created automatically when you record this payment.
                          </p>
                        ) : null}
                      </div>
                    ) : loadingFees && assignableFees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading fees…</p>
                    ) : null}

                    {studentCtx.invoices.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Select invoice {assignableFees.length > 0 ? "(optional)" : ""}</Label>
                      <Select
                        value={selectedInvoiceId || undefined}
                        onValueChange={(id) => {
                          setSelectedInvoiceId(id);
                          const inv = studentCtx.invoices.find((i) => i.id === id);
                          if (inv) setAmount(String(inv.balance));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose invoice…" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentCtx.invoices.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id} title={inv.invoiceNumber}>
                              {shortInvoiceRef(inv.invoiceNumber)} · {INVOICE_STATUS_LABELS[inv.status] ?? inv.status} ·{" "}
                              {formatMoney(inv.balance, inv.currency)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!selectedInvoiceId && assignableFees.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Or select a created fee below — an invoice will be generated on payment.
                        </p>
                      ) : null}
                    </div>
                    ) : null}

                    {(selectedFeeId || (assignableFees.length === 0 && selectedInvoice)) ? (
                      <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Invoice / reference</Label>
                        {activeInvoice?.invoiceNumber ? (
                          <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                            <PosInvoiceRef value={activeInvoice.invoiceNumber} />
                          </div>
                        ) : (
                          <Input
                            value={feeOnlyMode ? "Created on payment" : "—"}
                            disabled
                            className="bg-muted"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Fee type</Label>
                        <Input value={effectiveFeeType || "—"} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>Academic year</Label>
                        <Input value={effectiveAcademicYear || "—"} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>Term</Label>
                        <Input value={effectiveTerm || "—"} disabled className="bg-muted" />
                      </div>
                    </div>

                    <div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount due</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(effectiveTotal, effectiveCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Previously paid</p>
                        <p className="text-lg font-semibold">
                          {formatMoney(effectivePaid, effectiveCurrency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatMoney(effectiveBalance, effectiveCurrency)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pos-amount">Amount being paid</Label>
                      <Input
                        id="pos-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-2xl font-bold h-14"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Payment method</Label>
                        <Select value={method} onValueChange={(v) => setMethod(v as ManualPaymentMethod)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {methodOptions.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment date</Label>
                        <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Transaction / reference number
                        {method === "pos_terminal" && posSettings?.posRequireReference ? (
                          <span className="text-destructive"> *</span>
                        ) : null}
                      </Label>
                      <Input
                        placeholder="Optional reference (auto-generated if empty)"
                        value={gatewayRef}
                        onChange={(e) => setGatewayRef(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={2}
                        placeholder="Optional payment notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    <Button
                      className="h-12 w-full text-base font-semibold"
                      size="lg"
                      disabled={
                        saving
                        || !amount
                        || Number(amount) <= 0
                        || (assignableFees.length > 0 && !selectedFeeId)
                        || (assignableFees.length === 0 && !selectedInvoice && !selectedFee)
                      }
                      onClick={handleRecordPayment}
                    >
                      {saving ? "Processing payment…" : "Record Payment"}
                    </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Select a created fee above to enter payment details.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
