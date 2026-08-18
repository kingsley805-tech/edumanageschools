import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { assignTeacherClassSubjects } from "@/lib/teacherClassSubjects";
import { BookOpen, Link2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TeacherOption = {
  id: string;
  employee_no: string | null;
  subject_specialty: string | null;
  profiles?: { full_name?: string } | null;
};

type ClassOption = {
  id: string;
  name: string;
  level: string | null;
};

type SubjectOption = {
  id: string;
  name: string;
  code: string | null;
};

type AssignmentRow = {
  id: string;
  class_id: string;
  subject_id: string;
  classes?: { name?: string; level?: string | null } | null;
  subjects?: { name?: string; code?: string | null } | null;
};

const TeacherClassLink = () => {
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void fetchTeachers();
    void fetchClasses();
    void fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      void fetchAssignments();
    } else {
      setAssignments([]);
    }
  }, [selectedTeacher]);

  useEffect(() => {
    setSelectedSubjectIds([]);
  }, [selectedClass, selectedTeacher]);

  const assignedSubjectIdsForClass = useMemo(() => {
    if (!selectedClass) return new Set<string>();
    return new Set(
      assignments
        .filter((assignment) => assignment.class_id === selectedClass)
        .map((assignment) => assignment.subject_id),
    );
  }, [assignments, selectedClass]);

  const fetchTeachers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;

    const { data } = await supabase
      .from("teachers")
      .select("id, employee_no, subject_specialty, profiles(full_name)")
      .eq("school_id", profileData.school_id);

    if (data) setTeachers(data as TeacherOption[]);
  };

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;

    const { data } = await supabase
      .from("classes")
      .select("id, name, level")
      .eq("school_id", profileData.school_id);

    if (data) setClasses(data as ClassOption[]);
  };

  const fetchSubjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;

    const { data } = await supabase
      .from("subjects")
      .select("id, name, code")
      .eq("school_id", profileData.school_id);

    if (data) setSubjects(data as SubjectOption[]);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from("class_subjects")
      .select(`
        id,
        class_id,
        subject_id,
        classes(name, level),
        subjects(name, code)
      `)
      .eq("teacher_id", selectedTeacher);

    if (data) setAssignments(data as AssignmentRow[]);
  };

  const toggleSubject = (subjectId: string, checked: boolean) => {
    setSelectedSubjectIds((prev) =>
      checked ? [...prev, subjectId] : prev.filter((id) => id !== subjectId),
    );
  };

  const handleAssignAllSubjects = () => {
    if (!selectedClass) {
      toast({
        title: "Select a class first",
        variant: "destructive",
      });
      return;
    }

    const available = subjects
      .map((subject) => subject.id)
      .filter((id) => !assignedSubjectIdsForClass.has(id));

    setSelectedSubjectIds(available);
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacher || !selectedClass || selectedSubjectIds.length === 0) return;

    setSubmitting(true);
    try {
      const { assigned, skipped } = await assignTeacherClassSubjects(
        selectedTeacher,
        selectedClass,
        selectedSubjectIds,
      );

      if (assigned === 0 && skipped > 0) {
        toast({
          title: "Already assigned",
          description: "This teacher is already assigned to the selected subject(s) for this class",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description:
          assigned > 0 && skipped > 0
            ? `Assigned ${assigned} subject${assigned === 1 ? "" : "s"}. ${skipped} already existed.`
            : `Assigned ${assigned} subject${assigned === 1 ? "" : "s"} successfully`,
      });

      setSelectedSubjectIds([]);
      await fetchAssignments();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Assignment failed",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("class_subjects")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });

      await fetchAssignments();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Remove failed",
        variant: "destructive",
      });
    }
  };

  const selectedTeacherName = teachers.find((teacher) => teacher.id === selectedTeacher)?.profiles?.full_name;

  return (
    <DashboardLayout role="admin">
      <div className="mingo-content space-y-6">
        <div>
          <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">Teacher-Class Assignments</h2>
          <p className="text-[12.5px] text-muted-foreground mt-1">Assign teachers to classes and the subjects they teach</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Assign Teacher to Class
            </CardTitle>
            <CardDescription>Select a teacher, class, and one or more subjects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.profiles?.full_name}
                        {teacher.subject_specialty ? ` (${teacher.subject_specialty})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  disabled={!selectedTeacher}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.level ? ` (${cls.level})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>
                  Subjects
                  {selectedSubjectIds.length > 0 ? ` (${selectedSubjectIds.length} selected)` : ""}
                </Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={handleAssignAllSubjects}
                  disabled={!selectedClass || subjects.length === 0}
                >
                  Select all subjects
                </Button>
              </div>
              <div className="max-h-52 overflow-y-auto rounded-md border bg-background p-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground col-span-full">No subjects available.</p>
                ) : (
                  subjects.map((subject) => {
                    const alreadyAssigned = assignedSubjectIdsForClass.has(subject.id);
                    return (
                      <label
                        key={subject.id}
                        className={`flex items-center gap-2 text-sm ${
                          !selectedClass || alreadyAssigned
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={alreadyAssigned || selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={(checked) => toggleSubject(subject.id, checked === true)}
                          disabled={!selectedClass || alreadyAssigned}
                        />
                        <span className="truncate">
                          {subject.name}
                          {subject.code ? ` (${subject.code})` : ""}
                          {alreadyAssigned ? " — assigned" : ""}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {!selectedClass && (
                <p className="text-xs text-muted-foreground">Select a class to choose subjects.</p>
              )}
            </div>

            <Button
              onClick={() => void handleAssignTeacher()}
              disabled={!selectedTeacher || !selectedClass || selectedSubjectIds.length === 0 || submitting}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              {submitting
                ? "Assigning…"
                : `Assign ${selectedSubjectIds.length > 0 ? selectedSubjectIds.length : ""} Subject${selectedSubjectIds.length === 1 ? "" : "s"}`.trim()}
            </Button>
          </CardContent>
        </Card>

        {selectedTeacher && (
          <Card>
            <CardHeader>
              <CardTitle>Current Assignments</CardTitle>
              <CardDescription>
                Classes and subjects taught by{" "}
                <Link
                  to={`/admin/teachers/${selectedTeacher}`}
                  className="text-primary font-semibold hover:underline"
                >
                  {selectedTeacherName}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No assignments for this teacher yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.classes?.name ? (
                            <Link
                              to={`/admin/classes/${assignment.class_id || assignment.classes.name}`}
                              className="text-foreground hover:text-primary hover:underline font-semibold"
                            >
                              {assignment.classes.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{assignment.classes?.level}</TableCell>
                        <TableCell>{assignment.subjects?.name}</TableCell>
                        <TableCell>{assignment.subjects?.code}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemoveAssignment(assignment.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherClassLink;
