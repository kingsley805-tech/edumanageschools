import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const Grades = () => {
  const [grades, setGrades] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("Term 1");
  const [trendData, setTrendData] = useState<any[]>([]);
  const [subjectComparison, setSubjectComparison] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchGrades();
  }, [selectedTerm]);

  const fetchGrades = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get student ID
    const { data: studentData } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!studentData) return;

    // Fetch grades for selected term
    const { data: gradesData, error } = await supabase
      .from("grades")
      .select(`
        id,
        score,
        term,
        created_at,
        subjects:subject_id(name)
      `)
      .eq("student_id", studentData.id)
      .eq("term", selectedTerm)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching grades", variant: "destructive" });
    } else {
      setGrades(gradesData || []);
      prepareSubjectComparison(gradesData || []);
    }

    // Fetch all grades for trend analysis
    const { data: allGrades } = await supabase
      .from("grades")
      .select("score, term, subjects:subject_id(name)")
      .eq("student_id", studentData.id)
      .order("term", { ascending: true });

    if (allGrades) {
      prepareTrendData(allGrades);
    }
  };

  const prepareTrendData = (allGrades: any[]) => {
    const termAverages = allGrades.reduce((acc: any, grade: any) => {
      // Handle both "Term 1" format and "1" format for backward compatibility
      const term = grade.term?.startsWith("Term") ? grade.term : `Term ${grade.term}`;
      if (!acc[term]) {
        acc[term] = { term, total: 0, count: 0 };
      }
      acc[term].total += grade.score || 0;
      acc[term].count += 1;
      return acc;
    }, {});

    const trend = Object.values(termAverages).map((t: any) => ({
      term: t.term,
      average: Math.round((t.total / t.count) * 10) / 10,
    }));

    setTrendData(trend);
  };

  const prepareSubjectComparison = (gradesData: any[]) => {
    const comparison = gradesData.map((grade: any) => ({
      subject: grade.subjects?.name || "Unknown",
      score: grade.score || 0,
    }));
    setSubjectComparison(comparison);
  };

  const calculateAverage = () => {
    if (grades.length === 0) return 0;
    const total = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    return Math.round((total / grades.length) * 10) / 10;
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">My Grades</h2>
            <p className="text-muted-foreground">View your academic performance</p>
          </div>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Term 1">Term 1</SelectItem>
              <SelectItem value="Term 2">Term 2</SelectItem>
              <SelectItem value="Term 3">Term 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateAverage()}%</div>
              <p className="text-xs text-muted-foreground">{selectedTerm}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{grades.length}</div>
              <p className="text-xs text-muted-foreground">Graded subjects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trendData.length > 1 && trendData[trendData.length - 1].average > trendData[trendData.length - 2].average ? "↑" : "↓"}
              </div>
              <p className="text-xs text-muted-foreground">Compared to previous term</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Grade Trends</CardTitle>
              <CardDescription>Your average scores across terms</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="term" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="average" stroke="hsl(var(--primary))" strokeWidth={2} name="Average Score" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subject Comparison</CardTitle>
              <CardDescription>Performance by subject - {selectedTerm}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="score" fill="hsl(var(--primary))" name="Score" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Grades</CardTitle>
            <CardDescription>All grades for {selectedTerm}</CardDescription>
          </CardHeader>
          <CardContent>
            {grades.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No grades yet</p>
                <p className="text-sm text-muted-foreground">Your grades will appear once published</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Subject</th>
                      <th className="text-left p-2">Score</th>
                      <th className="text-left p-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((grade) => (
                      <tr key={grade.id} className="border-b">
                        <td className="p-2">{grade.subjects?.name}</td>
                        <td className="p-2">{grade.score}%</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            grade.score >= 90 ? 'bg-green-100 text-green-800' :
                            grade.score >= 80 ? 'bg-blue-100 text-blue-800' :
                            grade.score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                            grade.score >= 60 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {grade.score >= 90 ? 'A+' :
                             grade.score >= 80 ? 'A' :
                             grade.score >= 70 ? 'B' :
                             grade.score >= 60 ? 'C' :
                             grade.score >= 50 ? 'D' : 'F'}
                          </span>
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
