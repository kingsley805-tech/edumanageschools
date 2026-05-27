import { useCallback, useEffect, useState } from "react";
import { useBillingSchoolId } from "@/billing/hooks/useBillingSchoolId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Users, FileText, Play, RefreshCw, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  backfillBillingAccounts,
  createBillingJob,
  fetchAccountInvoices,
  fetchBillingAccounts,
  fetchFeeTemplates,
  fetchInvoiceItems,
  recordAccountPayment,
  runBillingJobToCompletion,
  seedBillingDefaults,
  upsertFeeTemplate,
  type AccountInvoiceSummary,
  type InvoiceItemRow,
} from "@/billing/lib/consolidated/api";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ConsolidatedBilling() {
  const schoolId = useBillingSchoolId();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<AccountInvoiceSummary[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [terms, setTerms] = useState<{ id: string; name: string; session: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<AccountInvoiceSummary | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceItemRow[]>([]);
  const [academicTerm, setAcademicTerm] = useState("2026-T1");
  const [selectedTermId, setSelectedTermId] = useState("");
  const [jobProgress, setJobProgress] = useState<{ processed: number; total: number } | null>(null);
  const [runningJob, setRunningJob] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [recording, setRecording] = useState(false);
  const [manualAllocate, setManualAllocate] = useState(false);
  const [allocByItem, setAllocByItem] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; label: string }[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    fee_category_id: "",
    amount: "",
    scope: "global" as "global" | "grade" | "student",
    class_id: "",
    student_id: "",
    academic_term: "2026-T1",
  });

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [inv, acc, tmpl, termsRes, catsRes, classesRes, studentsRes] = await Promise.all([
        fetchAccountInvoices(schoolId),
        fetchBillingAccounts(schoolId),
        fetchFeeTemplates(schoolId),
        supabase.from("terms").select("id, name, session").eq("school_id", schoolId).order("name"),
        (supabase as any)
          .from("fee_categories")
          .select("id, name, code, default_priority")
          .eq("school_id", schoolId)
          .order("default_priority"),
        supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
        supabase
          .from("students")
          .select("id, admission_no, user_id")
          .eq("school_id", schoolId)
          .order("admission_no"),
      ]);
      setInvoices(inv);
      setAccounts(acc);
      setTemplates(tmpl);
      setTerms(termsRes.data ?? []);
      setCategories(catsRes.data ?? []);
      setClasses(classesRes.data ?? []);
      const studRows = studentsRes.data ?? [];
      const studUserIds = studRows.map((s) => s.user_id).filter(Boolean) as string[];
      const studNameMap = new Map<string, string>();
      if (studUserIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", studUserIds);
        for (const p of profs ?? []) studNameMap.set(p.id, p.full_name ?? "");
      }
      setStudents(
        studRows.map((s) => ({
          id: s.id,
          label: `${studNameMap.get(s.user_id ?? "") || "Student"} (${s.admission_no ?? s.id.slice(0, 8)})`,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load consolidated billing");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openInvoice = async (inv: AccountInvoiceSummary) => {
    setSelectedInvoice(inv);
    setManualAllocate(false);
    setAllocByItem({});
    setPaymentAmount("");
    try {
      const items = await fetchInvoiceItems(inv.id);
      setLineItems(items);
    } catch {
      toast.error("Could not load line items");
    }
  };

  const handleSetup = async () => {
    if (!schoolId) return;
    try {
      await seedBillingDefaults(schoolId);
      const result = await backfillBillingAccounts(schoolId);
      toast.success(
        `Setup complete: ${result.accounts_created} accounts created, ${result.links_ensured} student links`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    }
  };

  const handleGenerate = async () => {
    if (!schoolId) return;
    setRunningJob(true);
    setJobProgress({ processed: 0, total: 0 });
    try {
      const jobId = await createBillingJob({
        schoolId,
        academicTerm,
        termId: selectedTermId || null,
      });

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-process-job`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ jobId, maxChunks: 100, chunkSize: 200 }),
          },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Job failed");
        setJobProgress(json.progress);
      } else {
        await runBillingJobToCompletion(jobId, setJobProgress);
      }

      toast.success("Consolidated invoices generated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setRunningJob(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!schoolId || !selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    let manualAllocations: { invoice_item_id: string; amount: number }[] | undefined;
    if (manualAllocate) {
      manualAllocations = lineItems
        .map((li) => ({
          invoice_item_id: li.id,
          amount: parseFloat(allocByItem[li.id] ?? "0") || 0,
        }))
        .filter((a) => a.amount > 0);
      const sum = manualAllocations.reduce((s, a) => s + a.amount, 0);
      if (Math.abs(sum - amount) > 0.02) {
        toast.error(`Manual splits must equal payment (${sum.toFixed(2)} ≠ ${amount.toFixed(2)})`);
        return;
      }
      if (!manualAllocations.length) {
        toast.error("Enter amounts for at least one line item");
        return;
      }
    }
    setRecording(true);
    try {
      await recordAccountPayment({
        schoolId,
        billingAccountId: selectedInvoice.billing_account_id,
        invoiceId: selectedInvoice.id,
        amount,
        manualAllocations,
      });
      toast.success(manualAllocate ? "Payment recorded (manual allocation)" : "Payment recorded and allocated");
      setPaymentAmount("");
      await openInvoice(selectedInvoice);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setRecording(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!schoolId) return;
    const amount = parseFloat(newTemplate.amount);
    if (!newTemplate.name || !newTemplate.fee_category_id || !amount || amount <= 0) {
      toast.error("Name, category, and amount are required");
      return;
    }
    if (newTemplate.scope === "grade" && !newTemplate.class_id) {
      toast.error("Select a class for grade-scoped fees");
      return;
    }
    if (newTemplate.scope === "student" && !newTemplate.student_id) {
      toast.error("Select a student for individual fees");
      return;
    }
    setSavingTemplate(true);
    try {
      await upsertFeeTemplate({
        school_id: schoolId,
        fee_category_id: newTemplate.fee_category_id,
        name: newTemplate.name,
        amount,
        scope: newTemplate.scope,
        academic_term: newTemplate.academic_term,
        term_id: selectedTermId || null,
        class_id: newTemplate.scope === "grade" ? newTemplate.class_id : null,
        student_id: newTemplate.scope === "student" ? newTemplate.student_id : null,
      });
      toast.success("Fee template added");
      setTemplateOpen(false);
      setNewTemplate({
        name: "",
        fee_category_id: "",
        amount: "",
        scope: "global",
        class_id: "",
        student_id: "",
        academic_term: academicTerm,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Family Billing</h2>
          <p className="text-muted-foreground text-sm">
            Multi-child consolidated invoices — one ledger per parent, payment waterfall allocation.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleSetup()}>
            Initial setup
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5" />
            Generate term invoices (batch)
          </CardTitle>
          <CardDescription>
            Queues a background job: groups fees by parent account, one consolidated invoice per family.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>Academic term</Label>
            <Input
              value={academicTerm}
              onChange={(e) => setAcademicTerm(e.target.value)}
              placeholder="2026-T1"
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label>Term (optional)</Label>
            <Select value={selectedTermId} onValueChange={setSelectedTermId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.session} — {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void handleGenerate()} disabled={runningJob}>
            {runningJob ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate consolidated invoices
          </Button>
          {jobProgress && jobProgress.total > 0 && (
            <div className="w-full max-w-md space-y-1">
              <Progress value={(jobProgress.processed / jobProgress.total) * 100} />
              <p className="text-xs text-muted-foreground">
                {jobProgress.processed} / {jobProgress.total} students
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-1" />
            Family invoices
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Users className="h-4 w-4 mr-1" />
            Ledgers ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="templates">Fee templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoice_no}</TableCell>
                      <TableCell>
                        <div>{inv.display_name ?? "Family"}</div>
                        <div className="text-xs text-muted-foreground">{inv.account_no}</div>
                      </TableCell>
                      <TableCell>{inv.academic_term}</TableCell>
                      <TableCell>{inv.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{inv.total_paid.toFixed(2)}</TableCell>
                      <TableCell>{inv.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => void openInvoice(inv)}>
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>
                                {inv.invoice_no} — {inv.display_name}
                              </DialogTitle>
                            </DialogHeader>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Student</TableHead>
                                  <TableHead>Category</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead>Paid</TableHead>
                                  <TableHead>Balance</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lineItems.map((li) => (
                                  <TableRow key={li.id}>
                                    <TableCell>
                                      {li.student_name}
                                      {li.admission_no && (
                                        <span className="text-xs text-muted-foreground block">
                                          {li.admission_no}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {li.category_name}
                                      <span className="text-xs text-muted-foreground block">
                                        P{li.category_priority}
                                      </span>
                                    </TableCell>
                                    <TableCell>{li.amount.toFixed(2)}</TableCell>
                                    <TableCell>{li.amount_paid.toFixed(2)}</TableCell>
                                    <TableCell>
                                      {li.balance.toFixed(2)}
                                      {li.is_overdue && (
                                        <Badge variant="destructive" className="ml-1 text-xs">
                                          Overdue
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="space-y-3 pt-4 border-t">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id="manual-alloc"
                                  checked={manualAllocate}
                                  onCheckedChange={(v) => setManualAllocate(v === true)}
                                />
                                <Label htmlFor="manual-alloc" className="font-normal cursor-pointer">
                                  Manual allocation (split to specific line items)
                                </Label>
                              </div>
                              {manualAllocate && (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Line item</TableHead>
                                      <TableHead>Balance</TableHead>
                                      <TableHead>Allocate</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {lineItems.map((li) => (
                                      <TableRow key={li.id}>
                                        <TableCell className="text-sm">
                                          {li.student_name} — {li.category_name}
                                        </TableCell>
                                        <TableCell>{li.balance.toFixed(2)}</TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            className="w-28 h-8"
                                            placeholder="0"
                                            value={allocByItem[li.id] ?? ""}
                                            onChange={(e) =>
                                              setAllocByItem((prev) => ({
                                                ...prev,
                                                [li.id]: e.target.value,
                                              }))
                                            }
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                              <div className="flex flex-wrap items-end gap-2">
                                <div className="space-y-1">
                                  <Label>
                                    {manualAllocate ? "Total payment" : "Record payment (auto waterfall)"}
                                  </Label>
                                  <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-32"
                                  />
                                </div>
                                <Button
                                  onClick={() => void handleRecordPayment()}
                                  disabled={recording}
                                >
                                  {recording ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Apply payment"
                                  )}
                                </Button>
                              </div>
                              {!manualAllocate && (
                                <p className="text-xs text-muted-foreground">
                                  Auto order: overdue balances → fee category priority → proportional split.
                                </p>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No family invoices yet. Run setup, add fee templates, then generate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Children</TableHead>
                    <TableHead>Balance due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.display_name ?? a.account_no}</div>
                        <div className="text-xs text-muted-foreground">{a.account_no}</div>
                      </TableCell>
                      <TableCell>
                        {(a.billing_account_students ?? [])
                          .map((l: any) => l.student_label ?? "?")
                          .join(", ")}
                      </TableCell>
                      <TableCell>{Number(a.balance_due).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Fee templates</CardTitle>
                <CardDescription>
                  Global, grade, or student-scoped fees used when generating consolidated invoices.
                </CardDescription>
              </div>
              <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New fee template</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="space-y-1">
                      <Label>Name</Label>
                      <Input
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))}
                        placeholder="Term 1 Tuition"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select
                        value={newTemplate.fee_category_id}
                        onValueChange={(v) => setNewTemplate((t) => ({ ...t, fee_category_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          value={newTemplate.amount}
                          onChange={(e) => setNewTemplate((t) => ({ ...t, amount: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Academic term</Label>
                        <Input
                          value={newTemplate.academic_term}
                          onChange={(e) =>
                            setNewTemplate((t) => ({ ...t, academic_term: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Scope</Label>
                      <Select
                        value={newTemplate.scope}
                        onValueChange={(v) =>
                          setNewTemplate((t) => ({
                            ...t,
                            scope: v as "global" | "grade" | "student",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">All students</SelectItem>
                          <SelectItem value="grade">Grade / class</SelectItem>
                          <SelectItem value="student">Individual student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newTemplate.scope === "grade" && (
                      <div className="space-y-1">
                        <Label>Class</Label>
                        <Select
                          value={newTemplate.class_id}
                          onValueChange={(v) => setNewTemplate((t) => ({ ...t, class_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {newTemplate.scope === "student" && (
                      <div className="space-y-1">
                        <Label>Student</Label>
                        <Select
                          value={newTemplate.student_id}
                          onValueChange={(v) => setNewTemplate((t) => ({ ...t, student_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button onClick={() => void handleSaveTemplate()} disabled={savingTemplate}>
                      {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save template"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.fee_categories?.name}</TableCell>
                      <TableCell>{t.scope}</TableCell>
                      <TableCell>{t.academic_term}</TableCell>
                      <TableCell>
                        {Number(t.amount).toFixed(2)} {t.currency ?? "GHS"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {categories.length > 0 && (
                <p className="text-xs text-muted-foreground mt-4">
                  Categories (payment priority):{" "}
                  {categories.map((c) => `${c.name} (${c.default_priority})`).join(" → ")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
