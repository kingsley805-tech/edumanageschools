import { supabase } from "@/integrations/supabase/client";
import { normalizeHex } from "@/lib/themeColors";
import { isValidHexColor } from "@/report/lib/report-brand-colors";

/** Keep report card theme in sync with School Settings → Brand Colors primary. */
export async function syncReportThemeWithSchoolBrand(
  schoolId: string,
  primaryHex: string,
): Promise<void> {
  if (!isValidHexColor(primaryHex)) return;
  const hex = normalizeHex(primaryHex);

  const { data: existing } = await supabase
    .from("school_settings")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("school_settings")
      .update({ report_theme_primary: hex })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("school_settings").insert({
    school_id: schoolId,
    report_theme_primary: hex,
  });
  if (error) throw error;
}
