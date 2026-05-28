import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { RolesPermissionsPanel } from "@/components/admin/RolesPermissionsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Check, ChevronsUpDown, Loader2, Plus, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PermissionGate } from "@/components/PermissionGate";
import { isRbacAvailable, resetRbacAvailabilityProbe } from "@/lib/rbac/availability";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  portal_role: string;
  employee_no: string | null;
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
  const [deleteRoleOpen, setDeleteRoleOpen] = useState(false);
  const [rbacReady, setRbacReady] = useState<boolean | null>(null);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isProtectedRole = selectedRole ? PROTECTED_SLUGS.has(selectedRole.slug) : false;
  const isSuperAdminRole = selectedRole?.slug === "super_admin";
  const matrixReadOnly = !canManage || isSuperAdminRole || !selectedRole;

  const assignableRoles = useMemo(
    () => roles.filter((r) => r.slug !== "super_admin"),
    [roles],
  );
  const teacherStaff = useMemo(
    () => staff.filter((s) => s.portal_role === "teacher"),
    [staff],
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
    let rbacMap = new Map<string, string | null>();
    if (await isRbacAvailable()) {
      const { data: assignments } = await supabase
        .from("user_role_assignments")
        .select("user_id, role_id, roles(id, name)")
        .eq("school_id", schoolId)
        .in("user_id", staffIds);
      rbacMap = new Map(
        (assignments ?? []).map((a) => [
          a.user_id,
          (a.roles as { name: string } | null)?.name ?? null,
        ]),
      );
    }
    setStaff(
      staffUsers.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        portal_role: p.portal_role,
        employee_no: p.employee_no,
        rbac_role_name: rbacMap.get(p.id) ?? null,
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
    void isRbacAvailable().then(setRbacReady);
  }, []);

  const handleRecheckRbac = useCallback(async () => {
    resetRbacAvailabilityProbe();
    const ok = await isRbacAvailable();
    setRbacReady(ok);
    if (ok) {
      await loadRoles();
      await loadStaff();
    }
  }, [loadRoles, loadStaff]);

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
    if (!selectedRole || !schoolId || !user || !canManage || isSuperAdminRole) return;
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
      } catch {
        /* audit optional */
      }
      clearPermissionCache();
      invalidateCache();
      setDirty(false);
      toast({
        title: result.missingCodes.length
          ? `Saved ${result.inserted} (some codes missing in DB)`
          : `Permissions saved (${result.inserted})`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save permission data";
      toast({ title: message, variant: "destructive" });
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
      toast({ title: "Cannot delete role", variant: "destructive" });
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
      clearPermissionCache();
      invalidateCache();
      await loadStaff();
      toast({ title: "Role assigned to staff member" });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Assignment failed",
        variant: "destructive",
      });
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

  const roleSelect = (
    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
      <SelectTrigger className="rp-select-trigger h-8 min-w-[140px] border-[#2a2a2a] bg-[#1c1c1c] text-[#fafafa] shadow-none focus:ring-0 focus:ring-offset-0 rounded-md text-sm font-medium">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent className="bg-[#1c1c1c] border-[#2a2a2a] text-[#fafafa]">
        {assignableRoles.map((r) => (
          <SelectItem key={r.id} value={r.id} className="focus:bg-[#262626] focus:text-white">
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex min-h-[50vh] items-center justify-center bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
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
        {/* Full-bleed dark canvas like reference screenshot */}
        <div className="-m-3 md:-m-6 min-h-[calc(100vh-4rem)] bg-[#0a0a0a] p-4 md:p-8">
          <div className="mx-auto max-w-[1200px]">
            {rbacReady === false && (
              <Alert className="mb-6 border-amber-500/40 bg-amber-500/10 text-amber-50">
                <AlertTitle>RBAC database not installed</AlertTitle>
                <AlertDescription>
                  Run{" "}
                  <code className="rounded bg-black/30 px-1 py-0.5 text-xs">
                    supabase/scripts/apply-rbac-full.sql
                  </code>{" "}
                  in the Supabase SQL Editor, then reload the API schema (Settings → API). Until
                  then, portal admins keep full access; the permission matrix stays empty.
                </AlertDescription>
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => void handleRecheckRbac()}>
                    Recheck RBAC now
                  </Button>
                </div>
              </Alert>
            )}
            {selectedRole ? (
              <RolesPermissionsPanel
                selected={selectedCodes}
                onChange={(next) => {
                  setSelectedCodes(next);
                  setDirty(true);
                }}
                search={moduleSearch}
                onSearchChange={setModuleSearch}
                readOnly={matrixReadOnly}
                roleControl={roleSelect}
                dirty={dirty}
                saving={saving}
                onSave={canManage && !isSuperAdminRole ? handleSavePermissions : undefined}
                onFullAccess={matrixReadOnly ? undefined : handleFullAccess}
                onRevokeFullAccess={matrixReadOnly ? undefined : handleRevokeFullAccess}
              />
            ) : (
              <div className="rp-page">
                <h1 className="rp-title">Roles &amp; Permissions</h1>
                <p className="rp-subtitle">No roles available. Create a role to continue.</p>
              </div>
            )}

            {isSuperAdminRole && selectedRole && (
              <p className="mt-3 text-sm text-[#a3a3a3]">
                {selectedRole.name} has unrestricted access to all modules.
              </p>
            )}

            {/* Secondary actions — not in reference UI */}
            {canManage && (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#262626] pt-4">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#2a2a2a] bg-transparent text-[#fafafa] hover:bg-[#1c1c1c]"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Assign to staff
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="bg-[#141414] border-[#2a2a2a] text-[#fafafa]">
                    <SheetHeader>
                      <SheetTitle className="text-white">Assign role to staff</SheetTitle>
                      <SheetDescription className="text-[#a3a3a3]">
                        Link this matrix role to teachers in your school.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[#fafafa]">Teacher</Label>
                        <Select value={assignUserId} onValueChange={setAssignUserId}>
                          <SelectTrigger className="bg-[#1c1c1c] border-[#2a2a2a]">
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teacherStaff.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.full_name}
                                {s.employee_no ? ` (${s.employee_no})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {teacherStaff.length === 0 && (
                          <p className="text-xs text-[#a3a3a3]">
                            No teacher accounts found in this school yet.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[#fafafa]">RBAC role</Label>
                        <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                          <SelectTrigger className="bg-[#1c1c1c] border-[#2a2a2a]">
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
                      <Button type="button" onClick={() => void handleAssignStaff()}>
                        Assign role
                      </Button>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Teacher</TableHead>
                            <TableHead>RBAC role</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teacherStaff.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.full_name}</TableCell>
                              <TableCell>{s.rbac_role_name ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="New role name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="h-8 w-36 bg-[#1c1c1c] border-[#2a2a2a] text-[#fafafa]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[#2a2a2a] bg-transparent text-[#fafafa]"
                    disabled={!newRoleName.trim()}
                    onClick={() => void handleCreateRole()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {selectedRole && !selectedRole.is_system && !isProtectedRole && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-[#dc2626] hover:text-[#fca5a5] hover:bg-transparent"
                    onClick={() => setDeleteRoleOpen(true)}
                  >
                    Delete role
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <AlertDialog open={deleteRoleOpen} onOpenChange={setDeleteRoleOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedRole?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Staff assigned to this role will lose these permissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleDeleteRole()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PermissionGate>
    </DashboardLayout>
  );
}
