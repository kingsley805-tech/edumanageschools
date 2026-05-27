import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/report/hooks/use-auth";
import {
  createSchoolTerm,
  deleteSchoolTerm,
  fetchSchoolTerms,
  formatTermLabel,
  setCurrentTerm,
  TERM_KIND_OPTIONS,
  updateSchoolTerm,
  type SchoolTerm,
  type TermKind,
} from "@/report/lib/terms";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Plus, Star, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TermsManager() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const schoolId = profile?.school_id ?? "";

  const [session, setSession] = useState(new Date().getFullYear().toString());
  const [name, setName] = useState("Term 1");
  const [termKind, setTermKind] = useState<TermKind>("term");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editTerm, setEditTerm] = useState<SchoolTerm | null>(null);

  const { data: terms, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["school-terms", schoolId],
    enabled: !!schoolId,
    queryFn: () => fetchSchoolTerms(schoolId),
  });

  const refreshTerms = async () => {
    await qc.invalidateQueries({ queryKey: ["school-terms", schoolId] });
    await qc.invalidateQueries({ queryKey: ["current-term", schoolId] });
    await refetch();
  };

  const createTerm = useMutation({
    mutationFn: async (makeCurrent: boolean) =>
      createSchoolTerm({
        schoolId,
        session,
        name,
        termKind,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        makeCurrent,
      }),
    onSuccess: async (created) => {
      qc.setQueryData<SchoolTerm[]>(["school-terms", schoolId], (old) => {
        const list = old ?? [];
        if (list.some((t) => t.id === created.id)) return list;
        return [created, ...list].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });
      await refreshTerms();
      toast.success("Term created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: (termId: string) => setCurrentTerm(termId),
    onSuccess: async () => {
      await refreshTerms();
      toast.success("Active term updated — new reports will use this term");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteSchoolTerm,
    onSuccess: async () => {
      await refreshTerms();
      toast.success("Term removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editTerm) return;
      await updateSchoolTerm(editTerm.id, {
        session: editTerm.session,
        name: editTerm.name,
        term_kind: editTerm.term_kind,
        start_date: editTerm.start_date,
        end_date: editTerm.end_date,
      });
    },
    onSuccess: async () => {
      setEditTerm(null);
      await refreshTerms();
      toast.success("Term updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Academic terms</CardTitle>
        <CardDescription>
          Create and select the active term. New student reports are automatically tagged with the selected term and academic year.
          Set each term&apos;s end date (school closes) and the next term&apos;s start date (reopening) so they appear on report cards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Academic year / session</Label>
            <Input placeholder="2024 / 2025" value={session} onChange={(e) => setSession(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Term name</Label>
            <Input placeholder="Term 1, Semester 1…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={termKind} onValueChange={(v) => setTermKind(v as TermKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERM_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Used as reopening date on reports for the previous term.</p>
          </div>
          <div className="space-y-2">
            <Label>End date (school closes)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Shown as School Closes on report cards for this term.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => createTerm.mutate(false)}
            disabled={!schoolId || !session || !name || createTerm.isPending}
          >
            <Plus className="mr-1 h-4 w-4" /> Add term
          </Button>
          <Button
            variant="default"
            onClick={() => createTerm.mutate(true)}
            disabled={!schoolId || !session || !name || createTerm.isPending}
          >
            <Star className="mr-1 h-4 w-4" /> Add & set as active
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">All terms</h4>
          {!schoolId ? (
            <p className="text-sm text-muted-foreground">Loading school profile…</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Could not load terms: {(error as Error).message}
              <Button variant="link" className="h-auto p-0 ml-2" onClick={() => refetch()}>
                Retry
              </Button>
            </p>
          ) : !terms?.length ? (
            <p className="text-sm text-muted-foreground">
              No terms yet. Create Term 1, Term 2, Term 3, or a full academic year.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {terms.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{formatTermLabel(t)}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {(t.term_kind ?? "term").replace(/_/g, " ")}
                      {t.start_date ? ` · ${t.start_date}` : ""}
                      {t.end_date ? ` → ${t.end_date}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {t.is_current && (
                      <Badge className="bg-primary text-primary-foreground">Active</Badge>
                    )}
                    {!t.is_current && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activate.mutate(t.id)}
                        disabled={activate.isPending}
                      >
                        Set active
                      </Button>
                    )}
                    <Dialog open={editTerm?.id === t.id} onOpenChange={(o) => !o && setEditTerm(null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => setEditTerm({ ...t })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit term</DialogTitle>
                        </DialogHeader>
                        {editTerm && (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label>Session</Label>
                              <Input
                                value={editTerm.session}
                                onChange={(e) => setEditTerm({ ...editTerm, session: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input
                                value={editTerm.name}
                                onChange={(e) => setEditTerm({ ...editTerm, name: e.target.value })}
                              />
                            </div>
                            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                              Save
                            </Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => remove.mutate(t.id)}
                      disabled={remove.isPending || !!t.is_current}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
