import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, clearPermissionCache } from "@/hooks/usePermissions";
import { writeAuditLog } from "@/lib/auditLog";
import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import { modulePermissionCodes } from "@/lib/rbac/matrixColumns";
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
  type RoleRow,
} from "@/lib/rbac/rbacService";
import { supabase } from "@/integrations/supabase/client";
import { fetchStaffPortalUsers } from "@/lib/staffUsers";
import { Save, Loader2, Plus, Users, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/PermissionGate";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [moduleSearch, setModuleSearch] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [deleteRoleOpen, setDeleteRoleOpen] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isProtectedRole = selectedRole ? PROTECTED_SLUGS.has(selectedRole.slug) : false;
  const isSuperAdminRole = selectedRole?.slug === "super_admin";
  const matrixReadOnly = !canManage || isSuperAdminRole || !selectedRole;

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.slug !== "super_admin"),
    [roles],
  );

  const filteredModuleCodes = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    const mods = !q
      ? ALL_PORTAL_MODULES
      : ALL_PORTAL_MODULES.filter(
          (m) =>
            m.label.toLowerCase().includes(q) ||
            m.categoryLabel.toLowerCase().includes(q),
        );
    return mods.flatMap((m) => modulePermissionCodes(m));
  }, [moduleSearch]);

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
        {
          id: (a.roles as { id: string; name: string; slug: string })?.id,
          name: (a.roles as { name: string })?.name,
        },
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
    return roleRows;
  }, [schoolId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const roleRows = await loadRoles();
        if (roleRows.length) {
          setSelectedRoleId((current) => {
            if (current && roleRows.some((r) => r.id === current)) return current;
            const preferred =
              roleRows.find((r) => r.slug === "accountant") ??
              roleRows.find((r) => r.slug === "teacher") ??
              roleRows[0];
            return preferred.id;
          });
        }
        await loadStaff();
      } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Failed to load permission data";
        toast({ title: message, variant: "destructive" });
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
      } catch {
        toast({ title: "Could not load role permissions", variant: "destructive" });
      }
    })();
  }, [selectedRoleId, toast]);

  const handleSavePermissions = async () => {
    if (!selectedRole || !schoolId || !user || !canManage) return;
    if (isSuperAdminRole) return;
    setSaving(true);
    try {
      const result = await saveRolePermissions(selectedRole.id, selectedCodes, permissionIdMap);
      try {
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
      } catch (logErr) {
        console.warn("Permission saved but audit log failed:", logErr);
      }
      clearPermissionCache();
      invalidateCache();
      setDirty(false);
      if (result.missingCodes.length > 0) {
        toast({
          title: "Permissions partially saved",
          description: `${result.inserted} saved. Run portal RBAC SQL in Supabase for missing codes.`,
          variant: "destructive",
        });
      } else {
        toast({ title: `Permissions saved (${result.inserted})` });
      }
    } catch (e) {
      console.error(e);
      const message =
        e instanceof Error ? e.message : "Failed to save permission data";
      toast({
        title: message.includes("authorized") ? "Not authorized to save permissions" : message,
        variant: "destructive",
      });
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
    } catch {
      toast({ title: "Could not create role", variant: "destructive" });
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

  const handleFullAccess = () => {
    if (matrixReadOnly) return;
    const next = new Set(selectedCodes);
    for (const code of filteredModuleCodes) next.add(code);
    setSelectedCodes(next);
    setDirty(true);
  };

  const handleRevokeFullAccess = () => {
    if (matrixReadOnly) return;
    const next = new Set(selectedCodes);
    for (const code of filteredModuleCodes) next.delete(code);
    setSelectedCodes(next);
    setDirty(true);
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

  const roleSelect = (
    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
      <SelectTrigger className="h-8 w-[140px] border-border/80 bg-background/80 text-sm font-medium">
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
  );

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
        <div className="mx-auto max-w-[1400px] space-y-5">
          {/* Page header — matches reference */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Roles &amp; Permissions
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Configure module-level access with dynamic permission matrix, select-all controls,
                and audit logging.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!canManage && (
                <Badge variant="outline" className="text-xs">
                  View only
                </Badge>
              )}
              {canManage && !isSuperAdminRole && selectedRole && dirty && (
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={handleSavePermissions}
                  className="h-8"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save changes
                    </>
                  )}
                </Button>
              )}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!selectedRole || isSuperAdminRole}
                      onClick={() => void handleResetDefaults()}
                    >
                      Reset to defaults
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 flex gap-2">
                      <Input
                        placeholder="New role"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className="h-8 text-xs"
                        onKeyDown={(e) => e.key === "Enter" && void handleCreateRole()}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={!newRoleName.trim()}
                        onClick={() => void handleCreateRole()}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {selectedRole && !selectedRole.is_system && !isProtectedRole && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteRoleOpen(true)}
                        >
                          Delete role
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <AlertDialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {selectedRole?.name ?? "role"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Staff assigned to this role will lose these permissions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void handleDeleteRole();
                        setDeleteRoleOpen(false);
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {isSuperAdminRole && selectedRole && (
            <p className="text-sm text-muted-foreground -mt-2">
              {selectedRole.name} has unrestricted access to all modules.
            </p>
          )}

          {/* Single matrix card — exact reference structure */}
          {selectedRole ? (
            <PermissionMatrix
              selected={selectedCodes}
              onChange={(next) => {
                setSelectedCodes(next);
                setDirty(true);
              }}
              search={moduleSearch}
              onSearchChange={setModuleSearch}
              readOnly={matrixReadOnly}
              roleControl={roleSelect}
              onFullAccess={matrixReadOnly ? undefined : handleFullAccess}
              onRevokeFullAccess={matrixReadOnly ? undefined : handleRevokeFullAccess}
            />
          ) : (
            <div className="rounded-xl border border-border/80 bg-card/95 py-16 text-center text-sm text-muted-foreground">
              Select a role to configure permissions.
            </div>
          )}

          <Collapsible open={staffOpen} onOpenChange={setStaffOpen}>
            <Card className="border-border/80">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Users className="h-5 w-5" />
                        Assign roles to staff
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Link matrix roles to teacher, accountant, and auditor accounts.
                      </CardDescription>
                    </div>
                    {staffOpen ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
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
                    <Button
                      type="button"
                      onClick={() => void handleAssignStaff()}
                      disabled={!assignUserId || !assignRoleId}
                    >
                      Assign role
                    </Button>
                  )}
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
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </PermissionGate>
    </DashboardLayout>
  );
}
