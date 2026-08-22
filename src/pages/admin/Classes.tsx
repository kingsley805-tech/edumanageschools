import DashboardLayout from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resolveUserSchoolId } from "@/lib/schoolFetch";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ClassRosterPanel } from "@/components/classes/ClassRosterPanel";

const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  level: z.string().min(1, "Level is required"),
});

type ClassFormData = z.infer<typeof classSchema>;

const Classes = () => {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  });

  useEffect(() => {
    void fetchClasses();
  }, []);

  const fetchTeachers = async (schoolId: string) => {
    const { data, error } = await supabase
      .from("teachers")
      .select("id, employee_no, profiles(full_name)")
      .eq("school_id", schoolId);
    if (!error && data) {
      setTeachers(data);
    }
  };

  const handleAssignClassTeacher = async (
    classId: string,
    teacherId: string,
    currentTeacherId?: string | null,
  ) => {
    const newTeacher = teacherId === "unassigned" || !teacherId ? null : teacherId;
    const current = currentTeacherId ?? null;
    if (newTeacher === current) return;

    try {
      const { error } = await supabase.rpc("assign_class_teacher", {
        p_class_id: classId,
        p_teacher_id: newTeacher,
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: newTeacher ? "Class teacher assigned." : "Class teacher removed.",
      });
      await fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const schoolId = await resolveUserSchoolId(user.id);
    if (!schoolId) {
      console.error("School not found for user");
      return;
    }

    void fetchTeachers(schoolId);

    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        students(count),
        class_teacher:teachers!class_teacher_id(
          id,
          profiles(full_name)
        )
      `)
      .eq("school_id", schoolId)
      .order("name");

    if (!error && data) {
      setClasses(data);
    }
  };

  const onSubmit = async (data: ClassFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const schoolId = await resolveUserSchoolId(user.id);
      if (!schoolId) throw new Error("School not found");

      const { error } = await supabase
        .from("classes")
        .insert([{
          name: data.name,
          level: data.level,
          school_id: schoolId,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Class created successfully",
      });

      setOpen(false);
      reset();
      void fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const teacherOptions = teachers.map((t) => ({
    value: t.id,
    label: t.profiles?.full_name ?? "Teacher",
    description: t.employee_no ? `Emp. ${t.employee_no}` : undefined,
  }));

  const selectedClassRow = classes.find((c) => c.id === selectedClass);

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Classes</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Manage school classes, teacher assignments, and student enrollments
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ExportMenu
            filename="classes"
            title="Classes"
            headers={["Name", "Level", "Student Count", "Class Teacher"]}
            rows={classes.map((cls) => [
              cls.name,
              cls.level || "Standard level",
              cls.students?.[0]?.count ?? 0,
              cls.class_teacher?.profiles?.full_name
                ?? teachers.find((t) => t.id === cls.class_teacher_id)?.profiles?.full_name
                ?? "Unassigned",
            ])}
            disabled={classes.length === 0}
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="kt-btn kt-btn-primary gap-2">
                <i className="ki-filled ki-plus text-base" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Class</DialogTitle>
                <DialogDescription>Create a new class for students</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Class Name</Label>
                  <Input id="name" placeholder="e.g., Grade 10A" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input id="level" placeholder="e.g., Secondary" {...register("level")} />
                  {errors.level && <p className="text-sm text-destructive">{errors.level.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Class</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-7.5">
        {classes.map((cls) => (
          <div className="kt-card channel-stats-bg" key={cls.id}>
            <div className="kt-card-header flex justify-between items-center py-4 px-5">
              <div>
                <Link
                  to={`/admin/classes/${cls.id}`}
                  className="kt-card-title text-base hover:text-primary hover:underline block"
                >
                  {cls.name}
                </Link>
                <span className="text-xs text-secondary-foreground">{cls.level || "Standard level"}</span>
              </div>
              <span className="kt-badge kt-badge-outline kt-badge-sm">
                {cls.students?.[0]?.count || 0} students
              </span>
            </div>
            <div className="kt-card-content p-5 flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Class Teacher</Label>
                <SearchableSelect
                  options={[{ value: "unassigned", label: "Unassigned" }, ...teacherOptions]}
                  value={cls.class_teacher_id || "unassigned"}
                  onChange={(val) => void handleAssignClassTeacher(cls.id, val, cls.class_teacher_id)}
                  placeholder="Assign teacher"
                  searchPlaceholder="Search teachers…"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={`kt-btn kt-btn-outline flex-1 justify-center ${selectedClass === cls.id ? "ring-2 ring-primary/40" : ""}`}
                  onClick={() => setSelectedClass(cls.id === selectedClass ? null : cls.id)}
                >
                  Roster
                </Button>
                <Link
                  to={`/admin/classes/${cls.id}`}
                  className="kt-btn kt-btn-primary px-3 text-xs justify-center inline-flex items-center"
                >
                  View Class
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedClass && selectedClassRow ? (
        <ClassRosterPanel
          classId={selectedClass}
          className={selectedClassRow.name}
          classTeacherId={selectedClassRow.class_teacher_id}
          teachers={teachers}
          onAssignClassTeacher={handleAssignClassTeacher}
          onClassesChanged={() => void fetchClasses()}
        />
      ) : null}
    </DashboardLayout>
  );
};

export default Classes;
