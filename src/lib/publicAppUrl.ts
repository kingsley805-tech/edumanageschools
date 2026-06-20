/** Public HTTPS origin for OAuth branding links (privacy, terms, home). */
export function getPublicAppUrl(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.startsWith("https://")) return origin;
  }

  return "";
}

export function getPublicAppLinks() {
  const base = getPublicAppUrl();
  return {
    home: base ? `${base}/landing` : "/landing",
    privacy: base ? `${base}/privacy` : "/privacy",
    terms: base ? `${base}/terms` : "/terms",
  };
}
