import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { AchievementsSchemaSetupCard } from "@/modules/achievements/components/AchievementsSchemaSetupCard";
import { AchievementsDashboardPanel } from "@/modules/achievements/components/AchievementsDashboardPanel";
import { AchievementsListPanel } from "@/modules/achievements/components/AchievementsListPanel";
import {
  fetchAchievementCategories,
  fetchAchievements,
  fetchAchievementsDashboardStats,
  fetchStudentOptions,
} from "@/modules/achievements/lib/api";
import {
  achievementsSchemaReady,
  checkAchievementsSchema,
  type AchievementsSchemaStatus,
} from "@/modules/achievements/lib/schema";
import type {
  Achievement,
  AchievementCategory,
  AchievementsDashboardStats,
  StudentOption,
} from "@/modules/achievements/lib/types";
import { toast } from "sonner";

const EMPTY_STATS: AchievementsDashboardStats = {
  total: 0,
  published: 0,
  pending: 0,
  approved: 0,
  awards: 0,
  certificates: 0,
  competitions: 0,
  archived: 0,
};

export default function AchievementsPage() {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("achievements");

  const [schemaStatus, setSchemaStatus] = useState<AchievementsSchemaStatus | null>(null);
  const [schemaChecking, setSchemaChecking] = useState(false);
  const [stats, setStats] = useState<AchievementsDashboardStats>(EMPTY_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [categories, setCategories] = useState<AchievementCategory[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(false);

  const accessProps = useMemo(
    () => ({
      canCreate: access.canCreate,
      canEdit: access.canEdit,
      canDelete: access.canDelete,
      canExport: access.canExport,
      canManage: access.canManage,
    }),
    [access],
  );

  const loadAll = useCallback(async () => {
    if (!schoolId) return;
    setSchemaChecking(true);
    setLoading(true);
    try {
      const status = await checkAchievementsSchema(schoolId);
      setSchemaStatus(status);
      if (!achievementsSchemaReady(status)) return;

      const [s, list, cats, studs] = await Promise.all([
        fetchAchievementsDashboardStats(schoolId).catch(() => EMPTY_STATS),
        fetchAchievements(schoolId),
        fetchAchievementCategories(schoolId),
        fetchStudentOptions(schoolId),
      ]);
      setStats(s);
      setAchievements(list);
      setCategories(cats);
      setStudents(studs);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (isMissingTableError(err)) toast.error(operationsSchemaSetupMessage());
      else toast.error(err.message ?? "Failed to load achievements");
    } finally {
      setSchemaChecking(false);
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!access.canView) return <ModuleAccessDenied label="Achievements" />;

  const schemaReady = schemaStatus ? achievementsSchemaReady(schemaStatus) : false;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Academics</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Achievements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage awards, honors, certificates, competitions, and student recognition.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {schemaStatus && !schemaReady ? (
        <AchievementsSchemaSetupCard
          status={schemaStatus}
          checking={schemaChecking}
          onRecheck={() => void loadAll()}
        />
      ) : (
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <AchievementsDashboardPanel stats={stats} />
          </TabsContent>
          <TabsContent value="records" className="mt-4">
            <AchievementsListPanel
              achievements={achievements}
              categories={categories}
              students={students}
              access={accessProps}
              schoolId={schoolId}
              userId={user?.id ?? null}
              onRefresh={() => void loadAll()}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
