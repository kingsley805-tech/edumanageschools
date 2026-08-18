import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchParentRecordByUserId,
  fetchStudentsForParent,
  studentDisplayNameForParent,
} from "@/lib/parent-students";
import { fetchPublishedAchievementsForStudents } from "@/modules/achievements/lib/api";
import {
  ACHIEVEMENT_TYPE_LABELS,
  type Achievement,
} from "@/modules/achievements/lib/types";
import { fetchStudentForUser } from "@/modules/shop/lib/shopApi";

type PortalRole = "student" | "parent";

type ChildOption = {
  id: string;
  full_name: string;
  admission_number: string | null;
};

type Props = {
  portalRole: PortalRole;
};

export default function AchievementsPortalPanel({ portalRole }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Achievement[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [childId, setChildId] = useState<string>("all");
  const [studentLabel, setStudentLabel] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (portalRole === "student") {
        const student = await fetchStudentForUser(user.id);
        if (!student) {
          setRows([]);
          setStudentLabel("");
          return;
        }
        setStudentLabel(student.full_name);
        setRows(await fetchPublishedAchievementsForStudents([student.id]));
        return;
      }

      const parent = await fetchParentRecordByUserId(user.id);
      if (!parent) {
        setChildren([]);
        setRows([]);
        return;
      }

      const kids = await fetchStudentsForParent<ChildOption>(
        parent.id,
        "id, full_name, admission_number",
      );
      setChildren(kids);
      if (!kids.length) {
        setRows([]);
        return;
      }
      setRows(await fetchPublishedAchievementsForStudents(kids.map((k) => k.id)));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Unable to load achievements");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, portalRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (portalRole !== "parent" || childId === "all") return rows;
    return rows.filter((r) => r.student_id === childId);
  }, [rows, portalRole, childId]);

  return (
    <DashboardLayout role={portalRole}>
      <div className="mingo-content space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">
              Achievements &amp; certificates
            </h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {portalRole === "student"
                ? studentLabel
                  ? `Certificates and awards for ${studentLabel}.`
                  : "Certificates and awards assigned to you by the school."
                : "Certificates and awards for your linked children."}
            </p>
          </div>
          {portalRole === "parent" && children.length > 1 ? (
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All children" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All children</SelectItem>
                {children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {studentDisplayNameForParent(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading achievements…
          </div>
        ) : visible.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Trophy className="h-10 w-10 opacity-40" />
              <p>No published certificates yet.</p>
              <p className="text-xs">
                When the school awards an achievement to{" "}
                {portalRole === "student" ? "you" : "your child"}, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <Card key={item.id} className="overflow-hidden border-border/70 shadow-sm">
                <div className="relative aspect-[4/3] bg-muted">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Award className="h-10 w-10 opacity-40" />
                      <span className="text-xs">
                        {ACHIEVEMENT_TYPE_LABELS[item.achievement_type] || item.achievement_type}
                      </span>
                    </div>
                  )}
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">
                        {ACHIEVEMENT_TYPE_LABELS[item.achievement_type] || item.achievement_type}
                      </Badge>
                      {item.category_name ? (
                        <Badge variant="outline">{item.category_name}</Badge>
                      ) : null}
                    </div>
                    <p className="font-semibold leading-tight">{item.title}</p>
                    {portalRole === "parent" ? (
                      <p className="text-xs text-muted-foreground">
                        {item.student_name}
                        {item.class_name ? ` · ${item.class_name}` : ""}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.awarded_on
                        ? new Date(item.awarded_on).toLocaleDateString()
                        : "—"}
                      {item.awarded_by ? ` · ${item.awarded_by}` : ""}
                      {item.level ? ` · ${item.level}` : ""}
                    </p>
                    {item.description ? (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.image_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.image_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          View certificate
                        </a>
                      </Button>
                    ) : null}
                    {item.document_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.document_url} target="_blank" rel="noopener noreferrer">
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Document
                        </a>
                      </Button>
                    ) : null}
                    {!item.image_url && !item.document_url ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        No file attached
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
