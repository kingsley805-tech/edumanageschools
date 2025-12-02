import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Attendance = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, rate: "0" });

  useEffect(() => {
    fetchChildren();
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchAttendance();
    }
  }, [selectedChild]);

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

  const fetchAttendance = async () => {
    if (!selectedChild) return;

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", selectedChild)
      .order("date", { ascending: false })
      .limit(30);

    if (error || !data) return;

    setAttendanceRecords(data);

    const total = data.length;
    const present = data.filter(a => a.status === "present").length;
    const absent = data.filter(a => a.status === "absent").length;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

    setStats({ total, present, absent, rate });
  };

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
            <p className="text-muted-foreground">View your child's attendance records</p>
          </div>
          {children.length > 0 && (
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-[200px]">
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rate}%</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Days</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.present}</div>
              <p className="text-xs text-muted-foreground">Out of {stats.total} days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.absent}</div>
              <p className="text-xs text-muted-foreground">Out of {stats.total} days</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>Recent attendance history</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceRecords.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No attendance records yet</p>
                <p className="text-sm text-muted-foreground">Check back once attendance has been recorded</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {record.status === "present" ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : record.status === "absent" ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <Clock className="h-5 w-5 text-warning" />
                      )}
                      <div>
                        <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">
                          Recorded {new Date(record.recorded_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      record.status === "present" ? "default" :
                      record.status === "absent" ? "destructive" : "secondary"
                    }>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;