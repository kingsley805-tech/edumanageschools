import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { fetchStudentsWithLinkedProfiles, formatStudentDisplayName } from "@/billing/lib/studentDisplayName";

export type ReassignInvoiceTarget = {
  id: string;
  invoice_number: string;
  student_id: string | null;
  term_id: string | null;
  due_date: string;
  currency: string;
};

interface ClassOption {
  id: string;
  name: string;
  stream: string | null;
}

interface TermOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  class_id: string | null;
  linkedProfile: { first_name: string; last_name: string } | null;
}

function formatClassLabel(c: ClassOption) {
  return c.stream ? `${c.name} · ${c.stream}` : c.name;
}

export function ReassignInvoiceDialog({
  schoolId,
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: {
  schoolId: string;
  invoice: ReassignInvoiceTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("none");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open || !schoolId || !invoice) return;

    setStudentId(invoice.student_id ?? "");
    setTermId(invoice.term_id ?? "none");
    setDueDate(invoice.due_date);
    setClassFilter("all");

    let cancelled = false;
    setLoadingData(true);

    void (async () => {
      const [classesRes, termsRes, studentRows] = await Promise.all([
        supabase.from("classes").select("id, name, stream").eq("school_id", schoolId).order("level"),
        supabase.from("terms").select("id, name").eq("school_id", schoolId).order("start_date", { ascending: false }),
        fetchStudentsWithLinkedProfiles(schoolId),
      ]);

      if (cancelled) return;

      if (classesRes.error) {
        toast.error(classesRes.error.message);
      } else {
        setClasses((classesRes.data ?? []) as ClassOption[]);
      }

      if (termsRes.error) {
        toast.error(termsRes.error.message);
      } else {
        setTerms((termsRes.data ?? []) as TermOption[]);
      }

      const activeStudents = studentRows
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          id: s.id as string,
          first_name: s.first_name as string,
          last_name: s.last_name as string,
          student_id: s.student_id as string,
          class_id: (s.class_id as string | null) ?? null,
          linkedProfile: s.linkedProfile ?? null,
        }));
      setStudents(activeStudents);

      if (invoice.student_id) {
        const current = activeStudents.find((s) => s.id === invoice.student_id);
        if (current?.class_id) setClassFilter(current.class_id);
      }

      setLoadingData(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, schoolId, invoice]);

  const filteredStudents = useMemo(() => {
    if (classFilter === "all") return students;
    return students.filter((s) => s.class_id === classFilter);
  }, [students, classFilter]);

  const handleSubmit = async (send: boolean) => {
    if (!invoice || !studentId) {
      toast.error("Select a student to assign this invoice to.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("reassign_billing_invoice" as never, {
        p_invoice_id: invoice.id,
        p_student_id: studentId,
        p_term_id: termId === "none" ? null : termId,
        p_due_date: dueDate || null,
        p_send: send,
      } as never);

      if (error) throw error;

      const row = data as { invoice_number?: string } | null;
      toast.success(
        send
          ? `Invoice ${row?.invoice_number ?? invoice.invoice_number} sent to the selected student`
          : `Invoice ${row?.invoice_number ?? invoice.invoice_number} reassigned as draft`,
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not reassign invoice");
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign invoice</DialogTitle>
          <DialogDescription>
            Move <span className="font-mono font-medium">{invoice.invoice_number}</span> to another class or
            student, then save as draft or send immediately. Only unpaid invoices can be reassigned.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={classFilter}
                onValueChange={(value) => {
                  setClassFilter(value);
                  if (value !== "all" && studentId) {
                    const stillVisible = students.some(
                      (s) => s.id === studentId && s.class_id === value,
                    );
                    if (!stillVisible) setStudentId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {formatClassLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.length === 0 ? null : (
                    filteredStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {formatStudentDisplayName(
                          {
                            first_name: student.first_name,
                            last_name: student.last_name,
                            student_id: student.student_id,
                          },
                          student.linkedProfile,
                        )}{" "}
                        ({student.student_id})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {filteredStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No students in this class.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Term (optional)</Label>
                <Select value={termId} onValueChange={setTermId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No term</SelectItem>
                    {terms.map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/80 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => void handleSubmit(false)} disabled={loading || !studentId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save as draft
              </Button>
              <Button onClick={() => void handleSubmit(true)} disabled={loading || !studentId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to student
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
