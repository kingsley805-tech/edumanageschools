import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Upload, Calendar, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Assignments = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchAssignments();
  }, [user]);

  // Prevent text selection and copy on assignment descriptions
  useEffect(() => {
    // Prevent context menu
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only prevent on assignment description text
      if (target.closest('[data-assignment-content]')) {
        e.preventDefault();
        return false;
      }
    };

    // Prevent copy, cut shortcuts on assignment content
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-assignment-content]')) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
          e.preventDefault();
          toast.error("Copying assignment content is not allowed");
          return false;
        }
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchAssignments = async () => {
    if (!user) return;

    // Get student record
    const { data: studentData } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("user_id", user.id)
      .single();

    if (!studentData) return;

    // Get assignments for student's class
    const { data: assignmentsData } = await supabase
      .from("assignments")
      .select(`
        *,
        subjects(name),
        classes(name),
        submissions(id, submitted_at, grade, student_id)
      `)
      .eq("class_id", studentData.class_id)
      .order("due_date", { ascending: true });

    if (assignmentsData) {
      // Filter to show only submissions for this student
      const assignmentsWithSubmission = assignmentsData.map(assignment => ({
        ...assignment,
        submission: Array.isArray(assignment.submissions) 
          ? assignment.submissions.find((s: any) => s.student_id === studentData.id)
          : null,
      }));
      setAssignments(assignmentsWithSubmission);
    }
  };

  const handleSubmit = async (assignmentId: string) => {
    if (!selectedFile || !user) return;

    setSubmitting(true);
    try {
      // Get student record
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!studentData) throw new Error("Student record not found");

      // Upload file to private bucket
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${assignmentId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("assignment-submissions")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Create submission record with file path (not public URL since bucket is private)
      const { error: submissionError } = await supabase
        .from("submissions")
        .insert({
          assignment_id: assignmentId,
          student_id: studentData.id,
          file_url: fileName,
        });

      if (submissionError) throw submissionError;

      toast.success("Assignment submitted successfully");

      setOpenDialog(null);
      setSelectedFile(null);
      fetchAssignments();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
          <p className="text-muted-foreground">View and submit your assignments</p>
        </div>

        {assignments.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">No assignments yet</p>
                <p className="text-sm text-muted-foreground">New assignments will appear here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1" data-assignment-content>
                      <CardTitle style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{assignment.title}</CardTitle>
                      <CardDescription style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{assignment.subjects?.name}</CardDescription>
                    </div>
                    {assignment.submission ? (
                      <Badge className="bg-success">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Submitted
                      </Badge>
                    ) : isOverdue(assignment.due_date) ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p 
                    className="text-sm text-muted-foreground" 
                    data-assignment-content
                    style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                  >
                    {assignment.description}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {new Date(assignment.due_date).toLocaleString()}</span>
                  </div>
                  {assignment.submission ? (
                    <div className="space-y-2">
                      <p className="text-sm">
                        Submitted on: {new Date(assignment.submission.submitted_at).toLocaleString()}
                      </p>
                      {assignment.submission.grade && (
                        <p className="text-sm font-medium">
                          Grade: <Badge>{assignment.submission.grade}</Badge>
                        </p>
                      )}
                    </div>
                  ) : (
                    <Dialog open={openDialog === assignment.id} onOpenChange={(open) => setOpenDialog(open ? assignment.id : null)}>
                      <DialogTrigger asChild>
                        <Button className="w-full gap-2">
                          <Upload className="h-4 w-4" />
                          Submit Assignment
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Submit Assignment</DialogTitle>
                          <DialogDescription>Upload your assignment file</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="file">Choose File</Label>
                            <Input
                              id="file"
                              type="file"
                              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                            />
                            <p className="text-xs text-muted-foreground">
                              Accepted formats: PDF, Word, Images, Text (Max 10MB)
                            </p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpenDialog(null)}>Cancel</Button>
                            <Button 
                              onClick={() => handleSubmit(assignment.id)}
                              disabled={!selectedFile || submitting}
                            >
                              {submitting ? "Submitting..." : "Submit"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Assignments;
