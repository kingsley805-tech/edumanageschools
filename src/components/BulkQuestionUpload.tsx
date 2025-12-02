import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BulkQuestion {
  question_type: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_answer: string;
  marks: number;
  difficulty: string;
}

interface BulkQuestionUploadProps {
  subjects: { id: string; name: string }[];
  onSuccess: () => void;
}

export const BulkQuestionUpload = ({ subjects, onSuccess }: BulkQuestionUploadProps) => {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [subjectId, setSubjectId] = useState("");
  const [questions, setQuestions] = useState<BulkQuestion[]>([]);
  const [generatedForms, setGeneratedForms] = useState(false);

  const generateForms = () => {
    if (!subjectId) {
      toast.error("Please select a subject");
      return;
    }
    if (numberOfQuestions < 1 || numberOfQuestions > 50) {
      toast.error("Number of questions must be between 1 and 50");
      return;
    }
    
    const newQuestions: BulkQuestion[] = Array.from({ length: numberOfQuestions }, () => ({
      question_type: "multiple_choice",
      question_text: "",
      options: [
        { id: "1", text: "" },
        { id: "2", text: "" },
        { id: "3", text: "" },
        { id: "4", text: "" },
      ],
      correct_answer: "",
      marks: 1,
      difficulty: "medium",
    }));
    setQuestions(newQuestions);
    setGeneratedForms(true);
  };

  const updateQuestion = (index: number, field: keyof BulkQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    
    // Reset correct_answer when question type changes
    if (field === "question_type") {
      updated[index].correct_answer = "";
    }
    
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = { ...updated[qIndex].options[optIndex], text };
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    // Validate all questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return;
      }
      if (!q.correct_answer) {
        toast.error(`Question ${i + 1} needs a correct answer`);
        return;
      }
      if (q.question_type === "multiple_choice") {
        const filledOptions = q.options.filter(o => o.text.trim());
        if (filledOptions.length < 2) {
          toast.error(`Question ${i + 1} needs at least 2 options`);
          return;
        }
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user?.id)
      .single();

    const payload = questions.map(q => ({
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.question_type === "multiple_choice" ? q.options : null,
      correct_answer: q.correct_answer,
      marks: q.marks,
      difficulty: q.difficulty,
      subject_id: subjectId,
      school_id: profile?.school_id,
      created_by: user?.id,
    }));

    const { error } = await supabase.from("question_bank").insert(payload);
    
    if (error) {
      toast.error("Failed to upload questions");
      return;
    }

    toast.success(`${questions.length} questions uploaded successfully`);
    setDialogOpen(false);
    resetForm();
    onSuccess();
  };

  const resetForm = () => {
    setNumberOfQuestions(5);
    setSubjectId("");
    setQuestions([]);
    setGeneratedForms(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Bulk Upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Questions</DialogTitle>
        </DialogHeader>
        
        {!generatedForms ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Number of Questions</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={numberOfQuestions} 
                  onChange={(e) => setNumberOfQuestions(Number(e.target.value))} 
                />
              </div>
            </div>
            <Button onClick={generateForms} className="w-full">Generate Question Forms</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Fill in {questions.length} questions for <strong>{subjects.find(s => s.id === subjectId)?.name}</strong>
            </div>
            
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Question {qIndex + 1}</h4>
                  <div className="flex gap-2 items-center">
                    <Select value={q.question_type} onValueChange={(v) => updateQuestion(qIndex, "question_type", v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="true_false">True/False</SelectItem>
                        <SelectItem value="fill_blank">Fill Blank</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={q.difficulty} onValueChange={(v) => updateQuestion(qIndex, "difficulty", v)}>
                      <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number" 
                      className="w-[70px]" 
                      value={q.marks} 
                      onChange={(e) => updateQuestion(qIndex, "marks", Number(e.target.value))} 
                      min="1"
                      placeholder="Marks"
                    />
                  </div>
                </div>
                
                <Textarea 
                  value={q.question_text} 
                  onChange={(e) => updateQuestion(qIndex, "question_text", e.target.value)} 
                  placeholder="Enter question text"
                  rows={2}
                />
                
                {q.question_type === "multiple_choice" && (
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, optIndex) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <Input 
                          value={opt.text} 
                          onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} 
                          placeholder={`Option ${optIndex + 1}`} 
                        />
                        <input 
                          type="radio" 
                          name={`correct-${qIndex}`} 
                          checked={q.correct_answer === opt.id} 
                          onChange={() => updateQuestion(qIndex, "correct_answer", opt.id)} 
                        />
                      </div>
                    ))}
                  </div>
                )}

                {q.question_type === "true_false" && (
                  <Select value={q.correct_answer} onValueChange={(v) => updateQuestion(qIndex, "correct_answer", v)}>
                    <SelectTrigger><SelectValue placeholder="Select correct answer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {q.question_type === "fill_blank" && (
                  <Input 
                    value={q.correct_answer} 
                    onChange={(e) => updateQuestion(qIndex, "correct_answer", e.target.value)} 
                    placeholder="Enter correct answer"
                  />
                )}
              </div>
            ))}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setGeneratedForms(false)} className="flex-1">Back</Button>
              <Button onClick={handleSubmit} className="flex-1">Upload All Questions</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
