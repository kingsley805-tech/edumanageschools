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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Subjects Management</h1>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
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

        <Card>
          <CardHeader>
            <CardTitle>All Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
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
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No subjects found. Add your first subject to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(subject)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(subject.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
