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
      <div className="space-y-4 md:space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Card key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
                <p className="text-xs md:text-sm text-success mt-1">
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts & Activity */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Class Distribution */}
          <Card className="animate-fade-up">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Class Distribution</CardTitle>
              <CardDescription className="text-sm md:text-base">Students enrolled by grade level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-6 pt-0">
              {classDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No class data available</p>
              ) : (
                classDistribution.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-xs md:text-sm">
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
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg md:text-xl">Recent Activity</CardTitle>
              <CardDescription className="text-sm md:text-base">Latest updates across the system</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-3 md:space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map((activity, index) => (
                  <div key={index} className="flex gap-2 md:gap-3 pb-3 border-b last:border-0">
                    <div className="h-8 w-8 md:h-9 md:w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {activity.type === "enrollment" && <Users className="h-3 w-3 md:h-4 md:w-4 text-primary" />}
                      {activity.type === "payment" && <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-success" />}
                      {activity.type === "attendance" && <Calendar className="h-3 w-3 md:h-4 md:w-4 text-accent" />}
                      {activity.type === "assignment" && <BookOpen className="h-3 w-3 md:h-4 md:w-4 text-warning" />}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-xs md:text-sm truncate">{activity.message}</p>
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
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <button onClick={() => navigate("/admin/students")} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border hover:bg-muted transition-colors text-left">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                <span className="font-medium text-sm md:text-base">Add New Student</span>
              </button>
              <button onClick={() => navigate("/admin/teachers")} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border hover:bg-muted transition-colors text-left">
                <GraduationCap className="h-4 w-4 md:h-5 md:w-5 text-accent flex-shrink-0" />
                <span className="font-medium text-sm md:text-base">Add New Teacher</span>
              </button>
              <button onClick={() => navigate("/admin/fees")} className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border hover:bg-muted transition-colors text-left sm:col-span-2 md:col-span-1">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-success flex-shrink-0" />
                <span className="font-medium text-sm md:text-base">Generate Invoice</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;