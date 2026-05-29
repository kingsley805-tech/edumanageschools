// @ts-nocheck
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Pencil, Trash2, RefreshCw, Hash, Phone, Mail, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { generateRegistrationNumber } from "@/lib/registration-numbers";
import { formatExample, fetchSchoolPrefixById } from "@/lib/admission-numbers";
import { buildStudentAuthEmail } from "@/lib/auth-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const studentSchema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  guardian_email: z.string().email("Invalid guardian email").optional().or(z.literal("")),
});

const editStudentSchema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  full_name: z.string().min(1, "Full name is required"),
  date_of_birth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  class_id: z.string().optional(),
});

type StudentFormData = z.infer<typeof studentSchema>;
type EditStudentFormData = z.infer<typeof editStudentSchema>;

type ParentProfile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type ParentRecord = {
  id: string;
  phone?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  profiles?: ParentProfile | null;
  relationship?: string | null;
};

type StudentRecord = {
  id: string;
  admission_no?: string | null;
  admission_number?: string | null;
  full_name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  class_id?: string | null;
  user_id?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  classes?: { name?: string | null; level?: string | null } | null;
  guardian?: ParentRecord | null;
  parent_student_links?: Array<{
    relationship?: string | null;
    parent?: ParentRecord | null;
  }> | null;
};

const STUDENT_LIST_SELECT = `
  *,
  classes(name, level),
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
`;

function getStudentName(student: StudentRecord): string {
  return student.profiles?.full_name?.trim() || student.full_name?.trim() || "Unknown";
}

function getStudentAdmissionNo(student: StudentRecord): string {
  return (
    student.admission_no?.trim() ||
    student.admission_number?.trim() ||
    "—"
  );
}

function getStudentClassLabel(student: StudentRecord): string {
  const name = student.classes?.name?.trim();
  const level = student.classes?.level?.trim();
  if (!name) return "Not assigned";
  return level ? `${name} (${level})` : name;
}

function getParentName(parent: ParentRecord): string {
  return parent.profiles?.full_name?.trim() || "Unknown";
}

function getParentPhone(parent: ParentRecord): string {
  return parent.phone?.trim() || parent.profiles?.phone?.trim() || "—";
}

function getLinkedParents(student: StudentRecord): ParentRecord[] {
  const byId = new Map<string, ParentRecord>();

  if (student.guardian?.id) {
    byId.set(student.guardian.id, {
      ...student.guardian,
      relationship: "Guardian",
    });
  }

  for (const link of student.parent_student_links ?? []) {
    const parent = link.parent;
    if (!parent?.id || byId.has(parent.id)) continue;
    byId.set(parent.id, {
      ...parent,
      relationship: link.relationship?.trim() || "Parent",
    });
  }

  return Array.from(byId.values());
}

