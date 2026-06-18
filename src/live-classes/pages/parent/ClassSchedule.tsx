import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { LiveClassSessionCard } from "@/live-classes/components/LiveClassSessionCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  studentDisplayNameForParent,
} from "@/lib/parent-students";
import { fetchLiveClassSessions } from "@/live-classes/lib/api";
import { LiveClassResourcesPanel } from "@/live-classes/components/LiveClassResourcesPanel";
import type { LiveClassSession } from "@/live-classes/lib/types";

export default function ParentClassSchedule() {
  const { user } = useAuth();
  const [children, setChildren] = useState<{ id: string; name: string; class_id: string }[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [sessions, setSessions] = useState<LiveClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const parent = await fetchParentRecordByUserId(user.id);
      if (!parent) return;
      const kids = await fetchStudentsForParent<{ id: string; class_id: string; full_name?: string; profiles: { full_name: string } | null }>(
        parent.id,
        "id, class_id, full_name, profiles:user_id(full_name)",
      );
      const mapped = kids.map((k) => ({
        id: k.id,
        class_id: k.class_id,
        name: studentDisplayNameForParent(k),
      }));
      setChildren(mapped);
      if (mapped[0]) setSelectedChild(mapped[0].id);
    })();
  }, [user]);

  useEffect(() => {
    const child = children.find((c) => c.id === selectedChild) ?? children[0];
    if (!child?.class_id) return;
    setLoading(true);
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        setSessions(
          await fetchLiveClassSessions({ classId: child.class_id, fromDate: today }),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [children, selectedChild]);

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <PortalPageHeader
          title="Class Schedule"
          description="View your child's upcoming online classes and join links."
        />

        {children.length > 1 && (
          <Select value={selectedChild} onValueChange={setSelectedChild}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming online classes.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s) => (
              <div key={s.id} className="space-y-2">
                <LiveClassSessionCard session={s} showJoin={false} />
                <LiveClassResourcesPanel
                  liveClassId={s.live_class_id}
                  sessionId={s.id}
                  schoolId={s.school_id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
