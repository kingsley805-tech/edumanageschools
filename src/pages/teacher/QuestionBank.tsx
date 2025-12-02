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
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Question {
  id: string;
  question_type: string;
  question_text: string;
  options: unknown;
  correct_answer: string;
  marks: number;
  difficulty: string;
  subject_id: string;
  subjects?: { name: string };
}

interface Subject {
  id: string;
  name: string;
}

const QuestionBank = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [formData, setFormData] = useState<{
    question_type: string;
    question_text: string;
    options: { id: string; text: string }[];
    correct_answer: string;
    marks: number;
    difficulty: string;
    subject_id: string;
  }>({
    question_type: "multiple_choice",
    question_text: "",
    options: [{ id: "1", text: "" }, { id: "2", text: "" }, { id: "3", text: "" }, { id: "4", text: "" }],
    correct_answer: "",
    marks: 1,
    difficulty: "medium",
    subject_id: "",
  });

  useEffect(() => {
    fetchData();
  }, [filterSubject, filterType]);

  const fetchData = async () => {
    const { data: subjectsData } = await supabase.from("subjects").select("id, name");
    if (subjectsData) setSubjects(subjectsData);

    let query = supabase.from("question_bank").select("*, subjects(name)");
    if (filterSubject !== "all") query = query.eq("subject_id", filterSubject);
    if (filterType !== "all") query = query.eq("question_type", filterType);
    
    const { data } = await query.order("created_at", { ascending: false });
    if (data) setQuestions(data as Question[]);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: profile } = await supabase.from("profiles").select("school_id").eq("id", user?.id).single();

    const payload = {
      question_type: formData.question_type,
      question_text: formData.question_text,
      options: formData.question_type === "multiple_choice" ? formData.options : null,
      correct_answer: formData.correct_answer,
      marks: formData.marks,
      difficulty: formData.difficulty,
      subject_id: formData.subject_id,
      school_id: profile?.school_id,
      created_by: user?.id,
    };

    if (editingQuestion) {
      const { error } = await supabase.from("question_bank").update(payload).eq("id", editingQuestion.id);
      if (error) return toast.error("Failed to update question");
      toast.success("Question updated");
    } else {
      const { error } = await supabase.from("question_bank").insert(payload);
      if (error) return toast.error("Failed to create question");
      toast.success("Question added to bank");
    }
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setDialogOpen(false);
    setEditingQuestion(null);
    setFormData({
      question_type: "multiple_choice",
      question_text: "",
      options: [{ id: "1", text: "" }, { id: "2", text: "" }, { id: "3", text: "" }, { id: "4", text: "" }],
      correct_answer: "",
      marks: 1,
      difficulty: "medium",
      subject_id: "",
    });
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    const opts = Array.isArray(question.options) 
      ? question.options as { id: string; text: string }[]
      : [{ id: "1", text: "" }, { id: "2", text: "" }, { id: "3", text: "" }, { id: "4", text: "" }];
    setFormData({
      question_type: question.question_type,
      question_text: question.question_text,
      options: opts,
      correct_answer: question.correct_answer,
      marks: question.marks,
      difficulty: question.difficulty,
      subject_id: question.subject_id,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) return toast.error("Failed to delete question");
    toast.success("Question deleted");
    fetchData();
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], text };
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Question Bank</h2>
            <p className="text-muted-foreground">Create and manage questions for online exams</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Question</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? "Edit" : "Add"} Question</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subject</Label>
                    <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Question Type</Label>
                    <Select value={formData.question_type} onValueChange={(v) => setFormData({ ...formData, question_type: v, correct_answer: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Question Text</Label>
                  <Textarea value={formData.question_text} onChange={(e) => setFormData({ ...formData, question_text: e.target.value })} required />
                </div>

                {formData.question_type === "multiple_choice" && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    {formData.options.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <Input value={opt.text} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                        <input type="radio" name="correct" checked={formData.correct_answer === opt.id} onChange={() => setFormData({ ...formData, correct_answer: opt.id })} />
                      </div>
                    ))}
                    <p className="text-sm text-muted-foreground">Select the correct answer</p>
                  </div>
                )}

                {formData.question_type === "true_false" && (
                  <div>
                    <Label>Correct Answer</Label>
                    <Select value={formData.correct_answer} onValueChange={(v) => setFormData({ ...formData, correct_answer: v })}>
                      <SelectTrigger><SelectValue placeholder="Select answer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.question_type === "fill_blank" && (
                  <div>
                    <Label>Correct Answer</Label>
                    <Input value={formData.correct_answer} onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })} placeholder="Enter the correct answer" required />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marks</Label>
                    <Input type="number" min="1" value={formData.marks} onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Difficulty</Label>
                    <Select value={formData.difficulty} onValueChange={(v) => setFormData({ ...formData, difficulty: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" className="w-full">{editingQuestion ? "Update" : "Add"} Question</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True/False</SelectItem>
              <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Questions ({questions.length})</CardTitle>
            <CardDescription>Manage your question bank</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-xs truncate">{q.question_text}</TableCell>
                    <TableCell>{q.subjects?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{q.question_type.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{q.difficulty}</TableCell>
                    <TableCell>{q.marks}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(q)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {questions.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No questions found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default QuestionBank;
