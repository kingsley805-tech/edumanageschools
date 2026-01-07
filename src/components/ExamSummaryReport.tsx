import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { FileText, Users, CheckCircle, XCircle, AlertTriangle, TrendingUp, Clock, Shield, Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { exportToExcel, exportToPDF, ExamReportData } from "@/lib/exportUtils";

interface ExamSummaryProps {
  examId: string;
  examTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AttemptData {
  id: string;
  student_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  total_marks_obtained: number | null;
  students: {
    id: string;
    profiles: { full_name: string; email: string } | null;
  } | null;
}

interface ProctoringLog {
  id: string;
  attempt_id: string;
  violation_type: string;
  description: string;
  created_at: string;
}

interface QuestionAnalytics {
  question_id: string;
  question_text: string;
  correct: number;
  wrong: number;
  skipped: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const ExamSummaryReport = ({ examId, examTitle, open, onOpenChange }: ExamSummaryProps) => {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [totalMarks, setTotalMarks] = useState(0);
  const [passingMarks, setPassingMarks] = useState(0);
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [proctoringLogs, setProctoringLogs] = useState<ProctoringLog[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "questions" | "proctoring">("overview");
  const [examDetails, setExamDetails] = useState<{ className: string; subjectName: string; examDate: string } | null>(null);

  useEffect(() => {
    if (open) {
      fetchReportData();
    }
  }, [open, examId]);

  const fetchReportData = async () => {
    setLoading(true);

    // Fetch exam details with class and subject
    const { data: exam } = await supabase
      .from("online_exams")
      .select("total_marks, passing_marks, start_time, classes(name), subjects(name)")
      .eq("id", examId)
      .single();

    if (exam) {
      setTotalMarks(exam.total_marks);
      setPassingMarks(exam.passing_marks || exam.total_marks * 0.5);
      setExamDetails({
        className: (exam.classes as any)?.name || "Unknown",
        subjectName: (exam.subjects as any)?.name || "Unknown",
        examDate: format(new Date(exam.start_time), "PPP"),
      });
    }

    // Fetch attempts with student info
    const { data: attemptsData } = await supabase
      .from("online_exam_attempts")
      .select(`
        id, student_id, status, started_at, submitted_at, total_marks_obtained,
        students(id, user_id, profiles:user_id(full_name, email))
      `)
      .eq("online_exam_id", examId);

    if (attemptsData) {
      const formattedAttempts = attemptsData.map((a: any) => ({
        ...a,
        students: a.students ? {
          id: a.students.id,
          profiles: a.students.profiles
        } : null
      }));
      setAttempts(formattedAttempts);
    }

    // Fetch question analytics
    const { data: examQuestions } = await supabase
      .from("online_exam_questions")
      .select("question_id, question_bank(id, question_text)")
      .eq("online_exam_id", examId);

    if (examQuestions && attemptsData) {
      const analytics: QuestionAnalytics[] = [];
      for (const eq of examQuestions) {
        const qb = eq.question_bank as { id: string; question_text: string } | null;
        if (!qb) continue;

        const { data: answers } = await supabase
          .from("online_exam_answers")
          .select("is_correct, student_answer")
          .eq("question_id", qb.id)
          .in("attempt_id", attemptsData.map(a => a.id));

        const correct = answers?.filter(a => a.is_correct === true).length || 0;
        const wrong = answers?.filter(a => a.is_correct === false).length || 0;
        const skipped = (attemptsData.length || 0) - correct - wrong;

        analytics.push({
          question_id: qb.id,
          question_text: qb.question_text,
          correct,
          wrong,
          skipped: Math.max(0, skipped),
        });
      }
      setQuestionAnalytics(analytics);
    }

    // Fetch proctoring logs
    if (attemptsData && attemptsData.length > 0) {
      const { data: logs } = await supabase
        .from("exam_proctoring_logs")
        .select("*")
        .in("attempt_id", attemptsData.map(a => a.id))
        .order("created_at", { ascending: false });

      if (logs) setProctoringLogs(logs);
    }

    setLoading(false);
  };

  const handleExport = async (format: "pdf" | "excel") => {
    const reportData: ExamReportData = {
      examTitle,
      className: examDetails?.className || "Unknown",
      subjectName: examDetails?.subjectName || "Unknown",
      examDate: examDetails?.examDate || "Unknown",
      totalMarks,
      passingMarks,
      stats: {
        totalStudents: attempts.length,
        attempted: attempts.filter(a => a.status === "submitted").length,
        passed: attempts.filter(a => (a.total_marks_obtained || 0) >= passingMarks).length,
        avgScore: attempts.length > 0
          ? attempts.reduce((sum, a) => sum + (a.total_marks_obtained || 0), 0) / attempts.filter(a => a.status === "submitted").length || 0
          : 0,
        highestScore: Math.max(...attempts.map(a => a.total_marks_obtained || 0), 0),
        lowestScore: attempts.filter(a => a.status === "submitted").length > 0
          ? Math.min(...attempts.filter(a => a.status === "submitted").map(a => a.total_marks_obtained || 0))
          : 0,
        passRate: attempts.filter(a => a.status === "submitted").length > 0
          ? (attempts.filter(a => (a.total_marks_obtained || 0) >= passingMarks).length /
             attempts.filter(a => a.status === "submitted").length) * 100
          : 0,
      },
      students: attempts.map(a => {
        const timeTaken = a.submitted_at && a.started_at
          ? Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 60000)
          : 0;
        const violations = proctoringLogs.filter(l => l.attempt_id === a.id).length;
        return {
          name: a.students?.profiles?.full_name || "Unknown",
          email: a.students?.profiles?.email || "",
          score: a.total_marks_obtained || 0,
          percentage: ((a.total_marks_obtained || 0) / totalMarks) * 100,
          status: (a.total_marks_obtained || 0) >= passingMarks ? "Passed" : "Failed",
          violations,
          timeTaken: timeTaken ? `${timeTaken} min` : "-",
        };
      }),
      questionAnalytics: questionAnalytics.map(q => ({
        question: q.question_text,
        correct: q.correct,
        wrong: q.wrong,
        skipped: q.skipped,
      })),
    };

    try {
      if (format === "pdf") {
        await exportToPDF(reportData);
        toast.success("PDF report downloaded");
      } else {
        exportToExcel(reportData);
        toast.success("Excel report downloaded");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export report");
    }
  };

  const stats = {
    totalStudents: attempts.length,
    submitted: attempts.filter(a => a.status === "submitted").length,
    passed: attempts.filter(a => (a.total_marks_obtained || 0) >= passingMarks).length,
    avgScore: attempts.length > 0
      ? attempts.reduce((sum, a) => sum + (a.total_marks_obtained || 0), 0) / attempts.filter(a => a.status === "submitted").length || 0
      : 0,
    highestScore: Math.max(...attempts.map(a => a.total_marks_obtained || 0), 0),
    lowestScore: attempts.filter(a => a.status === "submitted").length > 0
      ? Math.min(...attempts.filter(a => a.status === "submitted").map(a => a.total_marks_obtained || 0))
      : 0,
    passRate: attempts.filter(a => a.status === "submitted").length > 0
      ? (attempts.filter(a => (a.total_marks_obtained || 0) >= passingMarks).length /
         attempts.filter(a => a.status === "submitted").length) * 100
      : 0,
  };

  const gradeDistribution = [
    { name: "90-100%", value: attempts.filter(a => ((a.total_marks_obtained || 0) / totalMarks) * 100 >= 90).length },
    { name: "80-89%", value: attempts.filter(a => { const p = ((a.total_marks_obtained || 0) / totalMarks) * 100; return p >= 80 && p < 90; }).length },
    { name: "70-79%", value: attempts.filter(a => { const p = ((a.total_marks_obtained || 0) / totalMarks) * 100; return p >= 70 && p < 80; }).length },
    { name: "60-69%", value: attempts.filter(a => { const p = ((a.total_marks_obtained || 0) / totalMarks) * 100; return p >= 60 && p < 70; }).length },
    { name: "<60%", value: attempts.filter(a => ((a.total_marks_obtained || 0) / totalMarks) * 100 < 60).length },
  ].filter(g => g.value > 0);

  const violationSummary = proctoringLogs.reduce((acc, log) => {
    acc[log.violation_type] = (acc[log.violation_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exam Summary Report: {examTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation with Export */}
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex gap-2">
                {(["overview", "students", "questions", "proctoring"] as const).map((tab) => (
                  <Button
                    key={tab}
                    variant={activeTab === tab ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab(tab)}
                    className="capitalize"
                  >
                    {tab}
                  </Button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>
                    <FileText className="h-4 w-4 mr-2" /> Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Attempted</span>
                      </div>
                      <p className="text-2xl font-bold">{stats.submitted}/{stats.totalStudents}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-muted-foreground">Pass Rate</span>
                      </div>
                      <p className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-muted-foreground">Avg Score</span>
                      </div>
                      <p className="text-2xl font-bold">{stats.avgScore.toFixed(1)}/{totalMarks}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-orange-500" />
                        <span className="text-sm text-muted-foreground">Violations</span>
                      </div>
                      <p className="text-2xl font-bold">{proctoringLogs.length}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Grade Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={gradeDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {gradeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Score Range</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Highest Score</span>
                          <span>{stats.highestScore}/{totalMarks}</span>
                        </div>
                        <Progress value={(stats.highestScore / totalMarks) * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Average Score</span>
                          <span>{stats.avgScore.toFixed(1)}/{totalMarks}</span>
                        </div>
                        <Progress value={(stats.avgScore / totalMarks) * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Lowest Score</span>
                          <span>{stats.lowestScore}/{totalMarks}</span>
                        </div>
                        <Progress value={(stats.lowestScore / totalMarks) * 100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Students Tab */}
            {activeTab === "students" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Student Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Time Taken</TableHead>
                        <TableHead>Violations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map((attempt) => {
                        const percentage = ((attempt.total_marks_obtained || 0) / totalMarks) * 100;
                        const violations = proctoringLogs.filter(l => l.attempt_id === attempt.id).length;
                        const timeTaken = attempt.submitted_at && attempt.started_at
                          ? Math.round((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60000)
                          : null;

                        return (
                          <TableRow key={attempt.id}>
                            <TableCell>{attempt.students?.profiles?.full_name || "Unknown"}</TableCell>
                            <TableCell>
                              <Badge variant={attempt.status === "submitted" ? "default" : "secondary"}>
                                {attempt.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{attempt.total_marks_obtained ?? "-"}/{totalMarks}</TableCell>
                            <TableCell>
                              <span className={percentage >= 50 ? "text-green-600" : "text-red-600"}>
                                {percentage.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>{timeTaken ? `${timeTaken} min` : "-"}</TableCell>
                            <TableCell>
                              {violations > 0 ? (
                                <Badge variant="destructive">{violations}</Badge>
                              ) : (
                                <Badge variant="outline">0</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Questions Tab */}
            {activeTab === "questions" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Question Performance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {questionAnalytics.map((q, idx) => (
                      <div key={q.question_id} className="border rounded-lg p-4">
                        <p className="text-sm font-medium mb-2">
                          Q{idx + 1}: {q.question_text.substring(0, 100)}...
                        </p>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Correct: {q.correct}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">Wrong: {q.wrong}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">Skipped: {q.skipped}</span>
                          </div>
                        </div>
                        <Progress
                          value={attempts.length > 0 ? (q.correct / attempts.length) * 100 : 0}
                          className="h-2 mt-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Proctoring Tab */}
            {activeTab === "proctoring" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Violation Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(violationSummary).map(([type, count]) => (
                        <Badge key={type} variant="outline" className="px-3 py-1">
                          {type.replace("_", " ")}: {count}
                        </Badge>
                      ))}
                      {Object.keys(violationSummary).length === 0 && (
                        <p className="text-muted-foreground">No violations recorded</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Violation Log</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {proctoringLogs.slice(0, 20).map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "PPp")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="capitalize">
                                {log.violation_type.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.description}</TableCell>
                          </TableRow>
                        ))}
                        {proctoringLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No proctoring violations recorded
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
