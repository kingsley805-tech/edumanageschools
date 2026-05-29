import { useEffect, useState } from "react";
import { TimetablePortalView } from "@/timetable/pages/shared/TimetablePortalView";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  studentDisplayNameForParent,
} from "@/lib/parent-students";

export default function ParentTimetable() {
  const { user } = useAuth();
  const [children, setChildren] = useState<{ id: string; name: string; className: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    void (async () => {
      if (!user) return;
      const parent = await fetchParentRecordByUserId(user.id);
      if (!parent) return;
      const students = await fetchStudentsForParent<{
        id: string;
        full_name?: string | null;
        profiles: { full_name?: string } | null;
        classes: { name?: string } | null;
      }>(parent.id, "id, full_name, profiles:user_id(full_name), classes(name)");
      const rows = students.map((s) => ({
        id: s.id,
        name: studentDisplayNameForParent(s),
        className: s.classes?.name ?? "",
      }));
      setChildren(rows);
      if (rows.length) setSelectedId(rows[0].id);
    })();
  }, [user]);

  if (!children.length) {
    return (
      <DashboardLayout role="parent">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Link a child to view their timetable.
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-4 mb-4">
        {children.length > 1 ? (
          <div className="space-y-2 max-w-xs">
            <Label>Child</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      {selectedId ? <TimetablePortalView role="parent" childStudentId={selectedId} embedded /> : null}
    </DashboardLayout>
  );
}
