import { supabase } from "@/integrations/supabase/client";
import {
  getGradeScale,
  type GradingFormat,
  type GradeBand,
} from "@/report/lib/grading";

export type GradeScaleRow = {
  name: string;
  min_score: number;
  max_score: number;
  grade: string;
  grade_point: number | null;
};

/** Convert built-in grade bands to grade_scales table rows. */
export function gradeBandsToScaleRows(bands: GradeBand[]): GradeScaleRow[] {
  return bands.map((band, index) => ({
    name: band.remark,
    min_score: band.min,
    max_score: index === 0 ? 100 : bands[index - 1].min - 1,
    grade: band.grade,
    grade_point: null,
  }));
}

/** Replace school grade_scales rows with the standard scale for the chosen format. */
export async function syncGradeScalesForFormat(
  schoolId: string,
  format: GradingFormat,
): Promise<{ error: Error | null }> {
  const rows = gradeBandsToScaleRows(getGradeScale(format));

  const { error: deleteError } = await supabase
    .from("grade_scales")
    .delete()
    .eq("school_id", schoolId);

  if (deleteError) return { error: deleteError };

  if (rows.length === 0) return { error: null };

  const { error: insertError } = await supabase.from("grade_scales").insert(
    rows.map((row) => ({ ...row, school_id: schoolId })),
  );

  return { error: insertError };
}

/** Load or create school_settings.grading_system for a school. */
export async function saveGradingFormat(
  schoolId: string,
  format: GradingFormat,
  existingSettingsId?: string | null,
): Promise<{ error: Error | null }> {
  const payload = {
    school_id: schoolId,
    grading_system: format,
    updated_at: new Date().toISOString(),
  };

  if (existingSettingsId) {
    const { error } = await supabase
      .from("school_settings")
      .update(payload)
      .eq("id", existingSettingsId);
    return { error };
  }

  const { error } = await supabase.from("school_settings").insert(payload);
  return { error };
}
