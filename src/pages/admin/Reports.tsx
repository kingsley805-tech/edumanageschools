import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const Reports = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalRevenue: 0,
    averageAttendance: 0,
    activeClasses: 0,
  });
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [gradeData, setGradeData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    // Get current user's school_id for filtering
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;
    const schoolId = profileData.school_id;

    // Fetch total students for this school
    const { count: studentCount } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId);

    // Fetch total revenue (from students in this school)
    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "completed");
    const revenue = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    // Fetch attendance rate for school's students
    const { data: schoolStudents } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId);
    
    const studentIds = schoolStudents?.map(s => s.id) || [];
    
    let avgAttendance = 0;
    if (studentIds.length > 0) {
      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .in("student_id", studentIds);
      const presentCount = attendance?.filter(a => a.status === "present").length || 0;
      const totalAttendance = attendance?.length || 1;
      avgAttendance = (presentCount / totalAttendance) * 100;
    }

    // Fetch active classes for this school
    const { count: classCount } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId);

    setStats({
      totalStudents: studentCount || 0,
      totalRevenue: revenue,
      averageAttendance: Math.round(avgAttendance),
      activeClasses: classCount || 0,
    });

    // Fetch attendance trends (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const attendanceTrends = await Promise.all(
      last7Days.map(async (date) => {
        const { data } = await supabase
          .from("attendance")
          .select("status")
          .eq("date", date);
        
        const present = data?.filter(a => a.status === "present").length || 0;
        const absent = data?.filter(a => a.status === "absent").length || 0;
        
        return {
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          present,
          absent,
        };
      })
    );
    setAttendanceData(attendanceTrends);

    // Fetch grade distribution
    const { data: grades } = await supabase
      .from("grades")
      .select("score");
    
    const gradeRanges = [
      { range: "90-100", count: 0 },
      { range: "80-89", count: 0 },
      { range: "70-79", count: 0 },
      { range: "60-69", count: 0 },
      { range: "Below 60", count: 0 },
    ];

    grades?.forEach(g => {
      const score = Number(g.score);
      if (score >= 90) gradeRanges[0].count++;
      else if (score >= 80) gradeRanges[1].count++;
      else if (score >= 70) gradeRanges[2].count++;
      else if (score >= 60) gradeRanges[3].count++;
      else gradeRanges[4].count++;
    });
    setGradeData(gradeRanges);

    // Fetch revenue breakdown
    const { data: invoices } = await supabase
      .from("invoices")
      .select("status, amount");
    
    const paid = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
    const unpaid = invoices?.filter(i => i.status === "unpaid").reduce((sum, i) => sum + Number(i.amount), 0) || 0;
    
    setRevenueData([
      { name: "Paid", value: paid },
      { name: "Unpaid", value: unpaid },
    ]);
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive insights into school performance</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageAttendance}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeClasses}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends (Last 7 Days)</CardTitle>
              <CardDescription>Daily attendance tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="absent" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Student performance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>Payment status overview</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenueData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
