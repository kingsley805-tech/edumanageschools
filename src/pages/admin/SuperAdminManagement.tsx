import { useState, useEffect } from "react";
import PlatformLayout from "@/platform/components/PlatformLayout";
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
import { Shield, School, Trash2, Search, UserCheck, Lock, Unlock, Mail, Phone, MessageSquare, ExternalLink, CheckCheck, RefreshCw, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePublicSignup } from "@/hooks/usePublicSignup";
import {
  fetchContactInquiries,
  updateInquiryStatus,
  deleteInquiry,
  type ContactInquiryRecord,
} from "@/lib/contactInquiriesApi";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportMenu } from "@/modules/lib/ExportMenu";

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
  const { isSignupEnabled, isLoading: signupLoading, setSignupEnabled } = usePublicSignup();
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<SuperAdmin | null>(null);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Inquiries State
  const [inquiries, setInquiries] = useState<ContactInquiryRecord[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiryRecord | null>(null);
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    loadInquiries();

    const handleInquiriesUpdated = () => {
      loadInquiries();
    };
    window.addEventListener("edumanage_inquiries_updated", handleInquiriesUpdated);
    return () => {
      window.removeEventListener("edumanage_inquiries_updated", handleInquiriesUpdated);
    };
  }, []);

  const loadInquiries = async () => {
    setInquiriesLoading(true);
    try {
      const data = await fetchContactInquiries();
      setInquiries(data);
    } catch {
      // ignore
    } finally {
      setInquiriesLoading(false);
    }
  };

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
    return null;
  }

  const unreadInquiries = inquiries.filter((i) => i.status === "unread").length;

  return (
    <PlatformLayout
      title="Team and settings"
      description="Super admins, public signup, and contact inquiries"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Super admins</CardDescription>
              <CardTitle className="text-2xl">{superAdmins.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Schools</CardDescription>
              <CardTitle className="text-2xl">{allSchools.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assignments</CardDescription>
              <CardTitle className="text-2xl">
                {superAdmins.reduce((acc, admin) => acc + admin.assigned_schools.length, 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Inquiries</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                {inquiries.length}
                {unreadInquiries > 0 ? (
                  <Badge variant="secondary" className="text-xs">{unreadInquiries} new</Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="signup">Public signup</TabsTrigger>
            <TabsTrigger value="inquiries">
              Inquiries{unreadInquiries > 0 ? ` (${unreadInquiries})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signup" className="space-y-4">

      {/* Global Public Sign-Up Enable / Disable Card */}
      <Card className="border-border/80 bg-card/90 shadow-md backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  Public Portal Sign-Up & Registration
                </CardTitle>
                <Badge
                  variant={isSignupEnabled ? "default" : "secondary"}
                  className={
                    isSignupEnabled
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }
                >
                  {isSignupEnabled ? (
                    <span className="flex items-center gap-1">
                      <Unlock className="size-3" /> Registration Open
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Lock className="size-3" /> Registration Disabled (Invite Only)
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Control whether new users can register themselves on the public /auth portal. When disabled, the &quot;Create account&quot; tab is hidden, and only administrators can invite or create users.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Label htmlFor="public-signup-switch" className="text-xs font-semibold cursor-pointer">
                {isSignupEnabled ? "Sign-ups Active" : "Sign-ups Locked"}
              </Label>
              <Switch
                id="public-signup-switch"
                checked={isSignupEnabled}
                disabled={signupLoading}
                onCheckedChange={async (checked) => {
                  const success = await setSignupEnabled(checked);
                  if (success) {
                    toast.success(
                      checked
                        ? "Public account registration is now ENABLED across the platform."
                        : "Public account registration is now DISABLED (Sign-up button hidden on /auth)."
                    );
                  } else {
                    toast.error("Failed to update registration setting");
                  }
                }}
              />
            </div>
          </div>
        </CardHeader>
      </Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Super Administrators</CardTitle>
              <CardDescription>
                View and manage super admin users and their school access
              </CardDescription>
            </div>
            <ExportMenu
              filename="super-admins"
              title="Super Administrators"
              headers={["Name", "Email", "Assigned Schools"]}
              rows={filteredAdmins.map((admin) => [
                admin.full_name,
                admin.email,
                admin.assigned_schools.length === 0
                  ? "No schools assigned"
                  : admin.assigned_schools.map((s) => s.school_name).join(", "),
              ])}
              disabled={filteredAdmins.length === 0}
            />
          </div>
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
          </TabsContent>

          <TabsContent value="inquiries" className="space-y-4">
      <Card className="border-border/80 bg-card/90 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="size-4 text-blue-400" />
                Public Contact & Deployment Inquiries
              </CardTitle>
              <CardDescription className="text-xs">
                Inquiries submitted by prospective schools, partners, and visitors from the public /contact desk
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInquiries}
              disabled={inquiriesLoading}
              className="self-start sm:self-auto text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${inquiriesLoading ? "animate-spin" : ""}`} />
              Refresh Messages
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <MessageSquare className="mx-auto size-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No contact messages received yet</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                When visitors submit forms on the /contact page, their inquiries will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead>Sender & School</TableHead>
                    <TableHead>Subject & Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inquiries.map((inq) => (
                    <TableRow
                      key={inq.id}
                      className={inq.status === "unread" ? "bg-primary/[0.04] font-medium" : ""}
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(inq.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-foreground">{inq.name}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{inq.email}</span>
                          {inq.phone && <span>· {inq.phone}</span>}
                        </div>
                        {inq.institution_name && (
                          <div className="text-[10px] text-primary mt-0.5">
                            🏫 {inq.institution_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-foreground line-clamp-1">
                          {inq.subject || "(No Subject)"}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {inq.message}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            inq.status === "unread"
                              ? "bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]"
                              : inq.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {inq.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setSelectedInquiry(inq);
                              setInquiryDialogOpen(true);
                              if (inq.status === "unread") {
                                updateInquiryStatus(inq.id, "read");
                                setInquiries((prev) =>
                                  prev.map((i) => (i.id === inq.id ? { ...i, status: "read" } : i))
                                );
                              }
                            }}
                          >
                            <Eye className="size-3.5 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={async () => {
                              await deleteInquiry(inq.id);
                              setInquiries((prev) => prev.filter((i) => i.id !== inq.id));
                              toast.success("Inquiry removed");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inquiry Detail Dialog */}
      <Dialog open={inquiryDialogOpen} onOpenChange={setInquiryDialogOpen}>
        <DialogContent className="max-w-xl">
          {selectedInquiry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="text-base font-bold">
                    Inquiry from {selectedInquiry.name}
                  </DialogTitle>
                  <Badge variant="outline" className="capitalize text-xs">
                    {selectedInquiry.category || "General"}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Submitted on {new Date(selectedInquiry.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Email</span>
                    <a
                      href={`mailto:${selectedInquiry.email}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Mail className="size-3" />
                      {selectedInquiry.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Phone</span>
                    {selectedInquiry.phone ? (
                      <a
                        href={`tel:${selectedInquiry.phone}`}
                        className="font-medium text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="size-3" />
                        {selectedInquiry.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </div>
                  {selectedInquiry.institution_name && (
                    <div className="col-span-2 pt-2 border-t border-border/60">
                      <span className="text-muted-foreground block text-[10px] uppercase font-semibold">School / Organization</span>
                      <span className="font-semibold text-foreground block mt-0.5">
                        {selectedInquiry.institution_name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Subject</span>
                  <p className="font-semibold text-foreground text-sm">
                    {selectedInquiry.subject || "(No Subject)"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Message Body</span>
                  <div className="p-3.5 rounded-xl border bg-card text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedInquiry.message}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={async () => {
                      const nextStatus = selectedInquiry.status === "resolved" ? "read" : "resolved";
                      await updateInquiryStatus(selectedInquiry.id, nextStatus);
                      setSelectedInquiry({ ...selectedInquiry, status: nextStatus });
                      setInquiries((prev) =>
                        prev.map((i) => (i.id === selectedInquiry.id ? { ...i, status: nextStatus } : i))
                      );
                      toast.success(`Marked as ${nextStatus}`);
                    }}
                  >
                    <CheckCheck className="size-3.5 mr-1" />
                    {selectedInquiry.status === "resolved" ? "Mark as Open" : "Mark as Resolved"}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild size="sm" className="text-xs bg-primary">
                    <a href={`mailto:${selectedInquiry.email}?subject=Re: ${encodeURIComponent(selectedInquiry.subject || 'EduManage Inquiry')}`}>
                      <Mail className="size-3.5 mr-1" />
                      Reply via Email
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setInquiryDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </PlatformLayout>
  );
};

export default SuperAdminManagement;
