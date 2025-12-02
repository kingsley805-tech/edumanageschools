import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  total_marks: number;
  show_result_immediately: boolean;
  subjects?: { name: string };
  attempt?: { id: string; status: string; total_marks_obtained: number | null };
}

interface ExamQuestion {
  id: string;
  question_order: number;
  marks: number;
  question_bank: {
    id: string;
    question_text: string;
    question_type: string;
    options: { id: string; text: string }[] | null;
  };
}

const StudentOnlineExams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [takingExam, setTakingExam] = useState<OnlineExam | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ obtained: number; total: number } | null>(null);

  useEffect(() => {
    fetchExams();
  }, [user]);

  useEffect(() => {
    if (takingExam && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [takingExam, timeLeft]);

  const fetchExams = async () => {
    const { data: student } = await supabase
      .from("students")
      .select("id, class_id")
      .eq("user_id", user?.id)
      .single();

    if (!student) {
      setLoading(false);
      return;
    }

    setStudentId(student.id);

    const { data: examsData } = await supabase
      .from("online_exams")
      .select("*, subjects(name)")
      .eq("class_id", student.class_id)
      .order("start_time", { ascending: false });

    if (examsData) {
      const examsWithAttempts = await Promise.all(
        examsData.map(async (exam) => {
          const { data: attempt } = await supabase
            .from("online_exam_attempts")
            .select("id, status, total_marks_obtained")
            .eq("online_exam_id", exam.id)
            .eq("student_id", student.id)
            .maybeSingle();
          return { ...exam, attempt: attempt || undefined };
        })
      );
      setExams(examsWithAttempts as OnlineExam[]);
    }
    setLoading(false);
  };

  const startExam = async (exam: OnlineExam) => {
    const { data: examQuestions, error: questionsError } = await supabase
      .from("online_exam_questions")
      .select("id, question_order, marks, question_bank(id, question_text, question_type, options)")
      .eq("online_exam_id", exam.id)
      .order("question_order");

    if (questionsError) {
      console.error("Error fetching exam questions:", questionsError);
      return toast.error("Failed to load exam questions. Please try again.");
    }

    if (!examQuestions || examQuestions.length === 0) {
      return toast.error("No questions available for this exam");
    }

    // Create attempt
    const { data: attempt, error } = await supabase
      .from("online_exam_attempts")
      .insert({
        online_exam_id: exam.id,
        student_id: studentId,
        status: "in_progress",
      })
      .select()
      .single();

    if (error) return toast.error("Failed to start exam");

    setAttemptId(attempt.id);
    setQuestions(examQuestions as ExamQuestion[]);
    setTakingExam(exam);
    setCurrentQuestion(0);
    setAnswers({});
    setTimeLeft(exam.duration_minutes * 60);
  };

  const submitExam = async () => {
    if (!attemptId || !takingExam) return;

    // Save all answers
    const answerInserts = Object.entries(answers).map(([questionId, answer]) => {
      const question = questions.find(q => q.question_bank.id === questionId);
      return {
        attempt_id: attemptId,
        question_id: questionId,
        student_answer: answer,
      };
    });

    await supabase.from("online_exam_answers").insert(answerInserts);

    // Calculate score
    const { data: savedAnswers } = await supabase
      .from("online_exam_answers")
      .select("question_id, student_answer")
      .eq("attempt_id", attemptId);

    let totalObtained = 0;

    for (const ans of savedAnswers || []) {
      const { data: question } = await supabase
        .from("question_bank")
        .select("correct_answer")
        .eq("id", ans.question_id)
        .single();

      const examQ = questions.find(q => q.question_bank.id === ans.question_id);
      const isCorrect = question?.correct_answer === ans.student_answer;

      if (isCorrect) {
        totalObtained += examQ?.marks || 0;
      }

      await supabase
        .from("online_exam_answers")
        .update({ is_correct: isCorrect, marks_obtained: isCorrect ? (examQ?.marks || 0) : 0 })
        .eq("attempt_id", attemptId)
        .eq("question_id", ans.question_id);
    }

    await supabase
      .from("online_exam_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), total_marks_obtained: totalObtained })
      .eq("id", attemptId);

    if (takingExam.show_result_immediately) {
      setResult({ obtained: totalObtained, total: takingExam.total_marks });
      setShowResult(true);
    } else {
      toast.success("Exam submitted successfully");
    }

    setTakingExam(null);
    fetchExams();
  };

  const getExamStatus = (exam: OnlineExam) => {
    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(exam.end_time);

    if (exam.attempt?.status === "submitted") return { label: "Completed", variant: "secondary" as const, canTake: false };
    if (now < start) return { label: "Upcoming", variant: "outline" as const, canTake: false };
    if (now >= start && now <= end) return { label: "Available", variant: "default" as const, canTake: true };
    return { label: "Expired", variant: "destructive" as const, canTake: false };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (takingExam) {
    const q = questions[currentQuestion];
    const qb = q?.question_bank;

    return (
      <DashboardLayout role="student">
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{takingExam.title}</h2>
            <div className="flex items-center gap-2 text-lg font-mono">
              <Clock className="h-5 w-5" />
              <span className={timeLeft < 60 ? "text-destructive" : ""}>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <Progress value={((currentQuestion + 1) / questions.length) * 100} />

          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>Question {currentQuestion + 1} of {questions.length}</span>
                <Badge>{q?.marks} marks</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg mb-6">{qb?.question_text}</p>

              {qb?.question_type === "multiple_choice" && (
                <RadioGroup
                  value={answers[qb.id] || ""}
                  onValueChange={(v) => setAnswers({ ...answers, [qb.id]: v })}
                >
                  {qb.options?.map((opt) => (
                    <div key={opt.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted">
                      <RadioGroupItem value={opt.id} id={opt.id} />
                      <Label htmlFor={opt.id} className="flex-1 cursor-pointer">{opt.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {qb?.question_type === "true_false" && (
                <RadioGroup
                  value={answers[qb.id] || ""}
                  onValueChange={(v) => setAnswers({ ...answers, [qb.id]: v })}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted">
                    <RadioGroupItem value="true" id="true" />
                    <Label htmlFor="true" className="flex-1 cursor-pointer">True</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted">
                    <RadioGroupItem value="false" id="false" />
                    <Label htmlFor="false" className="flex-1 cursor-pointer">False</Label>
                  </div>
                </RadioGroup>
              )}

              {qb?.question_type === "fill_blank" && (
                <Input
                  value={answers[qb.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [qb.id]: e.target.value })}
                  placeholder="Type your answer here"
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(currentQuestion - 1)}>
                Previous
              </Button>
              {currentQuestion < questions.length - 1 ? (
                <Button onClick={() => setCurrentQuestion(currentQuestion + 1)}>Next</Button>
              ) : (
                <Button onClick={submitExam}>Submit Exam</Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Online Exams</h2>
          <p className="text-muted-foreground">Take your scheduled online examinations</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => {
            const status = getExamStatus(exam);
            return (
              <Card key={exam.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{exam.title}</CardTitle>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <CardDescription>{exam.subjects?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{exam.duration_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{exam.total_marks} marks</span>
                  </div>
                  <p className="text-sm">Start: {format(new Date(exam.start_time), "PPp")}</p>
                  {exam.attempt?.status === "submitted" && exam.attempt.total_marks_obtained !== null && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Score: {exam.attempt.total_marks_obtained}/{exam.total_marks}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {status.canTake && !exam.attempt && (
                    <Button className="w-full" onClick={() => startExam(exam)}>Start Exam</Button>
                  )}
                  {exam.attempt?.status === "submitted" && (
                    <Button variant="outline" className="w-full" disabled>Completed</Button>
                  )}
                  {!status.canTake && !exam.attempt && (
                    <Button variant="outline" className="w-full" disabled>{status.label}</Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
          {exams.length === 0 && !loading && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No online exams available</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exam Result</DialogTitle>
            </DialogHeader>
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-2xl font-bold">{result?.obtained} / {result?.total}</p>
              <p className="text-muted-foreground">marks obtained</p>
              <p className="text-lg mt-4">
                {result && result.obtained / result.total >= 0.5 ? "Congratulations! You passed!" : "Keep studying!"}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StudentOnlineExams;
