// @ts-nocheck
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAcademicCalendarAvailable } from "@/lib/billing/availability";
import { AcademicCalendarSchemaAlert } from "@/components/billing/AcademicCalendarSchemaAlert";
import { Plus, Star, Trash2, CalendarRange, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  createAcademicYear,
  createFinanceTerm,
  deleteAcademicYear,
  deleteFinanceTerm,
  fetchAcademicYears,
  fetchFinanceTerms,
  setCurrentAcademicYear,
  setCurrentFinanceTerm,
} from "@/billing/lib/academic-calendar";
import type { StaffPagePermission } from "@/lib/staffPermissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ConfirmActionButton from "@/billing/components/ConfirmActionButton";

type Props = {
  schoolId: string;
  permission: StaffPagePermission;
};

export function AcademicCalendarPanel({ schoolId, permission }: Props) {
  const qc = useQueryClient();
  const canCreate = permission.create || permission.manage;
  const canDelete = permission.delete || permission.manage;
  const [schemaOk, setSchemaOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isAcademicCalendarAvailable().then((ok) => {
      if (!cancelled) setSchemaOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const recheckSchema = () => {
    void isAcademicCalendarAvailable().then(setSchemaOk);
  };

  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ["academic-years", schoolId],
    queryFn: () => fetchAcademicYears(schoolId),
    enabled: !!schoolId && schemaOk === true,
  });

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: ["finance-terms", schoolId],
    queryFn: () => fetchFinanceTerms(schoolId),
    enabled: !!schoolId && schemaOk === true,
  });

  if (schemaOk === false) {
    return <AcademicCalendarSchemaAlert onRecheck={recheckSchema} />;
  }

  if (schemaOk === null) {
    return (
      <div className="mb-6 flex justify-center py-8">
        <div className="fee-spinner" />
      </div>
    );
  }

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["academic-years", schoolId] });
    await qc.invalidateQueries({ queryKey: ["finance-terms", schoolId] });
    await qc.invalidateQueries({ queryKey: ["terms", schoolId] });
    await qc.invalidateQueries({ queryKey: ["current-term", schoolId] });
    await qc.invalidateQueries({ queryKey: ["school-terms", schoolId] });
  };

  return (
    <div
      className="mb-6 grid gap-5 lg:grid-cols-2"
      style={{ marginBottom: 20 }}
    >
      <AcademicYearsCard
        schoolId={schoolId}
        years={years}
        loading={yearsLoading}
        canCreate={canCreate}
        canDelete={canDelete}
        onChanged={invalidate}
      />
      <FinanceTermsCard
        schoolId={schoolId}
        years={years}
        terms={terms}
        loading={termsLoading}
        canCreate={canCreate}
        canDelete={canDelete}
        onChanged={invalidate}
      />
    </div>
  );
}

