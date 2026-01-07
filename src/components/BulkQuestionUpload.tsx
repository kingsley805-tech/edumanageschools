import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Plus, Trash2, Download, FileUp } from "lucide-react";
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

  const exportToCSV = async () => {
    if (!subjectId) {
      toast.error("Please select a subject first");
      return;
    }

    // Fetch questions from the question bank for the selected subject
    const { data: bankQuestions, error } = await supabase
      .from("question_bank")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("created_by", user?.id);

    if (error) {
      toast.error("Failed to fetch questions");
      return;
    }

    if (!bankQuestions || bankQuestions.length === 0) {
      toast.error("No questions found for this subject");
      return;
    }

    // Create CSV header
    const headers = ["Question Type", "Question Text", "Option 1", "Option 2", "Option 3", "Option 4", "Correct Answer", "Marks", "Difficulty"];
    
    // Convert questions to CSV rows
    const rows = bankQuestions.map((q) => {
      const options = q.options as { id: string; text: string }[] | null;
      const option1 = options && options[0] ? options[0].text : "";
      const option2 = options && options[1] ? options[1].text : "";
      const option3 = options && options[2] ? options[2].text : "";
      const option4 = options && options[3] ? options[3].text : "";
      
      return [
        q.question_type,
        q.question_text.replace(/"/g, '""'), // Escape quotes
        option1.replace(/"/g, '""'),
        option2.replace(/"/g, '""'),
        option3.replace(/"/g, '""'),
        option4.replace(/"/g, '""'),
        q.correct_answer,
        q.marks.toString(),
        q.difficulty,
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `questions_${subjectId}_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Questions exported to CSV successfully");
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!subjectId) {
      toast.error("Please select a subject first");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("CSV file must have at least a header and one data row");
          return;
        }

        // Skip header row
        const dataLines = lines.slice(1);
        const importedQuestions: BulkQuestion[] = [];

        for (const line of dataLines) {
          // Parse CSV line (handling quoted fields)
          const fields: string[] = [];
          let currentField = "";
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                currentField += '"';
                i++; // Skip next quote
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              fields.push(currentField);
              currentField = "";
            } else {
              currentField += char;
            }
          }
          fields.push(currentField); // Add last field

          if (fields.length < 9) {
            toast.error(`Invalid CSV format. Expected 9 columns, got ${fields.length}`);
            continue;
          }

          const [questionType, questionText, opt1, opt2, opt3, opt4, correctAnswer, marks, difficulty] = fields;

          const question: BulkQuestion = {
            question_type: questionType.trim(),
            question_text: questionText.trim(),
            options: [
              { id: "1", text: opt1.trim() },
              { id: "2", text: opt2.trim() },
              { id: "3", text: opt3.trim() },
              { id: "4", text: opt4.trim() },
            ],
            correct_answer: correctAnswer.trim(),
            marks: parseInt(marks.trim()) || 1,
            difficulty: difficulty.trim() || "medium",
          };

          importedQuestions.push(question);
        }

        if (importedQuestions.length === 0) {
          toast.error("No valid questions found in CSV file");
          return;
        }

        setQuestions(importedQuestions);
        setGeneratedForms(true);
        toast.success(`Imported ${importedQuestions.length} questions from CSV`);
      } catch (error: any) {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    };

    reader.readAsText(file);
    // Reset input
    event.target.value = "";
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
            <div className="flex gap-2">
              <Button onClick={generateForms} className="flex-1">Generate Question Forms</Button>
              <Button variant="outline" onClick={exportToCSV} disabled={!subjectId}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="csv-import"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="csv-import" className="cursor-pointer">
                    <FileUp className="mr-2 h-4 w-4" /> Import CSV
                  </label>
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              CSV Format: Question Type, Question Text, Option 1, Option 2, Option 3, Option 4, Correct Answer, Marks, Difficulty
            </p>
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
