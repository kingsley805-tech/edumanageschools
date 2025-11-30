import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Schedule = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [className, setClassName] = useState<string>("");
  const { user } = useAuth();

  useEffect(() => {
    fetchSchedule();
  }, [user]);

  const fetchSchedule = async () => {
    if (!user) return;

    // Get student's class
    const { data: studentData } = await supabase
      .from("students")
      .select("class_id, classes(name)")
      .eq("user_id", user.id)
      .single();

    if (!studentData) return;

    setClassName(studentData.classes?.name || "");

    // Get class schedule
    const { data: scheduleData } = await supabase
      .from("schedules")
      .select(`
        *,
        subjects(name, code),
        teachers(
          profiles(full_name)
        )
      `)
      .eq("class_id", studentData.class_id)
      .order("day_of_week")
      .order("start_time");

    if (scheduleData) {
      setSchedules(scheduleData);
    }
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

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Schedule</h2>
          <p className="text-muted-foreground">
            {className ? `Class timetable for ${className}` : "View your class timetable"}
          </p>
        </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <CalendarIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-lg font-medium">No schedule available</p>
                <p className="text-sm text-muted-foreground">
                  Your class schedule will appear here once created
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
                <Card key={dayIndex} className={isToday ? "border-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5" />
                        {day}
                      </CardTitle>
                      {isToday && <Badge>Today</Badge>}
                    </div>
                    {daySchedules.length > 0 && (
                      <CardDescription>{daySchedules.length} classes scheduled</CardDescription>
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
                              <p className="text-sm text-muted-foreground">
                                Teacher: {schedule.teachers?.profiles?.full_name}
                              </p>
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

export default Schedule;
