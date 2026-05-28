import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, RefreshCw, Hash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateRegistrationNumber } from "@/lib/registration-numbers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const teacherSchema = z.object({
  employee_no: z.string().min(1, "Employee number is required"),
  email: z.string().email("Invalid email address"),
  full_name: z.string().min(1, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const editTeacherSchema = z.object({
  employee_no: z.string().min(1, "Employee number is required"),
  full_name: z.string().min(1, "Full name is required"),
  subject_specialty: z.string().optional(),
});

type TeacherFormData = z.infer<typeof teacherSchema>;
type EditTeacherFormData = z.infer<typeof editTeacherSchema>;

type ClassOption = { id: string; name: string; level: string | null };
type SubjectOption = { id: string; name: string; code: string | null };

type TeacherRow = {
  id: string;
  employee_no: string | null;
  subject_specialty: string | null;
  profiles?: { full_name?: string; email?: string } | null;
  class_subjects?: Array<{
    subjects?: { name?: string; code?: string } | null;
    classes?: { name?: string; level?: string } | null;
  }> | null;
};

function formatTeacherClasses(teacher: TeacherRow): string {
  const fromAssignments = [
    ...new Set(
      (teacher.class_subjects ?? [])
        .map((cs) => {
          const name = cs.classes?.name?.trim();
          const level = cs.classes?.level?.trim();
          if (!name) return null;
          return level ? `${name} (${level})` : name;
        })
        .filter((label): label is string => Boolean(label))
    ),
  ];
  if (fromAssignments.length > 0) return fromAssignments.join(", ");
  return "N/A";
}

function formatTeacherSubjects(teacher: TeacherRow): string {
  const fromAssignments = [
    ...new Set(
      (teacher.class_subjects ?? [])
        .map((cs) => cs.subjects?.name?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ];
  if (fromAssignments.length > 0) return fromAssignments.join(", ");
  const specialty = teacher.subject_specialty?.trim();
  if (specialty) return specialty;
  return "N/A";
}

async function assignTeacherClassSubjects(
  teacherId: string,
  classId: string,
  subjectIds: string[]
): Promise<number> {
  let assigned = 0;
  for (const subjectId of subjectIds) {
    const { data: existing } = await supabase
      .from("class_subjects")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("class_subjects").insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
    });

    if (!error) assigned += 1;
  }
  return assigned;
}

const Teachers = () => {
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [unusedEmployeeNumbers, setUnusedEmployeeNumbers] = useState<string[]>([]);
  const [loadingEmployeeNo, setLoadingEmployeeNo] = useState(false);
  const [generatingEmployeeNo, setGeneratingEmployeeNo] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectIds, setAssignSubjectIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
  });

  const employeeNoValue = watch("employee_no");

  const { 
    register: registerEdit, 
    handleSubmit: handleEditSubmit, 
    formState: { errors: editErrors }, 
    reset: resetEdit 
  } = useForm<EditTeacherFormData>({
    resolver: zodResolver(editTeacherSchema),
  });

  useEffect(() => {
    fetchTeachers();
    void resolveSchoolId();
  }, []);

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

  const loadUnusedEmployeeNumbers = async (selectNumber?: string) => {
    const sid = await resolveSchoolId();
    if (!sid) return;

    setLoadingEmployeeNo(true);
    try {
      const { data, error } = await supabase
        .from("registration_numbers")
        .select("registration_number")
        .eq("school_id", sid)
        .eq("number_type", "employee")
        .eq("status", "unused")
        .order("registration_number", { ascending: true })
        .limit(100);

      if (error) throw error;

      const numbers = (data ?? []).map((r) => r.registration_number);
      setUnusedEmployeeNumbers(numbers);
      if (selectNumber && numbers.includes(selectNumber)) {
        setValue("employee_no", selectNumber, { shouldValidate: true });
      } else if (numbers.length > 0) {
        setValue("employee_no", numbers[0], { shouldValidate: true });
      } else {
        setValue("employee_no", "");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load employee numbers";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoadingEmployeeNo(false);
    }
  };

  const handleGenerateEmployeeNumber = async () => {
    setGeneratingEmployeeNo(true);
    try {
      const sid = await resolveSchoolId();
      if (!sid) throw new Error("School not found");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const registrationNumber = await generateRegistrationNumber({
        schoolId: sid,
        userId: user.id,
        type: "employee",
        auditAction: "modal_generate",
      });

      await loadUnusedEmployeeNumbers(registrationNumber);
      toast({
        title: "Number generated",
        description: `${registrationNumber} is ready to use`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate employee number";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setGeneratingEmployeeNo(false);
    }
  };

  const fetchClassesAndSubjects = async () => {
    const sid = await resolveSchoolId();
    if (!sid) return;

    const [classesRes, subjectsRes] = await Promise.all([
      supabase.from("classes").select("id, name, level").eq("school_id", sid).order("name"),
      supabase.from("subjects").select("id, name, code").eq("school_id", sid).order("name"),
    ]);

    if (classesRes.error) {
      toast({ title: "Error loading classes", description: classesRes.error.message, variant: "destructive" });
    } else {
      setClasses((classesRes.data ?? []) as ClassOption[]);
    }

    if (subjectsRes.error) {
      toast({ title: "Error loading subjects", description: subjectsRes.error.message, variant: "destructive" });
    } else {
      setSubjects((subjectsRes.data ?? []) as SubjectOption[]);
    }
  };

  const toggleAssignSubject = (subjectId: string, checked: boolean) => {
    setAssignSubjectIds((prev) =>
      checked ? [...prev, subjectId] : prev.filter((id) => id !== subjectId)
    );
  };

  const handleAssignAllSubjects = () => {
    if (!assignClassId) {
      toast({
        title: "Select a class first",
        description: "Choose a class before assigning subjects.",
        variant: "destructive",
      });
      return;
    }
    if (subjects.length === 0) {
      toast({
        title: "No subjects available",
        description: "Add subjects for your school before assigning.",
        variant: "destructive",
      });
      return;
    }
    setAssignSubjectIds(subjects.map((s) => s.id));
  };

  const handleAddDialogChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
      setUnusedEmployeeNumbers([]);
      setAssignClassId("");
      setAssignSubjectIds([]);
      return;
    }
    void loadUnusedEmployeeNumbers();
    void fetchClassesAndSubjects();
  };

  const fetchTeachers = async () => {
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
      .from("teachers")
      .select(`
        *,
        profiles(full_name, email),
        class_subjects(
          subjects(name, code),
          classes(name, level)
        )
      `)
      .eq("school_id", profileData.school_id);
    
    if (!error && data) {
      setTeachers(data as TeacherRow[]);
    } else if (error) {
      console.error("Error fetching teachers:", error);
    }
  };

  const onSubmit = async (data: TeacherFormData) => {
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
        .eq("registration_number", data.employee_no)
        .eq("number_type", "employee")
        .maybeSingle();

      if (regCheck?.status === "used") {
        throw new Error("This employee number is already in use. Generate or pick another.");
      }

      const { data: result, error } = await supabase.functions.invoke('create-user-account', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: 'teacher',
          school_code: schoolCode,
          employee_no: data.employee_no,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const userId = result?.user?.id as string | undefined;
      if (!userId) throw new Error("Teacher account created but user id was not returned");

      let assignmentNote = "";
      if (assignClassId && assignSubjectIds.length > 0) {
        const { data: teacherRow, error: teacherLookupError } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (teacherLookupError || !teacherRow) {
          throw new Error("Teacher created but class assignments could not be saved");
        }

        const assignedCount = await assignTeacherClassSubjects(
          teacherRow.id,
          assignClassId,
          assignSubjectIds
        );
        assignmentNote =
          assignedCount > 0
            ? ` Assigned to ${assignedCount} subject${assignedCount === 1 ? "" : "s"}.`
            : "";
      }

      toast({
        title: "Success",
        description: `Teacher added successfully.${assignmentNote}`,
      });

      setOpen(false);
      reset();
      setAssignClassId("");
      setAssignSubjectIds([]);
      fetchTeachers();
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

  const openEditDialog = (teacher: any) => {
    setSelectedTeacher(teacher);
    resetEdit({
      employee_no: teacher.employee_no || "",
      full_name: teacher.profiles?.full_name || "",
      subject_specialty: teacher.subject_specialty || "",
    });
    setEditDialogOpen(true);
  };

  const onEditSubmit = async (data: EditTeacherFormData) => {
    if (!selectedTeacher) return;

    try {
      // Update teachers table
      const { error: teacherError } = await supabase
        .from("teachers")
        .update({
          employee_no: data.employee_no,
          subject_specialty: data.subject_specialty || null,
        })
        .eq("id", selectedTeacher.id);

      if (teacherError) throw teacherError;

      // Update profiles table for full_name
      if (selectedTeacher.user_id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: data.full_name })
          .eq("id", selectedTeacher.user_id);

        if (profileError) throw profileError;
      }

      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });

      setEditDialogOpen(false);
      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeacher = async (teacher: any) => {
    if (!teacher?.user_id) {
      toast({
        title: "Error",
        description: "Cannot delete teacher: No user account associated",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: {
          user_id: teacher.user_id,
          user_role: 'teacher',
          user_name: teacher.profiles?.full_name,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Teacher deleted successfully. Employee number remains locked.",
      });

      fetchTeachers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete teacher",
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
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Teachers</h2>
            <p className="text-sm md:text-base text-muted-foreground">Manage teaching staff</p>
          </div>
          <Dialog open={open} onOpenChange={handleAddDialogChange}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>Enter teacher information to create a new account</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="employee_no">Employee Number</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => void handleGenerateEmployeeNumber()}
                          disabled={loadingEmployeeNo || generatingEmployeeNo}
                        >
                          <Hash className={`h-3.5 w-3.5 ${generatingEmployeeNo ? "animate-pulse" : ""}`} />
                          Generate
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => void loadUnusedEmployeeNumbers()}
                          disabled={loadingEmployeeNo || generatingEmployeeNo}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingEmployeeNo ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      </div>
                    </div>
                    {unusedEmployeeNumbers.length > 1 ? (
                      <Select
                        value={employeeNoValue || undefined}
                        onValueChange={(value) => setValue("employee_no", value, { shouldValidate: true })}
                        disabled={loadingEmployeeNo || generatingEmployeeNo}
                      >
                        <SelectTrigger id="employee_no">
                          <SelectValue placeholder="Select employee number" />
                        </SelectTrigger>
                        <SelectContent>
                          {unusedEmployeeNumbers.map((num) => (
                            <SelectItem key={num} value={num}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="employee_no"
                        {...register("employee_no")}
                        placeholder={loadingEmployeeNo ? "Loading next number…" : "EMP-YYYY-001"}
                        disabled={loadingEmployeeNo || generatingEmployeeNo}
                        readOnly={unusedEmployeeNumbers.length === 1}
                        className={unusedEmployeeNumbers.length === 1 ? "bg-muted font-mono" : "font-mono"}
                      />
                    )}
                    {!loadingEmployeeNo && !generatingEmployeeNo && unusedEmployeeNumbers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No employee numbers yet. Click <span className="font-medium">Generate</span> to create one.
                      </p>
                    )}
                    {!loadingEmployeeNo && !generatingEmployeeNo && unusedEmployeeNumbers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {unusedEmployeeNumbers.length} unused number{unusedEmployeeNumbers.length === 1 ? "" : "s"} available
                      </p>
                    )}
                    {errors.employee_no && <p className="text-sm text-destructive">{errors.employee_no.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" {...register("full_name")} />
                    {errors.full_name && <p className="text-sm text-destructive">{errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register("email")} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register("password")} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>

                  <div className="col-span-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Class & subject assignment</p>
                        <p className="text-xs text-muted-foreground">Optional — assign now or later via Teacher–Class Link</p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        onClick={handleAssignAllSubjects}
                        disabled={!assignClassId || subjects.length === 0}
                      >
                        Assign all subjects
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select
                        value={assignClassId || undefined}
                        onValueChange={(value) => {
                          setAssignClassId(value);
                          setAssignSubjectIds([]);
                        }}
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

                    <div className="space-y-2">
                      <Label>
                        Subjects
                        {assignSubjectIds.length > 0 ? ` (${assignSubjectIds.length} selected)` : ""}
                      </Label>
                      <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {subjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground col-span-full">No subjects available.</p>
                        ) : (
                          subjects.map((subject) => (
                            <label
                              key={subject.id}
                              className={`flex items-center gap-2 text-sm cursor-pointer ${!assignClassId ? "opacity-50 pointer-events-none" : ""}`}
                            >
                              <Checkbox
                                checked={assignSubjectIds.includes(subject.id)}
                                onCheckedChange={(checked) =>
                                  toggleAssignSubject(subject.id, checked === true)
                                }
                                disabled={!assignClassId}
                              />
                              <span className="truncate">
                                {subject.name}
                                {subject.code ? ` (${subject.code})` : ""}
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                      {!assignClassId && (
                        <p className="text-xs text-muted-foreground">Select a class to choose subjects.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding…" : "Add Teacher"}
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
                <CardTitle className="text-lg md:text-xl">All Teachers</CardTitle>
                <CardDescription className="text-sm md:text-base">View and manage teacher information</CardDescription>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search teachers..." className="pl-10 w-full sm:w-64 text-base" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-6 pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Employee No.</TableHead>
                    <TableHead className="min-w-[150px]">Name</TableHead>
                    <TableHead className="hidden md:table-cell">Assigned Class</TableHead>
                    <TableHead className="hidden md:table-cell">Subject</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead className="min-w-[80px]">Status</TableHead>
                    <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No teachers found. Add your first teacher to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">
                          {teacher.employee_no || <Badge variant="outline" className="text-xs">Not assigned</Badge>}
                        </TableCell>
                        <TableCell className="font-medium">{teacher.profiles?.full_name}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatTeacherClasses(teacher)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatTeacherSubjects(teacher)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{teacher.profiles?.email}</TableCell>
                        <TableCell>
                          <Badge className="bg-success text-xs">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => openEditDialog(teacher)}
                              className="h-8 md:h-9"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedTeacher(teacher);
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
                                  <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {teacher.profiles?.full_name}? 
                                    This action cannot be undone. The employee number will remain 
                                    locked and cannot be reused.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteTeacher(teacher)}
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

        {/* Edit Teacher Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Teacher</DialogTitle>
              <DialogDescription>Update teacher information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_employee_no">Employee Number</Label>
                  <Input id="edit_employee_no" {...registerEdit("employee_no")} />
                  {editErrors.employee_no && <p className="text-sm text-destructive">{editErrors.employee_no.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_full_name">Full Name</Label>
                  <Input id="edit_full_name" {...registerEdit("full_name")} />
                  {editErrors.full_name && <p className="text-sm text-destructive">{editErrors.full_name.message}</p>}
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit_subject_specialty">Subject Specialty</Label>
                  <Input id="edit_subject_specialty" {...registerEdit("subject_specialty")} placeholder="e.g. Mathematics, Physics" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Teacher Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Teacher Details</DialogTitle>
              <DialogDescription>View complete teacher information</DialogDescription>
            </DialogHeader>
            {selectedTeacher && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Employee Number</Label>
                    <p className="font-medium">{selectedTeacher.employee_no || "Not assigned"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedTeacher.profiles?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedTeacher.profiles?.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Assigned Class</Label>
                    <p className="font-medium">{formatTeacherClasses(selectedTeacher)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Assigned Subject</Label>
                    <p className="font-medium">{formatTeacherSubjects(selectedTeacher)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className="bg-success">Active</Badge>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Teachers;
