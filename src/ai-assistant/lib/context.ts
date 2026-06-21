import { ALL_PORTAL_MODULES } from "@/lib/rbac/permissionCatalog";
import type { AiContext } from "./types";

const PATH_MODULE_MAP: Record<string, { key: string; label: string }> = {};

for (const m of ALL_PORTAL_MODULES) {
  PATH_MODULE_MAP[m.path] = { key: m.key, label: m.label };
}

/** Longest-prefix match for nested routes */
export function resolveModuleFromPath(pathname: string): { key: string; label: string } | null {
  if (pathname.startsWith("/ai-assistant")) return { key: "ai_assistant", label: "AI Assistant" };

  let best: { key: string; label: string; len: number } | null = null;
  for (const [path, mod] of Object.entries(PATH_MODULE_MAP)) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      if (!best || path.length > best.len) {
        best = { ...mod, len: path.length };
      }
    }
  }

  if (best) return { key: best.key, label: best.label };

  if (pathname.startsWith("/teacher")) return { key: "teacher_portal", label: "Teacher Portal" };
  if (pathname.startsWith("/student")) return { key: "student_portal", label: "Student Portal" };
  if (pathname.startsWith("/parent")) return { key: "parent_portal", label: "Parent Portal" };
  if (pathname.startsWith("/admin")) return { key: "admin_portal", label: "Administration" };
  if (pathname.startsWith("/accountant")) return { key: "finance", label: "Finance" };

  return null;
}

export function buildContextFromLocation(
  pathname: string,
  role: string,
  userName?: string,
): AiContext {
  const mod = resolveModuleFromPath(pathname);
  return {
    module: mod?.key,
    moduleLabel: mod?.label,
    pagePath: pathname,
    userRole: role,
    userName,
  };
}

export const REFERRER_CONTEXT_KEY = "eduManageAiReferrerContext";

export function storeReferrerContext(ctx: AiContext) {
  try {
    sessionStorage.setItem(REFERRER_CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function loadReferrerContext(): AiContext | null {
  try {
    const raw = sessionStorage.getItem(REFERRER_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as AiContext) : null;
  } catch {
    return null;
  }
}
