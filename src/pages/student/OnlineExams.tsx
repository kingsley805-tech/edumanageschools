import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, FileText, CheckCircle, AlertCircle, Shield, Monitor, Eye, AlertTriangle, Camera, UserX, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { useExamProctoring } from "@/hooks/useExamProctoring";
import { ExamReview } from "@/components/ExamReview";
import { WebcamPreview } from "@/components/WebcamPreview";

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  total_marks: number;
  show_result_immediately: boolean;
  shuffle_questions: boolean | null;
  shuffle_answers: boolean | null;
  proctoring_enabled: boolean | null;
  fullscreen_required: boolean | null;
  tab_switch_limit: number | null;
  webcam_required: boolean | null;
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
  shuffledOptions?: { id: string; text: string }[]; // Store shuffled options to maintain consistency
  isFlagged?: boolean; // Track if question is flagged
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
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeExtension, setTimeExtension] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ obtained: number; total: number; grade?: string | null } | null>(null);
  const [showProctoringWarning, setShowProctoringWarning] = useState(false);
  const [pendingExam, setPendingExam] = useState<OnlineExam | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewExamTitle, setReviewExamTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use ref to ensure stable callback that always has latest state
  const submitExamRef = useRef<() => Promise<void>>();
  submitExamRef.current = async () => {
    await submitExam();
  };

  const submitExamCallback = useCallback(() => {
    submitExamRef.current?.();
  }, []);

  const { isFullscreen, tabSwitchCount, violations, webcamStream, setVideoElement, snapshotCount, faceDetectionStatus, lastFaceCount } = useExamProctoring({
    enabled: takingExam?.proctoring_enabled ?? false,
    fullscreenRequired: takingExam?.fullscreen_required ?? true,
    tabSwitchLimit: takingExam?.tab_switch_limit ?? 3,
    webcamRequired: takingExam?.webcam_required ?? false,
    attemptId,
    studentId,
    userId: user?.id ?? null,
    snapshotIntervalSeconds: 30,
    faceDetectionEnabled: takingExam?.webcam_required ?? false,
    onAutoSubmit: submitExamCallback,
  });

  useEffect(() => {
    fetchExams();
  }, [user]);

  // Timer countdown
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

  // Poll for time extensions every 30 seconds
  useEffect(() => {
    if (!attemptId || !takingExam) return;
    
    const checkExtensions = async () => {
      const { data: extensions } = await supabase
        .from("exam_time_extensions")
        .select("extension_minutes")
        .eq("attempt_id", attemptId);
      
      const totalExtension = extensions?.reduce((sum, ext) => sum + ext.extension_minutes, 0) || 0;
      
      if (totalExtension > timeExtension) {
        const additionalTime = totalExtension - timeExtension;
        setTimeExtension(totalExtension);
        setTimeLeft(prev => prev + (additionalTime * 60));
        toast.success(`Time extended by ${additionalTime} minute${additionalTime > 1 ? 's' : ''}!`);
      }
    };

    const extensionPoller = setInterval(checkExtensions, 30000); // Check every 30 seconds
    return () => clearInterval(extensionPoller);
  }, [attemptId, takingExam, timeExtension]);

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

  const handleStartExam = (exam: OnlineExam) => {
    if (exam.proctoring_enabled) {
      setPendingExam(exam);
      setShowProctoringWarning(true);
    } else {
      startExam(exam);
    }
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const startExam = async (exam: OnlineExam) => {
    setShowProctoringWarning(false);
    setPendingExam(null);

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

    // Shuffle questions if enabled
    let orderedQuestions = examQuestions as ExamQuestion[];
    if (exam.shuffle_questions) {
      orderedQuestions = [...orderedQuestions].sort(() => Math.random() - 0.5);
    }

    // Shuffle options for each question if enabled and store them
    orderedQuestions = orderedQuestions.map(q => ({
      ...q,
      shuffledOptions: q.question_bank.options && exam.shuffle_answers 
        ? shuffleArray([...q.question_bank.options])
        : q.question_bank.options || []
    }));

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

    // Check for any existing time extensions
    const { data: extensions } = await supabase
      .from("exam_time_extensions")
      .select("extension_minutes")
      .eq("attempt_id", attempt.id);
    
    const totalExtension = extensions?.reduce((sum, ext) => sum + ext.extension_minutes, 0) || 0;

    setAttemptId(attempt.id);
    setQuestions(orderedQuestions);
    setTakingExam(exam);
    setCurrentQuestion(0);
    setAnswers({});
    setFlaggedQuestions({});
    setTimeExtension(totalExtension);
    setTimeLeft((exam.duration_minutes + totalExtension) * 60);
    setIsSubmitting(false);
  };

  const submitExam = async () => {
    if (!attemptId || !takingExam || !studentId || isSubmitting) return;
    setIsSubmitting(true);

    // Save all answers
    const answerInserts = Object.entries(answers).map(([questionId, answer]) => {
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

    // Calculate percentage and get grade from school's grade scale
    const percentage = (totalObtained / takingExam.total_marks) * 100;
    
    // Get grade scale for the school
    const { data: student } = await supabase
      .from("students")
      .select("school_id")
      .eq("id", studentId)
      .single();

    let grade = null;
    if (student?.school_id) {
      const { data: gradeScales } = await supabase
        .from("grade_scales")
        .select("grade, min_score, max_score")
        .eq("school_id", student.school_id)
        .order("min_score", { ascending: false });

      if (gradeScales) {
        const matchingScale = gradeScales.find(
          gs => percentage >= gs.min_score && percentage <= gs.max_score
        );
        grade = matchingScale?.grade || null;
      }
    }

    await supabase
      .from("online_exam_attempts")
      .update({ 
        status: "submitted", 
        submitted_at: new Date().toISOString(), 
        total_marks_obtained: totalObtained 
      })
      .eq("id", attemptId);

    if (takingExam.show_result_immediately) {
      setResult({ obtained: totalObtained, total: takingExam.total_marks, grade });
      setShowResult(true);
    } else {
      toast.success("Exam submitted successfully");
    }

    setTakingExam(null);
    setIsSubmitting(false);
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

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  if (takingExam) {
    const q = questions[currentQuestion];
    const qb = q?.question_bank;
    const currentQuestionId = qb?.id;

    return (
      <DashboardLayout role="student" hideSidebar={true}>
        <div className="space-y-6 max-w-4xl mx-auto" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
          {/* Webcam Preview */}
          {takingExam.webcam_required && webcamStream && (
            <WebcamPreview stream={webcamStream} onVideoRef={setVideoElement} />
          )}

          {/* Proctoring Status Bar */}
          {takingExam.proctoring_enabled && (
            <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-900/20">
              <Shield className="h-4 w-4 text-orange-600" />
              <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 text-orange-800 dark:text-orange-200">
                  <span>Proctoring Active</span>
                  <span className="text-sm">| Tab Switches: {tabSwitchCount}/{takingExam.tab_switch_limit}</span>
                  {!isFullscreen && takingExam.fullscreen_required && (
                    <span className="text-red-600">| ⚠️ Fullscreen Required</span>
                  )}
                  {takingExam.webcam_required && (
                    <span className="flex items-center gap-1">
                      | <Camera className="h-3 w-3" /> 
                      {faceDetectionStatus === "ok" ? (
                        <span className="text-green-600">Face OK</span>
                      ) : faceDetectionStatus === "no_face" ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <UserX className="h-3 w-3" /> No Face
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <Users className="h-3 w-3" /> {lastFaceCount} Faces
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {violations.length > 0 && (
                  <Badge variant="destructive">{violations.length} violations</Badge>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">{takingExam.title}</h2>
              <p className="text-sm text-muted-foreground">Subject: {takingExam.subjects?.name}</p>
            </div>
            <div className="flex items-center gap-2 text-lg font-mono">
              <Clock className="h-5 w-5" />
              <span className={timeLeft < 300 ? "text-destructive font-semibold" : ""}>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Question Navigation */}
          <div className="flex flex-wrap gap-2 mb-4">
            {questions.map((_, index) => (
              <Button
                key={index}
                variant={currentQuestion === index ? "default" : "outline"}
                size="sm"
                className={`w-10 h-10 p-0 rounded-full relative ${
                  answers[questions[index]?.question_bank.id] ? "bg-green-100 dark:bg-green-900" : ""
                }`}
                onClick={() => setCurrentQuestion(index)}
              >
                {index + 1}
                {flaggedQuestions[questions[index]?.question_bank.id] && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
                )}
              </Button>
            ))}
          </div>

          <Progress value={((currentQuestion + 1) / questions.length) * 100} />

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span>Question {currentQuestion + 1} of {questions.length}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => currentQuestionId && toggleFlagQuestion(currentQuestionId)}
                    className="p-1 h-6 w-6"
                    title={flaggedQuestions[currentQuestionId] ? "Unflag this question" : "Flag for review"}
                  >
                    {flaggedQuestions[currentQuestionId] ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
                        <path d="M5 2h14l-3.5 7 3.5 7h-4.5v6l-1 1-1-1v-6h-4l3.5-7-3.5-7h4.5v6l1-1 1 1v-6z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 2h14l-3.5 7 3.5 7h-4.5v6l-1 1-1-1v-6h-4l3.5-7-3.5-7h4.5v6l1-1 1 1v-6z"></path>
                      </svg>
                    )}
                  </Button>
                </div>
                <Badge variant={flaggedQuestions[currentQuestionId] ? "secondary" : "default"}>
                  {q?.marks} mark{q?.marks !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg mb-6" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>{qb?.question_text}</p>

              {qb?.question_type === "multiple_choice" && (
                <RadioGroup
                  value={answers[qb.id] || ""}
                  onValueChange={(v) => setAnswers({ ...answers, [qb.id]: v })}
                >
                  {(q.shuffledOptions || qb.options || []).map((opt) => (
                    <div 
                      key={opt.id} 
                      className={`flex items-center space-x-2 p-4 border rounded-lg transition-colors ${
                        answers[qb.id] === opt.id 
                          ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                          : 'hover:bg-muted/50'
                      }`} 
                      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                    >
                      <RadioGroupItem 
                        value={opt.id} 
                        id={`${qb.id}-${opt.id}`} 
                        className="h-5 w-5"
                      />
                      <Label 
                        htmlFor={`${qb.id}-${opt.id}`} 
                        className="flex-1 cursor-pointer text-base" 
                        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}
                      >
                        {opt.text}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {qb?.question_type === "true_false" && (
                <RadioGroup
                  value={answers[qb.id] || ""}
                  onValueChange={(v) => setAnswers({ ...answers, [qb.id]: v })}
                >
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
                    <RadioGroupItem value="true" id="true" />
                    <Label htmlFor="true" className="flex-1 cursor-pointer" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>True</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
                    <RadioGroupItem value="false" id="false" />
                    <Label htmlFor="false" className="flex-1 cursor-pointer" style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>False</Label>
                  </div>
                </RadioGroup>
              )}

              {qb?.question_type === "fill_blank" && (
                <Input
                  value={answers[qb.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [qb.id]: e.target.value })}
                  placeholder="Type your answer here"
                  style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', msUserSelect: 'text' }}
                />
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-6 border-t">
              <div className="flex justify-between items-center w-full">
                <div className="flex-1">
                  {currentQuestion > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentQuestion(currentQuestion - 1)}
                      className="min-w-[100px]"
                    >
                      ← Previous
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => currentQuestionId && toggleFlagQuestion(currentQuestionId)}
                    className="gap-2"
                  >
                    {flaggedQuestions[currentQuestionId] ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
                          <path d="M5 2h14l-3.5 7 3.5 7h-4.5v6l-1 1-1-1v-6h-4l3.5-7-3.5-7h4.5v6l1-1 1 1v-6z"></path>
                        </svg>
                        Flagged
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 2h14l-3.5 7 3.5 7h-4.5v6l-1 1-1-1v-6h-4l3.5-7-3.5-7h4.5v6l1-1 1 1v-6z"></path>
                        </svg>
                        Flag for Review
                      </>
                    )}
                  </Button>
                  
                  {currentQuestion < questions.length - 1 && (
                    <Button 
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      className="min-w-[100px]"
                    >
                      Next →
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Always visible submit button */}
              <Button 
                onClick={submitExam}
                variant="destructive"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Exam"}
              </Button>
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
                  {exam.proctoring_enabled && (
                    <div className="flex items-center gap-2 text-sm text-orange-600">
                      <Shield className="h-4 w-4" />
                      <span>Proctored Exam</span>
                    </div>
                  )}
                  <p className="text-sm">Start: {format(new Date(exam.start_time), "PPp")}</p>
                  {exam.attempt?.status === "submitted" && exam.attempt.total_marks_obtained !== null && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Score: {exam.attempt.total_marks_obtained}/{exam.total_marks}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  {status.canTake && !exam.attempt && (
                    <Button className="flex-1" onClick={() => handleStartExam(exam)}>Start Exam</Button>
                  )}
                  {exam.attempt?.status === "submitted" && (
                    <>
                      <Button variant="outline" className="flex-1" onClick={() => {
                        setReviewAttemptId(exam.attempt!.id);
                        setReviewExamTitle(exam.title);
                        setShowReview(true);
                      }}>
                        <Eye className="h-4 w-4 mr-2" /> Review
                      </Button>
                    </>
                  )}
                  {!status.canTake && !exam.attempt && (
                    <Button variant="outline" className="flex-1" disabled>{status.label}</Button>
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
              {result?.grade && (
                <p className="text-3xl font-bold mt-4 text-primary">Grade: {result.grade}</p>
              )}
              <p className="text-lg mt-4">
                {result && result.obtained / result.total >= 0.5 ? "Congratulations! You passed!" : "Keep studying!"}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Proctoring Warning Dialog */}
        <Dialog open={showProctoringWarning} onOpenChange={setShowProctoringWarning}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-500" />
                Proctored Exam Notice
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This exam has proctoring enabled to ensure academic integrity.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 text-sm">
                <p className="font-medium">The following rules apply:</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {pendingExam?.fullscreen_required && (
                    <li className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" /> Fullscreen mode is required
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Tab switching is limited to {pendingExam?.tab_switch_limit || 3} times
                  </li>
                  <li>Right-click and copy/paste are disabled</li>
                  <li>All violations will be recorded and reported</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowProctoringWarning(false)}>
                  Cancel
                </Button>
                <Button onClick={() => pendingExam && startExam(pendingExam)}>
                  I Understand, Start Exam
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Exam Review Dialog */}
        {reviewAttemptId && (
          <ExamReview
            attemptId={reviewAttemptId}
            examTitle={reviewExamTitle}
            open={showReview}
            onOpenChange={setShowReview}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentOnlineExams;
