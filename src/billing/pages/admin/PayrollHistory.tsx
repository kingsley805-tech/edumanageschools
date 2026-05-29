// @ts-nocheck
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { downloadPayrollCsv, downloadPayrollPdf, payoutSummaryFromSnapshot } from "@/billing/lib/payrollExport";
import { FileSpreadsheet, Loader2 } from "lucide-react";

type TeacherRow = {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
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

export default function PayrollHistoryPage() {
  const { schoolId } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const perm = getPermission("payments");
  const [month, setMonth] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState("");

  const { data: teachers = [] } = useQuery({
    queryKey: ["payroll-teachers", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase.rpc("list_teachers_for_payroll", { p_school_id: schoolId });
      if (error) throw error;
      return (data ?? []) as TeacherRow[];
    },
    enabled: !!schoolId && perm.view,
  });

  const { data: salaries = [], isLoading } = useQuery({
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

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    teachers.forEach((t) => m.set(t.user_id, `${t.first_name} ${t.last_name}`.trim()));
    return m;
  }, [teachers]);

  const filtered = useMemo(() => {
    return salaries.filter((s) => {
      if (month && s.month !== month) return false;
      if (teacherId && s.staff_user_id !== teacherId) return false;
      if (status && s.status !== status) return false;
      return true;
    });
  }, [salaries, month, teacherId, status]);

  const exportRows = () => {
    const headers = [
      "Teacher",
      "Month",
      "Amount",
      "Allowances",
      "Deductions",
      "Status",
      "Method",
      "Payout summary",
      "Gateway ref",
      "Paid at",
      "Notes",
    ];
    const body = filtered.map((s) => [
      nameById.get(s.staff_user_id) || s.staff_user_id,
      s.month,
      s.amount,
      s.allowances ?? 0,
      s.deductions ?? 0,
      s.status,
      s.method,
      payoutSummaryFromSnapshot(s.payout_snapshot, s.method),
      s.gateway_ref || "",
      s.paid_at || "",
      (s.notes || "").replace(/\n/g, " "),
    ]);
    downloadPayrollCsv(headers, body, `payroll-export-${schoolId?.slice(0, 8)}`);
    downloadPayrollPdf(
      "Payroll history",
      headers,
      body as (string | number)[][],
      `payroll-export-${schoolId?.slice(0, 8)}`,
    );
  };

  if (!perm.view) {
    return <div className="py-16 text-center text-muted-foreground">You do not have access to payroll history.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payroll history</h1>
          <p className="mt-1 text-sm text-muted-foreground">Filter, review, and export salary records</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/billing/payroll">Back to payroll</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="space-y-2">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[180px]" />
          </div>
          <div className="min-w-[200px] space-y-2">
            <Label>Teacher</Label>
            <Select value={teacherId || "__all__"} onValueChange={(v) => setTeacherId(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All teachers</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.first_name} {t.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] space-y-2">
            <Label>Status</Label>
            <Select value={status || "__any__"} onValueChange={(v) => setStatus(v === "__any__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any status</SelectItem>
                <SelectItem value="paid">paid</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="processing">processing</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={exportRows} disabled={filtered.length === 0}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV &amp; PDF
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Paid at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{nameById.get(s.staff_user_id) || s.staff_user_id}</TableCell>
                    <TableCell className="font-mono text-sm">{s.month}</TableCell>
                    <TableCell className="text-right">{Number(s.amount).toLocaleString()}</TableCell>
                    <TableCell>{s.status}</TableCell>
                    <TableCell className="text-sm">{s.method}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {payoutSummaryFromSnapshot(s.payout_snapshot, s.method)}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs">{s.gateway_ref || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.paid_at ? new Date(s.paid_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No rows match your filters.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}