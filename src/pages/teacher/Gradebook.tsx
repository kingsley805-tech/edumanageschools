import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Student {
  id: string;
  user_id: string;
  profiles: { full_name: string };
}

interface Grade {
  student_id: string;
  subject_id: string;
  score: number;
  term: string;
}

const Gradebook = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string>("Term 1");
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

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
          .select("classes(id, name)")
          .eq("teacher_id", teacherData.id);

        const uniqueClasses = Array.from(
          new Map(data?.map(item => [item.classes?.id, item.classes]) || []).values()
        ).filter(Boolean);
        setClasses(uniqueClasses);
      }
    };
    fetchClasses();
  }, [user]);

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data } = await supabase.from("subjects").select("*");
      setSubjects(data || []);
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchStudentsAndGrades = async () => {
      if (!selectedClass || !selectedSubject) return;

      const { data: studentsData } = await supabase
        .from("students")
        .select("id, user_id, profiles(full_name)")
        .eq("class_id", selectedClass);

      setStudents((studentsData as any) || []);

      const { data: gradesData } = await supabase
        .from("grades")
        .select("*")
        .eq("subject_id", selectedSubject)
        .eq("term", selectedTerm)
        .in("student_id", (studentsData || []).map(s => s.id));

      setGrades((gradesData as any) || []);
    };

    fetchStudentsAndGrades();
  }, [selectedClass, selectedSubject, selectedTerm]);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gradebook</h2>
          <p className="text-muted-foreground">View all student grades in spreadsheet format</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grade Overview</CardTitle>
            <CardDescription>Filter by class, subject, and term</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    {subjects.map((subj) => (
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

            {selectedClass && selectedSubject ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="text-right">Grade</TableHead>
                      <TableHead className="text-right">Letter Grade</TableHead>
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
                        const grade = grades.find(g => g.student_id === student.id);
                        const score = grade?.score || 0;
                        const letterGrade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.profiles.full_name}</TableCell>
                            <TableCell className="text-right">{score}%</TableCell>
                            <TableCell className="text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                letterGrade === 'A' ? 'bg-success/10 text-success' :
                                letterGrade === 'B' ? 'bg-primary/10 text-primary' :
                                letterGrade === 'C' ? 'bg-warning/10 text-warning' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {letterGrade}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Select a class and subject to view grades
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Gradebook;
