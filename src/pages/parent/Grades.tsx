import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const Grades = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("1");
  const [grades, setGrades] = useState<any[]>([]);

  useEffect(() => {
    fetchChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchGrades();
    }
  }, [selectedChild, selectedTerm]);

  const fetchChildren = async () => {
    if (!user) return;

    const { data: parentData } = await supabase
      .from("parents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!parentData) return;

    const { data: studentsData } = await supabase
      .from("students")
      .select("id, profiles(full_name)")
      .eq("guardian_id", parentData.id);

    if (studentsData && studentsData.length > 0) {
      setChildren(studentsData);
      setSelectedChild(studentsData[0].id);
    }
  };

  const fetchGrades = async () => {
    if (!selectedChild) return;

    const { data, error } = await supabase
      .from("grades")
      .select(`
        id,
        score,
        term,
        created_at,
        subjects:subject_id(name)
      `)
      .eq("student_id", selectedChild)
      .eq("term", selectedTerm)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGrades(data);
    }
  };

  const calculateAverage = () => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    return Math.round((total / grades.length) * 10) / 10;
  };

  const getGradeLetter = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
  };

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Grades & Report Cards</h2>
            <p className="text-muted-foreground">View your child's academic performance</p>
          </div>
          <div className="flex gap-2">
            {children.length > 0 && (
              <Select value={selectedChild} onValueChange={setSelectedChild}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.profiles?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-[130px]">
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateAverage()}%</div>
              <p className="text-xs text-muted-foreground">Term {selectedTerm}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{grades.length}</div>
              <p className="text-xs text-muted-foreground">Graded subjects</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Academic Performance</CardTitle>
            <CardDescription>Grades by subject and term</CardDescription>
          </CardHeader>
          <CardContent>
            {grades.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No grades yet</p>
                <p className="text-sm text-muted-foreground">Check back once grades have been published</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Subject</th>
                      <th className="text-left p-3">Score</th>
                      <th className="text-left p-3">Grade</th>
                      <th className="text-left p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b">
                        <td className="p-3">{grade.subjects?.name}</td>
                        <td className="p-3">{grade.score}%</td>
                        <td className="p-3">
                          <Badge variant={
                            grade.score >= 80 ? "default" :
                            grade.score >= 60 ? "secondary" : "destructive"
                          }>
                            {getGradeLetter(grade.score)}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(grade.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Grades;