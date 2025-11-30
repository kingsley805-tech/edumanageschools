import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const scheduleSchema = z.object({
  class_id: z.string().min(1, "Class is required"),
  subject_id: z.string().min(1, "Subject is required"),
  teacher_id: z.string().min(1, "Teacher is required"),
  day_of_week: z.string().min(1, "Day is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  room: z.string().optional(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const Schedule = () => {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
  });

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchSchedules();
    }
  }, [selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from("classes").select("*").order("name");
    if (data) setClasses(data);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("*").order("name");
    if (data) setSubjects(data);
  };

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from("teachers")
      .select(`
        id,
        profiles(full_name)
      `);
    if (data) setTeachers(data);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("schedules")
      .select(`
        *,
        classes(name),
        subjects(name),
        teachers(
          id,
          profiles(full_name)
        )
      `)
      .eq("class_id", selectedClass)
      .order("day_of_week")
      .order("start_time");

    if (data) setSchedules(data);
  };

  const onSubmit = async (data: ScheduleFormData) => {
    try {
      const { error } = await supabase
        .from("schedules")
        .insert([{
          class_id: data.class_id,
          subject_id: data.subject_id,
          teacher_id: data.teacher_id,
          day_of_week: parseInt(data.day_of_week),
          start_time: data.start_time,
          end_time: data.end_time,
          room: data.room || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule entry created successfully",
      });

      setOpen(false);
      reset();
      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule entry deleted",
      });

      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Group schedules by day
  const schedulesByDay = schedules.reduce((acc, schedule) => {
    const day = schedule.day_of_week;
    if (!acc[day]) acc[day] = [];
    acc[day].push(schedule);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Class Schedules</h2>
            <p className="text-muted-foreground">Manage class timetables and schedules</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Schedule Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Schedule Entry</DialogTitle>
                <DialogDescription>Create a new class schedule entry</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="class_id">Class</Label>
                    <Select onValueChange={(value) => setValue("class_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.class_id && <p className="text-sm text-destructive">{errors.class_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject_id">Subject</Label>
                    <Select onValueChange={(value) => setValue("subject_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subject_id && <p className="text-sm text-destructive">{errors.subject_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher_id">Teacher</Label>
                    <Select onValueChange={(value) => setValue("teacher_id", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.profiles?.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.teacher_id && <p className="text-sm text-destructive">{errors.teacher_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="day_of_week">Day</Label>
                    <Select onValueChange={(value) => setValue("day_of_week", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((day, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.day_of_week && <p className="text-sm text-destructive">{errors.day_of_week.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input id="start_time" type="time" {...register("start_time")} />
                    {errors.start_time && <p className="text-sm text-destructive">{errors.start_time.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">End Time</Label>
                    <Input id="end_time" type="time" {...register("end_time")} />
                    {errors.end_time && <p className="text-sm text-destructive">{errors.end_time.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="room">Room (Optional)</Label>
                    <Input id="room" placeholder="e.g., Room 101" {...register("room")} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Entry</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Class</CardTitle>
            <CardDescription>Choose a class to view and manage its schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedClass && (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>
                Timetable for {classes.find((c) => c.id === selectedClass)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No schedule entries for this class
                </p>
              ) : (
                <div className="space-y-6">
                  {DAYS.map((day, dayIndex) => {
                    const daySchedules = schedulesByDay[dayIndex] || [];
                    if (daySchedules.length === 0) return null;

                    return (
                      <div key={dayIndex}>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {day}
                        </h3>
                        <div className="space-y-2">
                          {daySchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                  </span>
                                  <Badge variant="outline">{schedule.subjects?.name}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {schedule.teachers?.profiles?.full_name}
                                  </span>
                                  {schedule.room && (
                                    <Badge variant="secondary">{schedule.room}</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(schedule.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
