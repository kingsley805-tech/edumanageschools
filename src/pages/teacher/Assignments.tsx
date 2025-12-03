import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Calendar, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  class_id: z.string().min(1, "Class is required"),
  subject_id: z.string().min(1, "Subject is required"),
  due_date: z.string().min(1, "Due date is required"),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

const Assignments = () => {
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradeValue, setGradeValue] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
  });

  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchSubjects();
  }, []);

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from("assignments")
      .select(`
        *,
        classes(name),
        subjects(name)
      `)
      .eq("created_by", user?.id)
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setAssignments(data);
    }
  };

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get teacher's assigned classes only
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherData) {
      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("classes(id, name)")
        .eq("teacher_id", teacherData.id);

      const uniqueClasses = Array.from(
        new Map(classSubjects?.map(item => [item.classes?.id, item.classes]) || []).values()
      ).filter(Boolean);
      setClasses(uniqueClasses as any);
    }
  };

  const fetchSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get teacher's assigned subjects only
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (teacherData) {
      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("subjects(id, name)")
        .eq("teacher_id", teacherData.id);

      const uniqueSubjects = Array.from(
        new Map(classSubjects?.map(item => [item.subjects?.id, item.subjects]) || []).values()
      ).filter(Boolean);
      setSubjects(uniqueSubjects as any);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    const { data } = await supabase
      .from("submissions")
      .select(`
        *,
        students(
          admission_no,
          profiles(full_name)
        )
      `)
      .eq("assignment_id", assignmentId);
    
    if (data) setSubmissions(data);
  };

  const onSubmit = async (data: AssignmentFormData) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .insert([{
          title: data.title,
          description: data.description,
          class_id: data.class_id,
          subject_id: data.subject_id,
          due_date: data.due_date,
          created_by: user?.id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment created successfully",
      });

      setOpen(false);
      reset();
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewSubmissions = (assignmentId: string) => {
    setSelectedAssignment(assignmentId);
    fetchSubmissions(assignmentId);
  };

  const handleGradeSubmission = async () => {
    if (!gradingSubmission || !gradeValue) {
      toast({
        title: "Error",
        description: "Please enter a grade",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("submissions")
        .update({ grade: parseFloat(gradeValue) })
        .eq("id", gradingSubmission.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Grade submitted successfully",
      });

      setGradingSubmission(null);
      setGradeValue("");
      if (selectedAssignment) {
        fetchSubmissions(selectedAssignment);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
            <p className="text-muted-foreground">Create and manage assignments</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
                <DialogDescription>Add a new assignment for your students</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title")} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description")} rows={4} />
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="class_id">Class</Label>
                    <Select onValueChange={(value) => setValue("class_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.class_id && <p className="text-sm text-destructive">{errors.class_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject_id">Subject</Label>
                    <Select onValueChange={(value) => setValue("subject_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>{subj.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subject_id && <p className="text-sm text-destructive">{errors.subject_id.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input id="due_date" type="datetime-local" {...register("due_date")} />
                  {errors.due_date && <p className="text-sm text-destructive">{errors.due_date.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Assignment</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>View and manage all your assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
                  <p className="text-lg font-medium">No assignments yet</p>
                  <p className="text-sm text-muted-foreground">Create your first assignment to get started</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.title}</TableCell>
                      <TableCell>{assignment.classes?.name}</TableCell>
                      <TableCell>{assignment.subjects?.name}</TableCell>
                      <TableCell>{new Date(assignment.due_date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewSubmissions(assignment.id)}
                        >
                          View Submissions
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selectedAssignment && (
          <Card>
            <CardHeader>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Student submissions for this assignment</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No submissions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.students?.profiles?.full_name}</TableCell>
                        <TableCell>{sub.students?.admission_no}</TableCell>
                        <TableCell>{new Date(sub.submitted_at).toLocaleString()}</TableCell>
                        <TableCell>{sub.grade ? <Badge>{sub.grade}</Badge> : <Badge variant="outline">Not graded</Badge>}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setGradingSubmission(sub);
                              setGradeValue(sub.grade?.toString() || "");
                            }}
                          >
                            {sub.grade ? "Update Grade" : "Grade"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={!!gradingSubmission} onOpenChange={(open) => !open && setGradingSubmission(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grade Submission</DialogTitle>
              <DialogDescription>
                Student: {gradingSubmission?.students?.profiles?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {gradingSubmission?.file_url && (
                <div className="space-y-2">
                  <Label>Submitted File</Label>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={async () => {
                      // Handle both full URLs and storage paths
                      const fileUrl = gradingSubmission.file_url;
                      if (fileUrl.startsWith('http')) {
                        window.open(fileUrl, '_blank');
                      } else {
                        const { data } = await supabase.storage
                          .from('assignment-submissions')
                          .createSignedUrl(fileUrl, 300);
                        if (data?.signedUrl) {
                          window.open(data.signedUrl, '_blank');
                        }
                      }
                    }}
                  >
                    View Submission
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label>Grade (out of 100)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  placeholder="Enter grade"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGradingSubmission(null)}>Cancel</Button>
                <Button onClick={handleGradeSubmission}>Submit Grade</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Assignments;
