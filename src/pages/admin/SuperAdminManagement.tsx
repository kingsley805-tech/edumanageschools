import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield, School, UserPlus, Trash2, Search, Building } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SuperAdmin {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  assigned_schools: { id: string; school_name: string; school_code: string }[];
}

interface School {
  id: string;
  school_name: string;
  school_code: string;
  is_active: boolean;
}

const SuperAdminManagement = () => {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<SuperAdmin | null>(null);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all super admins
      const { data: superAdminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (rolesError) throw rolesError;

      if (superAdminRoles && superAdminRoles.length > 0) {
        const userIds = superAdminRoles.map(r => r.user_id);
        
        // Fetch profiles for super admins
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        // Fetch school assignments
        const { data: assignments, error: assignmentsError } = await supabase
          .from("super_admin_schools")
          .select(`
            user_id,
            school_id,
            schools:school_id (id, school_name, school_code)
          `)
          .in("user_id", userIds);

        if (assignmentsError) throw assignmentsError;

        // Combine data
        const adminsWithSchools = profiles?.map(profile => ({
          id: profile.id,
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name || "Unknown",
          assigned_schools: assignments
            ?.filter(a => a.user_id === profile.id)
            .map(a => a.schools as any)
            .filter(Boolean) || []
        })) || [];

        setSuperAdmins(adminsWithSchools);
      }

      // Fetch all schools
      const { data: schools, error: schoolsError } = await supabase
        .from("schools")
        .select("id, school_name, school_code, is_active")
        .eq("is_active", true);

      if (schoolsError) throw schoolsError;
      setAllSchools(schools || []);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load super admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSchools = async () => {
    if (!selectedAdmin) return;

    try {
      // Delete existing assignments
      await supabase
        .from("super_admin_schools")
        .delete()
        .eq("user_id", selectedAdmin.user_id);

      // Insert new assignments
      if (selectedSchools.length > 0) {
        const { error } = await supabase
          .from("super_admin_schools")
          .insert(
            selectedSchools.map(schoolId => ({
              user_id: selectedAdmin.user_id,
              school_id: schoolId,
            }))
          );

        if (error) throw error;
      }

      toast.success("School assignments updated successfully");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error assigning schools:", error);
      toast.error("Failed to update school assignments");
    }
  };

  const openAssignDialog = (admin: SuperAdmin) => {
    setSelectedAdmin(admin);
    setSelectedSchools(admin.assigned_schools.map(s => s.id));
    setDialogOpen(true);
  };

  const toggleSchool = (schoolId: string) => {
    setSelectedSchools(prev =>
      prev.includes(schoolId)
        ? prev.filter(id => id !== schoolId)
        : [...prev, schoolId]
    );
  };

  const filteredAdmins = superAdmins.filter(admin =>
    admin.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const layoutRole = role === "super_admin" ? "admin" : (role as "admin" | "teacher" | "parent" | "student");

  return (
    <DashboardLayout role={layoutRole}>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Super Admin Management</h1>
          <p className="text-muted-foreground">
            Manage super administrators and their school assignments
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdmins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSchools.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {superAdmins.reduce((acc, admin) => acc + admin.assigned_schools.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Super Administrators</CardTitle>
          <CardDescription>
            View and manage super admin users and their school access
          </CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No super admins found</p>
              <p className="text-sm">Super admins can sign up using the special Super Admin key</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Schools</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.full_name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.assigned_schools.length === 0 ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            No schools assigned
                          </Badge>
                        ) : (
                          admin.assigned_schools.map((school) => (
                            <Badge key={school.id} variant="secondary">
                              {school.school_name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={dialogOpen && selectedAdmin?.id === admin.id} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignDialog(admin)}
                          >
                            <School className="h-4 w-4 mr-2" />
                            Manage Schools
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Assign Schools to {admin.full_name}</DialogTitle>
                            <DialogDescription>
                              Select the schools this super admin should have access to
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4 max-h-[300px] overflow-y-auto">
                            {allSchools.map((school) => (
                              <div key={school.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted">
                                <Checkbox
                                  id={school.id}
                                  checked={selectedSchools.includes(school.id)}
                                  onCheckedChange={() => toggleSchool(school.id)}
                                />
                                <Label htmlFor={school.id} className="flex-1 cursor-pointer">
                                  <div className="font-medium">{school.school_name}</div>
                                  <div className="text-sm text-muted-foreground">{school.school_code}</div>
                                </Label>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAssignSchools}>
                              Save Assignments
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminManagement;
