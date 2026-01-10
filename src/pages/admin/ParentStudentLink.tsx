import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Link2, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ParentStudentLink = () => {
  const [parents, setParents] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedParent, setSelectedParent] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [linkedStudents, setLinkedStudents] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchParents();
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedParent) {
      fetchLinkedStudents();
    }
  }, [selectedParent]);

  const fetchParents = async () => {
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
      .from("parents")
      .select("id, profiles(full_name, email)")
      .eq("school_id", profileData.school_id);
    
    if (data) setParents(data);
  };

  const fetchStudents = async () => {
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
      .from("students")
      .select("id, admission_no, profiles(full_name)")
      .eq("school_id", profileData.school_id);
    
    if (data) setStudents(data);
  };

  const fetchLinkedStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select(`
        id,
        admission_no,
        profiles(full_name, email),
        classes(name)
      `)
      .eq("guardian_id", selectedParent);
    
    if (data) setLinkedStudents(data);
  };

  const handleLinkStudent = async () => {
    if (!selectedParent || !selectedStudent) return;

    try {
      const { error } = await supabase
        .from("students")
        .update({ guardian_id: selectedParent })
        .eq("id", selectedStudent);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student linked to parent successfully",
      });

      setSelectedStudent("");
      fetchLinkedStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnlinkStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("students")
        .update({ guardian_id: null })
        .eq("id", studentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student unlinked from parent",
      });

      fetchLinkedStudents();
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
          <h2 className="text-3xl font-bold tracking-tight">Parent-Student Links</h2>
          <p className="text-muted-foreground">Link parent accounts to their children's accounts</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Link Student to Parent
            </CardTitle>
            <CardDescription>Select a parent and student to create a link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parent Account</Label>
                <Select value={selectedParent} onValueChange={setSelectedParent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.profiles?.full_name} ({parent.profiles?.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Student Account</Label>
                <Select 
                  value={selectedStudent} 
                  onValueChange={setSelectedStudent}
                  disabled={!selectedParent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.admission_no} - {student.profiles?.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleLinkStudent}
              disabled={!selectedParent || !selectedStudent}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Link Student to Parent
            </Button>
          </CardContent>
        </Card>

        {selectedParent && (
          <Card>
            <CardHeader>
              <CardTitle>Linked Students</CardTitle>
              <CardDescription>
                Students linked to {parents.find(p => p.id === selectedParent)?.profiles?.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedStudents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No students linked to this parent yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.admission_no}</TableCell>
                        <TableCell>{student.profiles?.full_name}</TableCell>
                        <TableCell>{student.profiles?.email}</TableCell>
                        <TableCell>{student.classes?.name || "Not assigned"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkStudent(student.id)}
                          >
                            Unlink
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

export default ParentStudentLink;