function AcademicYearsCard({
  schoolId,
  years,
  loading,
  canCreate,
  canDelete,
  onChanged,
}: {
  schoolId: string;
  years: Awaited<ReturnType<typeof fetchAcademicYears>>;
  loading: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const create = useMutation({
    mutationFn: (makeCurrent: boolean) =>
      createAcademicYear({
        schoolId,
        name,
        startDate,
        endDate,
        makeCurrent,
      }),
    onSuccess: async () => {
      await onChanged();
      setOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      toast.success("Academic year created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setCurrent = useMutation({
    mutationFn: (yearId: string) => setCurrentAcademicYear(schoolId, yearId),
    onSuccess: async () => {
      await onChanged();
      toast.success("Current academic year updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteAcademicYear,
    onSuccess: async () => {
      await onChanged();
      toast.success("Academic year removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = !!name.trim() && !!startDate && !!endDate;

  return (
    <div className="fee-card p-6 animate-slide-up stagger-1">
      <div className="section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="section-icon">
            <CalendarRange size={15} color="hsl(var(--primary))" />
          </span>
          Academic years
        </span>
        {canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button" className="fee-btn-sm">
                <Plus size={13} />
                New year
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New academic year</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="ay-name">Year name</Label>
                  <Input
                    id="ay-name"
                    className="fee-input"
                    placeholder="e.g. 2025 / 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ay-start">Start date</Label>
                    <Input
                      id="ay-start"
                      type="date"
                      className="fee-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ay-end">End date</Label>
                    <Input
                      id="ay-end"
                      type="date"
                      className="fee-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="fee-btn-primary flex-1"
                    disabled={!valid || create.isPending}
                    onClick={() => create.mutate(false)}
                  >
                    {create.isPending ? "Creating…" : "Create year"}
                  </button>
                  <button
                    type="button"
                    className="fee-btn-primary flex-1"
                    disabled={!valid || create.isPending}
                    onClick={() => create.mutate(true)}
                  >
                    <Star className="mr-1 inline h-4 w-4" />
                    Set as current
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="fee-spinner" />
        </div>
      ) : years.length === 0 ? (
        <div className="fee-empty">
          No academic years yet.
          <br />
          <span style={{ fontSize: 12 }}>Create a year before adding terms for fees.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {years.map((y, i) => (
            <div key={y.id} className="fee-row" style={{ animationDelay: `${i * 0.05}s` }}>
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {y.name}
                  {y.is_current ? (
                    <Badge className="bg-primary text-primary-foreground">Current year</Badge>
                  ) : null}
                </div>
                <div className="fee-subtext">
                  {y.start_date ?? "—"} → {y.end_date ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!y.is_current && canCreate ? (
                  <button
                    type="button"
                    className="fee-btn-sm"
                    onClick={() => setCurrent.mutate(y.id)}
                    disabled={setCurrent.isPending}
                  >
                    Set current
                  </button>
                ) : null}
                {canDelete && !y.is_current ? (
                  <ConfirmActionButton
                    title="Delete academic year?"
                    description={`Remove ${y.name}? Terms linked to this year may be affected.`}
                    confirmLabel="Delete"
                    onConfirm={() => remove.mutate(y.id)}
                    trigger={
                      <button type="button" className="fee-btn-del">
                        <Trash2 size={14} />
                      </button>
                    }
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinanceTermsCard({
  schoolId,
  years,
  terms,
  loading,
  canCreate,
  canDelete,
  onChanged,
}: {
  schoolId: string;
  years: Awaited<ReturnType<typeof fetchAcademicYears>>;
  terms: Awaited<ReturnType<typeof fetchFinanceTerms>>;
  loading: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [yearId, setYearId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const selectedYear = years.find((y) => y.id === yearId);

  const create = useMutation({
    mutationFn: (makeCurrent: boolean) => {
      if (!selectedYear) throw new Error("Select an academic year");
      return createFinanceTerm({
        schoolId,
        academicYearId: yearId,
        academicYearName: selectedYear.name,
        name,
        startDate,
        endDate,
        feesDueDate: dueDate,
        makeCurrent,
      });
    },
    onSuccess: async () => {
      await onChanged();
      setOpen(false);
      setYearId("");
      setName("");
      setStartDate("");
      setEndDate("");
      setDueDate("");
      toast.success("Term created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setCurrent = useMutation({
    mutationFn: setCurrentFinanceTerm,
    onSuccess: async () => {
      await onChanged();
      toast.success("Current term updated — fees and invoices will use this term");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteFinanceTerm,
    onSuccess: async () => {
      await onChanged();
      toast.success("Term deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = !!yearId && !!name.trim() && !!startDate && !!endDate && !!dueDate;

  return (
    <div className="fee-card p-6 animate-slide-up stagger-2">
      <div className="section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="section-icon">
            <Layers size={15} color="hsl(var(--primary))" />
          </span>
          Terms (finances)
        </span>
        {canCreate ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button type="button" className="fee-btn-sm" disabled={years.length === 0}>
                <Plus size={13} />
                New term
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New term</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Academic year</Label>
                  <Select value={yearId} onValueChange={setYearId}>
                    <SelectTrigger className="fee-input">
                      <SelectValue placeholder="Select academic year…" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term-name">Term name</Label>
                  <Input
                    id="term-name"
                    className="fee-input"
                    placeholder="e.g. Term 1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="term-start">Start date</Label>
                    <Input
                      id="term-start"
                      type="date"
                      className="fee-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="term-end">End date</Label>
                    <Input
                      id="term-end"
                      type="date"
                      className="fee-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fees-due">Fees due date</Label>
                  <Input
                    id="fees-due"
                    type="date"
                    className="fee-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="fee-btn-primary flex-1"
                    disabled={!valid || create.isPending}
                    onClick={() => create.mutate(false)}
                  >
                    {create.isPending ? "Creating…" : "Create term"}
                  </button>
                  <button
                    type="button"
                    className="fee-btn-primary flex-1"
                    disabled={!valid || create.isPending}
                    onClick={() => create.mutate(true)}
                  >
                    <Star className="mr-1 inline h-4 w-4" />
                    Set as current
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {years.length === 0 ? (
        <div className="fee-empty">
          Create an academic year first.
          <br />
          <span style={{ fontSize: 12 }}>Then add Term 1, Term 2, etc. for billing.</span>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <div className="fee-spinner" />
        </div>
      ) : terms.length === 0 ? (
        <div className="fee-empty">
          No terms yet.
          <br />
          <span style={{ fontSize: 12 }}>Click &quot;New term&quot; to get started.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {terms.map((term, i) => (
            <div key={term.id} className="fee-row" style={{ animationDelay: `${i * 0.05}s` }}>
              <div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {term.name}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "hsl(var(--primary))",
                      background: "hsl(var(--primary) / 0.1)",
                      borderRadius: 5,
                      padding: "1px 7px",
                    }}
                  >
                    {term.academic_years?.name ?? term.session}
                  </span>
                  {term.is_current ? (
                    <Badge className="bg-primary text-primary-foreground">Current term</Badge>
                  ) : null}
                </div>
                <div className="fee-subtext">
                  {term.start_date} → {term.end_date}
                  {term.fees_due_date ? ` · Fees due ${term.fees_due_date}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!term.is_current && canCreate ? (
                  <button
                    type="button"
                    className="fee-btn-sm"
                    onClick={() => setCurrent.mutate(term.id)}
                    disabled={setCurrent.isPending}
                  >
                    Set current
                  </button>
                ) : null}
                {canDelete && !term.is_current ? (
                  <ConfirmActionButton
                    title="Delete term?"
                    description={`Remove ${term.name}?`}
                    confirmLabel="Delete"
                    onConfirm={() => remove.mutate(term.id)}
                    trigger={
                      <button type="button" className="fee-btn-del">
                        <Trash2 size={14} />
                      </button>
                    }
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}