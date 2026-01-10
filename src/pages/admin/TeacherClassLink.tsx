import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { BookOpen, Link2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TeacherClassLink = () => {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      fetchAssignments();
    }
  }, [selectedTeacher]);

  const fetchTeachers = async () => {
    // Get current user's school_id for filtering
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
    
    if (data) setTeachers(data);
  };

  const fetchClasses = async () => {
    // Get current user's school_id for filtering
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
    
    if (data) setClasses(data);
  };

  const fetchSubjects = async () => {
    // Get current user's school_id for filtering
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
    
    if (data) setSubjects(data);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from("class_subjects")
      .select(`
        id,
        classes(name, level),
        subjects(name, code)
      `)
      .eq("teacher_id", selectedTeacher);
    
    if (data) setAssignments(data);
  };

  const handleAssignTeacher = async () => {
    if (!selectedTeacher || !selectedClass || !selectedSubject) return;

    try {
      // Check if assignment already exists
      const { data: existing } = await supabase
        .from("class_subjects")
        .select("id")
        .eq("teacher_id", selectedTeacher)
        .eq("class_id", selectedClass)
        .eq("subject_id", selectedSubject)
        .single();

      if (existing) {
        toast({
          title: "Already assigned",
          description: "This teacher is already assigned to this class-subject combination",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("class_subjects")
        .insert({
          teacher_id: selectedTeacher,
          class_id: selectedClass,
          subject_id: selectedSubject,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Teacher assigned to class successfully",
      });

      setSelectedClass("");
      setSelectedSubject("");
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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

      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teacher-Class Assignments</h2>
          <p className="text-muted-foreground">Assign teachers to classes and subjects they teach</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Assign Teacher to Class
            </CardTitle>
            <CardDescription>Select teacher, class, and subject to create an assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.profiles?.full_name} ({teacher.subject_specialty})
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
                        {cls.name} ({cls.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select 
                  value={selectedSubject} 
                  onValueChange={setSelectedSubject}
                  disabled={!selectedTeacher}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleAssignTeacher}
              disabled={!selectedTeacher || !selectedClass || !selectedSubject}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Assign Teacher
            </Button>
          </CardContent>
        </Card>

        {selectedTeacher && (
          <Card>
            <CardHeader>
              <CardTitle>Current Assignments</CardTitle>
              <CardDescription>
                Classes and subjects taught by {teachers.find(t => t.id === selectedTeacher)?.profiles?.full_name}
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
                        <TableCell className="font-medium">{assignment.classes?.name}</TableCell>
                        <TableCell>{assignment.classes?.level}</TableCell>
                        <TableCell>{assignment.subjects?.name}</TableCell>
                        <TableCell>{assignment.subjects?.code}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAssignment(assignment.id)}
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