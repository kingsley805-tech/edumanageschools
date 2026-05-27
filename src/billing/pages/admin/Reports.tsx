import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { exportToCSV } from "@/billing/lib/exportUtils";

type InvoiceRow = { student_id: string | null; status: string };
type PaymentRow = { amount: number; method: string };
type StudentRow = { id: string; class_id: string | null };
type ClassRow = { id: string; name: string; stream: string | null };

const statusColors: Record<string, string> = {
  Paid: "hsl(152, 60%, 42%)",
  Pending: "hsl(38, 92%, 50%)",
  Overdue: "hsl(0, 72%, 51%)",
};

export default function BillingReports() {
  const { schoolId } = useBillingAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!schoolId) {
        setInvoices([]);
        setPayments([]);
        setStudents([]);
        setClasses([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [invoiceRes, paymentRes, studentRes, classRes] = await Promise.all([
        supabase.from("billing_invoices").select("student_id, status").eq("school_id", schoolId),
        supabase.from("billing_payments").select("amount, method").eq("school_id", schoolId).eq("status", "paid"),
        supabase.from("students").select("id, class_id").eq("school_id", schoolId),
        supabase.from("classes").select("id, name, stream").eq("school_id", schoolId).order("level"),
      ]);

      setInvoices((invoiceRes.data || []) as InvoiceRow[]);
      setPayments((paymentRes.data || []) as PaymentRow[]);
      setStudents((studentRes.data || []) as StudentRow[]);
      setClasses((classRes.data || []) as ClassRow[]);
      setLoading(false);
    };

    fetchReportData();
  }, [schoolId]);

  const methodData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of payments) {
      const methodName = (p.method || "other").replace("_", " ");
      totals.set(methodName, (totals.get(methodName) || 0) + Number(p.amount || 0));
    }
    return [...totals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const classData = useMemo(() => {
    const studentToClass = new Map(students.map((s) => [s.id, s.class_id]));
    const className = (classId: string | null) => {
      if (!classId) return "Unassigned";
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return "Unassigned";
      return cls.stream ? `${cls.name} ${cls.stream}` : cls.name;
    };

    const totals = new Map<string, { name: string; paid: number; pending: number; overdue: number }>();
    for (const inv of invoices) {
      const name = className(inv.student_id ? (studentToClass.get(inv.student_id) || null) : null);
      const row = totals.get(name) || { name, paid: 0, pending: 0, overdue: 0 };
      if (inv.status === "paid") row.paid += 1;
      else if (inv.status === "overdue") row.overdue += 1;
      else row.pending += 1;
      totals.set(name, row);
    }
    return [...totals.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, students, classes]);

  const statusData = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid").length;
    const overdue = invoices.filter((i) => i.status === "overdue").length;
    const pending = Math.max(0, invoices.length - paid - overdue);
    return [
      { name: "Paid", value: paid, color: statusColors.Paid },
      { name: "Pending", value: pending, color: statusColors.Pending },
      { name: "Overdue", value: overdue, color: statusColors.Overdue },
    ];
  }, [invoices]);

  const handleExport = () => {
    exportToCSV(
      "reports-payment-methods",
      ["Method", "Amount"],
      methodData.map((row) => [row.method, String(row.amount)])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">School financial reports and analytics</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Tabs defaultValue="method" className="space-y-4">
        <TabsList>
          <TabsTrigger value="method">By Payment Method</TabsTrigger>
          <TabsTrigger value="class">By Class</TabsTrigger>
          <TabsTrigger value="status">Payment Status</TabsTrigger>
        </TabsList>

        <TabsContent value="method">
          <Card>
            <CardHeader><CardTitle className="text-lg">Revenue by Payment Method</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 90%)" />
                    <XAxis dataKey="method" tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,90%)", borderRadius: "8px", fontSize: "13px" }} formatter={(v: number) => [v.toLocaleString(), "Amount"]} />
                    <Bar dataKey="amount" fill="hsl(172, 66%, 40%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="class">
          <Card>
            <CardHeader><CardTitle className="text-lg">Invoice Status by Class</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(0,0%,100%)", border: "1px solid hsl(220,13%,90%)", borderRadius: "8px", fontSize: "13px" }} />
                    <Bar dataKey="paid" name="Paid" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overdue" name="Overdue" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader><CardTitle className="text-lg">Overall Invoice Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={120} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading ? <p className="text-sm text-muted-foreground">Loading reports...</p> : null}
    </div>
  );
};


