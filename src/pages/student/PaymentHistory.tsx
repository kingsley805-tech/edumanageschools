// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import PaymentTransactionsTable from "@/billing/components/payments/PaymentTransactionsTable";
import { PaymentDetailsDialog, type PaymentDetailsPayload } from "@/billing/components/payments/PaymentDetailsDialog";
import { usePaymentTransactions } from "@/billing/hooks/usePaymentTransactions";
import { filterPaymentTransactions, paymentRevenueStats } from "@/billing/lib/paymentTransactions";
import { downloadPaymentReceipt } from "@/billing/lib/paymentReceipt";
import TablePagination from "@/billing/components/TablePagination";
import { usePagination } from "@/billing/hooks/usePagination";
export default function StudentPaymentHistory() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [profile, setProfile] = useState({ name: "", className: "", admission: "" });
  const [bootLoading, setBootLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<PaymentDetailsPayload | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setBootLoading(true);
      const { data: st } = await supabase
        .from("students")
        .select("id, full_name, admission_number, class_id, school_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!st) {
        setBootLoading(false);
        return;
      }
      setStudentId(st.id);
      setSchoolId(st.school_id);
      let className = "—";
      if (st.class_id) {
        const { data: cls } = await supabase.from("classes").select("name").eq("id", st.class_id).maybeSingle();
        className = cls?.name ?? "—";
      }
      setProfile({
        name: st.full_name ?? "Student",
        className,
        admission: st.admission_number ?? "",
      });
      setBootLoading(false);
    })();
  }, [user]);

  const scope = studentId ? { mode: "student" as const, studentId } : null;
  const { rows, loading, error, refetch } = usePaymentTransactions(scope);

  const filtered = useMemo(
    () => filterPaymentTransactions(rows, { search, status: statusFilter }),
    [rows, search, statusFilter],
  );
  const stats = useMemo(() => paymentRevenueStats(rows), [rows]);
  const { page, totalPages, paged, setPage } = usePagination(filtered);

  const openDetail = useCallback((row: (typeof rows)[0]) => {
    setDetail({
      id: row.id,
      amount: row.amount,
      method: row.method,
      status: row.status,
      paid_at: row.paid_at,
      created_at: row.created_at,
      currency: row.currency,
      gateway: row.gateway,
      gateway_ref: row.gateway_ref,
      paystack_transaction_id: row.paystack_transaction_id ?? row.transaction_id ?? null,
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      payer_name: row.payer_name,
      payer_role: row.payer_role,
      payment_context: row.payment_context ?? "fees",
      notes: row.notes,
    });
    setDetailOpen(true);
  }, []);

  const handleReceipt = useCallback(
    async (row: (typeof rows)[0]) => {
      if (!schoolId) return;
      try {
        await downloadPaymentReceipt(row, {
          schoolId,
          studentName: profile.name,
          admissionNumber: profile.admission,
          className: profile.className,
        });
        toast.success("Receipt downloaded");
      } catch {
        toast.error("Could not generate receipt");
      }
    },
    [schoolId, profile],
  );

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link to="/student/billing">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to fees
              </Link>
            </Button>
            <h2 className="text-3xl font-bold tracking-tight">Payment history</h2>
            <p className="text-muted-foreground">
              All your recorded fee payments · updates in real time
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>

        {bootLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !studentId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Student profile not found.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total paid</CardTitle>
                  <CardDescription>Successful payments</CardDescription>
                </CardHeader>
                <CardContent className="text-2xl font-bold text-emerald-700">
                  {stats.currency} {stats.totalRevenue.toLocaleString()}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  <CardDescription>Last 30 days: {stats.last30Count}</CardDescription>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{stats.successfulCount}</CardContent>
              </Card>
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[200px] flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search invoice, reference…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Successful</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <PaymentTransactionsTable
              variant="student"
              rows={paged}
              loading={loading}
              onView={openDetail}
              onDownloadReceipt={handleReceipt}
            />
            {!loading && filtered.length > 0 ? (
              <TablePagination
                page={page}
                totalPages={totalPages}
                setPage={setPage}
                totalItems={filtered.length}
              />
            ) : null}
          </>
        )}
      </div>
      <PaymentDetailsDialog payment={detail} open={detailOpen} onOpenChange={setDetailOpen} />
    </DashboardLayout>
  );
}
