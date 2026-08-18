import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EntityProfilePageLayout } from "@/components/entities/EntityProfilePageLayout";
import DashboardLayout from "@/components/DashboardLayout";
import { StudentTransportSection } from "@/modules/transport/components/StudentTransportSection";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserRound, Mail, Phone, Bus, BookOpen, Calendar, DollarSign, Award } from "lucide-react";

const editStudentSchema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  class_id: z.string().optional(),
});

type EditStudentFormData = z.infer<typeof editStudentSchema>;

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [student, setStudent] = useState<any | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<EditStudentFormData>({
    resolver: zodResolver(editStudentSchema),
  });

  useEffect(() => {
    if (id) {
      fetchStudent(id);
      fetchClasses();
    }
  }, [id]);

  const fetchStudent = async (studentId: string) => {
    try {
      setLoading(true);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);

      // Strategy 1: Full joined query with explicit foreign keys
      let query = supabase.from("students").select(`
        *,
        classes(id, name, level),
        profiles:profiles!students_user_id_fkey(full_name, email),
        guardian:parents!students_guardian_id_fkey(
          id,
          phone,
          address,
          emergency_contact,
          profiles:profiles!parents_user_id_fkey(full_name, email, phone)
        ),
        parent_student_links(
          relationship,
          parent:parents!parent_student_links_parent_id_fkey(
            id,
            phone,
            address,
            emergency_contact,
            profiles:profiles!parents_user_id_fkey(full_name, email, phone)
          )
        )
      `);

      if (isUuid) {
        query = query.or(`id.eq.${studentId},user_id.eq.${studentId}`);
      } else {
        query = query.or(`admission_no.eq.${studentId},admission_number.eq.${studentId}`);
      }

      const { data, error } = await query.maybeSingle();

      let studentRecord: any = data;

      // Strategy 2: If joined query fails or returns nothing, fetch bare student record (no joins)
      if (error || !studentRecord) {
        let bareQuery = supabase.from("students").select("*");
        if (isUuid) {
          bareQuery = bareQuery.or(`id.eq.${studentId},user_id.eq.${studentId}`);
        } else {
          bareQuery = bareQuery.or(`admission_no.eq.${studentId},admission_number.eq.${studentId}`);
        }
        const { data: bareData, error: bareError } = await bareQuery.maybeSingle();
        
        if (bareData) {
          studentRecord = { ...bareData };
          // Look up user profile
          if (bareData.user_id) {
            const { data: prof } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", bareData.user_id)
              .maybeSingle();
            if (prof) studentRecord.profiles = prof;
          }
          // Look up class
          if (bareData.class_id) {
            const { data: cls } = await supabase
              .from("classes")
              .select("id, name, level")
              .eq("id", bareData.class_id)
              .maybeSingle();
            if (cls) studentRecord.classes = cls;
          }
          // Look up guardian
          if (bareData.guardian_id) {
            const { data: guard } = await supabase
              .from("parents")
              .select("id, phone, address, emergency_contact, user_id")
              .eq("id", bareData.guardian_id)
              .maybeSingle();
            if (guard) {
              if (guard.user_id) {
                const { data: guardProf } = await supabase
                  .from("profiles")
                  .select("full_name, email, phone")
                  .eq("id", guard.user_id)
                  .maybeSingle();
                guard.profiles = guardProf;
              }
              studentRecord.guardian = guard;
            }
          }
        } else if (bareError && !error) {
          throw bareError;
        }
      }

      setStudent(studentRecord || null);

      if (studentRecord) {
        setValue("admission_no", studentRecord.admission_number || studentRecord.admission_no || "");
        setValue("full_name", studentRecord.profiles?.full_name || studentRecord.full_name || "");
        setValue("date_of_birth", studentRecord.date_of_birth || "");
        setValue("gender", studentRecord.gender || "male");
        setValue("class_id", studentRecord.class_id || "");
      }
    } catch (err: any) {
      console.error("fetchStudent error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load student",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase
      .from("classes")
      .select("id, name, level")
      .order("name");
    if (data) setClasses(data);
  };

  const onEditSubmit = async (formData: EditStudentFormData) => {
    if (!student) return;
    try {
      const { error: studentError } = await supabase
        .from("students")
        .update({
          admission_number: formData.admission_no,
          admission_no: formData.admission_no,
          full_name: formData.full_name,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender,
          class_id: formData.class_id || null,
        })
        .eq("id", student.id);

      if (studentError) throw studentError;

      if (student.user_id) {
        await supabase
          .from("profiles")
          .update({ full_name: formData.full_name })
          .eq("id", student.user_id);
      }

      toast({
        title: "Success",
        description: "Student updated successfully",
      });

      setEditOpen(false);
      fetchStudent(student.id);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update student",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!student) return;
    try {
      setDeleting(true);
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", student.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student deleted successfully",
      });

      navigate("/admin/students");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete student",
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
          <p className="text-sm font-medium text-muted-foreground">Loading student details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <UserRound className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Student Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The requested student record could not be found or may have been removed.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/admin/students" className="kt-btn kt-btn-primary kt-btn-sm">
              Return to Students List
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const admissionNo =
    student.admission_number || student.admission_no || "Not assigned";
  const fullName = student.profiles?.full_name || student.full_name || "Student";
  const className = student.classes
    ? `${student.classes.name}${student.classes.level ? ` (${student.classes.level})` : ""}`
    : "Not assigned";

  const linkedParents: any[] = [];
  if (student.guardian) linkedParents.push(student.guardian);
  if (student.parent_student_links) {
    student.parent_student_links.forEach((l: any) => {
      if (l.parent && !linkedParents.some((p) => p.id === l.parent.id)) {
        linkedParents.push({ ...l.parent, relationship: l.relationship });
      }
    });
  }

  const primaryParent = linkedParents[0];
  const parentName = primaryParent?.profiles?.full_name || primaryParent?.full_name || "—";
  const parentPhone = primaryParent?.phone || primaryParent?.emergency_contact || "—";
  const parentEmail = primaryParent?.profiles?.email || "—";

  return (
    <>
      <EntityProfilePageLayout
        role="admin"
        backLink={{ to: "/admin/students", label: "Back to Students" }}
        entityType="Student"
        entityCode={admissionNo !== "Not assigned" ? `#${admissionNo}` : undefined}
        name={fullName}
        statusText="Active"
        statusVariant="success"
        metaItems={[
          {
            icon: "ki-barcode",
            text: `#${admissionNo}`,
          },
          {
            icon: "ki-book-open",
            text: className,
          },
          {
            icon: "ki-sms",
            text: student.profiles?.email || parentEmail || "No email",
          },
          {
            icon: "ki-phone",
            text: parentPhone !== "—" ? parentPhone : "No phone",
          },
        ]}
        rightMetric={{
          label: "Enrollment Status",
          value: "Active",
        }}
        generalInfo={[
          {
            label: "Admission No",
            value: admissionNo,
          },
          {
            label: "Name",
            value: fullName,
          },
          {
            label: "Class",
            value: className,
          },
          {
            label: "Gender",
            value: (
              <span className="capitalize">{student.gender || "Not specified"}</span>
            ),
          },
          {
            label: "Date of Birth",
            value: student.date_of_birth
              ? new Date(student.date_of_birth).toLocaleDateString()
              : "Not provided",
          },
          {
            label: "Guardian / Parent",
            value: parentName !== "—" ? parentName : "None linked",
          },
          {
            label: "Guardian Phone",
            value: parentPhone,
          },
          {
            label: "Guardian Email",
            value: parentEmail,
          },
        ]}
        stats={[
          { label: "Attendance", value: "98%" },
          { label: "Term Fees", value: "GH₵1,200" },
          { label: "Fees Paid", value: "GH₵1,200" },
          { label: "Balance", value: "GH₵0.00" },
        ]}
        onRefreshStats={() => fetchStudent(student.id)}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteConfirmOpen(true)}
        customTabs={[
          {
            id: "information",
            label: "Information",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="kt-card p-5 border border-border rounded-xl bg-card">
                  <h3 className="text-sm font-semibold text-foreground pb-3 border-b border-border flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    Student Profile Details
                  </h3>
                  <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Admission Number:</span>
                      <span className="font-medium">{admissionNo}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Full Name:</span>
                      <span className="font-medium">{fullName}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="font-medium capitalize">{student.gender || "—"}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Date of Birth:</span>
                      <span className="font-medium">
                        {student.date_of_birth
                          ? new Date(student.date_of_birth).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Class Assigned:</span>
                      <span className="font-medium">{className}</span>
                    </div>
                  </div>
                </div>

                <div className="kt-card p-5 border border-border rounded-xl bg-card">
                  <h3 className="text-sm font-semibold text-foreground pb-3 border-b border-border flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Academic Standing
                  </h3>
                  <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Academic Status:</span>
                      <span className="font-medium text-emerald-600">Good Standing</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Current Term:</span>
                      <span className="font-medium">Term 1 (2025/2026)</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-muted-foreground">Term Reports:</span>
                      <Link
                        to="/admin/report-cards"
                        className="text-primary font-medium hover:underline"
                      >
                        View Report Cards
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "guardians",
            label: "Guardian & Transport",
            content: (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    Linked Parent & Contact Information
                  </h3>
                  {linkedParents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                      <p>No parent linked to this student.</p>
                      <p className="mt-1">
                        Link a parent from{" "}
                        <Link
                          to="/admin/parent-student-link"
                          className="text-primary font-medium hover:underline"
                        >
                          Parent–Student Link
                        </Link>{" "}
                        or edit student records.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {linkedParents.map((parent) => (
                        <div
                          key={parent.id}
                          className="rounded-xl border border-border bg-card p-4 space-y-2 text-xs sm:text-sm"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="font-semibold text-foreground">
                              {parent.profiles?.full_name || parent.full_name || "Parent"}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                              {parent.relationship || "Guardian"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            <span>{parent.phone || parent.emergency_contact || "No phone"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 text-primary" />
                            <span className="break-all">{parent.profiles?.email || "No email"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                    <Bus className="h-4 w-4 text-primary" />
                    School Transport
                  </h3>
                  <StudentTransportSection studentId={student.id} />
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Edit Student Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student profile information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="admission_no">Admission Number</Label>
                <Input id="admission_no" {...register("admission_no")} />
                {errors.admission_no && (
                  <p className="text-xs text-destructive">{errors.admission_no.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  defaultValue={student.gender}
                  onValueChange={(val) => setValue("gender", val as any)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="class_id">Class</Label>
                <Select
                  defaultValue={student.class_id}
                  onValueChange={(val) => setValue("class_id", val)}
                >
                  <SelectTrigger id="class_id">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.level && `(${cls.level})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <AlertDialogTitle>Delete Student Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {fullName}? This will remove their
              enrollments and linked records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
