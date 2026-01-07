import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, MinusCircle, Clock, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ExamReviewProps {
  attemptId: string;
  examTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReviewQuestion {
  id: string;
  question_order: number;
  marks: number;
  question_bank: {
    id: string;
    question_text: string;
    question_type: string;
    options: { id: string; text: string }[] | null;
    correct_answer: string;
  };
  student_answer: string | null;
  is_correct: boolean | null;
  marks_obtained: number | null;
}

interface AttemptDetails {
  id: string;
  started_at: string;
  submitted_at: string | null;
  total_marks_obtained: number | null;
  status: string;
  online_exams: {
    title: string;
    total_marks: number;
    duration_minutes: number;
    passing_marks: number | null;
  };
}

export const ExamReview = ({ attemptId, examTitle, open, onOpenChange }: ExamReviewProps) => {
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<AttemptDetails | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (open) {
      fetchReviewData();
    }
  }, [open, attemptId]);

  const fetchReviewData = async () => {
    setLoading(true);

    // Fetch attempt details
    const { data: attemptData } = await supabase
      .from("online_exam_attempts")
      .select(`
        id, started_at, submitted_at, total_marks_obtained, status,
        online_exams(title, total_marks, duration_minutes, passing_marks)
      `)
      .eq("id", attemptId)
      .single();

    if (attemptData) {
      setAttempt(attemptData as unknown as AttemptDetails);
    }

    // Fetch questions with answers
    const { data: answersData } = await supabase
      .from("online_exam_answers")
      .select("question_id, student_answer, is_correct, marks_obtained")
      .eq("attempt_id", attemptId);

    // Fetch exam questions
    const { data: attemptForExam } = await supabase
      .from("online_exam_attempts")
      .select("online_exam_id")
      .eq("id", attemptId)
      .single();

    if (attemptForExam) {
      const { data: examQuestions } = await supabase
        .from("online_exam_questions")
        .select(`
          id, question_order, marks,
          question_bank(id, question_text, question_type, options, correct_answer)
        `)
        .eq("online_exam_id", attemptForExam.online_exam_id)
        .order("question_order");

      if (examQuestions) {
        const reviewQuestions: ReviewQuestion[] = examQuestions.map((eq: any) => {
          const answer = answersData?.find(a => a.question_id === eq.question_bank?.id);
          return {
            ...eq,
            student_answer: answer?.student_answer || null,
            is_correct: answer?.is_correct ?? null,
            marks_obtained: answer?.marks_obtained ?? null,
          };
        });
        setQuestions(reviewQuestions);
      }
    }

    setLoading(false);
  };

  const getOptionText = (options: { id: string; text: string }[] | null, answerId: string | null) => {
    if (!options || !answerId) return "Not answered";
    const option = options.find(o => o.id === answerId);
    return option?.text || answerId;
  };

  const stats = {
    correct: questions.filter(q => q.is_correct === true).length,
    wrong: questions.filter(q => q.is_correct === false).length,
    skipped: questions.filter(q => q.student_answer === null).length,
    percentage: attempt ? ((attempt.total_marks_obtained || 0) / attempt.online_exams.total_marks) * 100 : 0,
    passed: attempt ? (attempt.total_marks_obtained || 0) >= (attempt.online_exams.passing_marks || attempt.online_exams.total_marks * 0.5) : false,
  };

  const currentQuestion = questions[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Exam Review: {examTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-3">
                <div className="text-center">
                  <p className="text-2xl font-bold">{attempt?.total_marks_obtained || 0}/{attempt?.online_exams.total_marks}</p>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <p className={`text-2xl font-bold ${stats.passed ? "text-green-600" : "text-red-600"}`}>
                    {stats.percentage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{stats.passed ? "Passed" : "Failed"}</p>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-xl font-bold">{stats.correct}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">Correct</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xl font-bold">{stats.wrong}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">Wrong</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-center gap-2">
                  <MinusCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-xl font-bold">{stats.skipped}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center">Skipped</p>
              </Card>
            </div>

            {/* Question Navigation */}
            <div className="flex flex-wrap gap-2 justify-center">
              {questions.map((q, idx) => (
                <Button
                  key={q.id}
                  variant={currentIndex === idx ? "default" : "outline"}
                  size="sm"
                  className={`w-9 h-9 p-0 ${
                    q.is_correct === true ? "border-green-500 bg-green-50 dark:bg-green-900/20" :
                    q.is_correct === false ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                    "border-gray-300"
                  }`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </Button>
              ))}
            </div>

            {/* Question Display */}
            {currentQuestion && (
              <ScrollArea className="flex-1">
                <Card className="border-2">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex items-center gap-2">
                        Question {currentIndex + 1}
                        {currentQuestion.is_correct === true && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" /> Correct
                          </Badge>
                        )}
                        {currentQuestion.is_correct === false && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Wrong
                          </Badge>
                        )}
                        {currentQuestion.student_answer === null && (
                          <Badge variant="secondary">
                            <MinusCircle className="h-3 w-3 mr-1" /> Skipped
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge variant="outline">{currentQuestion.marks_obtained ?? 0}/{currentQuestion.marks} marks</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-base font-medium">{currentQuestion.question_bank.question_text}</p>

                    {currentQuestion.question_bank.question_type === "multiple_choice" && (
                      <div className="space-y-2">
                        {currentQuestion.question_bank.options?.map((opt) => {
                          const isCorrect = opt.id === currentQuestion.question_bank.correct_answer;
                          const isSelected = opt.id === currentQuestion.student_answer;
                          
                          return (
                            <div
                              key={opt.id}
                              className={`p-3 rounded-lg border-2 ${
                                isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/20" :
                                isSelected && !isCorrect ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                                "border-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                                <span>{opt.text}</span>
                                {isCorrect && <Badge className="ml-auto bg-green-600">Correct Answer</Badge>}
                                {isSelected && !isCorrect && <Badge variant="destructive" className="ml-auto">Your Answer</Badge>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentQuestion.question_bank.question_type === "true_false" && (
                      <div className="space-y-2">
                        {["true", "false"].map((opt) => {
                          const isCorrect = opt === currentQuestion.question_bank.correct_answer;
                          const isSelected = opt === currentQuestion.student_answer;
                          
                          return (
                            <div
                              key={opt}
                              className={`p-3 rounded-lg border-2 capitalize ${
                                isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/20" :
                                isSelected && !isCorrect ? "border-red-500 bg-red-50 dark:bg-red-900/20" :
                                "border-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                                {isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600" />}
                                <span>{opt}</span>
                                {isCorrect && <Badge className="ml-auto bg-green-600">Correct Answer</Badge>}
                                {isSelected && !isCorrect && <Badge variant="destructive" className="ml-auto">Your Answer</Badge>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {currentQuestion.question_bank.question_type === "fill_blank" && (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg border-2 ${
                          currentQuestion.is_correct ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-red-500 bg-red-50 dark:bg-red-900/20"
                        }`}>
                          <p className="text-sm text-muted-foreground">Your Answer:</p>
                          <p className="font-medium">{currentQuestion.student_answer || "Not answered"}</p>
                        </div>
                        <div className="p-3 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20">
                          <p className="text-sm text-muted-foreground">Correct Answer:</p>
                          <p className="font-medium">{currentQuestion.question_bank.correct_answer}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </ScrollArea>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground self-center">
                {currentIndex + 1} of {questions.length}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                disabled={currentIndex === questions.length - 1}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
