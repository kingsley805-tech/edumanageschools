import { useEffect, useState } from "react";
import { TimetablePortalView } from "@/timetable/pages/shared/TimetablePortalView";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function ParentTimetable() {
  const { user } = useAuth();
  const [children, setChildren] = useState<{ id: string; name: string; className: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    void (async () => {
      if (!user) return;
      const { data: parent } = await supabase.from("parents").select("id").eq("user_id", user.id).maybeSingle();
      if (!parent) return;
      const { data: students } = await supabase
        .from("students")
        .select("id, profiles(full_name), classes(name)")
        .eq("guardian_id", parent.id);
      const rows = (students ?? []).map((s) => ({
        id: s.id,
        name: (s.profiles as { full_name?: string })?.full_name ?? "Child",
        className: (s.classes as { name?: string })?.name ?? "",
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
