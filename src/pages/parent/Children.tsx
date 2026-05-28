import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserCircle, BookOpen, Calendar, Award, Hash, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { normalizeAdmissionNumber } from "@/lib/admission-numbers";
import {
  linkParentToStudents,
  resolveStudentByAdmissionNumber,
  type StudentAdmissionPreview,
} from "@/lib/auth-api";
import { fetchParentRecordByUserId, fetchStudentsForParent } from "@/lib/parent-students";

interface Child {
  id: string;
  user_id: string;
  admission_no: string | null;
  admission_number?: string | null;
  class_id: string | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  classes: {
    name: string;
  } | null;
  attendance?: number;
  avgGrade?: string;
  totalClasses?: number;
}

const Children = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentId, setParentId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const [linkOpen, setLinkOpen] = useState(false);
  const [admissionInput, setAdmissionInput] = useState("");
  const [preview, setPreview] = useState<StudentAdmissionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const parent = await fetchParentRecordByUserId(user.id);
      if (!parent) {
        setChildren([]);
        setParentId(null);
        setSchoolId(null);
        return;
      }

      setParentId(parent.id);
      setSchoolId(parent.school_id);

      const rows = await fetchStudentsForParent<Child>(
        parent.id,
        `
          id,
          user_id,
          admission_no,
          admission_number,
          class_id,
          profiles:user_id (full_name, email),
          classes (name)
        `
      );

      const childrenWithStats = await Promise.all(
        rows.map(async (child) => {
          const [attendanceRes, gradesRes, classesRes] = await Promise.all([
            supabase.from("attendance").select("status", { count: "exact" }).eq("student_id", child.id),
            supabase.from("grades").select("score").eq("student_id", child.id),
            supabase
              .from("schedules")
              .select("id", { count: "exact", head: true })
              .eq("class_id", child.class_id ?? ""),
          ]);

          const presentCount = await supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("student_id", child.id)
            .eq("status", "present");

          const totalAttendance = attendanceRes.count || 1;
          const attendance = Math.round(((presentCount.count || 0) / totalAttendance) * 100);

          const avgScore =
            gradesRes.data && gradesRes.data.length > 0
              ? gradesRes.data.reduce((sum, g) => sum + (Number(g.score) || 0), 0) / gradesRes.data.length
              : 0;

          const avgGrade =
            avgScore >= 90
              ? "A"
              : avgScore >= 80
                ? "B"
                : avgScore >= 70
                  ? "C"
                  : avgScore >= 60
                    ? "D"
                    : avgScore > 0
                      ? "F"
                      : "--";

          return {
            ...child,
            attendance,
            avgGrade,
            totalClasses: classesRes.count || 0,
          };
        })
      );

      setChildren(childrenWithStats);
    } catch (err) {
      console.error(err);
      toast.error("Could not load your children");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    const num = normalizeAdmissionNumber(admissionInput);
    if (!num || num.length < 5) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      const result = await resolveStudentByAdmissionNumber(num);
      setPreview(result);
      setPreviewLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [admissionInput]);

  const handleLinkChild = async () => {
    if (!parentId || !schoolId) {
      toast.error("Parent profile not found");
      return;
    }

    const num = normalizeAdmissionNumber(admissionInput);
    if (!num) {
      toast.error("Enter your child's admission number");
      return;
    }

    if (children.some((c) => (c.admission_no ?? c.admission_number ?? "").toUpperCase() === num)) {
      toast.error("This child is already on your account");
      return;
    }

    setLinking(true);
    const result = await linkParentToStudents(parentId, schoolId, [num]);
    setLinking(false);

    if (!result.ok) {
      toast.error(result.error ?? "Could not link child");
      return;
    }

    toast.success("Child linked successfully");
    setAdmissionInput("");
    setPreview(null);
    setLinkOpen(false);
    await loadChildren();
  };

  const displayAdmission = (child: Child) =>
    child.admission_no ?? child.admission_number ?? "—";

  if (loading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">My Children</h2>
            <p className="text-muted-foreground">View profiles and link additional children</p>
          </div>

          <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Link another child
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Link a child</DialogTitle>
                <DialogDescription>
                  Enter your child&apos;s admission number. We&apos;ll verify their school and class
                  before linking them to your account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="link-admission">Student admission number</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="link-admission"
                      className="pl-9 uppercase font-mono"
                      placeholder="MINGO-Stu-2026-001"
                      value={admissionInput}
                      onChange={(e) => setAdmissionInput(normalizeAdmissionNumber(e.target.value))}
                    />
                  </div>
                </div>

                {previewLoading && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying…
                  </p>
                )}

                {preview?.valid && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-1">
                    <p className="font-semibold">{preview.student_name}</p>
                    <p className="text-muted-foreground">{preview.school_name}</p>
                    <p className="text-muted-foreground">Class: {preview.class_name}</p>
                    <p className="font-mono text-xs">{preview.admission_number}</p>
                  </div>
                )}

                {preview && !preview.valid && !previewLoading && (
                  <p className="text-sm text-destructive">{preview.error}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setLinkOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleLinkChild}
                  disabled={linking || previewLoading || !preview?.valid}
                >
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Linking…
                    </>
                  ) : (
                    "Link child"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No children linked yet</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Use your child&apos;s admission number to connect their records to your parent
                account.
              </p>
              <Button onClick={() => setLinkOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Link your first child
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserCircle className="h-10 w-10 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>{child.profiles?.full_name || "Student"}</CardTitle>
                      <CardDescription>
                        {child.classes?.name || "No class assigned"}
                      </CardDescription>
                      <Badge variant="outline" className="mt-2 font-mono">
                        {displayAdmission(child)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 text-center p-3 rounded-lg bg-primary/5">
                      <Calendar className="h-5 w-5 text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground">Attendance</p>
                      <p className="text-xl font-bold">{child.attendance ?? 0}%</p>
                    </div>
                    <div className="space-y-2 text-center p-3 rounded-lg bg-accent/5">
                      <Award className="h-5 w-5 text-accent mx-auto" />
                      <p className="text-sm text-muted-foreground">Avg Grade</p>
                      <p className="text-xl font-bold">{child.avgGrade ?? "--"}</p>
                    </div>
                    <div className="space-y-2 text-center p-3 rounded-lg bg-success/5">
                      <BookOpen className="h-5 w-5 text-success mx-auto" />
                      <p className="text-sm text-muted-foreground">Classes</p>
                      <p className="text-xl font-bold">{child.totalClasses ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Children;
