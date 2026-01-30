import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Clock, UserPlus, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface PendingUser {
  id: string;
  user_id: string;
  role: "student" | "teacher" | "parent";
  full_name: string;
  email: string;
  created_at: string;
  admission_no?: string | null;
  employee_no?: string | null;
  class_id?: string | null;
  class_name?: string | null;
}

const PendingUsers = () => {
  const [pendingStudents, setPendingStudents] = useState<PendingUser[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<PendingUser[]>([]);
  const [pendingParents, setPendingParents] = useState<PendingUser[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [approvalData, setApprovalData] = useState({
    admission_no: "",
    employee_no: "",
    class_id: "",
    subject_specialty: "",
  });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPendingUsers();
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) return;
    setSchoolId(profileData.school_id);

    const { data } = await supabase
      .from("classes")
      .select("id, name")
      .eq("school_id", profileData.school_id);
    
    if (data) setClasses(data);
  };

  const fetchPendingUsers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!profileData?.school_id) {
      setLoading(false);
      return;
    }

    // Fetch students without admission numbers (pending)
    const { data: studentsData } = await supabase
      .from("students")
      .select(`
        id,
        user_id,
        admission_no,
        class_id,
        created_at,
        classes(name),
        profiles(full_name, email)
      `)
      .eq("school_id", profileData.school_id)
      .is("admission_no", null);

    if (studentsData) {
      setPendingStudents(studentsData.map(s => ({
        id: s.id,
        user_id: s.user_id || "",
        role: "student" as const,
        full_name: (s.profiles as any)?.full_name || "Unknown",
        email: (s.profiles as any)?.email || "",
        created_at: s.created_at || "",
        admission_no: s.admission_no,
        class_id: s.class_id,
        class_name: (s.classes as any)?.name,
      })));
    }

    // Fetch teachers without employee numbers (pending)
    const { data: teachersData } = await supabase
      .from("teachers")
      .select(`
        id,
        user_id,
        employee_no,
        created_at,
        profiles(full_name, email)
      `)
      .eq("school_id", profileData.school_id)
      .is("employee_no", null);

    if (teachersData) {
      setPendingTeachers(teachersData.map(t => ({
        id: t.id,
        user_id: t.user_id || "",
        role: "teacher" as const,
        full_name: (t.profiles as any)?.full_name || "Unknown",
        email: (t.profiles as any)?.email || "",
        created_at: t.created_at || "",
        employee_no: t.employee_no,
      })));
    }

    // Fetch parents (for visibility - they may not have linked students yet)
    const { data: parentsData } = await supabase
      .from("parents")
      .select(`
        id,
        user_id,
        created_at,
        profiles(full_name, email)
      `)
      .eq("school_id", profileData.school_id);

    if (parentsData) {
      // Check which parents have no linked students
      const parentsWithoutStudents = [];
      for (const parent of parentsData) {
        const { count } = await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("guardian_id", parent.id);
        
        if (count === 0) {
          parentsWithoutStudents.push({
            id: parent.id,
            user_id: parent.user_id || "",
            role: "parent" as const,
            full_name: (parent.profiles as any)?.full_name || "Unknown",
            email: (parent.profiles as any)?.email || "",
            created_at: parent.created_at || "",
          });
        }
      }
      setPendingParents(parentsWithoutStudents);
    }

    setLoading(false);
  };

  const getNextRegistrationNumber = async (type: "student" | "employee") => {
    if (!schoolId) return null;
    
    // Get the next available unused registration number
    const { data } = await supabase
      .from("registration_numbers")
      .select("registration_number")
      .eq("school_id", schoolId)
      .eq("number_type", type)
      .eq("status", "unused")
      .order("registration_number", { ascending: true })
      .limit(1)
      .maybeSingle();
    
    return data?.registration_number || null;
  };

  const openApprovalDialog = async (user: PendingUser) => {
    setSelectedUser(user);
    
    // Auto-fetch next available number
    let nextNumber = "";
    if (user.role === "student") {
      nextNumber = await getNextRegistrationNumber("student") || "";
    } else if (user.role === "teacher") {
      nextNumber = await getNextRegistrationNumber("employee") || "";
    }
    
    setApprovalData({
      admission_no: nextNumber,
      employee_no: nextNumber,
      class_id: user.class_id || "",
      subject_specialty: "",
    });
    setApprovalDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedUser || !schoolId) return;

    try {
      if (selectedUser.role === "student") {
        // Get next available number if not already set
        let admissionNo = approvalData.class_id ? await getNextRegistrationNumber("student") : approvalData.admission_no;
        if (!admissionNo) {
          admissionNo = await getNextRegistrationNumber("student");
        }
        
        if (!admissionNo) {
          return toast.error("No available admission numbers. Please generate new numbers first.");
        }
        
        // Update student record - trigger will mark registration number as used
        const { error } = await supabase
          .from("students")
          .update({
            admission_no: admissionNo,
            class_id: approvalData.class_id || null,
          })
          .eq("id", selectedUser.id);

        if (error) throw error;
        toast.success(`Student approved with admission number: ${admissionNo}`);
      } else if (selectedUser.role === "teacher") {
        // Get next available number if not already set
        let employeeNo = approvalData.employee_no;
        if (!employeeNo) {
          employeeNo = await getNextRegistrationNumber("employee");
        }
        
        if (!employeeNo) {
          return toast.error("No available employee numbers. Please generate new numbers first.");
        }

        // Update teacher record - trigger will mark registration number as used
        const { error } = await supabase
          .from("teachers")
          .update({
            employee_no: employeeNo,
            subject_specialty: approvalData.subject_specialty || null,
          })
          .eq("id", selectedUser.id);

        if (error) throw error;
        toast.success(`Teacher approved with employee number: ${employeeNo}`);
      }

      setApprovalDialogOpen(false);
      fetchPendingUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve user");
    }
  };

  const handleReject = async (user: PendingUser) => {
    if (!confirm(`Are you sure you want to reject ${user.full_name}? This will remove their account.`)) {
      return;
    }

    try {
      // Delete from role-specific table
      if (user.role === "student") {
        await supabase.from("students").delete().eq("id", user.id);
      } else if (user.role === "teacher") {
        await supabase.from("teachers").delete().eq("id", user.id);
      } else if (user.role === "parent") {
        await supabase.from("parents").delete().eq("id", user.id);
      }

      // Note: The profile and auth user would need to be deleted via an edge function
      // for security reasons. For now, we just remove from role table.
      
      toast.success("User rejected successfully");
      fetchPendingUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject user");
    }
  };

  const filterUsers = (users: PendingUser[]) => {
    if (!searchQuery) return users;
    return users.filter(u => 
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const totalPending = pendingStudents.length + pendingTeachers.length + pendingParents.length;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserPlus className="h-7 w-7" />
              Pending User Approvals
            </h2>
            <p className="text-muted-foreground">
              Review and approve self-registered users
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            <Clock className="h-4 w-4 mr-2" />
            {totalPending} Pending
          </Badge>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students" className="relative">
              Students
              {pendingStudents.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingStudents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="teachers" className="relative">
              Teachers
              {pendingTeachers.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingTeachers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="parents" className="relative">
              Parents
              {pendingParents.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingParents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle>Pending Students</CardTitle>
                <CardDescription>
                  Students who registered with your school code but haven't been assigned admission numbers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filterUsers(pendingStudents).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No pending students
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterUsers(pendingStudents).map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>{student.class_name || "Not assigned"}</TableCell>
                          <TableCell>
                            {student.created_at ? format(new Date(student.created_at), "PP") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openApprovalDialog(student)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(student)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teachers">
            <Card>
              <CardHeader>
                <CardTitle>Pending Teachers</CardTitle>
                <CardDescription>
                  Teachers who registered with your school code but haven't been assigned employee numbers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filterUsers(pendingTeachers).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No pending teachers
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterUsers(pendingTeachers).map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-medium">{teacher.full_name}</TableCell>
                          <TableCell>{teacher.email}</TableCell>
                          <TableCell>
                            {teacher.created_at ? format(new Date(teacher.created_at), "PP") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openApprovalDialog(teacher)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(teacher)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parents">
            <Card>
              <CardHeader>
                <CardTitle>Pending Parents</CardTitle>
                <CardDescription>
                  Parents who registered but haven't been linked to any students yet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filterUsers(pendingParents).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No pending parents
                        </TableCell>
                      </TableRow>
                    ) : (
                      filterUsers(pendingParents).map((parent) => (
                        <TableRow key={parent.id}>
                          <TableCell className="font-medium">{parent.full_name}</TableCell>
                          <TableCell>{parent.email}</TableCell>
                          <TableCell>
                            {parent.created_at ? format(new Date(parent.created_at), "PP") : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.location.href = "/admin/parent-student-link"}
                              >
                                Link to Student
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(parent)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Approve {selectedUser?.role === "student" ? "Student" : "Teacher"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.role === "student" 
                ? "Assign a class to activate this student account. An admission number will be auto-assigned."
                : "An employee number will be auto-assigned to activate this account."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{selectedUser?.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              {approvalData.admission_no && selectedUser?.role === "student" && (
                <p className="text-sm text-primary mt-1">
                  Will be assigned: <strong>{approvalData.admission_no}</strong>
                </p>
              )}
              {approvalData.employee_no && selectedUser?.role === "teacher" && (
                <p className="text-sm text-primary mt-1">
                  Will be assigned: <strong>{approvalData.employee_no}</strong>
                </p>
              )}
            </div>

            {selectedUser?.role === "student" && (
              <div className="space-y-2">
                <Label htmlFor="class_id">Assign Class *</Label>
                <Select
                  value={approvalData.class_id}
                  onValueChange={(v) => setApprovalData({ ...approvalData, class_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedUser?.role === "teacher" && (
              <div className="space-y-2">
                <Label htmlFor="subject_specialty">Subject Specialty</Label>
                <Input
                  id="subject_specialty"
                  value={approvalData.subject_specialty}
                  onChange={(e) => setApprovalData({ ...approvalData, subject_specialty: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Activate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PendingUsers;
