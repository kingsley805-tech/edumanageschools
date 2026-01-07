import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Plus, Download, FileUp, Eye, Check, X, AlertCircle, FileText } from "lucide-react";
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
  isValid?: boolean;
  errors?: string[];
}

interface BulkQuestionUploadProps {
  subjects: { id: string; name: string }[];
  onSuccess: () => void;
}

type ViewMode = "setup" | "manual-entry" | "import-preview" | "export-preview";

export const BulkQuestionUpload = ({ subjects, onSuccess }: BulkQuestionUploadProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("setup");
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [subjectId, setSubjectId] = useState("");
  const [questions, setQuestions] = useState<BulkQuestion[]>([]);
  const [exportQuestions, setExportQuestions] = useState<BulkQuestion[]>([]);
  const [selectedForExport, setSelectedForExport] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const createEmptyQuestion = (): BulkQuestion => ({
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
  });

  const validateQuestion = (q: BulkQuestion): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!q.question_text.trim()) {
      errors.push("Question text is required");
    }
    if (!q.correct_answer) {
      errors.push("Correct answer is required");
    }
    if (q.question_type === "multiple_choice") {
      const filledOptions = q.options.filter(o => o.text.trim());
      if (filledOptions.length < 2) {
        errors.push("At least 2 options required");
      }
      if (q.correct_answer && !q.options.find(o => o.id === q.correct_answer)?.text.trim()) {
        errors.push("Selected answer option is empty");
      }
    }
    if (q.marks < 1) {
      errors.push("Marks must be at least 1");
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const generateManualForms = () => {
    if (!subjectId) {
      toast.error("Please select a subject");
      return;
    }
    if (numberOfQuestions < 1 || numberOfQuestions > 50) {
      toast.error("Number of questions must be between 1 and 50");
      return;
    }
    
    const newQuestions = Array.from({ length: numberOfQuestions }, createEmptyQuestion);
    setQuestions(newQuestions);
    setViewMode("manual-entry");
  };

  const updateQuestion = (index: number, field: keyof BulkQuestion, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === "question_type") {
      updated[index].correct_answer = "";
      if (value === "true_false") {
        updated[index].options = [
          { id: "true", text: "True" },
          { id: "false", text: "False" },
        ];
      } else if (value === "multiple_choice") {
        updated[index].options = [
          { id: "1", text: "" },
          { id: "2", text: "" },
          { id: "3", text: "" },
          { id: "4", text: "" },
        ];
      }
    }
    
    // Re-validate
    const validation = validateQuestion(updated[index]);
    updated[index].isValid = validation.isValid;
    updated[index].errors = validation.errors;
    
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = { ...updated[qIndex].options[optIndex], text };
    
    // Re-validate
    const validation = validateQuestion(updated[qIndex]);
    updated[qIndex].isValid = validation.isValid;
    updated[qIndex].errors = validation.errors;
    
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error("Must have at least one question");
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const addQuestion = () => {
    setQuestions([...questions, createEmptyQuestion()]);
  };

  const handleSubmit = async () => {
    // Validate all questions
    const validatedQuestions = questions.map(q => {
      const validation = validateQuestion(q);
      return { ...q, ...validation };
    });
    
    const invalidCount = validatedQuestions.filter(q => !q.isValid).length;
    if (invalidCount > 0) {
      setQuestions(validatedQuestions);
      toast.error(`${invalidCount} question(s) have errors. Please fix them.`);
      return;
    }

    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user?.id)
        .single();

      const payload = questions.map(q => ({
        question_type: q.question_type,
        question_text: q.question_text,
        options: q.question_type === "multiple_choice" ? q.options : 
                 q.question_type === "true_false" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : null,
        correct_answer: q.correct_answer,
        marks: q.marks,
        difficulty: q.difficulty,
        subject_id: subjectId,
        school_id: profile?.school_id,
        created_by: user?.id,
      }));

      const { error } = await supabase.from("question_bank").insert(payload);
      
      if (error) throw error;

      toast.success(`${questions.length} questions uploaded successfully`);
      setDialogOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload questions");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNumberOfQuestions(5);
    setSubjectId("");
    setQuestions([]);
    setExportQuestions([]);
    setSelectedForExport(new Set());
    setViewMode("setup");
  };

  // ===== EXPORT FUNCTIONALITY =====
  const loadQuestionsForExport = async () => {
    if (!subjectId) {
      toast.error("Please select a subject first");
      return;
    }

    setIsLoading(true);
    try {
      const { data: bankQuestions, error } = await supabase
        .from("question_bank")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!bankQuestions || bankQuestions.length === 0) {
        toast.error("No questions found for this subject");
        return;
      }

      const mapped: BulkQuestion[] = bankQuestions.map((q) => {
        const options = q.options as { id: string; text: string }[] | null;
        return {
          question_type: q.question_type,
          question_text: q.question_text,
          options: options || [
            { id: "1", text: "" },
            { id: "2", text: "" },
            { id: "3", text: "" },
            { id: "4", text: "" },
          ],
          correct_answer: q.correct_answer,
          marks: q.marks,
          difficulty: q.difficulty || "medium",
        };
      });

      setExportQuestions(mapped);
      setSelectedForExport(new Set(mapped.map((_, i) => i)));
      setViewMode("export-preview");
    } catch (error: any) {
      toast.error(error.message || "Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExportSelection = (index: number) => {
    const newSelected = new Set(selectedForExport);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedForExport(newSelected);
  };

  const toggleAllExport = () => {
    if (selectedForExport.size === exportQuestions.length) {
      setSelectedForExport(new Set());
    } else {
      setSelectedForExport(new Set(exportQuestions.map((_, i) => i)));
    }
  };

  const downloadCSV = () => {
    if (selectedForExport.size === 0) {
      toast.error("Please select at least one question to export");
      return;
    }

    const headers = ["Question Type", "Question Text", "Option 1", "Option 2", "Option 3", "Option 4", "Correct Answer", "Marks", "Difficulty"];
    
    const rows = exportQuestions
      .filter((_, i) => selectedForExport.has(i))
      .map((q) => {
        const opt1 = q.options[0]?.text || "";
        const opt2 = q.options[1]?.text || "";
        const opt3 = q.options[2]?.text || "";
        const opt4 = q.options[3]?.text || "";
        
        // For correct_answer, convert option ID to actual text for readability
        let correctAnswerText = q.correct_answer;
        if (q.question_type === "multiple_choice") {
          const correctOpt = q.options.find(o => o.id === q.correct_answer);
          correctAnswerText = correctOpt?.text || q.correct_answer;
        }
        
        return [
          q.question_type,
          q.question_text.replace(/"/g, '""'),
          opt1.replace(/"/g, '""'),
          opt2.replace(/"/g, '""'),
          opt3.replace(/"/g, '""'),
          opt4.replace(/"/g, '""'),
          correctAnswerText.replace(/"/g, '""'),
          q.marks.toString(),
          q.difficulty,
        ];
      });

    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const subjectName = subjects.find(s => s.id === subjectId)?.name || "questions";
    link.href = URL.createObjectURL(blob);
    link.download = `${subjectName.replace(/\s+/g, "_")}_questions_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    
    toast.success(`Exported ${selectedForExport.size} questions to CSV`);
  };

  // ===== IMPORT FUNCTIONALITY =====
  const handleFileSelect = () => {
    if (!subjectId) {
      toast.error("Please select a subject first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("CSV file must have at least a header and one data row");
          return;
        }

        const dataLines = lines.slice(1);
        const importedQuestions: BulkQuestion[] = [];

        for (const line of dataLines) {
          const fields = parseCSVLine(line);
          
          if (fields.length < 9) continue;

          const [questionType, questionText, opt1, opt2, opt3, opt4, correctAnswer, marks, difficulty] = fields;

          // Determine correct_answer based on question type
          let finalCorrectAnswer = correctAnswer.trim();
          const options = [
            { id: "1", text: opt1.trim() },
            { id: "2", text: opt2.trim() },
            { id: "3", text: opt3.trim() },
            { id: "4", text: opt4.trim() },
          ];
          
          // For multiple choice, try to match the correct answer text to an option ID
          if (questionType.trim() === "multiple_choice") {
            const matchedOpt = options.find(o => o.text.toLowerCase() === finalCorrectAnswer.toLowerCase());
            if (matchedOpt) {
              finalCorrectAnswer = matchedOpt.id;
            } else if (["1", "2", "3", "4"].includes(finalCorrectAnswer)) {
              // Already an ID, keep it
            } else {
              // Try to find a partial match or default to first non-empty option
              const firstNonEmpty = options.find(o => o.text.trim());
              finalCorrectAnswer = firstNonEmpty?.id || "1";
            }
          }

          const question: BulkQuestion = {
            question_type: questionType.trim() || "multiple_choice",
            question_text: questionText.trim(),
            options,
            correct_answer: finalCorrectAnswer,
            marks: parseInt(marks.trim()) || 1,
            difficulty: difficulty.trim() || "medium",
          };

          const validation = validateQuestion(question);
          question.isValid = validation.isValid;
          question.errors = validation.errors;

          importedQuestions.push(question);
        }

        if (importedQuestions.length === 0) {
          toast.error("No valid questions found in CSV file");
          return;
        }

        setQuestions(importedQuestions);
        setViewMode("import-preview");
        toast.success(`Loaded ${importedQuestions.length} questions for preview`);
      } catch (error: any) {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
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
    fields.push(currentField);
    return fields;
  };

  const getValidCount = () => questions.filter(q => validateQuestion(q).isValid).length;
  const getInvalidCount = () => questions.filter(q => !validateQuestion(q).isValid).length;

  const getDifficultyBadge = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-500/10 text-green-600",
      medium: "bg-yellow-500/10 text-yellow-600",
      hard: "bg-red-500/10 text-red-600",
    };
    return colors[difficulty] || colors.medium;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      multiple_choice: "MCQ",
      true_false: "T/F",
      fill_blank: "Fill",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Bulk Upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {viewMode === "setup" && "Bulk Question Management"}
            {viewMode === "manual-entry" && `Enter ${questions.length} Questions`}
            {viewMode === "import-preview" && "Import Preview"}
            {viewMode === "export-preview" && "Export Preview"}
          </DialogTitle>
        </DialogHeader>
        
        {/* SETUP VIEW */}
        {viewMode === "setup" && (
          <div className="space-y-6">
            <div>
              <Label>Subject *</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="manual"><Plus className="mr-2 h-4 w-4" />Manual Entry</TabsTrigger>
                <TabsTrigger value="import"><FileUp className="mr-2 h-4 w-4" />Import CSV</TabsTrigger>
                <TabsTrigger value="export"><Download className="mr-2 h-4 w-4" />Export CSV</TabsTrigger>
              </TabsList>
              
              <TabsContent value="manual" className="space-y-4 pt-4">
                <div>
                  <Label>Number of Questions (1-50)</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="50" 
                    value={numberOfQuestions} 
                    onChange={(e) => setNumberOfQuestions(Number(e.target.value))} 
                  />
                </div>
                <Button onClick={generateManualForms} className="w-full" disabled={!subjectId}>
                  <Plus className="mr-2 h-4 w-4" /> Generate {numberOfQuestions} Question Forms
                </Button>
              </TabsContent>
              
              <TabsContent value="import" className="space-y-4 pt-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV file with your questions
                  </p>
                  <Button onClick={handleFileSelect} disabled={!subjectId}>
                    <FileUp className="mr-2 h-4 w-4" /> Select CSV File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">CSV Format:</p>
                  <code className="text-xs text-muted-foreground block">
                    Question Type, Question Text, Option 1, Option 2, Option 3, Option 4, Correct Answer, Marks, Difficulty
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Question Type: multiple_choice, true_false, or fill_blank
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="export" className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Export existing questions from your question bank to a CSV file.
                </p>
                <Button onClick={loadQuestionsForExport} className="w-full" disabled={!subjectId || isLoading}>
                  {isLoading ? "Loading..." : <><Eye className="mr-2 h-4 w-4" /> Preview Questions to Export</>}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* MANUAL ENTRY VIEW */}
        {viewMode === "manual-entry" && (
          <>
            <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-3">
              <span>Subject: <strong>{subjects.find(s => s.id === subjectId)?.name}</strong></span>
              <span className="ml-auto">
                <Badge variant="outline" className="mr-2">{questions.length} Questions</Badge>
                <Button size="sm" variant="outline" onClick={addQuestion}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </span>
            </div>
            
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-2">
                {questions.map((q, qIndex) => (
                  <div key={qIndex} className={`p-4 border rounded-lg space-y-3 ${q.isValid === false ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-sm">Q{qIndex + 1}</span>
                      <div className="flex gap-2 items-center flex-wrap">
                        <Select value={q.question_type} onValueChange={(v) => updateQuestion(qIndex, "question_type", v)}>
                          <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                            <SelectItem value="true_false">True/False</SelectItem>
                            <SelectItem value="fill_blank">Fill Blank</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={q.difficulty} onValueChange={(v) => updateQuestion(qIndex, "difficulty", v)}>
                          <SelectTrigger className="w-[90px] h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number" 
                          className="w-[60px] h-8" 
                          value={q.marks} 
                          onChange={(e) => updateQuestion(qIndex, "marks", Number(e.target.value))} 
                          min="1"
                        />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeQuestion(qIndex)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <Textarea 
                      value={q.question_text} 
                      onChange={(e) => updateQuestion(qIndex, "question_text", e.target.value)} 
                      placeholder="Enter question text"
                      rows={2}
                      className="text-sm"
                    />
                    
                    {q.question_type === "multiple_choice" && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, optIndex) => (
                          <div key={opt.id} className="flex gap-2 items-center">
                            <Input 
                              value={opt.text} 
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)} 
                              placeholder={`Option ${optIndex + 1}`}
                              className="text-sm h-8"
                            />
                            <input 
                              type="radio" 
                              name={`correct-${qIndex}`} 
                              checked={q.correct_answer === opt.id} 
                              onChange={() => updateQuestion(qIndex, "correct_answer", opt.id)}
                              className="h-4 w-4"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.question_type === "true_false" && (
                      <Select value={q.correct_answer} onValueChange={(v) => updateQuestion(qIndex, "correct_answer", v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Select correct answer" /></SelectTrigger>
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
                        className="h-8"
                      />
                    )}

                    {q.errors && q.errors.length > 0 && (
                      <div className="flex items-start gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{q.errors.join(", ")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setViewMode("setup")}>Back</Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Uploading..." : `Upload ${questions.length} Questions`}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* IMPORT PREVIEW VIEW */}
        {viewMode === "import-preview" && (
          <>
            <div className="flex items-center gap-4 text-sm border-b pb-3">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                <Check className="h-3 w-3 mr-1" /> {getValidCount()} Valid
              </Badge>
              {getInvalidCount() > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive">
                  <AlertCircle className="h-3 w-3 mr-1" /> {getInvalidCount()} Invalid
                </Badge>
              )}
              <span className="text-muted-foreground ml-auto">Subject: {subjects.find(s => s.id === subjectId)?.name}</span>
            </div>
            
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead className="w-[70px]">Type</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-[80px]">Answer</TableHead>
                    <TableHead className="w-[60px]">Marks</TableHead>
                    <TableHead className="w-[80px]">Difficulty</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q, i) => {
                    const validation = validateQuestion(q);
                    return (
                      <TableRow key={i} className={!validation.isValid ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{getTypeBadge(q.question_type)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">{q.question_text}</TableCell>
                        <TableCell className="text-xs truncate max-w-[80px]">
                          {q.question_type === "multiple_choice" 
                            ? q.options.find(o => o.id === q.correct_answer)?.text || q.correct_answer
                            : q.correct_answer}
                        </TableCell>
                        <TableCell>{q.marks}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${getDifficultyBadge(q.difficulty)}`}>{q.difficulty}</Badge>
                        </TableCell>
                        <TableCell>
                          {validation.isValid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-destructive">{validation.errors[0]}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => { setViewMode("setup"); setQuestions([]); }}>Back</Button>
              <Button variant="outline" onClick={() => setViewMode("manual-entry")}>
                <FileText className="mr-2 h-4 w-4" /> Edit Questions
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || getValidCount() === 0}>
                {isLoading ? "Uploading..." : `Import ${getValidCount()} Valid Questions`}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* EXPORT PREVIEW VIEW */}
        {viewMode === "export-preview" && (
          <>
            <div className="flex items-center gap-4 text-sm border-b pb-3">
              <Button size="sm" variant="outline" onClick={toggleAllExport}>
                {selectedForExport.size === exportQuestions.length ? "Deselect All" : "Select All"}
              </Button>
              <Badge variant="outline">
                {selectedForExport.size} of {exportQuestions.length} selected
              </Badge>
              <span className="text-muted-foreground ml-auto">Subject: {subjects.find(s => s.id === subjectId)?.name}</span>
            </div>
            
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[70px]">Type</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-[100px]">Answer</TableHead>
                    <TableHead className="w-[60px]">Marks</TableHead>
                    <TableHead className="w-[80px]">Difficulty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportQuestions.map((q, i) => (
                    <TableRow 
                      key={i} 
                      className={`cursor-pointer ${selectedForExport.has(i) ? "bg-primary/5" : ""}`}
                      onClick={() => toggleExportSelection(i)}
                    >
                      <TableCell>
                        <input 
                          type="checkbox" 
                          checked={selectedForExport.has(i)} 
                          onChange={() => toggleExportSelection(i)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{getTypeBadge(q.question_type)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">{q.question_text}</TableCell>
                      <TableCell className="text-xs truncate max-w-[100px]">
                        {q.question_type === "multiple_choice" 
                          ? q.options.find(o => o.id === q.correct_answer)?.text || q.correct_answer
                          : q.correct_answer}
                      </TableCell>
                      <TableCell>{q.marks}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getDifficultyBadge(q.difficulty)}`}>{q.difficulty}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => { setViewMode("setup"); setExportQuestions([]); }}>Back</Button>
              <Button onClick={downloadCSV} disabled={selectedForExport.size === 0}>
                <Download className="mr-2 h-4 w-4" /> Export {selectedForExport.size} Questions
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
