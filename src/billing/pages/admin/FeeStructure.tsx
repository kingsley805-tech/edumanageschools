// @ts-nocheck
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBillingAuth } from "@/billing/hooks/useBillingAuth";
import { useBillingPermissions } from "@/billing/hooks/useBillingPermissions";
import { Button } from "@/components/ui/button";
import ConfirmActionButton from "@/billing/components/ConfirmActionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Layers, Link2, Plus, Tag, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currency";
import { fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";
import { AcademicCalendarPanel } from "@/billing/components/AcademicCalendarPanel";
import {
  fetchFeeAssignments,
  formatAssignmentStudentLabel,
  formatSupabaseError,
} from "@/billing/lib/fee-assignments";
import type { StaffPagePermission } from "@/lib/staffPermissions";
import { isBillingFeeCategoriesAvailable } from "@/lib/billing/availability";
import { BillingSchemaAlert } from "@/components/billing/BillingSchemaAlert";
import { seedBillingDefaults } from "@/billing/lib/consolidated/api";

/* ─────────────────────────── types ─────────────────────────── */
type CreatedFeeRow = {
  id: string; category_id: string; term_id: string; amount: number; currency: string;
  fee_categories: { name: string } | null; terms: { name: string; fees_due_date: string } | null;
};
type StudentOption = {
  id: string; first_name: string; last_name: string; student_id: string; class_id: string | null;
  linkedProfile: { first_name: string; last_name: string } | null;
};
type FeeCategoryRow = { id: string; name: string; is_optional: boolean | null };
type AcademicYearRow = { id: string; name: string };
type TermRow = { id: string; name: string; start_date: string; end_date: string; fees_due_date: string; academic_years: { name: string } | null };
type SchoolClassRow = { id: string; name: string; stream: string | null };

/* ─────────────────────── page styles ──────────────────────────── */
const styles = `
  .fee-root * { box-sizing: border-box; }

  .fee-card {
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 12px;
    box-shadow: 0 1px 2px hsl(var(--foreground) / 0.04);
  }

  .fee-row {
    display: flex; align-items: center; justify-content: space-between;
    border-radius: 8px; padding: 13px 16px;
    background: hsl(var(--muted) / 0.45);
    border: 1px solid hsl(var(--border));
  }
  .fee-row:hover { background: hsl(var(--muted) / 0.75); }

  .fee-btn-primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground)); border: none; border-radius: 8px;
    font-weight: 600; font-size: 13.5px;
    padding: 11px 20px; cursor: pointer;
  }
  .fee-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .fee-btn-del {
    background: transparent; border: none; border-radius: 8px;
    padding: 7px; cursor: pointer; color: hsl(var(--destructive)); line-height: 0;
  }
  .fee-btn-del:hover { background: hsl(var(--destructive) / 0.12); }

  .fee-btn-sm {
    display: inline-flex; align-items: center; gap: 6px;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground)); border: none; border-radius: 8px;
    font-weight: 600; font-size: 12.5px; padding: 7px 13px;
    cursor: pointer; white-space: nowrap;
  }

  .section-title {
    font-size: 15px; font-weight: 600; color: hsl(var(--foreground));
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding-bottom: 16px;
    border-bottom: 1px solid hsl(var(--border));
    margin-bottom: 18px;
  }
  .section-icon {
    width: 34px; height: 34px; border-radius: 8px;
    background: hsl(var(--muted));
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }

  .fee-empty {
    text-align: center; padding: 30px 20px; color: hsl(var(--muted-foreground)); font-size: 13px;
    background: hsl(var(--muted) / 0.35);
    border-radius: 8px; border: 1px dashed hsl(var(--border)); line-height: 1.6;
  }

  .fee-badge-mandatory {
    background: hsl(var(--success) / 0.12); color: hsl(var(--success));
    border: 1px solid hsl(var(--success) / 0.22);
    font-size: 10.5px; font-weight: 600; border-radius: 6px; padding: 2px 8px; white-space: nowrap;
  }
  .fee-badge-optional {
    background: hsl(var(--warning) / 0.12); color: hsl(var(--warning));
    border: 1px solid hsl(var(--warning) / 0.22);
    font-size: 10.5px; font-weight: 600; border-radius: 6px; padding: 2px 8px; white-space: nowrap;
  }

  .amount-chip {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-weight: 500; font-size: 13px;
    background: hsl(var(--muted));
    color: hsl(var(--foreground)); border: 1px solid hsl(var(--border));
    border-radius: 6px; padding: 3px 10px; white-space: nowrap;
  }

  .fee-bg { background: hsl(var(--background)); }

  .fee-input {
    border-radius: 8px !important; border: 1px solid hsl(var(--input)) !important;
    background: hsl(var(--background)) !important; color: hsl(var(--foreground)) !important; font-size: 13.5px !important;
  }
  .fee-input:focus { border-color: hsl(var(--ring)) !important; box-shadow: 0 0 0 2px hsl(var(--ring) / 0.15) !important; }

  .fee-tabs { display: flex; gap: 4px; background: hsl(var(--muted)); border-radius: 8px; padding: 4px; }
  .fee-tab {
    flex: 1; text-align: center; padding: 8px 12px; border-radius: 6px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    color: hsl(var(--muted-foreground)); border: none; background: transparent;
  }
  .fee-tab.active { background: hsl(var(--card)); color: hsl(var(--foreground)); border: 1px solid hsl(var(--border)); }

  .fee-label { font-size: 11.5px; font-weight: 600; color: hsl(var(--muted-foreground)); margin-bottom: 6px; display: block; letter-spacing: .04em; text-transform: uppercase; }
  .fee-subtext { font-size: 11.5px; color: hsl(var(--muted-foreground)); margin-top: 1px; }
  .fee-loading { padding: 24px 0; text-align: center; font-size: 13px; color: hsl(var(--muted-foreground)); }

  @media (max-width: 900px) {
    .fee-grid-2 { grid-template-columns: 1fr !important; }
  }
`;

/* ═══════════════════════ CategoriesManager ══════════════════════ */
function CategoriesManager({ schoolId, permission }: { schoolId: string; permission: StaffPagePermission }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isOptional, setIsOptional] = useState(false);
  const canCreate = permission.create || permission.manage;
  const canDelete = permission.delete || permission.manage;

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["fee-categories", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_categories").select("*").eq("school_id", schoolId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as FeeCategoryRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!canCreate) throw new Error("You do not have permission to create fee categories.");
      const { error } = await supabase.from("fee_categories").insert({ school_id: schoolId, name, is_optional: isOptional, sort_order: categories.length });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-categories"] }); setOpen(false); setName(""); setIsOptional(false); toast.success("Category created"); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!canDelete) throw new Error("You do not have permission to delete fee categories.");
      const { error } = await supabase.from("fee_categories").delete().eq("id", id); if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-categories"] }); toast.success("Category deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fee-card p-6">
      <div className="section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="section-icon"><Tag size={15} color="hsl(var(--primary))" /></span>
          Fee Categories
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          {canCreate ? (
            <DialogTrigger asChild>
              <button className="fee-btn-sm"><Plus size={13} />Add Category</button>
            </DialogTrigger>
          ) : null}
          <DialogContent>
            <DialogHeader><DialogTitle>New Fee Category</DialogTitle></DialogHeader>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 6 }}>
              <div>
                <label className="fee-label">Category Name</label>
                <Input className="fee-input" placeholder="e.g. Tuition, PTA Levy" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "hsl(var(--muted) / 0.65)", borderRadius: 12, border: "1px solid hsl(var(--border))" }}>
                <Switch checked={isOptional} onCheckedChange={setIsOptional} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--foreground))" }}>Optional fee</div>
                  <div className="fee-subtext">Students may opt in or out</div>
                </div>
              </div>
              <button className="fee-btn-primary" onClick={() => create.mutate()} disabled={!name || create.isPending} style={{ width: "100%", padding: "13px" }}>
                {create.isPending ? "Creating..." : "Create Category"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="fee-loading">Loading categories…</p>
      ) : categories.length === 0 ? (
        <div className="fee-empty">No fee categories yet.<br /><span style={{ fontSize: 12 }}>Click "Add Category" to get started.</span></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map((cat, i) => (
            <div key={cat.id} className="fee-row">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--card-foreground))" }}>{cat.name}</span>
                <span className={cat.is_optional ? "fee-badge-optional" : "fee-badge-mandatory"}>
                  {cat.is_optional ? "Optional" : "Mandatory"}
                </span>
              </div>
              {canDelete ? (
                <ConfirmActionButton
                  title="Delete category?"
                  description={`This will permanently delete ${cat.name}.`}
                  confirmLabel="Delete"
                  onConfirm={() => remove.mutate(cat.id)}
                  trigger={<button className="fee-btn-del"><Trash2 size={14} /></button>}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ FeeCreationSection ═════════════════════ */
function FeeCreationSection({ schoolId, permission }: { schoolId: string; permission: StaffPagePermission }) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(""); const [termId, setTermId] = useState(""); const [amount, setAmount] = useState(""); const [filterTermId, setFilterTermId] = useState("all");
  const canCreate = permission.create || permission.manage;
  const canDelete = permission.delete || permission.manage;

  const { data: categories = [] } = useQuery({ queryKey: ["fee-categories", schoolId], queryFn: async () => { const { data, error } = await supabase.from("fee_categories").select("*").eq("school_id", schoolId).order("sort_order"); if (error) throw error; return (data ?? []) as FeeCategoryRow[]; } });
  const { data: terms = [] } = useQuery({ queryKey: ["terms", schoolId], queryFn: async () => { const { data, error } = await supabase.from("terms").select("*, academic_years(name)").eq("school_id", schoolId).order("start_date", { ascending: false }); if (error) throw error; return (data ?? []) as TermRow[]; } });
  const { data: orgCurrency = "GHS" } = useQuery({ queryKey: ["org-currency", schoolId], queryFn: async () => { const { data, error } = await supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle(); if (error) throw error; return data?.currency?.trim() || "GHS"; } });

  const { data: createdFees = [], isLoading } = useQuery({
    queryKey: ["created-fees", schoolId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("fee_items").select("id, category_id, term_id, amount, currency, fee_categories(name), terms(name, fees_due_date)").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as CreatedFeeRow[];
    },
  });

  const createFee = useMutation({
    mutationFn: async () => {
      if (!canCreate) throw new Error("You do not have permission to create fees.");
      const parsedAmount = Number(amount);
      if (!categoryId || !termId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Select fee category, term, and enter a valid amount.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("fee_items").insert({ school_id: schoolId, category_id: categoryId, term_id: termId, amount: parsedAmount, currency: orgCurrency });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["created-fees"] }); setCategoryId(""); setTermId(""); setAmount(""); toast.success("Fee saved"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteFee = useMutation({
    mutationFn: async (id: string) => {
      if (!canDelete) throw new Error("You do not have permission to delete fees.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("fee_items").delete().eq("id", id); if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["created-fees"] }); qc.invalidateQueries({ queryKey: ["fee-assignments"] }); toast.success("Fee deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const visibleFees = createdFees.filter((fee) => filterTermId === "all" || fee.term_id === filterTermId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* create form */}
      <div className="fee-card p-6">
        <div className="section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="section-icon"><DollarSign size={15} color="hsl(var(--primary))" /></span>
            Create Fee
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div>
            <label className="fee-label">Fee Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="fee-input"><SelectValue placeholder="Select category..." /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="fee-label">Term</label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger className="fee-input"><SelectValue placeholder="Select term..." /></SelectTrigger>
              <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.academic_years?.name})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="fee-label">Amount</label>
            <Input className="fee-input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        {canCreate ? (
          <button className="fee-btn-primary" onClick={() => createFee.mutate()} disabled={!categoryId || !termId || !amount || createFee.isPending} style={{ width: "100%", marginTop: 18, padding: "13px" }}>
            {createFee.isPending ? "Saving..." : "Save Fee"}
          </button>
        ) : null}
      </div>

      {/* list */}
      <div className="fee-card p-6">
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid hsl(var(--border))" }}>Created Fees</div>
          <div style={{ maxWidth: 240 }}>
            <label className="fee-label">Filter by Term</label>
            <Select value={filterTermId} onValueChange={setFilterTermId}>
              <SelectTrigger className="fee-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.academic_years?.name})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isLoading ? (
          <p className="fee-loading">Loading fees…</p>
        ) : visibleFees.length === 0 ? (
          <div className="fee-empty">No fees match the current filter.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleFees.map((fee, i) => (
              <div key={fee.id} className="fee-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--card-foreground))" }}>{fee.fee_categories?.name ?? "Fee"}</div>
                  <div className="fee-subtext">{fee.terms?.name ?? "Term"}{fee.terms?.fees_due_date ? ` · Due ${fee.terms.fees_due_date}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="amount-chip">{formatMoney(Number(fee.amount), fee.currency || orgCurrency)}</span>
                  {canDelete ? (
                    <ConfirmActionButton
                      title="Delete fee?"
                      description={`This will permanently delete ${(fee.fee_categories?.name ?? "this fee")} for ${fee.terms?.name ?? "the selected term"}.`}
                      confirmLabel="Delete"
                      onConfirm={() => deleteFee.mutate(fee.id)}
                      trigger={<button className="fee-btn-del"><Trash2 size={14} /></button>}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ FeeAssignmentSection ═══════════════════ */
function FeeAssignmentSection({ schoolId, permission }: { schoolId: string; permission: StaffPagePermission }) {
  const qc = useQueryClient();
  const [assignmentType, setAssignmentType] = useState<"class" | "student">("class");
  const [feeItemId, setFeeItemId] = useState(""); const [classId, setClassId] = useState(""); const [studentId, setStudentId] = useState("");
  const canCreate = permission.create || permission.manage;
  const canDelete = permission.delete || permission.manage;

  const { data: createdFees = [] } = useQuery({
    queryKey: ["created-fees", schoolId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from as any)("fee_items").select("id, category_id, term_id, amount, currency, fee_categories(name), terms(name, fees_due_date)").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (error) throw error; return (data ?? []) as CreatedFeeRow[];
    },
  });
  const { data: classes = [] } = useQuery({ queryKey: ["school-classes", schoolId], queryFn: async () => { const { data, error } = await supabase.from("classes").select("*").eq("school_id", schoolId).order("level"); if (error) throw error; return (data ?? []) as SchoolClassRow[]; } });
  const { data: students = [] } = useQuery({
    queryKey: ["students-with-profiles", schoolId],
    queryFn: async () => {
      const rows = await fetchStudentsWithLinkedProfiles(schoolId);
      return rows.map((student) => ({
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_id: student.student_id,
        class_id: "class_id" in student ? ((student.class_id as string | null) ?? null) : null,
        linkedProfile: student.linkedProfile ?? null,
      })) satisfies StudentOption[];
    },
  });

  const {
    data: assignments = [],
    isLoading,
    isError,
    error: assignmentsError,
  } = useQuery({
    queryKey: ["fee-assignments", schoolId],
    queryFn: () => fetchFeeAssignments(schoolId),
    enabled: !!schoolId,
  });

  const assignFee = useMutation({
    mutationFn: async () => {
      if (!canCreate) throw new Error("You do not have permission to assign fees.");
      if (!feeItemId) throw new Error("Select a created fee.");
      if (assignmentType === "class" && !classId) throw new Error("Select a class.");
      if (assignmentType === "student" && !studentId) throw new Error("Select a student.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duplicateQuery = (supabase.from as any)("fee_assignments").select("id").eq("school_id", schoolId).eq("fee_item_id", feeItemId);
      const { data: existing, error: existingError } = assignmentType === "class"
        ? await duplicateQuery.eq("class_id", classId).is("student_id", null).maybeSingle()
        : await duplicateQuery.eq("student_id", studentId).is("class_id", null).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.id) throw new Error("This fee is already assigned.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("fee_assignments").insert({ school_id: schoolId, fee_item_id: feeItemId, class_id: assignmentType === "class" ? classId : null, student_id: assignmentType === "student" ? studentId : null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-assignments"] }); setFeeItemId(""); setClassId(""); setStudentId(""); toast.success("Fee assigned"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      if (!canDelete) throw new Error("You do not have permission to remove fee assignments.");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from as any)("fee_assignments").delete().eq("id", id); if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-assignments"] }); toast.success("Assignment removed"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* assign form */}
      <div className="fee-card p-6">
        <div className="section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="section-icon"><Link2 size={15} color="hsl(var(--primary))" /></span>
            Assign Fee
          </span>
        </div>

        {canCreate ? (
          <>
            <div style={{ marginBottom: 18 }}>
              <label className="fee-label">Assign To</label>
              <div className="fee-tabs">
                <button className={`fee-tab${assignmentType === "class" ? " active" : ""}`} onClick={() => setAssignmentType("class")}>Class</button>
                <button className={`fee-tab${assignmentType === "student" ? " active" : ""}`} onClick={() => setAssignmentType("student")}>Student</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fee-label">Select Created Fee</label>
                <Select value={feeItemId} onValueChange={setFeeItemId}>
                  <SelectTrigger className="fee-input"><SelectValue placeholder="Select created fee..." /></SelectTrigger>
                  <SelectContent>
                    {createdFees.map((fee) => (
                      <SelectItem key={fee.id} value={fee.id}>
                        {(fee.fee_categories?.name ?? "Fee")} · {(fee.terms?.name ?? "Term")} · {formatMoney(Number(fee.amount), fee.currency || "GHS")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {assignmentType === "class" ? (
                <div>
                  <label className="fee-label">Class</label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger className="fee-input"><SelectValue placeholder="Select class..." /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? ` ${c.stream}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <label className="fee-label">Student</label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger className="fee-input"><SelectValue placeholder="Select student..." /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatStudentDisplayName({ first_name: s.first_name, last_name: s.last_name, student_id: s.student_id }, s.linkedProfile)} ({s.student_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <button className="fee-btn-primary" onClick={() => assignFee.mutate()} disabled={!feeItemId || (assignmentType === "class" ? !classId : !studentId) || assignFee.isPending} style={{ width: "100%", marginTop: 18, padding: "13px" }}>
              {assignFee.isPending ? "Assigning..." : "Assign Fee"}
            </button>
          </>
        ) : (
          <div className="fee-empty">You can view assigned fees, but you do not have permission to create new assignments.</div>
        )}
      </div>

      {/* assigned list */}
      <div className="fee-card p-6">
        <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid hsl(var(--border))" }}>Assigned Fees</div>
        {isLoading ? (
          <p className="fee-loading">Loading assignments…</p>
        ) : isError ? (
          <div className="fee-empty" style={{ color: "hsl(var(--destructive))" }}>
            Could not load assigned fees.
            <br />
            <span style={{ fontSize: 12 }}>{formatSupabaseError(assignmentsError)}</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="fee-empty">No fee assignments yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assignments.map((a, i) => (
              <div key={a.id} className="fee-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "hsl(var(--card-foreground))", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {a.fee_items?.fee_categories?.name ?? "Fee"}
                    <ChevronRight size={11} style={{ color: "hsl(var(--muted-foreground))", flexShrink: 0 }} />
                    {a.fee_items?.terms?.name ?? "Term"}
                  </div>
                  <div className="fee-subtext">
                    {a.class_id
                      ? `Class: ${a.classes?.name ?? "Class"}${a.classes?.stream ? ` ${a.classes.stream}` : ""}`
                      : `Student: ${formatAssignmentStudentLabel(a.students)}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="amount-chip">{formatMoney(Number(a.fee_items?.amount ?? 0), a.fee_items?.currency ?? "GHS")}</span>
                  {canDelete ? (
                    <ConfirmActionButton
                      title="Remove fee assignment?"
                      description="This will remove the selected fee assignment."
                      confirmLabel="Remove"
                      onConfirm={() => deleteAssignment.mutate(a.id)}
                      trigger={<button className="fee-btn-del"><Trash2 size={14} /></button>}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ Root ═══════════════════════════════════ */
export default function BillingFeeStructure() {
  const { schoolId, loading: orgLoading } = useBillingAuth();
  const { getPermission } = useBillingPermissions();
  const permission = getPermission("fees");
  const [billingReady, setBillingReady] = useState<boolean | null>(null);

  const checkBilling = async () => {
    const ok = await isBillingFeeCategoriesAvailable();
    setBillingReady(ok);
    if (ok && schoolId) {
      try {
        await seedBillingDefaults(schoolId);
      } catch {
        /* seed optional */
      }
    }
  };

  useEffect(() => {
    void checkBilling();
  }, [schoolId]);

  return (
    <div className="fee-root fee-bg" style={{ padding: "32px 28px", minHeight: "100vh" }}>
      <style>{styles}</style>

      {orgLoading || billingReady === null ? (
        <p className="fee-loading" style={{ paddingTop: 48 }}>Loading…</p>
      ) : !schoolId ? (
        <div style={{ textAlign: "center", paddingTop: 80, color: "hsl(var(--muted-foreground))", fontSize: 14 }}>
          Please set up your organization first in Settings.
        </div>
      ) : billingReady === false ? (
        <BillingSchemaAlert onRecheck={() => void checkBilling()} />
      ) : (
        <>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "hsl(var(--foreground))", margin: "0 0 6px" }}>Fees</h1>
            <p style={{ fontSize: 13.5, color: "hsl(var(--muted-foreground))", margin: 0 }}>
              Set up academic years and the current term, then create fees and assign them to classes or students.
            </p>
          </div>

          <AcademicCalendarPanel schoolId={schoolId} permission={permission} />

          {/* top row: categories */}
          <div className="fee-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20, maxWidth: 640 }}>
            <CategoriesManager schoolId={schoolId} permission={permission} />
          </div>

          {/* bottom row: creation + assignment */}
          <div className="fee-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <FeeCreationSection schoolId={schoolId} permission={permission} />
            <FeeAssignmentSection schoolId={schoolId} permission={permission} />
          </div>
        </>
      )}
    </div>
  );
};