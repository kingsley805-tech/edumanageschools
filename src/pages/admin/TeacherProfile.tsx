import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EntityProfilePageLayout } from "@/components/entities/EntityProfilePageLayout";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Calendar, Mail, Phone, UserRound, GraduationCap, ShieldAlert } from "lucide-react";
import { fetchTeacherEntityStats, type TeacherEntityStats } from "@/lib/entityProfileStats";

const editTeacherSchema = z.object({
  employee_no: z.string().min(1, "Employee number is required"),
  full_name: z.string().min(1, "Full name is required"),
});

type EditTeacherFormData = z.infer<typeof editTeacherSchema>;

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [teacher, setTeacher] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [entityStats, setEntityStats] = useState<TeacherEntityStats | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EditTeacherFormData>({
    resolver: zodResolver(editTeacherSchema),
  });

  useEffect(() => {
    if (id) {
      fetchTeacher(id);
    }
  }, [id]);

  useEffect(() => {
    if (!teacher?.id) {
      setEntityStats(null);
      return;
    }
    const classes: string[] = [];
    const subjects: string[] = [];
    for (const cs of teacher.class_subjects || []) {
      if (cs.classes?.id && !classes.includes(cs.classes.id)) classes.push(cs.classes.id);
      if (cs.subjects?.name && !subjects.includes(cs.subjects.name)) subjects.push(cs.subjects.name);
    }
    for (const tc of teacher.teacher_classes || []) {
      if (tc.classes?.id && !classes.includes(tc.classes.id)) classes.push(tc.classes.id);
    }
    let cancelled = false;
    void (async () => {
      try {
        const stats = await fetchTeacherEntityStats(teacher.id, classes.length, subjects.length);
        if (!cancelled) setEntityStats(stats);
      } catch {
        if (!cancelled) setEntityStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  const fetchTeacher = async (teacherId: string) => {
    try {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId);

      // Strategy 1: Joined query
      let query = supabase.from("teachers").select(`
        *,
        profiles(id, full_name, email, phone, is_active, role),
        class_subjects(
          subjects(name, code),
          classes(id, name, level)
        )
      `);

      if (isUuid) {
        query = query.or(`id.eq.${teacherId},user_id.eq.${teacherId}`);
      } else {
        query = query.eq("employee_no", teacherId);
      }

      const { data, error } = await query.maybeSingle();

      let teacherRecord: any = data;

      // Strategy 2: Bare query fallback
      if (error || !teacherRecord) {
        let bareQuery = supabase.from("teachers").select("*");
        if (isUuid) {
          bareQuery = bareQuery.or(`id.eq.${teacherId},user_id.eq.${teacherId}`);
        } else {
          bareQuery = bareQuery.eq("employee_no", teacherId);
        }
        const { data: bareData, error: bareError } = await bareQuery.maybeSingle();

        if (bareData) {
          teacherRecord = { ...bareData };
          if (bareData.user_id) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("id, full_name, email, phone, is_active, role")
              .eq("id", bareData.user_id)
              .maybeSingle();
            if (prof) teacherRecord.profiles = prof;
          }
        } else if (bareError && !error) {
          throw bareError;
        }
      }

      if (!teacherRecord && isUuid) {
        // Check if this ID belongs to a user profile (e.g. admin or staff)
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", teacherId)
          .maybeSingle();

        if (userProfile && userProfile.role !== "teacher") {
          navigate(`/admin/admins/${teacherId}`, { replace: true });
          return;
        }
      }

      setTeacher(teacherRecord || null);

      if (teacherRecord) {
        setValue("employee_no", teacherRecord.employee_no || "");
        setValue("full_name", teacherRecord.profiles?.full_name || "");
      }
    } catch (err: any) {
      console.error("fetchTeacher error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load teacher",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onEditSubmit = async (formData: EditTeacherFormData) => {
    if (!teacher) return;
    try {
      const { error: teacherError } = await supabase
        .from("teachers")
        .update({
          employee_no: formData.employee_no,
        })
        .eq("id", teacher.id);

      if (teacherError) throw teacherError;

      if (teacher.user_id) {
        await supabase
          .from("profiles")
          .update({ full_name: formData.full_name })
          .eq("id", teacher.user_id);
      }

      toast({
        title: "Success",
        description: "Teacher profile updated",
      });

      setEditOpen(false);
      fetchTeacher(teacher.id);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update teacher",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!teacher) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from("teachers")
        .delete()
        .eq("id", teacher.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });

      navigate("/admin/teachers");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete teacher",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <i className="ki-filled ki-arrows-circle animate-spin text-3xl text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading teacher details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Teacher Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The requested teacher record could not be found or may have been removed.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/admin/teachers" className="kt-btn kt-btn-primary kt-btn-sm">
              Return to Teachers List
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const employeeNo = teacher.employee_no || "Not assigned";
  const fullName = teacher.profiles?.full_name || "Teacher";
  const isActive = teacher.profiles?.is_active !== false;

  const assignedClasses: any[] = [];
  const assignedSubjects: any[] = [];

  (teacher.class_subjects || []).forEach((cs: any) => {
    if (cs.classes && !assignedClasses.some((c: any) => c.id === cs.classes.id)) {
      assignedClasses.push(cs.classes);
    }
    if (cs.subjects && !assignedSubjects.some((s: any) => s.name === cs.subjects.name)) {
      assignedSubjects.push(cs.subjects);
    }
  });

  if (teacher.teacher_classes) {
    teacher.teacher_classes.forEach((tc: any) => {
      if (tc.classes && !assignedClasses.some((c: any) => c.id === tc.classes.id)) {
        assignedClasses.push(tc.classes);
      }
    });
  }

  return (
    <>
      <EntityProfilePageLayout
        role="admin"
        backLink={{ to: "/admin/teachers", label: "Back to Teachers" }}
        entityType="Teacher"
        entityCode={employeeNo !== "Not assigned" ? `#${employeeNo}` : undefined}
        name={fullName}
        statusText={isActive ? "Active" : "Inactive"}
        statusVariant={isActive ? "success" : "secondary"}
        metaItems={[
          {
            icon: "ki-barcode",
            text: `#${employeeNo}`,
          },
          {
            icon: "ki-book-open",
            text:
              assignedSubjects.map((s: any) => s.name).join(", ") ||
              "No subjects assigned",
          },
          {
            icon: "ki-sms",
            text: teacher.profiles?.email || "No email",
          },
          {
            icon: "ki-calendar-8",
            text:
              assignedClasses.map((c: any) => c.name).join(", ") ||
              "No classes assigned",
          },
        ]}
        rightMetric={{
          label: "Account Status",
          value: isActive ? "Active" : "Inactive",
        }}
        generalInfo={[
          {
            label: "Employee No",
            value: employeeNo,
          },
          {
            label: "Full Name",
            value: fullName,
          },
          {
            label: "Email",
            value: teacher.profiles?.email || "—",
          },
          {
            label: "Role",
            value: "Academic Staff / Teacher",
          },
          {
            label: "Classes Count",
            value: `${assignedClasses.length} Classes`,
          },
          {
            label: "Subjects Count",
            value: `${assignedSubjects.length} Subjects`,
          },
        ]}
        stats={[
          {
            label: "Classes",
            value: assignedClasses.length,
          },
          {
            label: "Subjects",
            value: assignedSubjects.length,
          },
          {
            label: "Status",
            value: isActive ? "Active" : "Inactive",
          },
          {
            label: "Registers (month)",
            value: entityStats?.registersLabel ?? "…",
          },
        ]}
        onRefreshStats={() => fetchTeacher(teacher.id)}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        customTabs={[
          {
            id: "classes",
            label: "Classes & Subjects",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="kt-card p-5 border border-border rounded-xl bg-card">
                  <h3 className="text-sm font-semibold text-foreground pb-3 border-b border-border flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Assigned Classes
                  </h3>
                  {assignedClasses.length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">
                      No classes assigned. Assign classes from{" "}
                      <Link
                        to="/admin/teacher-class-link"
                        className="text-primary font-medium hover:underline"
                      >
                        Teacher–Class Link
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                      {assignedClasses.map((cls: any) => (
                        <div
                          key={cls.id}
                          className="py-2.5 flex justify-between items-center"
                        >
                          <Link
                            to={`/admin/classes/${cls.id}`}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {cls.name} {cls.level ? `(${cls.level})` : ""}
                          </Link>
                          <Link
                            to={`/admin/classes/${cls.id}`}
                            className="text-xs text-primary hover:underline"
                          >
                            View Class
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="kt-card p-5 border border-border rounded-xl bg-card">
                  <h3 className="text-sm font-semibold text-foreground pb-3 border-b border-border flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Assigned Subjects
                  </h3>
                  {assignedSubjects.length === 0 ? (
                    <p className="py-4 text-xs text-muted-foreground">
                      No subjects assigned.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                      {assignedSubjects.map((sub: any) => (
                        <div
                          key={sub.id}
                          className="py-2.5 flex justify-between items-center"
                        >
                          <span className="font-medium text-foreground">
                            {sub.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {sub.code || "SUB"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Edit Teacher Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>Update teacher profile</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee_no">Employee Number</Label>
              <Input id="employee_no" {...register("employee_no")} />
              {errors.employee_no && (
                <p className="text-xs text-destructive">{errors.employee_no.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Teacher Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {fullName}? This will remove their
              assigned classes and subjects. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete Teacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
