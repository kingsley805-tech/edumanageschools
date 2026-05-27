import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatStudentDisplayName } from "@/billing/lib/studentDisplayName";

type OutstandingRow = {
  student_id_pk: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  invoices_count: number;
  outstanding_balance: number;
  currency: string;
};

export default function BillingOutstandingStudents() {
  const { schoolId } = useBillingAuth();
  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "class" | "balance">("balance");

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("id, student_id, total_amount, amount_paid, balance_due, status, currency")
        .eq("school_id", schoolId)
        .not("status", "in", "(paid,void)")
        .order("created_at", { ascending: false })
        .limit(1000);

      const openInvoices = (invoices || []).filter((inv) => {
        const bal = Number(inv.balance_due ?? (Number(inv.total_amount) - Number(inv.amount_paid)));
        return bal > 0;
      });

      const studentIds = [...new Set(openInvoices.map((i) => i.student_id).filter(Boolean))] as string[];
      if (studentIds.length === 0) {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const { data: students } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_id, user_id, class_id")
        .in("id", studentIds);

      const userIds = [...new Set((students || []).map((s) => s.user_id).filter(Boolean))] as string[];
      const profileMap = new Map<string, { first_name: string; last_name: string }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        for (const p of profs || []) {
          profileMap.set(p.user_id, { first_name: p.first_name || "", last_name: p.last_name || "" });
        }
      }

      const classIds = [...new Set((students || []).map((s) => s.class_id).filter(Boolean))] as string[];
      const classMap = new Map<string, string>();
      if (classIds.length > 0) {
        const { data: classes } = await supabase.from("classes").select("id, name, stream").in("id", classIds);
        for (const c of classes || []) {
          classMap.set(c.id, `${c.name}${c.stream ? ` ${c.stream}` : ""}`);
        }
      }

      const aggregate = new Map<string, OutstandingRow>();
      for (const inv of openInvoices) {
        const sid = inv.student_id;
        const st = (students || []).find((s) => s.id === sid);
        if (!st) continue;
        const linked = st.user_id ? profileMap.get(st.user_id) ?? null : null;
        const display = formatStudentDisplayName(
          { first_name: st.first_name, last_name: st.last_name, student_id: st.student_id },
          linked,
        );
        const balance = Number(inv.balance_due ?? (Number(inv.total_amount) - Number(inv.amount_paid)));
        const current = aggregate.get(sid);
        if (current) {
          current.outstanding_balance += balance;
          current.invoices_count += 1;
        } else {
          aggregate.set(sid, {
            student_id_pk: sid,
            student_name: display,
            admission_number: st.student_id,
            class_name: st.class_id ? classMap.get(st.class_id) || "—" : "—",
            invoices_count: 1,
            outstanding_balance: balance,
            currency: inv.currency || "GHS",
          });
        }
      }

      if (cancelled) return;
      setRows(Array.from(aggregate.values()));
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const classOptions = useMemo(() => {
    const uniq = [...new Set(rows.map((r) => r.class_name).filter((n) => n && n !== "—"))];
    return uniq.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const bySearch = !q || `${r.student_name} ${r.admission_number} ${r.class_name}`.toLowerCase().includes(q);
      const byClass = classFilter === "all" || r.class_name === classFilter;
      return bySearch && byClass;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.student_name.localeCompare(b.student_name);
      if (sortBy === "class") return a.class_name.localeCompare(b.class_name);
      return b.outstanding_balance - a.outstanding_balance;
    });
  }, [rows, search, classFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Outstanding Students</h1>
        <p className="text-sm text-muted-foreground">Students with unpaid balances across open invoices.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Search name, class, admission..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger><SelectValue placeholder="Filter by class" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classOptions.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "class" | "balance")}>
          <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="balance">Sort: Highest Balance</SelectItem>
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Invoices</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td className="px-4 py-8 text-sm text-muted-foreground" colSpan={6}>Loading...</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td className="px-4 py-8 text-sm text-muted-foreground" colSpan={6}>No outstanding students found.</td></tr>
              ) : visibleRows.map((row) => (
                <tr key={row.student_id_pk} className="hover:bg-muted/30">
                  <td className="px-4 py-3.5 text-sm font-medium">{row.student_name}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{row.class_name}</td>
                  <td className="px-4 py-3.5 text-sm font-mono text-muted-foreground">{row.admission_number}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{row.invoices_count}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{row.currency} {row.outstanding_balance.toLocaleString()}</td>
                  <td className="px-4 py-3.5"><Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Outstanding</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
