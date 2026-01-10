import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReportCard } from "@/components/ReportCard";

const ReportCards = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("1");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    // Get current user's school_id for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) {
      setStudents([]);
      return;
    }

    const { data, error } = await supabase
      .from("students")
      .select("id, admission_no, user_id, class_id")
      .eq("school_id", profileData.school_id);

    if (error) {
      toast({ title: "Error fetching students", variant: "destructive" });
      return;
    }

    if (!data) {
      setStudents([]);
      return;
    }

    // Fetch profiles and classes separately
    const studentsWithDetails = await Promise.all(
      data.map(async (student) => {
        const [profileRes, classRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", student.user_id).single(),
          supabase.from("classes").select("name").eq("id", student.class_id).single()
        ]);

        return {
          ...student,
          profiles: profileRes.data,
          classes: classRes.data
        };
      })
    );

    setStudents(studentsWithDetails);
  };

  const generateReport = async () => {
    if (!selectedStudent) return;

    setLoading(true);

    try {
      // Fetch grades with subjects separately
      const { data: gradesData, error: gradesError } = await supabase
        .from("grades")
        .select("score, subject_id")
        .eq("student_id", selectedStudent)
        .eq("term", selectedTerm);

      if (gradesError) throw gradesError;

      const gradesWithSubjects = await Promise.all(
        (gradesData || []).map(async (grade) => {
          const { data: subject } = await supabase
            .from("subjects")
            .select("name")
            .eq("id", grade.subject_id)
            .single();
          return { ...grade, subjects: subject };
        })
      );

      // Fetch exam results with exams and subjects separately
      const { data: examData, error: examError } = await supabase
        .from("exam_results")
        .select("marks_obtained, grade, remarks, exam_id")
        .eq("student_id", selectedStudent);

      if (examError) throw examError;

      const examsWithDetails = await Promise.all(
        (examData || []).map(async (exam) => {
          const { data: examDetails } = await supabase
            .from("exams")
            .select("total_marks, term, subject_id")
            .eq("id", exam.exam_id)
            .single();

          if (examDetails) {
            const { data: subject } = await supabase
              .from("subjects")
              .select("name")
              .eq("id", examDetails.subject_id)
              .single();

            return {
              ...exam,
              exams: { ...examDetails, subjects: subject }
            };
          }
          return exam;
        })
      );

      // Filter exam results by term
      const termExams = examsWithDetails?.filter((e: any) => e.exams?.term === selectedTerm) || [];

      // Fetch attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("status, date")
        .eq("student_id", selectedStudent);

      if (attendanceError) throw attendanceError;

      const presentDays = attendanceData?.filter((a: any) => a.status === "present").length || 0;
      const totalDays = attendanceData?.length || 1;
      const attendancePercentage = ((presentDays / totalDays) * 100).toFixed(1);

      // Get student details
      const student = students.find(s => s.id === selectedStudent);

      // Combine grades and exam results
      const allGrades = [
        ...(gradesWithSubjects?.map((g: any) => ({
          subject: g.subjects?.name || "Unknown",
          score: g.score,
        })) || []),
        ...(termExams.map((e: any) => ({
          subject: e.exams?.subjects?.name || "Unknown",
          exam_marks: e.marks_obtained,
          total_marks: e.exams?.total_marks,
          grade: e.grade,
        })) || []),
      ];

      const teacherRemarks = termExams[0]?.remarks || "";

      setReportData({
        student: {
          full_name: student?.profiles?.full_name || "Unknown",
          admission_no: student?.admission_no || "N/A",
          class_name: student?.classes?.name || "N/A",
        },
        term: `Term ${selectedTerm}`,
        grades: allGrades,
        attendance: {
          present: presentDays,
          total: totalDays,
          percentage: `${attendancePercentage}%`,
        },
        remarks: teacherRemarks,
      });

      toast({ title: "Report generated successfully" });
    } catch (error) {
      toast({ title: "Error generating report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Report Cards</h2>
          <p className="text-muted-foreground">Generate student report cards</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Report Card</CardTitle>
            <CardDescription>Select student and term to generate report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Student</label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.profiles?.full_name} ({student.admission_no})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Term</label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Term 1</SelectItem>
                    <SelectItem value="2">Term 2</SelectItem>
                    <SelectItem value="3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={generateReport} disabled={!selectedStudent || loading}>
                <FileText className="mr-2 h-4 w-4" />
                {loading ? "Generating..." : "Generate Report"}
              </Button>

              {reportData && (
                <PDFDownloadLink
                  document={<ReportCard {...reportData} />}
                  fileName={`report-card-${reportData.student.admission_no}-term${selectedTerm}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <Button variant="outline" disabled={pdfLoading}>
                      <Download className="mr-2 h-4 w-4" />
                      {pdfLoading ? "Preparing PDF..." : "Download PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </CardContent>
        </Card>

        {reportData && (
          <Card>
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Student Information</h3>
                  <p className="text-sm">Name: {reportData.student.full_name}</p>
                  <p className="text-sm">Admission No: {reportData.student.admission_no}</p>
                  <p className="text-sm">Class: {reportData.student.class_name}</p>
                  <p className="text-sm">Term: {reportData.term}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Grades</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Subject</th>
                          <th className="text-left p-2">Score</th>
                          <th className="text-left p-2">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.grades.map((grade: any, index: number) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{grade.subject}</td>
                            <td className="p-2">{grade.exam_marks || grade.score}</td>
                            <td className="p-2">{grade.grade || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Attendance</h3>
                  <p className="text-sm">
                    {reportData.attendance.present} / {reportData.attendance.total} days (
                    {reportData.attendance.percentage})
                  </p>
                </div>

                {reportData.remarks && (
                  <div>
                    <h3 className="font-semibold mb-2">Teacher's Remarks</h3>
                    <p className="text-sm bg-muted p-3 rounded">{reportData.remarks}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportCards;
