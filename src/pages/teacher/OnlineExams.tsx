import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Eye, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  class_id: string;
  subject_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  total_marks: number;
  term: string | null;
  classes?: { name: string };
  subjects?: { name: string };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  difficulty: string;
}

const OnlineExams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<OnlineExam | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [examQuestions, setExamQuestions] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    class_id: "",
    subject_id: "",
    start_time: "",
    end_time: "",
    duration_minutes: 60,
    total_marks: 100,
    term: "",
    shuffle_questions: false,
    show_result_immediately: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: teacherData } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    if (teacherData) {
      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("class_id, subject_id, classes(id, name), subjects(id, name)")
        .eq("teacher_id", teacherData.id);

      if (classSubjects) {
        const uniqueClasses = Array.from(new Map(classSubjects.map(cs => [cs.class_id, cs.classes])).values()).filter(Boolean) as { id: string; name: string }[];
        const uniqueSubjects = Array.from(new Map(classSubjects.map(cs => [cs.subject_id, cs.subjects])).values()).filter(Boolean) as { id: string; name: string }[];
        setClasses(uniqueClasses);
        setSubjects(uniqueSubjects);
      }
    }

    const { data: examsData } = await supabase
      .from("online_exams")
      .select("*, classes(name), subjects(name)")
      .eq("created_by", user?.id)
      .order("start_time", { ascending: false });
    
    if (examsData) setExams(examsData as OnlineExam[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("online_exams").insert({
      ...formData,
      created_by: user?.id,
    });

    if (error) return toast.error("Failed to create exam");
    toast.success("Online exam created");
    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      class_id: "",
      subject_id: "",
      start_time: "",
      end_time: "",
      duration_minutes: 60,
      total_marks: 100,
      term: "",
      shuffle_questions: false,
      show_result_immediately: true,
    });
  };

  const openQuestionsDialog = async (exam: OnlineExam) => {
    setSelectedExam(exam);
    
    // Filter questions by teacher (created_by) and subject
    const { data: bankQuestions } = await supabase
      .from("question_bank")
      .select("id, question_text, question_type, marks, difficulty")
      .eq("subject_id", exam.subject_id)
      .eq("created_by", user?.id);
    
    if (bankQuestions) setQuestions(bankQuestions);

    const { data: existingQuestions } = await supabase
      .from("online_exam_questions")
      .select("question_id")
      .eq("online_exam_id", exam.id);
    
    if (existingQuestions) {
      const ids = existingQuestions.map(q => q.question_id);
      setSelectedQuestions(ids);
      setExamQuestions(ids);
    }

    setQuestionsDialogOpen(true);
  };

  const saveQuestions = async () => {
    if (!selectedExam) return;

    // Remove old questions
    await supabase.from("online_exam_questions").delete().eq("online_exam_id", selectedExam.id);

    // Add new questions
    if (selectedQuestions.length > 0) {
      const inserts = selectedQuestions.map((qId, idx) => ({
        online_exam_id: selectedExam.id,
        question_id: qId,
        question_order: idx + 1,
        marks: questions.find(q => q.id === qId)?.marks || 1,
      }));

      const { error } = await supabase.from("online_exam_questions").insert(inserts);
      if (error) return toast.error("Failed to save questions");

      // Update total marks
      const totalMarks = selectedQuestions.reduce((sum, qId) => {
        const q = questions.find(q => q.id === qId);
        return sum + (q?.marks || 1);
      }, 0);

      await supabase.from("online_exams").update({ total_marks: totalMarks }).eq("id", selectedExam.id);
    }

    toast.success("Questions saved");
    setQuestionsDialogOpen(false);
    fetchData();
  };

  const toggleQuestion = (id: string) => {
    setSelectedQuestions(prev => 
      prev.includes(id) ? prev.filter(q => q !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("online_exams").delete().eq("id", id);
    if (error) return toast.error("Failed to delete exam");
    toast.success("Exam deleted");
    fetchData();
  };

  const getExamStatus = (exam: OnlineExam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);
    
    if (now < start) return { label: "Upcoming", variant: "secondary" as const };
    if (now >= start && now <= end) return { label: "Active", variant: "default" as const };
    return { label: "Ended", variant: "outline" as const };
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Online Exams</h2>
            <p className="text-muted-foreground">Create and manage online examinations</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="mr-2 h-4 w-4" /> Create Exam</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Online Exam</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Class</Label>
                    <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Time</Label>
                    <Input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })} required />
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select value={formData.term} onValueChange={(v) => setFormData({ ...formData, term: v })}>
                      <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={formData.shuffle_questions} onCheckedChange={(c) => setFormData({ ...formData, shuffle_questions: !!c })} />
                    <Label>Shuffle Questions</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox checked={formData.show_result_immediately} onCheckedChange={(c) => setFormData({ ...formData, show_result_immediately: !!c })} />
                    <Label>Show Result Immediately</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full">Create Exam</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Online Exams</CardTitle>
            <CardDescription>Manage your online examinations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => {
                  const status = getExamStatus(exam);
                  return (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>{exam.classes?.name}</TableCell>
                      <TableCell>{exam.subjects?.name}</TableCell>
                      <TableCell>{format(new Date(exam.start_time), "PPp")}</TableCell>
                      <TableCell>{exam.duration_minutes} min</TableCell>
                      <TableCell>{exam.total_marks}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openQuestionsDialog(exam)} title="Manage Questions">
                            <ListChecks className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(exam.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {exams.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No online exams found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={questionsDialogOpen} onOpenChange={setQuestionsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Questions - {selectedExam?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select questions from the question bank for this exam</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>
                        <Checkbox checked={selectedQuestions.includes(q.id)} onCheckedChange={() => toggleQuestion(q.id)} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{q.question_text}</TableCell>
                      <TableCell className="capitalize">{q.question_type.replace("_", " ")}</TableCell>
                      <TableCell className="capitalize">{q.difficulty}</TableCell>
                      <TableCell>{q.marks}</TableCell>
                    </TableRow>
                  ))}
                  {questions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No questions available for this subject</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center">
                <p>Selected: {selectedQuestions.length} questions | Total Marks: {selectedQuestions.reduce((sum, qId) => sum + (questions.find(q => q.id === qId)?.marks || 0), 0)}</p>
                <Button onClick={saveQuestions}>Save Questions</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default OnlineExams;
