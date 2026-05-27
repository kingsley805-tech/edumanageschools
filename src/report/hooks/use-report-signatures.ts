import { useQuery } from "@tanstack/react-query";
import { fetchActiveSignature, fetchSchoolHeadSignature } from "@/report/lib/user-signatures";

export function useReportSignatures(opts: {
  schoolId: string;
  teacherId: string | null | undefined;
  enabled?: boolean;
}) {
  const enabled = opts.enabled !== false && !!opts.schoolId;

  const teacherSig = useQuery({
    queryKey: ["active-signature", "teacher", opts.teacherId],
    enabled: enabled && !!opts.teacherId,
    queryFn: () => fetchActiveSignature(opts.teacherId!, "teacher"),
  });

  const headSig = useQuery({
    queryKey: ["active-signature", "head", opts.schoolId],
    enabled,
    queryFn: () => fetchSchoolHeadSignature(opts.schoolId),
  });

  return {
    teacherSignatureUrl: teacherSig.data?.image_url ?? null,
    headSignatureUrl: headSig.data ?? null,
    isLoading: teacherSig.isLoading || headSig.isLoading,
  };
}
