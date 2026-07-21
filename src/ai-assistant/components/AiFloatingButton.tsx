import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buildContextFromLocation, storeReferrerContext } from "@/ai-assistant/lib/context";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { MINGO } from "@/lib/designTokens";

type Props = {
  className?: string;
};

/** Floating quick-access — mingo ai-fab */
export function AiFloatingButton({ className }: Props) {
  const location = useLocation();
  const { user } = useAuth();
  const { role: portalRole } = useUserRole();

  if (
    location.pathname.startsWith("/ai-assistant") ||
    location.pathname.startsWith("/dashboard/ai-assistant")
  ) {
    return null;
  }

  const role = portalRole ?? "admin";
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? undefined;
  const ctx = buildContextFromLocation(location.pathname, role, userName);

  return (
    <Link
      to="/ai-assistant"
      className={cn(
        "fixed bottom-[26px] right-[26px] z-20 flex items-center gap-2.5 border px-[18px] py-3 text-[13px] font-semibold text-white",
        className,
      )}
      style={{
        background: MINGO.lineStrong,
        borderColor: MINGO.ink,
      }}
      onClick={() => storeReferrerContext(ctx)}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: MINGO.brandHover }}
        aria-hidden
      />
      <span className="hidden sm:inline">EduManage AI</span>
      <span className="sm:hidden">AI</span>
    </Link>
  );
}
