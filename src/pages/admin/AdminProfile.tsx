import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { EntityProfilePageLayout } from "@/components/entities/EntityProfilePageLayout";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Lock,
  Key,
  Activity,
  Calendar,
  Mail,
  Phone,
  UserCheck,
  Layers,
  Settings,
  ExternalLink,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const editAdminSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
});

type EditAdminFormData = z.infer<typeof editAdminSchema>;

interface AdminProfileData {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: string;
  is_active: boolean;
  school_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  school?: {
    id: string;
    school_name: string;
    school_code: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
    currency?: string | null;
    current_session?: string | null;
    current_term?: string | null;
  } | null;
  roles?: string[];
  permissions?: string[];
  auditLogs?: Array<{
    id: string;
    action: string;
    entity_type?: string | null;
    details?: any;
    created_at: string;
  }>;
}

export default function AdminProfile() {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const effectiveId = paramId || currentUser?.id;

  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EditAdminFormData>({
    resolver: zodResolver(editAdminSchema),
  });

  useEffect(() => {
    if (effectiveId) {
      fetchAdminProfile(effectiveId);
    }
  }, [effectiveId]);

  const fetchAdminProfile = async (targetId: string) => {
    try {
      setLoading(true);

      // 1. Fetch Profile
      const { data: profData, error: profError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (profError) throw profError;

      if (!profData) {
        setProfile(null);
        return;
      }

      // 2. Fetch School Details if available
      let schoolData = null;
      if (profData.school_id) {
        const { data: sch } = await supabase
          .from("schools")
          .select("*")
          .eq("id", profData.school_id)
          .maybeSingle();
        schoolData = sch;
      }

      // 3. Fetch User Roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);

      const rolesList = (userRoles || []).map((r) => r.role);
      if (!rolesList.includes(profData.role) && profData.role) {
        rolesList.push(profData.role);
      }

      // 4. Fetch User Audit Logs (recent actions)
      let recentLogs: any[] = [];
      try {
        const { data: logs } = await supabase
          .from("audit_logs")
          .select("id, action, entity_type, details, created_at")
          .eq("user_id", targetId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (logs) recentLogs = logs;
      } catch {
        // Audit logs table might be restricted or empty
      }

      const combined: AdminProfileData = {
        ...profData,
        school: schoolData,
        roles: rolesList.length > 0 ? rolesList : [profData.role || "admin"],
        auditLogs: recentLogs,
      };

      setProfile(combined);

      setValue("full_name", combined.full_name || "");
      setValue("phone", combined.phone || "");
    } catch (err: any) {
      console.error("fetchAdminProfile error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to load administrator profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onEditSubmit = async (formData: EditAdminFormData) => {
    if (!profile) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Admin profile updated successfully",
      });

      setEditOpen(false);
      fetchAdminProfile(profile.id);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <i className="ki-filled ki-arrows-circle animate-spin text-3xl text-primary mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Loading administrator details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="admin">
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Admin Record Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2">
            The requested administrator or staff record could not be found or you may not have permission to view it.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/admin" className="kt-btn kt-btn-primary kt-btn-sm">
              Return to Dashboard
            </Link>
            <Link to="/admin/staff" className="kt-btn kt-btn-outline kt-btn-sm">
              View Staff Directory
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const fullName = profile.full_name || "Administrator";
  const email = profile.email || "No email";
  const phone = profile.phone || "No phone";
  const isActive = profile.is_active !== false;
  const isSuperAdmin = profile.role === "super_admin" || profile.roles?.includes("super_admin");
  const schoolName = profile.school?.school_name || "Central Administrative Office";
  const schoolCode = profile.school?.school_code || "—";
  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const roleLabel = isSuperAdmin
    ? "Super Administrator"
    : profile.role === "accountant"
    ? "School Accountant"
    : profile.role === "auditor"
    ? "Internal Auditor"
    : profile.role === "teacher"
    ? "Teacher / Academic Staff"
    : "School Administrator";

  const adminCapabilities = isSuperAdmin
    ? [
        "Full Platform Configuration & Control",
        "Tenant & School Management",
        "Staff & Student Record Oversight",
        "Financial & Fee Structure Control",
        "Exam, Timetable & Academic Permissions",
        "Security & Audit Log Monitoring",
        "RBAC Role & Permission Management",
        "Subscription & Module Entitlements",
      ]
    : [
        "School Dashboard & Analytics",
        "Student Enrollment & Class Management",
        "Teaching Staff & Subject Linking",
        "Attendance & Timetable Oversight",
        "Fee Invoicing & Payment Verification",
        "Report Cards & Academic Assessment",
        "Parent & Student Communications",
        "School Settings & Branding",
      ];

  return (
    <>
      <EntityProfilePageLayout
        role="admin"
        backLink={{ to: "/admin", label: "Back to Dashboard" }}
        entityType={isSuperAdmin ? "Super Admin" : "Administrator"}
        entityCode={schoolCode !== "—" ? `#${schoolCode}` : undefined}
        name={fullName}
        avatarUrl={profile.avatar_url}
        statusText={isActive ? "Active" : "Inactive"}
        statusVariant={isActive ? "success" : "danger"}
        metaItems={[
          {
            icon: "ki-shield-tick",
            text: roleLabel,
          },
          {
            icon: "ki-sms",
            text: email,
          },
          {
            icon: "ki-phone",
            text: phone,
          },
          {
            icon: "ki-bank",
            text: schoolName,
          },
        ]}
        rightMetric={{
          label: "Access Privilege",
          value: isSuperAdmin ? "Root / Super" : "School Admin",
        }}
        generalInfo={[
          {
            label: "Full Name",
            value: fullName,
          },
          {
            label: "Email Address",
            value: email,
          },
          {
            label: "Phone Number",
            value: phone,
          },
          {
            label: "System Role",
            value: (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Shield className="size-3.5 text-primary" />
                {roleLabel}
              </span>
            ),
          },
          {
            label: "School / Campus",
            value: schoolName,
          },
          {
            label: "School Code",
            value: schoolCode,
          },
          {
            label: "Account Status",
            value: (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isActive
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400"
                }`}
              >
                <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                {isActive ? "Active Account" : "Suspended"}
              </span>
            ),
          },
          {
            label: "Member Since",
            value: joinedDate,
          },
        ]}
        stats={[
          {
            label: "Security Level",
            value: isSuperAdmin ? "Level 1" : "Level 2",
            sub: isSuperAdmin ? "Root Access" : "Admin Portal",
          },
          {
            label: "Account Status",
            value: isActive ? "Active" : "Inactive",
            sub: "Authentication OK",
          },
          {
            label: "Assigned Roles",
            value: profile.roles?.length || 1,
            sub: (profile.roles || []).join(", "),
          },
          {
            label: "School Scope",
            value: profile.school?.school_code || "Global",
            sub: "Tenant ID linked",
          },
        ]}
        onRefreshStats={() => fetchAdminProfile(profile.id)}
        onEdit={() => setEditOpen(true)}
        editLabel="Edit Profile"
        customTabs={[
          {
            id: "permissions",
            label: "Permissions & Roles",
            content: (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="kt-card p-5 border border-border rounded-xl bg-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" />
                      Assigned Capabilities
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {isSuperAdmin ? "All Privileges" : "Standard Admin"}
                    </Badge>
                  </div>
                  <div className="space-y-2.5 pt-1">
                    {adminCapabilities.map((cap, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-foreground">{cap}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Need to modify role permissions?</span>
                    <Link
                      to="/admin/roles"
                      className="kt-btn kt-btn-outline kt-btn-sm text-xs gap-1.5"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Role Manager
                    </Link>
                  </div>
                </div>

                <div className="kt-card p-5 border border-border rounded-xl bg-card space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Security & Authentication
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">256-bit TLS</span>
                  </div>
                  <div className="divide-y divide-border/40 text-xs sm:text-sm">
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Authentication Method:</span>
                      <span className="font-medium text-foreground">Email & Password</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="font-mono text-xs text-muted-foreground">{profile.id}</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Account Status:</span>
                      <span className="text-emerald-500 font-semibold">Active / Verified</span>
                    </div>
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-muted-foreground">Password Recovery:</span>
                      <Link
                        to="/settings"
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Change in Settings
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "organization",
            label: "School & Campus",
            content: (
              <div className="kt-card p-5 border border-border rounded-xl bg-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    School Organization Information
                  </h3>
                  <Link
                    to="/admin/school-settings"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Manage School
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm pt-2">
                  <div className="p-4 rounded-lg bg-accent/30 border border-border/40 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                      Institution Name
                    </span>
                    <span className="text-base font-bold text-foreground block">{schoolName}</span>
                    <span className="text-xs text-muted-foreground font-mono block">Code: {schoolCode}</span>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/30 border border-border/40 space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                      Academic Context
                    </span>
                    <span className="text-sm font-medium text-foreground block">
                      Session: {profile.school?.current_session || "2025/2026"}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      Term: {profile.school?.current_term || "Term 1"}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border/40 text-xs sm:text-sm pt-2">
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Campus Address:</span>
                    <span className="font-medium text-foreground">{profile.school?.address || "—"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Official Phone:</span>
                    <span className="font-medium text-foreground">{profile.school?.phone || "—"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-muted-foreground">Official Email:</span>
                    <span className="font-medium text-foreground">{profile.school?.email || "—"}</span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "activity",
            label: "Activity & Audit",
            content: (
              <div className="kt-card p-5 border border-border rounded-xl bg-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Recent Administrative Actions
                  </h3>
                  <Link
                    to="/admin/audit-logs"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    Full Audit Logs
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {profile.auditLogs && profile.auditLogs.length > 0 ? (
                  <div className="divide-y divide-border/40 text-xs sm:text-sm">
                    {profile.auditLogs.map((log) => (
                      <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-foreground capitalize">
                              {log.action?.replace(/_/g, " ") || "Admin Action"}
                            </p>
                            {log.entity_type && (
                              <p className="text-[11px] text-muted-foreground">
                                Target: {log.entity_type}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No recent audit activity records found for this administrator account.
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Edit Admin Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Administrator Profile</DialogTitle>
            <DialogDescription>Update contact information and profile details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register("phone")} placeholder="+233..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
