import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, Calculator } from "lucide-react";

interface Student {
  id: string;
  user_id: string;
  profiles: { full_name: string };
}

interface GradeScale {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  grade_point: number | null;
}

interface ExamResult {
  student_id: string;
  marks_obtained: number | null;
  exam: {
    title: string;
    total_marks: number;
    exam_type_id: string | null;
  };
}

interface OnlineExamResult {
  student_id: string;
  total_marks_obtained: number | null;
  online_exam: {
    title: string;
    total_marks: number;
  };
}

const Grades = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>("Term 1");
  const [students, setStudents] = useState<Student[]>([]);
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([]);
  const [manualGrades, setManualGrades] = useState<Record<string, number>>({});
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [onlineExamResults, setOnlineExamResults] = useState<OnlineExamResult[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user) return;
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (teacherData) {
        const { data } = await supabase
          .from("class_subjects")
          .select("classes(id, name), subjects(id, name)")
          .eq("teacher_id", teacherData.id);

        const uniqueClasses = Array.from(
          new Map(data?.map(item => [item.classes?.id, item.classes]) || []).values()
        ).filter(Boolean);
        setClasses(uniqueClasses);

        const uniqueSubjects = Array.from(
          new Map(data?.map(item => [item.subjects?.id, item.subjects]) || []).values()
        ).filter(Boolean);
        setSubjects(uniqueSubjects);
      }
    };
    fetchClasses();
  }, [user]);

  useEffect(() => {
    const fetchGradeScales = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();

      if (profile?.school_id) {
        const { data } = await supabase
          .from("grade_scales")
          .select("*")
          .eq("school_id", profile.school_id)
          .order("min_score", { ascending: false });

        setGradeScales(data || []);
      }
    };
    fetchGradeScales();
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedClass || !selectedSubject) return;

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, user_id, profiles(full_name)")
        .eq("class_id", selectedClass);

      setStudents((studentsData as any) || []);
      const studentIds = (studentsData || []).map(s => s.id);

      if (studentIds.length === 0) return;

      const { data: gradesData } = await supabase
        .from("grades")
        .select("*")
        .eq("subject_id", selectedSubject)
        .eq("term", selectedTerm)
        .in("student_id", studentIds);

      const gradesMap: Record<string, number> = {};
      (gradesData || []).forEach(g => {
        if (g.score !== null) gradesMap[g.student_id] = g.score;
      });
      setManualGrades(gradesMap);

      const { data: examsData } = await supabase
        .from("exams")
        .select("id")
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .eq("term", selectedTerm);

      if (examsData && examsData.length > 0) {
        const examIds = examsData.map(e => e.id);
        const { data: resultsData } = await supabase
          .from("exam_results")
          .select("student_id, marks_obtained, exam:exams(title, total_marks, exam_type_id)")
          .in("exam_id", examIds)
          .in("student_id", studentIds);

        setExamResults((resultsData as any) || []);
      } else {
        setExamResults([]);
      }

      const { data: onlineExamsData } = await supabase
        .from("online_exams")
        .select("id")
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .eq("term", selectedTerm);

      if (onlineExamsData && onlineExamsData.length > 0) {
        const onlineExamIds = onlineExamsData.map(e => e.id);
        const { data: onlineResultsData } = await supabase
          .from("online_exam_attempts")
          .select("student_id, total_marks_obtained, online_exam:online_exams(title, total_marks)")
          .in("online_exam_id", onlineExamIds)
          .in("student_id", studentIds)
          .eq("status", "submitted");

        setOnlineExamResults((onlineResultsData as any) || []);
      } else {
        setOnlineExamResults([]);
      }
    };

    fetchData();
  }, [selectedClass, selectedSubject, selectedTerm]);

  const getLetterGrade = (score: number): string => {
    if (gradeScales.length === 0) {
      if (score >= 90) return 'A';
      if (score >= 80) return 'B';
      if (score >= 70) return 'C';
      if (score >= 60) return 'D';
      return 'F';
    }
    
    const scale = gradeScales.find(s => score >= s.min_score && score <= s.max_score);
    return scale?.grade || 'F';
  };

  const handleGradeChange = (studentId: string, value: string) => {
    const score = value === "" ? 0 : Math.min(100, Math.max(0, Number(value)));
    setManualGrades(prev => ({ ...prev, [studentId]: score }));
  };

  const saveGrades = async () => {
    if (!selectedClass || !selectedSubject) return;
    setSaving(true);

    try {
      for (const student of students) {
        const score = manualGrades[student.id] ?? 0;
        
        const { error } = await supabase
          .from("grades")
          .upsert({
            student_id: student.id,
            subject_id: selectedSubject,
            term: selectedTerm,
            score: score,
          }, {
            onConflict: 'student_id,subject_id,term'
          });

        if (error) throw error;
      }

      toast.success("Grades saved successfully");
    } catch (error) {
      toast.error("Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const calculateFinalGrade = (studentId: string): number => {
    let totalScore = 0;
    let totalWeight = 0;

    const manualGrade = manualGrades[studentId];
    if (manualGrade !== undefined) {
      totalScore += manualGrade * 0.4;
      totalWeight += 0.4;
    }

    const studentExamResults = examResults.filter(r => r.student_id === studentId);
    if (studentExamResults.length > 0) {
      const examAvg = studentExamResults.reduce((sum, r) => {
        const percentage = ((r.marks_obtained || 0) / r.exam.total_marks) * 100;
        return sum + percentage;
      }, 0) / studentExamResults.length;
      totalScore += examAvg * 0.3;
      totalWeight += 0.3;
    }

    const studentOnlineResults = onlineExamResults.filter(r => r.student_id === studentId);
    if (studentOnlineResults.length > 0) {
      const onlineAvg = studentOnlineResults.reduce((sum, r) => {
        const percentage = ((r.total_marks_obtained || 0) / r.online_exam.total_marks) * 100;
        return sum + percentage;
      }, 0) / studentOnlineResults.length;
      totalScore += onlineAvg * 0.3;
      totalWeight += 0.3;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Grade Management</h2>
          <p className="text-muted-foreground">Enter and manage student grades for your subjects</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Class & Subject</CardTitle>
            <CardDescription>Choose a class and subject to manage grades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClass || ""} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Select value={selectedSubject || ""} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subj: any) => (
                      <SelectItem key={subj.id} value={subj.id}>{subj.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Term</label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedClass && selectedSubject && (
          <Tabs defaultValue="manual" className="space-y-4">
            <TabsList>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="overview">Grade Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Manual Grade Entry</CardTitle>
                    <CardDescription>Enter grades for paper-based assessments</CardDescription>
                  </div>
                  <Button onClick={saveGrades} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save Grades"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="w-32">Score (0-100)</TableHead>
                        <TableHead>Letter Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No students in this class
                          </TableCell>
                        </TableRow>
                      ) : (
                        students.map((student) => {
                          const score = manualGrades[student.id] ?? 0;
                          const letterGrade = getLetterGrade(score);
                          
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.profiles?.full_name || 'Unknown'}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={manualGrades[student.id] ?? ""}
                                  onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                  placeholder="0"
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  letterGrade === 'A' ? 'default' :
                                  letterGrade === 'B' ? 'secondary' :
                                  letterGrade === 'C' ? 'outline' : 'destructive'
                                }>
                                  {letterGrade}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Grade Overview
                  </CardTitle>
                  <CardDescription>
                    Combined grades from manual entry, paper exams, and online exams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead className="text-center">Manual Grade</TableHead>
                        <TableHead className="text-center">Paper Exams</TableHead>
                        <TableHead className="text-center">Online Exams</TableHead>
                        <TableHead className="text-center">Final Grade</TableHead>
                        <TableHead className="text-center">Letter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No students in this class
                          </TableCell>
                        </TableRow>
                      ) : (
                        students.map((student) => {
                          const manual = manualGrades[student.id] ?? 0;
                          
                          const studentExamResults = examResults.filter(r => r.student_id === student.id);
                          const examAvg = studentExamResults.length > 0
                            ? Math.round(studentExamResults.reduce((sum, r) => {
                                return sum + ((r.marks_obtained || 0) / r.exam.total_marks) * 100;
                              }, 0) / studentExamResults.length)
                            : null;

                          const studentOnlineResults = onlineExamResults.filter(r => r.student_id === student.id);
                          const onlineAvg = studentOnlineResults.length > 0
                            ? Math.round(studentOnlineResults.reduce((sum, r) => {
                                return sum + ((r.total_marks_obtained || 0) / r.online_exam.total_marks) * 100;
                              }, 0) / studentOnlineResults.length)
                            : null;

                          const finalGrade = calculateFinalGrade(student.id);
                          const letterGrade = getLetterGrade(finalGrade);
                          
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.profiles?.full_name || 'Unknown'}</TableCell>
                              <TableCell className="text-center">{manual}%</TableCell>
                              <TableCell className="text-center">
                                {examAvg !== null ? `${examAvg}%` : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell className="text-center">
                                {onlineAvg !== null ? `${onlineAvg}%` : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell className="text-center font-semibold">{finalGrade}%</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={
                                  letterGrade === 'A' ? 'default' :
                                  letterGrade === 'B' ? 'secondary' :
                                  letterGrade === 'C' ? 'outline' : 'destructive'
                                }>
                                  {letterGrade}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  {gradeScales.length > 0 && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Grade Scale:</p>
                      <div className="flex flex-wrap gap-2">
                        {gradeScales.map((scale) => (
                          <Badge key={scale.id} variant="outline">
                            {scale.grade}: {scale.min_score}-{scale.max_score}%
                          </Badge>
                        ))}
                      </div>
                    </div>
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

export default Grades;
