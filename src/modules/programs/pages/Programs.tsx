import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { ProgramsListPanel } from "@/modules/programs/components/ProgramsListPanel";
import { StatCounter } from "@/components/charts/StatCounter";
import { fetchPrograms, fetchProgramsDashboardStats } from "@/modules/programs/lib/api";
import {
  checkProgramsSchema,
  programsSchemaReady,
  type ProgramsSchemaStatus,
} from "@/modules/programs/lib/schema";
import type { AcademicProgram, ProgramsDashboardStats } from "@/modules/programs/lib/types";
import { toast } from "sonner";

const EMPTY_STATS: ProgramsDashboardStats = {
  total: 0,
  active: 0,
  inactive: 0,
  archived: 0,
  departments: 0,
};

export default function ProgramsPage() {
  const { user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("programs");

  const [schemaStatus, setSchemaStatus] = useState<ProgramsSchemaStatus | null>(null);
  const [stats, setStats] = useState<ProgramsDashboardStats>(EMPTY_STATS);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [loading, setLoading] = useState(false);

  const accessProps = useMemo(
    () => ({
      canCreate: access.canCreate,
      canEdit: access.canEdit,
      canDelete: access.canDelete,
      canExport: access.canExport,
    }),
    [access],
  );

  const loadAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const status = await checkProgramsSchema();
      setSchemaStatus(status);
      if (!programsSchemaReady(status)) return;
      const [s, list] = await Promise.all([
        fetchProgramsDashboardStats(schoolId),
        fetchPrograms(schoolId),
      ]);
      setStats(s);
      setPrograms(list);
    } catch (e) {
      const err = e as { message?: string };
      if (isMissingTableError(err)) toast.error(operationsSchemaSetupMessage());
      else toast.error(err.message ?? "Failed to load programs");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!access.canView) return <ModuleAccessDenied label="Programs" />;

  const schemaReady = schemaStatus ? programsSchemaReady(schemaStatus) : false;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <BookMarked className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Academics</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Academic program tracks, departments, credits, and coordinators.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {!schemaReady ? (
        <OperationsSchemaSetupCard
          moduleLabel="Academic Programs"
          quickScript="apply-achievements-programs.sql"
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total programs", stats.total],
              ["Active", stats.active],
              ["Inactive", stats.inactive],
              ["Archived", stats.archived],
              ["Departments", stats.departments],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <StatCounter value={value as number} className="text-2xl font-bold tabular-nums" />
                </CardContent>
              </Card>
            ))}
          </div>
          <ProgramsListPanel
            programs={programs}
            access={accessProps}
            schoolId={schoolId}
            userId={user?.id ?? null}
            onRefresh={() => void loadAll()}
          />
        </>
      )}
    </div>
  );
}
