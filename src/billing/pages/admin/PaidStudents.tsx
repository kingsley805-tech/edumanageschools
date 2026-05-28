// @ts-nocheck
﻿import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatStudentDisplayName } from "@/billing/lib/studentDisplayName";

type Period = "today" | "week" | "month";

type PaidRow = {
  payment_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  reference: string;
  paid_at: string;
};

export default function BillingPaidStudents() {
  const { schoolId } = useBillingAuth();
  const [period, setPeriod] = useState<Period>("today");
  const [rows, setRows] = useState<PaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "class" | "latest">("latest");

  const startDateIso = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "today") return dayStart.toISOString();
    if (period === "week") {
      const weekStart = new Date(dayStart);
      weekStart.setDate(dayStart.getDate() - 6);
      return weekStart.toISOString();
    }
    const monthStart = new Date(dayStart);
    monthStart.setDate(dayStart.getDate() - 29);
    return monthStart.toISOString();
  }, [period]);

  useEffect(() => {
    if (!schoolId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: payments } = await (supabase
        .from("billing_payments")
        .select("id, invoice_id, gateway_ref, paid_at, created_at, payer_name") as any)
        .eq("school_id", schoolId)
        .eq("status", "paid")
        .gte("created_at", startDateIso)
        .order("created_at", { ascending: false })
        .limit(300);

      const invoiceIds = [...new Set((payments || []).map((p) => p.invoice_id).filter(Boolean))] as string[];
      let invoiceToStudent = new Map<string, string>();
      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase.from("billing_invoices").select("id, student_id").in("id", invoiceIds);
        invoiceToStudent = new Map((invoices || []).map((i) => [i.id, i.student_id]).filter((x): x is [string, string] => Boolean(x[0] && x[1])));
      }

      const studentIds = [...new Set(Array.from(invoiceToStudent.values()))];
      let studentMeta = new Map<string, { first_name: string; last_name: string; student_id: string; user_id: string | null; class_id: string | null }>();
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from("students")
          .select("id, first_name, last_name, student_id, user_id, class_id")
          .in("id", studentIds);
        studentMeta = new Map(
          (students || [])
            .map((s) => [s.id, { first_name: s.first_name, last_name: s.last_name, student_id: s.student_id, user_id: s.user_id, class_id: s.class_id }] as const)
            .filter((x) => Boolean(x[0])),
        );
      }
      const classIds = [...new Set(Array.from(studentMeta.values()).map((s) => s.class_id).filter(Boolean))] as string[];
      const classMap = new Map<string, string>();
      if (classIds.length > 0) {
        const { data: classes } = await supabase.from("classes").select("id, name, stream").in("id", classIds);
        for (const c of classes || []) {
          classMap.set(c.id, `${c.name}${c.stream ? ` ${c.stream}` : ""}`);
        }
      }

      const userIds = [...new Set(Array.from(studentMeta.values()).map((s) => s.user_id).filter(Boolean))] as string[];
      const profileMap = new Map<string, { first_name: string; last_name: string }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        for (const p of profs || []) {
          profileMap.set(p.user_id, { first_name: p.first_name || "", last_name: p.last_name || "" });
        }
      }

      const looksLikeEmail = (value: string) => /\S+@\S+\.\S+/.test(value);
      const looksLikeAdmission = (value: string) => /^[A-Z]{2,5}-/i.test(value);

      const formatted: PaidRow[] = (payments || [])
        .map((p) => {
          const sid = invoiceToStudent.get(p.invoice_id || "");
          if (!sid) return null;
          const st = studentMeta.get(sid);
          if (!st) return null;
          const linked = st.user_id ? profileMap.get(st.user_id) ?? null : null;
          let name = formatStudentDisplayName(
            { first_name: st.first_name, last_name: st.last_name, student_id: st.student_id },
            linked,
          );
          const payerName = String(p.payer_name || "").trim();
          if (name.toLowerCase() === st.student_id.toLowerCase() && payerName && !looksLikeEmail(payerName) && !looksLikeAdmission(payerName)) {
            name = payerName;
          }
          return {
            payment_id: p.id,
            student_name: name,
            admission_number: st.student_id,
            class_name: st.class_id ? classMap.get(st.class_id) || "—" : "—",
            reference: p.gateway_ref || p.id.slice(0, 8),
            paid_at: p.paid_at || p.created_at,
          };
        })
        .filter((r): r is PaidRow => Boolean(r));

      if (cancelled) return;
      setRows(formatted);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId, startDateIso]);

  const classOptions = useMemo(() => {
    const uniq = [...new Set(rows.map((r) => r.class_name).filter((n) => n && n !== "—"))];
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      const bySearch =
        !q ||
        `${r.student_name} ${r.admission_number} ${r.reference} ${r.class_name}`.toLowerCase().includes(q);
      const byClass = classFilter === "all" || r.class_name === classFilter;
      return bySearch && byClass;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.student_name.localeCompare(b.student_name);
      if (sortBy === "class") return a.class_name.localeCompare(b.class_name);
      return new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime();
    });
    return list;
  }, [rows, search, classFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Paid Students</h1>
        <p className="text-sm text-muted-foreground">View paid students with original names, admission numbers, and references.</p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Search name, class, admission, reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger><SelectValue placeholder="Filter by class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "class" | "latest")}>
          <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Sort: Latest paid</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="class">Sort: Class</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Admission #</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid At</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td className="px-4 py-8 text-sm text-muted-foreground" colSpan={6}>Loading...</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td className="px-4 py-8 text-sm text-muted-foreground" colSpan={6}>No matching paid students.</td></tr>
              ) : visibleRows.map((row) => (
                <tr key={row.payment_id} className="hover:bg-muted/30">
                  <td className="px-4 py-3.5 text-sm font-medium">{row.student_name}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{row.class_name}</td>
                  <td className="px-4 py-3.5 text-sm font-mono text-muted-foreground">{row.admission_number}</td>
                  <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{row.reference}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{new Date(row.paid_at).toLocaleString()}</td>
                  <td className="px-4 py-3.5"><Badge variant="outline" className="bg-success/10 text-success border-success/20">Paid</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}