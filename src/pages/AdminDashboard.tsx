import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, DollarSign, TrendingUp, Calendar, BookOpen } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    {
      title: "Total Students",
      value: "0",
      change: "+12.5%",
      icon: Users,
      color: "text-primary"
    },
    {
      title: "Active Teachers",
      value: "0",
      change: "+3.2%",
      icon: GraduationCap,
      color: "text-accent"
    },
    {
      title: "Fees Collected",
      value: "$0",
      change: "+18.7%",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "Attendance Rate",
      value: "0%",
      change: "+2.1%",
      icon: TrendingUp,
      color: "text-warning"
    }
  ]);

  useEffect(() => {
    const fetchStats = async () => {
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

      const [studentsRes, teachersRes, feesRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
        supabase.from("invoices").select("amount, students!inner(school_id)").eq("students.school_id", schoolId),
        supabase.from("attendance").select("status, students!inner(school_id)", { count: "exact", head: true }).eq("students.school_id", schoolId)
      ]);

      const totalFees = feesRes.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0;
      const totalAttendance = attendanceRes.count || 1;
      const presentCount = await supabase
        .from("attendance")
        .select("id, students!inner(school_id)", { count: "exact", head: true })
        .eq("students.school_id", schoolId)
        .eq("status", "present");
      const attendanceRate = totalAttendance > 0 
        ? ((presentCount.count || 0) / totalAttendance * 100).toFixed(1)
        : "0.0";

      setStats([
        { title: "Total Students", value: studentsRes.count?.toString() || "0", change: "+12.5%", icon: Users, color: "text-primary" },
        { title: "Active Teachers", value: teachersRes.count?.toString() || "0", change: "+3.2%", icon: GraduationCap, color: "text-accent" },
        { title: "Fees Collected", value: `$${totalFees.toLocaleString()}`, change: "+18.7%", icon: DollarSign, color: "text-success" },
        { title: "Attendance Rate", value: `${attendanceRate}%`, change: "+2.1%", icon: TrendingUp, color: "text-warning" }
      ]);
    };

    fetchStats();
  }, []);

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [classDistribution, setClassDistribution] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentActivity = async () => {
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

      const [studentsRes, paymentsRes, attendanceRes, assignmentsRes] = await Promise.all([
        supabase.from("students").select("created_at, profiles(full_name), classes(name)").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(10),
        supabase.from("payments").select("created_at, amount, invoices!inner(students!inner(school_id))").eq("invoices.students.school_id", schoolId).eq("status", "completed").order("created_at", { ascending: false }).limit(10),
        supabase.from("attendance").select("recorded_at, classes(name), students!inner(school_id)").eq("students.school_id", schoolId).order("recorded_at", { ascending: false }).limit(10),
        supabase.from("assignments").select("created_at, title, classes!inner(school_id)").eq("classes.school_id", schoolId).order("created_at", { ascending: false }).limit(10)
      ]);

      const activities = [
        ...(studentsRes.data || []).map(s => ({
          type: "enrollment",
          message: `New student ${(s.profiles as any)?.full_name} enrolled in ${(s.classes as any)?.name}`,
          time: new Date(s.created_at).toLocaleString()
        })),
        ...(paymentsRes.data || []).map(p => ({
          type: "payment",
          message: `Fee payment of $${p.amount} received`,
          time: new Date(p.created_at).toLocaleString()
        })),
        ...(attendanceRes.data || []).map(a => ({
          type: "attendance",
          message: `Attendance marked for ${(a.classes as any)?.name}`,
          time: new Date(a.recorded_at || "").toLocaleString()
        })),
        ...(assignmentsRes.data || []).map(a => ({
          type: "assignment",
          message: `New assignment: ${a.title}`,
          time: new Date(a.created_at).toLocaleString()
        }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

      setRecentActivity(activities);
    };

    const fetchClassDistribution = async () => {
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

      const { data } = await supabase.from("classes").select("name, students(count)").eq("school_id", schoolId);
      const distribution = (data || []).map(c => ({
        grade: c.name,
        students: (c as any).students?.length || 0,
        percentage: Math.min(100, ((c as any).students?.length || 0) / 5)
      })).slice(0, 4);
      setClassDistribution(distribution);
    };

    fetchRecentActivity();
    fetchClassDistribution();
  }, []);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-sm text-success mt-1">
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts & Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Class Distribution */}
          <Card className="animate-fade-up">
            <CardHeader>
              <CardTitle>Class Distribution</CardTitle>
              <CardDescription>Students enrolled by grade level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {classDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No class data available</p>
              ) : (
                classDistribution.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.grade}</span>
                    <span className="text-muted-foreground">{item.students} students</span>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              )))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map((activity, index) => (
                  <div key={index} className="flex gap-3 pb-3 border-b last:border-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {activity.type === "enrollment" && <Users className="h-4 w-4 text-primary" />}
                      {activity.type === "payment" && <DollarSign className="h-4 w-4 text-success" />}
                      {activity.type === "attendance" && <Calendar className="h-4 w-4 text-accent" />}
                      {activity.type === "assignment" && <BookOpen className="h-4 w-4 text-warning" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                )))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <button onClick={() => navigate("/admin/students")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Add New Student</span>
              </button>
              <button onClick={() => navigate("/admin/teachers")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <GraduationCap className="h-5 w-5 text-accent" />
                <span className="font-medium">Add New Teacher</span>
              </button>
              <button onClick={() => navigate("/admin/fees")} className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors">
                <DollarSign className="h-5 w-5 text-success" />
                <span className="font-medium">Generate Invoice</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;