/** Normalize logo/stamp/signature URLs for display and PDF capture. */
export function resolveReportAssetUrl(url: string | null | undefined): string {
  const raw = url?.trim();
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return raw;
  return raw;
}
