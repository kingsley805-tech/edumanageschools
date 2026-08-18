import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { toast } from "sonner";

type StaffRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  employee_no: string | null;
};

const STAFF_ROLES = ["admin", "teacher", "accountant", "auditor", "registrar", "examiner", "parent_support"];

export default function StaffManagementPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("staff_management");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewStaff, setViewStaff] = useState<StaffRow | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("school_id", schoolId);

      if (profErr) throw profErr;

      const userIds = (profiles ?? []).map((p) => p.id);
      if (!userIds.length) {
        setRows([]);
        return;
      }

      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds)
        .in("role", STAFF_ROLES as never[]);

      if (rolesErr) throw rolesErr;

      const staffUserIds = new Set((roles ?? []).map((r) => r.user_id));
      const staffProfiles = (profiles ?? []).filter((p) => staffUserIds.has(p.id));

      const { data: teachers } = await supabase
        .from("teachers")
        .select("profile_id, employee_no")
        .eq("school_id", schoolId);

      const empMap = new Map((teachers ?? []).map((t) => [t.profile_id, t.employee_no]));

      const roleMap = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(String(r.role));
        roleMap.set(r.user_id, list);
      }

      setRows(
        staffProfiles.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: (roleMap.get(p.id) ?? []).join(", "),
          employee_no: empMap.get(p.id) ?? null,
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q),
    );
  }, [rows, search]);

  if (!access.canView) return <ModuleAccessDenied label="Staff Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Briefcase className="h-6 w-6" />
            Staff Management
          </h1>
          <p className="text-sm text-muted-foreground">School staff directory across all portal roles.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <ExportMenu
              filename={`staff-${schoolId?.slice(0, 8) ?? "export"}`}
              title="Staff Directory"
              headers={["Name", "Email", "Roles", "Employee No"]}
              rows={filtered.map((r) => [r.full_name, r.email, r.role, r.employee_no])}
            />
          ) : null}
          {access.canCreate ? (
            <Button asChild size="sm">
              <Link to="/admin/teachers">Add teacher</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff directory</CardTitle>
          <CardDescription>Teachers and school staff linked to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Employee #</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No staff found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                      <TableCell>{r.email ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.role.split(", ").filter(Boolean).map((role) => (
                            <Badge key={role} variant="secondary">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{r.employee_no ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setViewStaff(r)} title="View staff profile">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewStaff} onOpenChange={(v) => !v && setViewStaff(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewStaff?.full_name ?? "Staff Member"}</span>
              {viewStaff?.employee_no ? (
                <Badge variant="outline" className="font-mono text-xs">
                  #{viewStaff.employee_no}
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {viewStaff ? (
            <div className="space-y-4 py-2">
              <dl className="grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Full Name</dt>
                  <dd className="font-medium mt-0.5">{viewStaff.full_name ?? "—"}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="font-medium mt-0.5 truncate">{viewStaff.email ?? "—"}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">Employee No</dt>
                  <dd className="font-medium mt-0.5">{viewStaff.employee_no ?? "Not assigned"}</dd>
                </div>
                <div className="rounded-md border bg-muted/20 p-2">
                  <dt className="text-xs text-muted-foreground">User ID</dt>
                  <dd className="font-mono text-xs mt-0.5 truncate">{viewStaff.id}</dd>
                </div>
              </dl>
              <div className="rounded-md border bg-muted/20 p-2.5">
                <p className="text-xs text-muted-foreground mb-1.5">Assigned Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewStaff.role.split(", ").filter(Boolean).map((role) => (
                    <Badge key={role} variant="secondary" className="capitalize">
                      {role.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewStaff(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
