import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Users, Calendar, ClipboardCheck, BookOpen, 
  AlertTriangle, GraduationCap, CheckCircle, Clock, Send, 
  MessageSquare, Plus, FileText, ChevronRight, Calculator, Check, AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ClassDetails {
  id: string;
  name: string;
  level: string;
  school_id: string;
  class_teacher_id: string | null;
  subject: {
    id: string;
    name: string;
  };
}

interface Student {
  id: string;
  admission_no: string;
  user: {
    full_name: string;
    email: string;
  };
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  description: string;
}

const ClassDetails = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Class Teacher states
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Recommendations form states
  const [recStudentId, setRecStudentId] = useState("");
  const [recType, setRecType] = useState<"study_plan" | "extra_classes" | "assignment" | "intervention" | "general">("general");
  const [recStrengths, setRecStrengths] = useState("");
  const [recWeaknesses, setRecWeaknesses] = useState("");
  const [recSuggestions, setRecSuggestions] = useState("");
  const [recAlert, setRecAlert] = useState(false);
  const [submittingRec, setSubmittingRec] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    fetchClassDetails();
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      // 1. Get auth user and resolve teacher record
      const { data: { user } } = await supabase.auth.getUser();
      let currentTeacherId: string | null = null;
      if (user) {
        const { data: teacher } = await supabase
          .from("teachers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (teacher) {
          currentTeacherId = teacher.id;
          setTeacherId(teacher.id);
        }
      }

      // 2. Fetch class data
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, level, school_id, class_teacher_id")
        .eq("id", classId)
        .single();

      if (!classData) return;

      const { data: classSubjects } = await supabase
        .from("class_subjects")
        .select("subject:subjects(id, name)")
        .eq("class_id", classId);

      setClassDetails({
        ...classData,
        subject: classSubjects?.[0]?.subject || { id: "", name: "N/A" }
      });

      const isCt = currentTeacherId !== null && classData.class_teacher_id === currentTeacherId;
      setIsClassTeacher(isCt);

      // 3. Fetch enrolled students
      const { data: studentsData } = await supabase
        .from("students")
        .select(`
          id,
          admission_no,
          gender,
          profiles!inner(full_name, email)
        `)
        .eq("class_id", classId)
        .order("admission_no");

      const mappedStudents = (studentsData || []).map(s => ({
        id: s.id,
        admission_no: s.admission_no,
        user: {
          full_name: (s.profiles as any)?.full_name || "Unknown",
          email: (s.profiles as any)?.email || ""
        }
      }));
      setStudents(mappedStudents);

      // 4. Fetch schedules
      const { data: schedulesData } = await supabase
        .from("schedules")
        .select("id, day_of_week, start_time, end_time, room")
        .eq("class_id", classId)
        .order("day_of_week");

      setSchedules(schedulesData || []);

      // 5. Fetch assignments
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, due_date, description")
        .eq("class_id", classId)
        .order("due_date", { ascending: false })
        .limit(5);

      setAssignments(assignmentsData || []);

      // 6. Fetch extra Class Teacher parameters if teacher is the homeroom advisor
      if (isCt) {
        const { data: termsData } = await supabase
          .from("terms")
          .select("id, name, is_current")
          .eq("school_id", classData.school_id)
          .order("is_current", { ascending: false });

        setTerms(termsData || []);
        
        if (termsData && termsData.length > 0) {
          const currentTerm = termsData.find(t => t.is_current) || termsData[0];
          setSelectedTermId(currentTerm.id);
        }

        const { data: classSubjectsData } = await supabase
          .from("class_subjects")
          .select("subject:subjects(id, name)")
          .eq("class_id", classId);
        
        const extractedSubjects = (classSubjectsData || [])
          .map((cs: any) => cs.subject)
          .filter(Boolean);
        setSubjects(extractedSubjects);

        const { data: attData } = await supabase
          .from("attendance")
          .select("student_id, status")
          .eq("class_id", classId);
        setAttendanceRecords(attData || []);
      }
    } catch (error) {
      console.error("Error fetching class details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch term-specific information (Report Cards, results, recommendations)
  const fetchTermSpecificData = async () => {
    if (!classId || !selectedTermId) return;
    setLoadingExtra(true);
    try {
      const studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return;

      // Report cards
      const { data: reports } = await supabase
        .from("term_report_cards")
        .select("id, student_id, status, total_score, class_position")
        .eq("class_id", classId)
        .eq("term_id", selectedTermId);
      setReportCards(reports || []);

      // Student results for term
      const { data: resultsData } = await supabase
        .from("results")
        .select(`
          student_id,
          subject_id,
          ca_score,
          exam_score,
          position,
          grade,
          remark,
          subjects(id, name)
        `)
        .eq("term_id", selectedTermId)
        .in("student_id", studentIds);
      setResults(resultsData || []);

      // Academic recommendations
      const { data: recs } = await supabase
        .from("academic_recommendations")
        .select(`
          id,
          student_id,
          term_id,
          recommendation_type,
          suggestions,
          strengths,
          weaknesses,
          threshold_alert,
          created_at
        `)
        .eq("term_id", selectedTermId)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });
      setRecommendations(recs || []);
    } catch (err) {
      console.error("Error loading term specific data:", err);
    } finally {
      setLoadingExtra(false);
    }
  };

  // Re-run whenever selectedTermId or students list changes
  useEffect(() => {
    if (isClassTeacher && selectedTermId && students.length > 0) {
      fetchTermSpecificData();
    }
  }, [isClassTeacher, selectedTermId, students]);

  // Attendance rate helpers
  const getAttendanceRate = (studentId: string) => {
    const studentRecords = attendanceRecords.filter(r => r.student_id === studentId);
    if (studentRecords.length === 0) return 100;
    const attended = studentRecords.filter(r => 
      r.status === "present" || r.status === "late" || r.status === "excused"
    ).length;
    return Math.round((attended / studentRecords.length) * 100);
  };

  const getAverageClassAttendance = () => {
    if (attendanceRecords.length === 0) return 100;
    const attended = attendanceRecords.filter(r => 
      r.status === "present" || r.status === "late" || r.status === "excused"
    ).length;
    return Math.round((attended / attendanceRecords.length) * 100);
  };

  // Performance helpers
  const subjectAverages = subjects.map(subject => {
    const subjectResults = results.filter(r => r.subject_id === subject.id);
    const total = subjectResults.reduce((sum, r) => sum + (Number(r.ca_score || 0) + Number(r.exam_score || 0)), 0);
    const count = subjectResults.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return {
      id: subject.id,
      name: subject.name,
      average: avg,
      count
    };
  }).sort((a, b) => b.average - a.average);

  const studentAverages = students.map(student => {
    const studentResults = results.filter(r => r.student_id === student.id);
    const total = studentResults.reduce((sum, r) => sum + (Number(r.ca_score || 0) + Number(r.exam_score || 0)), 0);
    const count = studentResults.length;
    const avg = count > 0 ? Math.round(total / count) : 0;
    return {
      id: student.id,
      name: student.user.full_name,
      average: avg,
      subjectCount: count
    };
  });

  const excellingStudents = studentAverages
    .filter(s => s.subjectCount > 0 && s.average >= 80)
    .sort((a, b) => b.average - a.average);

  const strugglingStudents = studentAverages
    .filter(s => s.subjectCount > 0 && s.average < 50)
    .sort((a, b) => a.average - b.average);

  // Handlers
  const handleRecalculateRankings = async () => {
    if (!classId || !selectedTermId) return;
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc("recalculate_class_rankings", {
        p_class_id: classId,
        p_term_id: selectedTermId
      });

      if (error) throw error;

      const summary = data as {
        subjectUpdates: number;
        classPositions: number;
        reportCardsUpdated: number;
        reportCardsCreated: number;
        eligibleStudents: number;
      };

      toast.success(
        `Rankings Recalculated! Updated ${summary.classPositions} class positions, created ${summary.reportCardsCreated} new report cards, and updated ${summary.reportCardsUpdated} report cards.`
      );
      
      fetchTermSpecificData();
    } catch (err: any) {
      console.error("Error recalculating rankings:", err);
      toast.error(err.message || "Failed to recalculate rankings.");
    } finally {
      setRecalculating(false);
    }
  };

  const handleSubmitRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recStudentId || !recSuggestions) {
      toast.error("Please select a student and enter suggestions.");
      return;
    }
    setSubmittingRec(true);
    try {
      const { error } = await supabase
        .from("academic_recommendations")
        .insert({
          school_id: classDetails?.school_id,
          student_id: recStudentId,
          teacher_id: teacherId,
          term_id: selectedTermId,
          recommendation_type: recType,
          suggestions: recSuggestions,
          strengths: recStrengths || null,
          weaknesses: recWeaknesses || null,
          threshold_alert: recAlert
        });

      if (error) throw error;

      toast.success("Academic recommendation submitted successfully!");
      // Reset form
      setRecStudentId("");
      setRecType("general");
      setRecStrengths("");
      setRecWeaknesses("");
      setRecSuggestions("");
      setRecAlert(false);
      setDialogOpen(false);
      
      fetchTermSpecificData();
    } catch (err: any) {
      console.error("Error submitting recommendation:", err);
      toast.error(err.message || "Failed to submit recommendation.");
    } finally {
      setSubmittingRec(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!classDetails) {
    return (
      <DashboardLayout role="teacher">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Class not found</p>
          <Button onClick={() => navigate("/teacher/classes")} className="mt-4">
            Back to Classes
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="mingo-content space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/teacher/classes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">{classDetails.name}</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              {classDetails.level} • {classDetails.subject.name}
              {isClassTeacher && " • Homeroom Advisor"}
            </p>
          </div>
        </div>

        {/* Advisor Dashboard Indicator and Term Selector */}
        {isClassTeacher && (
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-primary flex items-center gap-2">
                🏆 Class Advisor/Teacher Dashboard Active
              </p>
              <p className="text-sm text-muted-foreground">
                You have homeroom access for roster monitoring, attendance averages, report cards management, and academic recommendations.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-sm font-medium text-muted-foreground shrink-0">Selected Term:</span>
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.is_current ? "(Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!isClassTeacher ? (
          // Original UI for normal subject teachers
          <>
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{students.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Class Sessions</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{schedules.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Recent Assignments</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assignments.length}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Student Roster
                  </CardTitle>
                  <CardDescription>Students enrolled in this class</CardDescription>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No students enrolled yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admission No.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.admission_no || "N/A"}</TableCell>
                            <TableCell>{student.user.full_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{student.user.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Class Schedule
                  </CardTitle>
                  <CardDescription>Weekly class timings</CardDescription>
                </CardHeader>
                <CardContent>
                  {schedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No schedule set yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {schedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium">{daysOfWeek[schedule.day_of_week]}</p>
                            <p className="text-sm text-muted-foreground">Room {schedule.room}</p>
                          </div>
                          <Badge variant="outline">
                            {schedule.start_time} - {schedule.end_time}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Recent Assignments
                </CardTitle>
                <CardDescription>Latest assignments for this class</CardDescription>
              </CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No assignments created yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-start justify-between p-4 rounded-lg border">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">{assignment.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {assignment.description || "No description"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="ml-4">
                          Due {new Date(assignment.due_date).toLocaleDateString()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          // Premium Advisor tabs
          <Tabs defaultValue="roster" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="roster" className="rounded-lg gap-2">
                <Users className="h-4 w-4" /> Roster & Schedule
              </TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-lg gap-2">
                <Clock className="h-4 w-4" /> Attendance Trends
              </TabsTrigger>
              <TabsTrigger value="reports" className="rounded-lg gap-2">
                <FileText className="h-4 w-4" /> Report Cards & Ranks
              </TabsTrigger>
              <TabsTrigger value="performance" className="rounded-lg gap-2">
                <GraduationCap className="h-4 w-4" /> Performance Analysis
              </TabsTrigger>
              <TabsTrigger value="communications" className="rounded-lg gap-2">
                <MessageSquare className="h-4 w-4" /> Communications Log
              </TabsTrigger>
            </TabsList>

            {/* TAB: Roster & Schedule */}
            <TabsContent value="roster" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Homeroom Student Roster
                    </CardTitle>
                    <CardDescription>Monitored students in this class and their current term attendance rate.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {students.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No students enrolled yet
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Admission No.</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Attendance Rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student) => {
                            const attRate = getAttendanceRate(student.id);
                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.admission_no || "N/A"}</TableCell>
                                <TableCell>{student.user.full_name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{student.user.email}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={attRate < 80 ? "destructive" : "secondary"}>
                                    {attRate}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Weekly Schedule
                      </CardTitle>
                      <CardDescription>Timetable slots for this class</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {schedules.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No schedules set.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {schedules.map((schedule) => (
                            <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-all">
                              <div>
                                <p className="font-medium text-sm">{daysOfWeek[schedule.day_of_week]}</p>
                                <p className="text-xs text-muted-foreground">Room {schedule.room}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {schedule.start_time} - {schedule.end_time}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Attendance Trends */}
            <TabsContent value="attendance" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-4">
                <Card className="bg-primary/5 border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Class Attendance Average</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{getAverageClassAttendance()}%</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-600">Poor Attendance Warning</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">
                      {students.filter(s => getAttendanceRate(s.id) < 80).length} students
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Attendance Record Summary</CardTitle>
                    <CardDescription>Track overall attendance rates and identify students with attendance issues (&lt; 80%).</CardDescription>
                  </div>
                  <Button onClick={() => navigate("/teacher/attendance")} className="gap-2">
                    <Calendar className="h-4 w-4" /> Take Attendance
                  </Button>
                </CardHeader>
                <CardContent>
                  {students.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students in class.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Admission No.</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Attendance Rate</TableHead>
                          <TableHead>Status / Warning</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => {
                          const attRate = getAttendanceRate(student.id);
                          const records = attendanceRecords.filter(r => r.student_id === student.id);
                          const present = records.filter(r => r.status === "present").length;
                          const absent = records.filter(r => r.status === "absent").length;
                          const late = records.filter(r => r.status === "late").length;
                          const excused = records.filter(r => r.status === "excused").length;

                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.admission_no || "—"}</TableCell>
                              <TableCell className="font-semibold">{student.user.full_name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-base">{attRate}%</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({present} Present, {absent} Absent, {late} Late, {excused} Excused)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {attRate < 80 ? (
                                  <Badge variant="destructive" className="animate-pulse flex items-center gap-1 w-fit">
                                    <AlertTriangle className="h-3 w-3" /> Under 80% (Action Required)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                                    Good Standing
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Report Cards & Positions */}
            <TabsContent value="reports" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>Class Report Cards & Rankings</CardTitle>
                      <CardDescription>Review all class report card drafting status, total scores, and positions.</CardDescription>
                    </div>
                    <Button onClick={handleRecalculateRankings} disabled={recalculating} className="gap-2">
                      <Calculator className="h-4 w-4" />
                      {recalculating ? "Recalculating..." : "Recalculate Class Rankings"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingExtra ? (
                    <div className="py-8 space-y-4">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : students.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students in class.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Draft Status</TableHead>
                          <TableHead>Total Aggregate Score</TableHead>
                          <TableHead>Class Position</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => {
                          const report = reportCards.find(r => r.student_id === student.id);
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-semibold">{student.user.full_name}</TableCell>
                              <TableCell>
                                {report ? (
                                  <Badge variant={
                                    report.status === "published" ? "default" :
                                    report.status === "approved" ? "secondary" :
                                    report.status === "rejected" ? "destructive" : "outline"
                                  }>
                                    {report.status.toUpperCase()}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground bg-muted/20 border-dashed">
                                    No Report Card Draft
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {report?.total_score != null ? `${report.total_score}` : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-bold border-primary text-primary bg-primary/5 px-2 py-0.5">
                                  {report?.class_position || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => navigate(`/teacher/report-cards?classId=${classId}&studentId=${student.id}`)}
                                  className="gap-1 text-primary hover:text-primary hover:bg-primary/5"
                                >
                                  Edit Report <ChevronRight className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Performance Analysis */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Subject Performance Averages */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      Subject Performance Averages
                    </CardTitle>
                    <CardDescription>Overall average scores for each subject taught in this class</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {loadingExtra ? (
                        <div className="space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ) : subjectAverages.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No grades or assessments available for this term.</p>
                      ) : (
                        subjectAverages.map((sub, idx) => (
                          <div key={sub.id} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{idx + 1}. {sub.name}</span>
                              <span className={`font-bold ${sub.average >= 75 ? "text-green-600" : sub.average < 50 ? "text-destructive" : "text-amber-600"}`}>{sub.average}%</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${sub.average >= 75 ? "bg-green-500" : sub.average < 50 ? "bg-red-500" : "bg-amber-500"}`}
                                style={{ width: `${sub.average}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Excelling and Struggling Lists & Recommendation Submission */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-green-600 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Excelling Students (Average &ge; 80%)
                      </CardTitle>
                      <CardDescription>Students performing exceptionally well across subjects</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingExtra ? (
                        <Skeleton className="h-10 w-full" />
                      ) : excellingStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No students currently averaging 80% or above.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {excellingStudents.map(s => (
                            <Badge key={s.id} variant="secondary" className="px-3 py-1 bg-green-50 text-green-700 border-green-200">
                              {s.name} ({s.average}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-red-600 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Struggling Students (Average &lt; 50%)
                      </CardTitle>
                      <CardDescription>Students who need academic intervention or study support</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingExtra ? (
                        <Skeleton className="h-10 w-full" />
                      ) : strugglingStudents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">No students currently averaging below 50%.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {strugglingStudents.map(s => (
                            <Badge key={s.id} variant="outline" className="px-3 py-1 bg-red-50 text-red-700 border-red-200 animate-pulse">
                              {s.name} ({s.average}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Submission Form Dialog */}
                  <div className="flex justify-end pt-2">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 w-full md:w-auto shadow-md">
                          <Plus className="h-4 w-4" /> Submit Intervention Recommendation
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmitRecommendation}>
                          <DialogHeader>
                            <DialogTitle>Submit Academic Recommendation</DialogTitle>
                            <DialogDescription>
                              Send study plans, interventions, or suggestions directly to parents.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="student">Select Student</Label>
                              <Select value={recStudentId} onValueChange={setRecStudentId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose student" />
                                </SelectTrigger>
                                <SelectContent>
                                  {students.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.user.full_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="type">Recommendation Type</Label>
                              <Select value={recType} onValueChange={(v: any) => setRecType(v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="study_plan">Study Plan</SelectItem>
                                  <SelectItem value="extra_classes">Extra Classes</SelectItem>
                                  <SelectItem value="assignment">Assignment</SelectItem>
                                  <SelectItem value="intervention">Intervention</SelectItem>
                                  <SelectItem value="general">General</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="strengths">Strengths (Optional)</Label>
                                <Input 
                                  id="strengths" 
                                  value={recStrengths} 
                                  onChange={(e) => setRecStrengths(e.target.value)} 
                                  placeholder="e.g. Excellent math skills"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="weaknesses">Weaknesses (Optional)</Label>
                                <Input 
                                  id="weaknesses" 
                                  value={recWeaknesses} 
                                  onChange={(e) => setRecWeaknesses(e.target.value)} 
                                  placeholder="e.g. Needs focus in essay writing"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="suggestions">Suggestions / Interventions</Label>
                              <Textarea 
                                id="suggestions" 
                                value={recSuggestions} 
                                onChange={(e) => setRecSuggestions(e.target.value)} 
                                placeholder="Write detailed recommendations or study schedule..."
                                rows={4}
                              />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <Checkbox 
                                id="alert" 
                                checked={recAlert} 
                                onCheckedChange={(checked) => setRecAlert(!!checked)}
                              />
                              <Label htmlFor="alert" className="text-sm font-medium cursor-pointer text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-4 w-4 animate-bounce" /> Mark as URGENT Alert (Threshold Alert)
                              </Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={submittingRec}>
                              {submittingRec ? "Submitting..." : "Send to Parents"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB: Communications Log */}
            <TabsContent value="communications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sent Academic Recommendations</CardTitle>
                  <CardDescription>Log of suggestions and academic intervention study plans sent to parents this term.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingExtra ? (
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl p-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="font-semibold text-lg text-foreground">No suggestions sent yet</p>
                      <p className="text-sm">Submit academic recommendations under the Performance Analysis tab.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Suggestions</TableHead>
                          <TableHead>Strengths</TableHead>
                          <TableHead>Weaknesses</TableHead>
                          <TableHead>Alert Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recommendations.map((rec) => {
                          const student = students.find(s => s.id === rec.student_id);
                          return (
                            <TableRow key={rec.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(rec.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {student?.user.full_name || "Unknown Student"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {rec.recommendation_type.replace("_", " ").toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate font-medium">{rec.suggestions}</TableCell>
                              <TableCell className="max-w-xs truncate text-muted-foreground">{rec.strengths || "—"}</TableCell>
                              <TableCell className="max-w-xs truncate text-muted-foreground">{rec.weaknesses || "—"}</TableCell>
                              <TableCell>
                                {rec.threshold_alert ? (
                                  <Badge variant="destructive" className="flex items-center gap-1 w-fit animate-pulse">
                                    <AlertTriangle className="h-3 w-3" /> URGENT ALERT
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">NORMAL</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClassDetails;
