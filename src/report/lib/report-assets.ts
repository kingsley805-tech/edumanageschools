import { supabase } from "@/integrations/supabase/client";

/** Normalize logo/stamp/signature URLs for display and PDF capture. */
export function resolveReportAssetUrl(url: string | null | undefined): string {
  const raw = url?.trim();
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return raw;
  // Storage path without bucket prefix
  if (!raw.includes("://") && !raw.startsWith("/")) {
    const { data } = supabase.storage.from("school-assets").getPublicUrl(raw);
    if (data?.publicUrl) return data.publicUrl;
    const { data: logos } = supabase.storage.from("school-logos").getPublicUrl(raw);
    return logos?.publicUrl ?? raw;
  }
  return raw;
}
