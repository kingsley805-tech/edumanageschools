import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Attendance = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
      fetchAttendanceForDate();
    }
  }, [selectedClass, date]);

  const fetchClasses = async () => {
    const { data } = await supabase
      .from("class_subjects")
      .select(`
        class_id,
        classes(id, name)
      `)
      .eq("teacher_id", user?.id);

    if (data) {
      const uniqueClasses = Array.from(
        new Map(data.map(item => [item.classes.id, item.classes])).values()
      );
      setClasses(uniqueClasses);
    }
  };

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        profiles(full_name)
      `)
      .eq("class_id", selectedClass);

    if (data) setStudents(data);
  };

  const fetchAttendanceForDate = async () => {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("class_id", selectedClass)
      .eq("date", dateStr);

    if (data) {
      const records: Record<string, string> = {};
      data.forEach(record => {
        records[record.student_id] = record.status;
      });
      setAttendanceRecords(records);
    } else {
      setAttendanceRecords({});
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      toast({
        title: "Error",
        description: "Please select a class",
        variant: "destructive",
      });
      return;
    }

    const dateStr = date.toISOString().split('T')[0];

    try {
      // Delete existing records for this date and class
      await supabase
        .from("attendance")
        .delete()
        .eq("class_id", selectedClass)
        .eq("date", dateStr);

      // Insert new records
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: selectedClass,
        date: dateStr,
        status,
        recorded_by: user?.id,
      }));

      const { error } = await supabase
        .from("attendance")
        .insert(records);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
            <p className="text-muted-foreground">Mark and manage student attendance</p>
          </div>
          <Button className="gap-2" onClick={handleSaveAttendance}>
            <Save className="h-4 w-4" />
            Save Attendance
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
              <CardDescription>Choose date and class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(date) => date && setDate(date)}
                className="rounded-md border"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mark Attendance</CardTitle>
              <CardDescription>
                {selectedClass ? `Marking for ${date.toLocaleDateString()}` : "Select a class to begin"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedClass ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center space-y-4">
                    <CalendarIcon className="h-16 w-16 text-muted-foreground mx-auto" />
                    <p className="text-lg font-medium">Select a class</p>
                    <p className="text-sm text-muted-foreground">Choose a class to start marking attendance</p>
                  </div>
                </div>
              ) : students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No students in this class</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.admission_no}</TableCell>
                        <TableCell>{student.profiles?.full_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant={attendanceRecords[student.id] === "present" ? "default" : "outline"}
                              onClick={() => handleStatusChange(student.id, "present")}
                            >
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={attendanceRecords[student.id] === "absent" ? "destructive" : "outline"}
                              onClick={() => handleStatusChange(student.id, "absent")}
                            >
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              variant={attendanceRecords[student.id] === "late" ? "secondary" : "outline"}
                              onClick={() => handleStatusChange(student.id, "late")}
                            >
                              Late
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
