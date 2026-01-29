import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalendarIcon, Clock, Download, Trash2, Edit2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";

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
const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00"
];

const Timetable = () => {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<ScheduleFormData>({
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
        profiles(full_name, id)
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
          profiles(full_name, id)
        )
      `)
      .eq("class_id", selectedClass)
      .order("day_of_week")
      .order("start_time");

    if (data) setSchedules(data);
  };

  const notifyTeacher = async (teacherId: string, subjectName: string, className: string, dayOfWeek: number, startTime: string) => {
    // Get teacher's user_id
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher?.profiles?.id) return;

    const dayName = DAYS[dayOfWeek];
    
    await supabase.from("notifications").insert({
      user_id: teacher.profiles.id,
      title: "New Class Assigned",
      body: `You have been assigned to teach ${subjectName} for ${className} on ${dayName} at ${startTime}`,
      data: { type: "timetable_update" }
    });
  };

  const onSubmit = async (data: ScheduleFormData) => {
    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from("schedules")
          .update({
            class_id: data.class_id,
            subject_id: data.subject_id,
            teacher_id: data.teacher_id,
            day_of_week: parseInt(data.day_of_week),
            start_time: data.start_time,
            end_time: data.end_time,
            room: data.room || null,
          })
          .eq("id", editingSchedule.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Timetable entry updated successfully",
        });
      } else {
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

        // Notify teacher about new class
        const subject = subjects.find(s => s.id === data.subject_id);
        const classData = classes.find(c => c.id === data.class_id);
        await notifyTeacher(data.teacher_id, subject?.name || "", classData?.name || "", parseInt(data.day_of_week), data.start_time);

        toast({
          title: "Success",
          description: "Timetable entry created and teacher notified",
        });
      }

      setOpen(false);
      setEditingSchedule(null);
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

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setValue("class_id", schedule.class_id);
    setValue("subject_id", schedule.subject_id);
    setValue("teacher_id", schedule.teacher_id);
    setValue("day_of_week", schedule.day_of_week.toString());
    setValue("start_time", schedule.start_time);
    setValue("end_time", schedule.end_time);
    setValue("room", schedule.room || "");
    setOpen(true);
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
        description: "Timetable entry deleted",
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

  const downloadTimetable = () => {
    if (!selectedClass || schedules.length === 0) {
      toast({
        title: "Error",
        description: "Please select a class with schedule entries",
        variant: "destructive",
      });
      return;
    }

    const className = classes.find(c => c.id === selectedClass)?.name || "Class";
    
    // Create timetable grid
    const timetableData: any[] = [];
    
    // Header row with days
    timetableData.push([`${className} Timetable`, ...DAYS.slice(1, 6)]); // Mon-Fri only
    
    // Get all unique time slots from schedules
    const timeSlots = [...new Set(schedules.map(s => s.start_time))].sort();
    
    timeSlots.forEach(time => {
      const row = [time];
      // For each day (Mon-Fri = 1-5)
      for (let day = 1; day <= 5; day++) {
        const slot = schedules.find(s => s.day_of_week === day && s.start_time === time);
        if (slot) {
          row.push(`${slot.subjects?.name}\n${slot.teachers?.profiles?.full_name}\n${slot.room || ""}`);
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
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, `${className.replace(/[^a-z0-9]/gi, "_")}_Timetable.xlsx`);
    
    toast({
      title: "Success",
      description: "Timetable downloaded successfully",
    });
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
            <h2 className="text-3xl font-bold tracking-tight">Permanent Timetable</h2>
            <p className="text-muted-foreground">Manage permanent class timetables and schedules</p>
          </div>
          <div className="flex gap-2">
            {selectedClass && schedules.length > 0 && (
              <Button variant="outline" onClick={downloadTimetable}>
                <Download className="h-4 w-4 mr-2" />
                Download Timetable
              </Button>
            )}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingSchedule(null); reset(); } }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingSchedule ? "Edit" : "Add"} Timetable Entry</DialogTitle>
                  <DialogDescription>
                    {editingSchedule ? "Update the class schedule entry" : "Create a new class schedule entry. Teachers will be notified."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="class_id">Class</Label>
                      <Select onValueChange={(value) => setValue("class_id", value)} defaultValue={editingSchedule?.class_id}>
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
                      <Select onValueChange={(value) => setValue("subject_id", value)} defaultValue={editingSchedule?.subject_id}>
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
                      <Select onValueChange={(value) => setValue("teacher_id", value)} defaultValue={editingSchedule?.teacher_id}>
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
                      <Select onValueChange={(value) => setValue("day_of_week", value)} defaultValue={editingSchedule?.day_of_week?.toString()}>
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
                    <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingSchedule(null); reset(); }}>Cancel</Button>
                    <Button type="submit">{editingSchedule ? "Update" : "Create"} Entry</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Class</CardTitle>
            <CardDescription>Choose a class to view and manage its timetable</CardDescription>
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
              <CardTitle>Permanent Timetable</CardTitle>
              <CardDescription>
                Schedule for {classes.find((c) => c.id === selectedClass)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No timetable entries for this class
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
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
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
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(schedule)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(schedule.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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

export default Timetable;