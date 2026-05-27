import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  clearClassRankingsCache,
  getClassScoringProgress,
  invalidateRankingQueries,
  recalculateClassRankings,
  type RankingResult,
} from "@/report/lib/ranking";

const inflight = new Map<string, Promise<RankingResult>>();

function rankingKey(classId: string, termId: string) {
  return `${classId}:${termId}`;
}

type GenerateVars = { silent?: boolean };

type UseGeneratePositionsOpts = {
  classId: string | undefined;
  termId: string | undefined;
  onSuccess?: (result: RankingResult) => void | Promise<void>;
};

export function useGeneratePositions({ classId, termId, onSuccess }: UseGeneratePositionsOpts) {
  const qc = useQueryClient();

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["class-scoring-progress", classId, termId],
    enabled: !!classId && !!termId,
    queryFn: () => getClassScoringProgress(classId!, termId!),
  });

  const generate = useMutation({
    mutationFn: async (_vars?: GenerateVars) => {
      if (!classId || !termId) {
        throw new Error("Select a class and current term before generating positions.");
      }

      const key = rankingKey(classId, termId);
      const existing = inflight.get(key);
      if (existing) return existing;

      const promise = recalculateClassRankings(classId, termId).finally(() => {
        inflight.delete(key);
      });

      inflight.set(key, promise);
      return promise;
    },
    onSuccess: async (result, vars) => {
      if (classId && termId) clearClassRankingsCache(classId, termId);
      invalidateRankingQueries(qc);
      await onSuccess?.(result);

      if (!vars?.silent) {
        const ranked = result.eligibleStudents || result.classPositions;
        const reportMsg =
          result.reportCardsUpdated || result.reportCardsCreated
            ? `, ${result.reportCardsUpdated} report${result.reportCardsUpdated === 1 ? "" : "s"} updated` +
              (result.reportCardsCreated
                ? `, ${result.reportCardsCreated} created`
                : "")
            : "";
        toast.success(
          `Rankings complete for ${ranked} student${ranked === 1 ? "" : "s"} — ` +
            `${result.subjectUpdates} subject positions, ${result.classPositions} class ranks` +
            reportMsg +
            `. Switch students to view their report cards.`,
        );
      }
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to generate positions. Please try again.");
    },
  });

  return {
    generate,
    progress,
    progressLoading,
    isGenerating: generate.isPending,
    progressPct:
      progress && progress.expected > 0
        ? Math.round((progress.filled / progress.expected) * 100)
        : 0,
  };
}
