import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, clearPermissionCache } from "@/hooks/usePermissions";
import { writeAuditLog } from "@/lib/auditLog";
import { PORTAL_CATEGORIES } from "@/lib/rbac/permissionCatalog";
import {
  applyDefaultPermissionsForRole,
  assignRoleToUser,
  createRole,
  deleteRole,
  fetchPermissionIdMap,
  fetchRolePermissionCodes,
  fetchRoles,
  logPermissionChange,
  saveRolePermissions,
  updateRole,
  type RoleRow,
} from "@/lib/rbac/rbacService";
import { supabase } from "@/integrations/supabase/client";
import { fetchStaffPortalUsers } from "@/lib/staffUsers";
import {
  Shield,
  Save,
  Loader2,
  Plus,
  Trash2,
  Search,
  Users,
  KeyRound,
} from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PermissionGate } from "@/components/PermissionGate";

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  portal_role: string;
  rbac_role_id: string | null;
  rbac_role_name: string | null;
}

const PROTECTED_SLUGS = new Set(["super_admin", "school_admin"]);

export default function PermissionManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { schoolId, hasPermission, invalidateCache, isSuperAdmin } = usePermissions();
  const canManage = isSuperAdmin || hasPermission("portal.staff_access.manage");

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissionIdMap, setPermissionIdMap] = useState<Map<string, string>>(new Map());
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [newRoleName, setNewRoleName] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isProtectedRole = selectedRole ? PROTECTED_SLUGS.has(selectedRole.slug) : false;
  const isSuperAdminRole = selectedRole?.slug === "super_admin";

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [roles, roleSearch]);

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.slug !== "super_admin"),
    [roles],
  );

  const loadStaff = useCallback(async () => {
    if (!schoolId) return;
    const staffUsers = await fetchStaffPortalUsers(schoolId);
    const staffIds = staffUsers.map((s) => s.id);

    if (!staffIds.length) {
      setStaff([]);
      return;
    }

    const { data: assignments } = await supabase
      .from("user_role_assignments")
      .select("user_id, role_id, roles(id, name, slug)")
      .eq("school_id", schoolId)
      .in("user_id", staffIds);

    const rbacMap = new Map(
      (assignments ?? []).map((a) => [
        a.user_id,
        { id: (a.roles as { id: string; name: string; slug: string })?.id, name: (a.roles as { name: string })?.name },
      ]),
    );

    setStaff(
      staffUsers.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        portal_role: p.portal_role,
        rbac_role_id: rbacMap.get(p.id)?.id ?? null,
        rbac_role_name: rbacMap.get(p.id)?.name ?? null,
      })),
    );
  }, [schoolId]);

  const loadRoles = useCallback(async () => {
    const [roleRows, idMap] = await Promise.all([fetchRoles(schoolId), fetchPermissionIdMap()]);
    setRoles(roleRows);
    setPermissionIdMap(idMap);
  }, [schoolId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadRoles();
        await loadStaff();
      } catch (e) {
        console.error(e);
        toast({ title: "Failed to load permission data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadRoles, loadStaff, toast]);

  useEffect(() => {
    if (!selectedRoleId) return;
    (async () => {
      try {
        const codes = await fetchRolePermissionCodes(selectedRoleId);
        setSelectedCodes(codes);
        setDirty(false);
        const role = roles.find((r) => r.id === selectedRoleId);
        if (role) {
          setEditName(role.name);
          setEditDescription(role.description ?? "");
        }
      } catch {
        toast({ title: "Could not load role permissions", variant: "destructive" });
      }
    })();
  }, [selectedRoleId, roles, toast]);

  const handleSavePermissions = async () => {
    if (!selectedRole || !schoolId || !user || !canManage) return;
    if (isSuperAdminRole) return;
    setSaving(true);
    try {
      await saveRolePermissions(selectedRole.id, selectedCodes, permissionIdMap);
      await logPermissionChange({
        schoolId,
        actorId: user.id,
        actionType: "role_permissions_updated",
        roleId: selectedRole.id,
        details: { slug: selectedRole.slug, count: selectedCodes.size },
      });
      await writeAuditLog({
        schoolId,
        actionType: "update_role_permissions",
        entityType: "role",
        entityId: selectedRole.id,
        details: { role: selectedRole.slug, permissionCount: selectedCodes.size },
      });
      clearPermissionCache();
      invalidateCache();
      setDirty(false);
      toast({ title: "Permissions saved" });
    } catch (e) {
      console.error(e);
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim() || !canManage) return;
    try {
      const row = await createRole({
        schoolId,
        name: newRoleName.trim(),
        description: "Custom school role",
      });
      await applyDefaultPermissionsForRole(row.id, row.slug, permissionIdMap);
      await loadRoles();
      setSelectedRoleId(row.id);
      setNewRoleName("");
      toast({ title: "Role created" });
    } catch (e) {
      toast({ title: "Could not create role", variant: "destructive" });
    }
  };

  const handleUpdateRoleMeta = async () => {
    if (!selectedRole || isProtectedRole || !canManage) return;
    try {
      await updateRole(selectedRole.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      await loadRoles();
      toast({ title: "Role updated" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.is_system || isProtectedRole || !canManage) return;
    try {
      await deleteRole(selectedRole.id);
      setSelectedRoleId("");
      await loadRoles();
      toast({ title: "Role deleted" });
    } catch {
      toast({ title: "Cannot delete role (may be in use)", variant: "destructive" });
    }
  };

  const handleAssignStaff = async () => {
    if (!assignUserId || !assignRoleId || !schoolId || !user || !canManage) return;
    const role = roles.find((r) => r.id === assignRoleId);
    if (!role) return;
    try {
      await assignRoleToUser({
        userId: assignUserId,
        roleId: assignRoleId,
        schoolId,
        assignedBy: user.id,
        roleSlug: role.slug,
      });
      await logPermissionChange({
        schoolId,
        actorId: user.id,
        actionType: "user_role_assigned",
        roleId: assignRoleId,
        targetUserId: assignUserId,
        details: { slug: role.slug },
      });
      await writeAuditLog({
        schoolId,
        actionType: "assign_user_role",
        entityType: "user",
        entityId: assignUserId,
        details: { role: role.slug },
      });
      clearPermissionCache();
      invalidateCache();
      await loadStaff();
      toast({ title: "Role assigned to staff member" });
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Assignment failed";
      toast({ title: message, variant: "destructive" });
    }
  };

  const handleResetDefaults = async () => {
    if (!selectedRole || !canManage || isSuperAdminRole) return;
    try {
      await applyDefaultPermissionsForRole(selectedRole.id, selectedRole.slug, permissionIdMap);
      const codes = await fetchRolePermissionCodes(selectedRole.id);
      setSelectedCodes(codes);
      setDirty(false);
      toast({ title: "Default permissions applied" });
    } catch {
      toast({ title: "Reset failed", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <PermissionGate
        permission="portal.staff_access.view"
        anyOf={["portal.staff_access.manage", "admin.manage_permissions"]}
        showDenied
      >
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Shield className="h-7 w-7 text-primary" />
                Permission Management
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Control roles, module access, and staff assignments for the admin portal.
              </p>
            </div>
            {!canManage && (
              <Badge variant="outline">View only — contact an administrator to make changes</Badge>
            )}
          </div>

          <Tabs defaultValue="roles" className="space-y-4">
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Roles</CardTitle>
                  <CardDescription>
                    System roles are predefined. Custom roles can be created per school.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search roles…"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredRoles.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRoleId(r.id)}
                        className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                          selectedRoleId === r.id ? "border-primary ring-1 ring-primary/30" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{r.name}</span>
                          {r.is_system && <Badge variant="secondary">System</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{r.slug}</p>
                        {r.description && (
                          <p className="text-xs mt-2 line-clamp-2">{r.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Input
                        placeholder="New custom role name"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button type="button" onClick={handleCreateRole} disabled={!newRoleName.trim()}>
                        <Plus className="h-4 w-4 mr-1" />
                        Create role
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedRole && (
                <Card>
                  <CardHeader>
                    <CardTitle>Edit role</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isProtectedRole || !canManage}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          disabled={isProtectedRole || !canManage}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage && !isProtectedRole && (
                        <Button type="button" variant="outline" onClick={handleUpdateRoleMeta}>
                          Save details
                        </Button>
                      )}
                      {canManage && !selectedRole.is_system && !isProtectedRole && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete role
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this role?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Staff assigned to this role will lose these permissions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteRole}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="space-y-4">
              {!selectedRole ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Select a role from the Roles tab to configure permissions.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <KeyRound className="h-5 w-5" />
                          {selectedRole.name}
                        </CardTitle>
                        <CardDescription>
                          {isSuperAdminRole
                            ? "Super Admin always has unrestricted access to all modules."
                            : "Toggle module actions. Sidebar and routes respect View permission."}
                        </CardDescription>
                      </div>
                      {canManage && !isSuperAdminRole && (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={handleResetDefaults}>
                            Reset to defaults
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!dirty || saving}
                            onClick={handleSavePermissions}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Save permissions
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="Search permissions…"
                            value={permSearch}
                            onChange={(e) => setPermSearch(e.target.value)}
                          />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {PORTAL_CATEGORIES.map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <PermissionMatrix
                        selected={selectedCodes}
                        onChange={(next) => {
                          setSelectedCodes(next);
                          setDirty(true);
                        }}
                        search={permSearch}
                        categoryFilter={categoryFilter}
                        readOnly={!canManage || isSuperAdminRole}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="staff" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Assign role to staff
                  </CardTitle>
                  <CardDescription>
                    Links RBAC role to portal accounts (admin, accountant, auditor, teacher).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                    <div className="space-y-2">
                      <Label>Staff member</Label>
                      <Select value={assignUserId} onValueChange={setAssignUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.full_name} ({s.portal_role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>RBAC role</Label>
                      <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {canManage && (
                    <Button type="button" onClick={handleAssignStaff} disabled={!assignUserId || !assignRoleId}>
                      Assign role
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Staff assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Portal role</TableHead>
                        <TableHead>RBAC role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>{s.full_name}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{s.portal_role}</Badge>
                          </TableCell>
                          <TableCell>{s.rbac_role_name ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                      {staff.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No staff portal users found for this school.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PermissionGate>
    </DashboardLayout>
  );
}
