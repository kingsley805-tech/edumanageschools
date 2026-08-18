import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";

const subjectSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(1, "Subject code is required"),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

interface Subject {
  id: string;
  name: string;
  code: string;
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
  });

  useEffect(() => {
    fetchSchoolId();
  }, []);

  useEffect(() => {
    if (schoolId) {
      fetchSubjects();
    }
  }, [schoolId]);

  const fetchSchoolId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        setSchoolId(profile.school_id);
      }
    }
  };

  const fetchSubjects = async () => {
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .order("name");

    if (error) {
      toast.error("Failed to fetch subjects");
      return;
    }

    setSubjects(data || []);
  };

  const onSubmit = async (data: SubjectFormData) => {
    try {
      if (editingSubject) {
        // Update existing subject
        const { error } = await supabase
          .from("subjects")
          .update({
            name: data.name,
            code: data.code,
          })
          .eq("id", editingSubject.id);

        if (error) throw error;
        toast.success("Subject updated successfully");
      } else {
        // Create new subject
        const { error } = await supabase
          .from("subjects")
          .insert({
            name: data.name,
            code: data.code,
            school_id: schoolId,
          });

        if (error) throw error;
        toast.success("Subject created successfully");
      }

      setIsDialogOpen(false);
      reset();
      setEditingSubject(null);
      fetchSubjects();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    reset({
      name: subject.name,
      code: subject.code,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;

    try {
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Subject deleted successfully");
      fetchSubjects();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete subject");
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    reset();
    setEditingSubject(null);
  };

  return (
    <DashboardLayout role="admin">
      {/* Page Header — Metronic toolbar */}
      <div className="flex flex-wrap items-center lg:items-end justify-between gap-5 pb-7.5">
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h1 className="text-xl font-medium leading-none text-mono">Subjects Management</h1>
          <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
            Define curriculum subjects, subject codes, and academic offerings
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="kt-btn kt-btn-primary gap-2">
                <i className="ki-filled ki-plus text-base" />
                Add subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubject ? "Edit Subject" : "Add New Subject"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Subject Name</Label>
                  <Input id="name" {...register("name")} placeholder="e.g., Mathematics" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Subject Code</Label>
                  <Input id="code" {...register("code")} placeholder="e.g., MATH101" />
                  {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingSubject ? "Update" : "Create"} Subject
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="kt-card">
        <div className="kt-card-header flex justify-between items-center py-4 px-5">
          <h3 className="kt-card-title">All Subjects</h3>
          <span className="kt-badge kt-badge-outline kt-badge-sm">
            {subjects.length} subjects
          </span>
        </div>
        <div className="kt-card-content p-0 overflow-x-auto">
          <Table className="kt-table min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Subject Name</TableHead>
                <TableHead>Subject Code</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No subjects found. Add your first subject to get started.
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium text-mono">{subject.name}</TableCell>
                    <TableCell className="font-mono text-2sm">{subject.code || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="kt-btn kt-btn-ghost kt-btn-sm"
                          onClick={() => handleEdit(subject)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="kt-btn kt-btn-ghost kt-btn-sm text-destructive hover:text-destructive"
                          onClick={() => handleDelete(subject.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
