import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Clock, BookOpen, Download, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Timetable = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchSchedule();
  }, [user]);

  const fetchSchedule = async () => {
    if (!user) return;

    try {
      // Get teacher record
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacherData) {
        setLoading(false);
        return;
      }

      // Get teacher's schedule
      const { data: scheduleData } = await supabase
        .from("schedules")
        .select(`
          *,
          subjects(name, code),
          classes(name, level)
        `)
        .eq("teacher_id", teacherData.id)
        .order("day_of_week")
        .order("start_time");

      if (scheduleData) {
        setSchedules(scheduleData);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadTimetable = () => {
    if (schedules.length === 0) {
      toast.error("No timetable to download");
      return;
    }

    // Create timetable grid
    const timetableData: any[] = [];
    
    // Header row with days
    timetableData.push(["My Teaching Timetable", ...DAYS.slice(1, 6)]); // Mon-Fri only
    
    // Get all unique time slots from schedules
    const timeSlots = [...new Set(schedules.map(s => s.start_time))].sort();
    
    timeSlots.forEach(time => {
      const row = [time.slice(0, 5)];
      // For each day (Mon-Fri = 1-5)
      for (let day = 1; day <= 5; day++) {
        const slot = schedules.find(s => s.day_of_week === day && s.start_time === time);
        if (slot) {
          row.push(`${slot.subjects?.name} - ${slot.classes?.name}${slot.room ? ` (${slot.room})` : ""}`);
        } else {
          row.push("");
        }
      }
      timetableData.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(timetableData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, `Teaching_Timetable.xlsx`);
    
    toast.success("Timetable downloaded successfully");
  };

  // Group schedules by day
  const schedulesByDay = schedules.reduce((acc, schedule) => {
    const day = schedule.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(schedule);
    return acc;
  }, {} as Record<number, any[]>);

  // Get current day
  const today = new Date().getDay();

  // Get today's classes for quick view
  const todaysClasses = schedulesByDay[today] || [];

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-64"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">My Timetable</h2>
            <p className="text-muted-foreground">View your teaching schedule</p>
          </div>
          {schedules.length > 0 && (
            <Button variant="outline" onClick={downloadTimetable}>
              <Download className="h-4 w-4 mr-2" />
              Download Timetable
            </Button>
          )}
        </div>

        {/* Today's Quick View */}
        {todaysClasses.length > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Today's Classes
              </CardTitle>
              <CardDescription>You have {todaysClasses.length} classes today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {todaysClasses.map((schedule) => (
                  <Badge key={schedule.id} variant="secondary" className="py-2 px-3 text-sm">
                    {schedule.start_time.slice(0, 5)} - {schedule.subjects?.name} ({schedule.classes?.name})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <CalendarIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">No schedule assigned</p>
                <p className="text-sm text-muted-foreground">
                  Your teaching schedule will appear here once assigned by an administrator
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {DAYS.map((day, dayIndex) => {
              const daySchedules = schedulesByDay[dayIndex] || [];
              const isToday = dayIndex === today;

              return (
                <Card key={dayIndex} className={isToday ? "border-primary ring-1 ring-primary" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        {day}
                      </CardTitle>
                      {isToday && <Badge className="bg-primary">Today</Badge>}
                    </div>
                    {daySchedules.length > 0 && (
                      <CardDescription>{daySchedules.length} classes to teach</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {daySchedules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No classes</p>
                    ) : (
                      <div className="space-y-3">
                        {daySchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex flex-col items-center gap-1 min-w-[80px]">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {schedule.start_time.slice(0, 5)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {schedule.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <span className="font-semibold">{schedule.subjects?.name}</span>
                                {schedule.subjects?.code && (
                                  <Badge variant="outline" className="text-xs">
                                    {schedule.subjects.code}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-3 w-3" />
                                Class: {schedule.classes?.name}
                              </div>
                              {schedule.room && (
                                <p className="text-sm text-muted-foreground">
                                  Room: {schedule.room}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Timetable;