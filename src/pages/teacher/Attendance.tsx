// @ts-nocheck
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { saveTeacherClassAttendance } from "@/lib/attendance-queries";
import { fetchClassStudents, studentDisplayName } from "@/register/lib/api";
import { sendTeacherAttendanceSmsNotifications, describeAttendanceSmsResult } from "@/register/lib/sms";
import { fetchTeacherAssignedClasses } from "@/report/lib/teacher-assignments";
import { invalidateAttendanceQueries } from "@/register/hooks/use-attendance-summary";

type ClassOption = { id: string; name: string };
type ClassStudent = Awaited<ReturnType<typeof fetchClassStudents>>[number];

const Attendance = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    setLoadingClasses(true);
    void fetchTeacherAssignedClasses(user.id)
      .then(setClasses)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load classes";
        toast({ title: "Error", description: message, variant: "destructive" });
      })
      .finally(() => setLoadingClasses(false));
  }, [user, toast]);

  const fetchAttendanceForDate = useCallback(async () => {
    if (!selectedClass) return;
    const dateStr = date.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("class_id", selectedClass)
      .eq("date", dateStr);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const records: Record<string, string> = {};
    for (const record of data ?? []) {
      records[record.student_id] = record.status;
    }
    setAttendanceRecords(records);
  }, [selectedClass, date, toast]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    setLoadingStudents(true);
    void fetchClassStudents(selectedClass)
      .then(setStudents)
      .catch((err: unknown) => {
        setStudents([]);
        const message = err instanceof Error ? err.message : "Could not load students";
        toast({ title: "Error", description: message, variant: "destructive" });
      })
      .finally(() => setLoadingStudents(false));

    void fetchAttendanceForDate();
  }, [selectedClass, date, fetchAttendanceForDate, toast]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceRecords((prev) => ({
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

    const dateStr = date.toISOString().split("T")[0];

    try {
      setSaving(true);
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: studentId,
        status,
      }));

      await saveTeacherClassAttendance(selectedClass, dateStr, records);

      invalidateAttendanceQueries(queryClient, { classId: selectedClass });
      for (const studentId of Object.keys(attendanceRecords)) {
        invalidateAttendanceQueries(queryClient, { studentId });
      }

      toast({
        title: "Success",
        description: "Attendance saved successfully",
      });

      void sendTeacherAttendanceSmsNotifications(selectedClass, dateStr)
        .then((result) => {
          const feedback = describeAttendanceSmsResult(result ?? {});
          if (feedback) {
            toast({
              title: feedback.title,
              description: feedback.description,
              variant: feedback.variant === "success" ? "default" : feedback.variant,
            });
          }
        })
        .catch((smsError: unknown) => {
          const message =
            smsError instanceof Error ? smsError.message : "Could not send parent SMS notifications";
          toast({
            title: "Attendance saved — SMS failed",
            description: message,
            variant: "destructive",
          });
        });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save attendance";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const emptyStudentsMessage = loadingStudents
    ? "Loading students…"
    : "No students in this class. Confirm each student has this class set under Admin → Students.";

  return (
    <DashboardLayout role="teacher">
      <div className="mingo-content space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">Attendance</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1">Mark and manage student attendance</p>
          </div>
          <Button className="gap-2" onClick={handleSaveAttendance} disabled={!selectedClass || loadingStudents || saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Attendance"}
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
                onSelect={(d) => d && setDate(d)}
                className="rounded-md border"
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingClasses}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingClasses ? "Loading classes…" : "Select class"} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClass && students.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newRecords = { ...attendanceRecords };
                      students.forEach((s) => {
                        newRecords[s.id] = "present";
                      });
                      setAttendanceRecords(newRecords);
                    }}
                  >
                    Mark All Present
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newRecords = { ...attendanceRecords };
                      students.forEach((s) => {
                        newRecords[s.id] = "absent";
                      });
                      setAttendanceRecords(newRecords);
                    }}
                  >
                    Mark All Absent
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAttendanceRecords({})}>
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Mark Attendance</CardTitle>
                <CardDescription>
                  {selectedClass ? `Marking for ${date.toLocaleDateString()}` : "Select a class to begin"}
                </CardDescription>
              </div>
              <ExportMenu
                filename="teacher-attendance"
                title="Attendance"
                headers={["Admission No", "Student Name", "Status"]}
                rows={students.map((student) => [
                  student.admission_no ?? student.admission_number ?? "—",
                  studentDisplayName(student),
                  attendanceRecords[student.id] === "present"
                    ? "Present"
                    : attendanceRecords[student.id] === "absent"
                      ? "Absent"
                      : attendanceRecords[student.id] === "late"
                        ? "Late"
                        : "",
                ])}
                disabled={students.length === 0}
              />
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
                <p className="text-center text-muted-foreground py-8">{emptyStudentsMessage}</p>
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
                        <TableCell>{student.admission_no ?? student.admission_number ?? "—"}</TableCell>
                        <TableCell>{studentDisplayName(student)}</TableCell>
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