const Students = () => {
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unusedAdmissionNumbers, setUnusedAdmissionNumbers] = useState<string[]>([]);
  const [loadingAdmissionNo, setLoadingAdmissionNo] = useState(false);
  const [generatingAdmissionNo, setGeneratingAdmissionNo] = useState(false);
  const [assignClassId, setAssignClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [admissionPlaceholder, setAdmissionPlaceholder] = useState("MINGO-Stu-2026-001");
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
  });

  const admissionNoValue = watch("admission_no");

  const { 
    register: registerEdit, 
    handleSubmit: handleEditSubmit, 
    formState: { errors: editErrors }, 
    reset: resetEdit, 
    setValue: setEditValue 
  } = useForm<EditStudentFormData>({
    resolver: zodResolver(editStudentSchema),
  });

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;
    setSchoolId(profileData.school_id);

    try {
      const prefix = await fetchSchoolPrefixById(profileData.school_id);
      setAdmissionPlaceholder(formatExample(prefix, "Stu"));
    } catch {
      /* keep default */
    }

    const { data } = await supabase
      .from("classes")
      .select("id, name, level")
      .eq("school_id", profileData.school_id)
      .order("name");
    
    if (data) setClasses(data);
  };

  const resolveSchoolId = async (): Promise<string | null> => {
    if (schoolId) return schoolId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    const sid = profileData?.school_id ?? null;
    if (sid) setSchoolId(sid);
    return sid;
  };

  const loadUnusedAdmissionNumbers = async (selectNumber?: string) => {
    const sid = await resolveSchoolId();
    if (!sid) return;

    setLoadingAdmissionNo(true);
    try {
      const { data, error } = await supabase
        .from("registration_numbers")
        .select("registration_number")
        .eq("school_id", sid)
        .eq("number_type", "student")
        .eq("status", "unused")
        .order("registration_number", { ascending: true })
        .limit(100);

      if (error) throw error;

      const numbers = (data ?? []).map((r) => r.registration_number);
      setUnusedAdmissionNumbers(numbers);
      if (selectNumber && numbers.includes(selectNumber)) {
        setValue("admission_no", selectNumber, { shouldValidate: true });
      } else if (numbers.length > 0) {
        setValue("admission_no", numbers[0], { shouldValidate: true });
      } else {
        setValue("admission_no", "");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load admission numbers";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoadingAdmissionNo(false);
    }
  };

  const handleGenerateAdmissionNumber = async () => {
    setGeneratingAdmissionNo(true);
    try {
      const sid = await resolveSchoolId();
      if (!sid) throw new Error("School not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const registrationNumber = await generateRegistrationNumber({
        schoolId: sid,
        userId: user.id,
        poolType: "student",
        auditAction: "modal_generate",
      });

      await loadUnusedAdmissionNumbers(registrationNumber);
      toast({
        title: "Number generated",
        description: `${registrationNumber} is ready to use`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate admission number";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setGeneratingAdmissionNo(false);
    }
  };

  const handleAddDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
      setUnusedAdmissionNumbers([]);
      setAssignClassId("");
      return;
    }
    void loadUnusedAdmissionNumbers();
    void fetchClasses();
  };

  const fetchStudents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) {
      console.error("School not found for user");
      return;
    }

    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_LIST_SELECT)
      .eq("school_id", profileData.school_id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setStudents(data as StudentRecord[]);
    } else if (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Could not load students",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: StudentFormData) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("school_id, schools(school_code)")
        .eq("id", user.id)
        .single();

      if (!profileData?.school_id) throw new Error("School not found");
      const schoolCode = (profileData.schools as any)?.school_code;

      const { data: regCheck } = await supabase
        .from("registration_numbers")
        .select("status")
        .eq("school_id", profileData.school_id)
        .eq("registration_number", data.admission_no)
        .eq("number_type", "student")
        .maybeSingle();

      if (regCheck?.status === "used") {
        throw new Error("This admission number is already in use. Pick another from Number Generator.");
      }

      const authEmail = buildStudentAuthEmail(data.admission_no, profileData.school_id);

      const { data: result, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: authEmail,
          password: data.password,
          full_name: data.full_name,
          role: 'student',
          school_code: schoolCode,
          admission_no: data.admission_no,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          guardian_email: data.guardian_email || undefined,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const userId = result?.user?.id as string | undefined;
      if (!userId) throw new Error("Student account created but user id was not returned");

      const studentPatch: { full_name: string; class_id?: string } = {
        full_name: data.full_name,
      };
      if (assignClassId) studentPatch.class_id = assignClassId;

      const { error: studentPatchError } = await supabase
        .from("students")
        .update(studentPatch)
        .eq("user_id", userId);

      if (studentPatchError) {
        throw new Error(
          assignClassId
            ? "Student created but class assignment failed"
            : "Student created but profile details could not be saved"
        );
      }

      let classNote = "";
      if (assignClassId) {
        const className = classes.find((c) => c.id === assignClassId)?.name;
        classNote = className ? ` Enrolled in ${className}.` : " Class assigned.";
      }

      toast({
        title: "Success",
        description: `Student added successfully.${classNote}`,
      });

      setOpen(false);
      reset();
      setAssignClassId("");
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (student: StudentRecord) => {
    setSelectedStudent(student);
    resetEdit({
      admission_no: getStudentAdmissionNo(student) || "",
      full_name: getStudentName(student) === "Unknown" ? "" : getStudentName(student),
      date_of_birth: student.date_of_birth || "",
      gender: student.gender || undefined,
      class_id: student.class_id || "",
    });
    setEditDialogOpen(true);
  };

  const onEditSubmit = async (data: EditStudentFormData) => {
    if (!selectedStudent) return;

    try {
      // Update students table
      const { error: studentError } = await supabase
        .from("students")
        .update({
          admission_no: data.admission_no,
          full_name: data.full_name,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          class_id: data.class_id || null,
        })
        .eq("id", selectedStudent.id);

      if (studentError) throw studentError;

      // Update profiles table for full_name
      if (selectedStudent.user_id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: data.full_name })
          .eq("id", selectedStudent.user_id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: "Student updated successfully",
      });

      setEditDialogOpen(false);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async (student: any) => {
    if (!student?.user_id) {
      toast({
        title: "Error",
        description: "Cannot delete student: No user account associated",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          user_id: student.user_id,
          user_role: 'student',
          user_name: getStudentName(student),
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student deleted successfully. Registration number remains locked.",
      });

      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete student",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Students</h2>
            <p className="text-sm md:text-base text-muted-foreground">Manage student records and enrollments</p>
          </div>
          <Dialog open={open} onOpenChange={handleAddDialogChange}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>Enter student information to create a new account</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="admission_no">Admission Number</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => void handleGenerateAdmissionNumber()}
                          disabled={loadingAdmissionNo || generatingAdmissionNo}
                        >
                          <Hash className={`h-3.5 w-3.5 ${generatingAdmissionNo ? "animate-pulse" : ""}`} />
                          Generate
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => void loadUnusedAdmissionNumbers()}
                          disabled={loadingAdmissionNo || generatingAdmissionNo}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingAdmissionNo ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      </div>
                    </div>
                    {unusedAdmissionNumbers.length > 1 ? (
                      <Select
                        value={admissionNoValue || undefined}
                        onValueChange={(value) => setValue("admission_no", value, { shouldValidate: true })}
                        disabled={loadingAdmissionNo || generatingAdmissionNo}
                      >
                        <SelectTrigger id="admission_no">
                          <SelectValue placeholder="Select admission number" />
                        </SelectTrigger>
                        <SelectContent>
                          {unusedAdmissionNumbers.map((num) => (
                            <SelectItem key={num} value={num}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="admission_no"
                        {...register("admission_no")}
                        placeholder={loadingAdmissionNo ? "Loading next number…" : admissionPlaceholder}
                        disabled={loadingAdmissionNo || generatingAdmissionNo}
                        readOnly={unusedAdmissionNumbers.length === 1}
                        className={unusedAdmissionNumbers.length === 1 ? "bg-muted font-mono" : "font-mono"}
                      />
                    )}
                    {!loadingAdmissionNo && !generatingAdmissionNo && unusedAdmissionNumbers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No admission numbers yet. Click <span className="font-medium">Generate</span> to create one.
                      </p>
                    )}
                    {!loadingAdmissionNo && !generatingAdmissionNo && unusedAdmissionNumbers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {unusedAdmissionNumbers.length} unused number{unusedAdmissionNumbers.length === 1 ? "" : "s"} available
                      </p>
                    )}
                    {errors.admission_no && <p className="text-sm text-destructive">{errors.admission_no.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" {...register("full_name")} />
                    {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
                      Students sign in with their admission number and password — no personal email
                      is required.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register("password")} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
                    {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value) => setValue("gender", value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="guardian_email">Guardian Email (Optional)</Label>
                    <Input id="guardian_email" type="email" {...register("guardian_email")} placeholder="Link to parent account" />
                    {errors.guardian_email && <p className="text-sm text-destructive">{errors.guardian_email.message}</p>}
                  </div>

                  <div className="col-span-2 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div>
                      <p className="text-sm font-semibold">Class assignment</p>
                      <p className="text-xs text-muted-foreground">Optional — enroll the student in a class now</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select
                        value={assignClassId || undefined}
                        onValueChange={setAssignClassId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name}
                              {cls.level ? ` (${cls.level})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {classes.length === 0 && (
                        <p className="text-xs text-muted-foreground">No classes found. Create classes first.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding…" : "Add Student"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg md:text-xl">All Students</CardTitle>
                <CardDescription className="text-sm md:text-base">View and manage student information</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." className="pl-10 w-full sm:w-64 text-base" />
                </div>
                <Button variant="outline" size="icon" className="flex-shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Admission No.</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Class</TableHead>
                    <TableHead className="hidden md:table-cell">Gender</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No students found. Add your first student to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {getStudentAdmissionNo(student) || (
                            <Badge variant="outline" className="text-xs">Not assigned</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{getStudentName(student)}</TableCell>
                        <TableCell className="hidden sm:table-cell">{getStudentClassLabel(student)}</TableCell>
                        <TableCell className="hidden md:table-cell capitalize">{student.gender || "N/A"}</TableCell>
                        <TableCell>
                          <Badge className="bg-success text-xs">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(student)}
                              className="h-8 md:h-9"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedStudent(student);
                                setViewDialogOpen(true);
                              }}
                              className="h-8 md:h-9"
                            >
                              View
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 md:h-9 text-destructive hover:text-destructive"
                                  disabled={deleting}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Student</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {getStudentName(student)}? 
                                    This action cannot be undone. The registration number will remain 
                                    locked and cannot be reused.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteStudent(student)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Student Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>Update student information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_admission_no">Admission Number</Label>
                  <Input id="edit_admission_no" {...registerEdit("admission_no")} />
                  {editErrors.admission_no && <p className="text-sm text-destructive">{editErrors.admission_no.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Full Name</Label>
                  <Input id="edit_full_name" {...registerEdit("full_name")} />
                  {editErrors.full_name && <p className="text-sm text-destructive">{editErrors.full_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_date_of_birth">Date of Birth</Label>
                  <Input id="edit_date_of_birth" type="date" {...registerEdit("date_of_birth")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_gender">Gender</Label>
                  <Select 
                    defaultValue={selectedStudent?.gender}
                    onValueChange={(value) => setEditValue("gender", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit_class">Class</Label>
                  <Select 
                    defaultValue={selectedStudent?.class_id}
                    onValueChange={(value) => setEditValue("class_id", value)}
                  >
                    <SelectTrigger>
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Student Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
              <DialogDescription>View complete student information</DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Admission Number</Label>
                    <p className="font-medium">{getStudentAdmissionNo(selectedStudent) || "Not assigned"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{getStudentName(selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Admission number (login)</Label>
                    <p className="font-medium font-mono">{getStudentAdmissionNo(selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Class</Label>
                    <p className="font-medium">{getStudentClassLabel(selectedStudent)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedStudent.gender || "Not specified"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {selectedStudent.date_of_birth 
                        ? new Date(selectedStudent.date_of_birth).toLocaleDateString()
                        : "Not provided"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className="bg-success">Active</Badge>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    Linked parent & contact
                  </p>
                  {getLinkedParents(selectedStudent).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      <p>No parent linked to this student.</p>
                      <p className="mt-1">
                        Link a parent from{" "}
                        <Link
                          to="/admin/parent-student-link"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Parent–Student Link
                        </Link>{" "}
                        or use guardian email when adding a student.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getLinkedParents(selectedStudent).map((parent) => (
                        <div
                          key={parent.id}
                          className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <div>
                            <Label className="text-xs text-muted-foreground">Parent name</Label>
                            <p className="font-medium">{getParentName(parent)}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Relationship</Label>
                            <p className="font-medium capitalize">{parent.relationship || "Parent"}</p>
                          </div>
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <p className="font-medium break-all">
                                {parent.profiles?.email?.trim() || "—"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                            <div>
                              <Label className="text-xs text-muted-foreground">Phone</Label>
                              <p className="font-medium">{getParentPhone(parent)}</p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Emergency contact</Label>
                            <p className="font-medium">{parent.emergency_contact?.trim() || "—"}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="text-xs text-muted-foreground">Address</Label>
                            <p className="font-medium">{parent.address?.trim() || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Students;