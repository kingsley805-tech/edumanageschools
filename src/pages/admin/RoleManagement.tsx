import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";
import { clearPermissionCache } from "@/hooks/usePermissions";
import { writeAuditLog } from "@/lib/auditLog";
import { Shield, Copy, Search, UserPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface PermissionRow {
  id: string;
  module: string;
  action: string;
  code: string;
  description: string | null;
}

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
}

const RoleManagement = () => {
  const { toast } = useToast();
  const { schoolId, hasPermission, invalidateCache, isSchoolAdmin, isSuperAdmin } = usePermissions();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(new Set());
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  const canManagePermissions = isSchoolAdmin || isSuperAdmin || hasPermission(PERMISSIONS.admin.managePermissions);
  const editableRoleSlugs = new Set(["accountant", "auditor", "teacher"]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const groupedPermissions = useMemo(() => {
    const filtered = permissions.filter(
      (p) =>
        !search ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.module.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce<Record<string, PermissionRow[]>>((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {});
  }, [permissions, search]);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("roles").select("*").or("school_id.is.null,school_id.eq." + (schoolId ?? "null")).order("name"),
      supabase.from("permissions").select("*").order("module").order("action"),
    ]);
    if (rolesRes.data) setRoles(rolesRes.data as RoleRow[]);
    if (permsRes.data) setPermissions(permsRes.data as PermissionRow[]);

    if (schoolId) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("school_id", schoolId);
      if (profiles) {
        const ids = profiles.map((p) => p.id);
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids)
          .in("role", ["admin", "accountant", "auditor", "teacher", "super_admin"]);
        const staffIds = new Set((adminRoles ?? []).map((r) => r.user_id));
        setStaff(
          profiles
            .filter((p) => staffIds.has(p.id))
            .map((p) => ({ id: p.id, full_name: p.full_name ?? "", email: p.email ?? "" }))
        );
      }
    }
    setLoading(false);
  };

  const fetchRolePermissions = async (roleId: string) => {
    const { data } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    setRolePermissionIds(new Set((data ?? []).map((r) => r.permission_id)));
  };

  useEffect(() => {
    fetchData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedRoleId) fetchRolePermissions(selectedRoleId);
  }, [selectedRoleId]);

  useEffect(() => {
    if (roles.length && !selectedRoleId) setSelectedRoleId(roles[0]?.id ?? "");
  }, [roles, selectedRoleId]);

  const togglePermission = async (permId: string, checked: boolean) => {
    if (!selectedRoleId || !schoolId) return;
    if (!canManagePermissions) {
      toast({ title: "Denied", description: "You cannot modify permissions.", variant: "destructive" });
      return;
    }

    if (selectedRole?.is_system && selectedRole.slug === "school_admin" && !isSuperAdmin) {
      toast({
        title: "Protected role",
        description: "School Admin permissions are fixed. Edit Accountant, Auditor, or custom roles for staff.",
        variant: "destructive",
      });
      return;
    }

    if (checked) {
      const { error } = await supabase.from("role_permissions").insert({
        role_id: selectedRoleId,
        permission_id: permId,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setRolePermissionIds((prev) => new Set(prev).add(permId));
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRoleId)
        .eq("permission_id", permId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      setRolePermissionIds((prev) => {
        const next = new Set(prev);
        next.delete(permId);
        return next;
      });
    }

    const perm = permissions.find((p) => p.id === permId);
    await writeAuditLog({
      schoolId,
      actionType: checked ? "permission_granted" : "permission_revoked",
      entityType: "role",
      entityId: selectedRoleId,
      module: "rbac",
      details: { permission_code: perm?.code, role_slug: selectedRole?.slug },
    });
    clearPermissionCache();
    invalidateCache();
  };

  const cloneRole = async () => {
    if (!selectedRole || !schoolId) return;
    const newSlug = `${selectedRole.slug}_copy_${Date.now().toString(36).slice(-4)}`;
    const { data: newRole, error } = await supabase
      .from("roles")
      .insert({
        school_id: schoolId,
        slug: newSlug,
        name: `${selectedRole.name} (Copy)`,
        description: selectedRole.description,
        is_system: false,
      })
      .select()
      .single();
    if (error || !newRole) {
      toast({ title: "Clone failed", description: error?.message, variant: "destructive" });
      return;
    }
    const inserts = [...rolePermissionIds].map((pid) => ({
      role_id: newRole.id,
      permission_id: pid,
    }));
    if (inserts.length) await supabase.from("role_permissions").insert(inserts);
    toast({ title: "Role cloned", description: newRole.name });
    fetchData();
    setSelectedRoleId(newRole.id);
  };

  const assignRoleToUser = async () => {
    if (!assignUserId || !assignRoleId || !schoolId) return;
    const role = roles.find((r) => r.id === assignRoleId);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("user_role_assignments").insert({
      user_id: assignUserId,
      role_id: assignRoleId,
      school_id: schoolId,
      assigned_by: user?.id,
    });
    if (error) {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
      return;
    }

    const portalMap: Record<string, string> = {
      school_admin: "admin",
      accountant: "accountant",
      auditor: "auditor",
      teacher: "teacher",
    };
    const portalRole = role ? portalMap[role.slug] : null;
    if (portalRole) {
      await supabase.from("user_roles").upsert(
        { user_id: assignUserId, role: portalRole as "admin" },
        { onConflict: "user_id,role" }
      );
    }

    await writeAuditLog({
      schoolId,
      actionType: "role_assigned",
      entityType: "user",
      entityId: assignUserId,
      module: "rbac",
      details: { role_slug: role?.slug },
    });
    toast({ title: "Role assigned" });
    clearPermissionCache();
  };

  const createSchoolRole = async () => {
    if (!schoolId || !newRoleName.trim()) return;
    setCreatingRole(true);
    const slug = newRoleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const { data: newRole, error } = await supabase
      .from("roles")
      .insert({
        school_id: schoolId,
        slug: `${slug}_${Date.now().toString(36).slice(-4)}`,
        name: newRoleName.trim(),
        description: "Custom staff role",
        is_system: false,
      })
      .select()
      .single();
    setCreatingRole(false);
    if (error || !newRole) {
      toast({ title: "Could not create role", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Role created", description: "Assign permissions below, then assign staff on the User Assignments tab." });
    setNewRoleName("");
    await fetchData();
    setSelectedRoleId(newRole.id);
  };

  const layoutRole = "admin";
  const roleCanEditPermissions = (r: RoleRow) =>
    !r.is_system || editableRoleSlugs.has(r.slug) || (r.slug === "school_admin" && isSuperAdmin);

  return (
    <PermissionGate anyOf={[PERMISSIONS.admin.manageRoles]} showDenied>
      <DashboardLayout role={layoutRole}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8" />
                Roles & Permissions
              </h1>
              <p className="text-muted-foreground">
                Give employees access: pick a role, toggle permissions, then assign the role on User Assignments.
              </p>
            </div>
          </div>

          <Tabs defaultValue="permissions">
            <TabsList>
              <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
              <TabsTrigger value="assignments">User Assignments</TabsTrigger>
            </TabsList>

            <TabsContent value="permissions" className="space-y-4">
              <div className="grid lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-lg">Roles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {roles.map((r) => (
                      <Button
                        key={r.id}
                        variant={selectedRoleId === r.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSelectedRoleId(r.id)}
                      >
                        {r.name}
                        {r.is_system && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            System
                          </Badge>
                        )}
                      </Button>
                    ))}
                    {selectedRole && !selectedRole.is_system && (
                      <Button variant="secondary" className="w-full mt-2" onClick={cloneRole}>
                        <Copy className="h-4 w-4 mr-2" />
                        Clone role
                      </Button>
                    )}
                    <div className="pt-3 space-y-2 border-t mt-3">
                      <Label className="text-xs">New custom role</Label>
                      <Input
                        placeholder="e.g. Bursar"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        className="w-full"
                        size="sm"
                        disabled={!newRoleName.trim() || creatingRole}
                        onClick={createSchoolRole}
                      >
                        Create role
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                  <CardHeader>
                    <CardTitle>{selectedRole?.name ?? "Select a role"}</CardTitle>
                    <CardDescription>{selectedRole?.description}</CardDescription>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search permissions..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="max-h-[60vh] overflow-y-auto space-y-6">
                    {loading ? (
                      <p className="text-muted-foreground">Loading...</p>
                    ) : (
                      Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module}>
                          <h3 className="font-semibold capitalize mb-2">{module.replace(/_/g, " ")}</h3>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {perms.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={rolePermissionIds.has(p.id)}
                                  onCheckedChange={(c) => togglePermission(p.id, c === true)}
                                  disabled={
                                    !selectedRole ||
                                    !roleCanEditPermissions(selectedRole) ||
                                    !canManagePermissions
                                  }
                                />
                                <div>
                                  <span className="text-sm font-medium">{p.action}</span>
                                  <p className="text-xs text-muted-foreground">{p.code}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assignments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Assign role to staff
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Staff member</Label>
                    <Select value={assignUserId} onValueChange={setAssignUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name} ({s.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter(
                            (r) =>
                              ["accountant", "auditor", "teacher"].includes(r.slug) ||
                              (r.school_id === schoolId && !r.is_system),
                          )
                          .map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={assignRoleToUser} disabled={!assignUserId || !assignRoleId}>
                      Assign role
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Current assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <AssignmentsTable schoolId={schoolId} roles={roles} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </PermissionGate>
  );
};

function AssignmentsTable({
  schoolId,
  roles,
}: {
  schoolId: string | null;
  roles: RoleRow[];
}) {
  const [rows, setRows] = useState<{ user_name: string; role_name: string }[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("user_id, role_id")
        .eq("school_id", schoolId);
      if (assignments?.length) {
        const userIds = [...new Set(assignments.map((a) => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
        setRows(
          assignments.map((d) => ({
            user_name: nameMap.get(d.user_id) ?? d.user_id,
            role_name: roles.find((r) => r.id === d.role_id)?.name ?? "",
          }))
        );
      }
    })();
  }, [schoolId, roles]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            <TableCell>{r.user_name}</TableCell>
            <TableCell>{r.role_name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default RoleManagement;
