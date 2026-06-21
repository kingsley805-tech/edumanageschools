import { Link, useLocation } from "react-router-dom";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildContextFromLocation, storeReferrerContext } from "@/ai-assistant/lib/context";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AI_ASSISTANT_NAV_LABEL } from "../lib/branding";

type Props = {
  className?: string;
};

/** Floating quick-access button — hidden on AI page itself */
export function AiFloatingButton({ className }: Props) {
  const location = useLocation();
  const { user } = useAuth();
  const { role: portalRole } = useUserRole();

  if (location.pathname.startsWith("/ai-assistant") || location.pathname.startsWith("/dashboard/ai-assistant")) {
    return null;
  }

  const role = portalRole ?? "admin";
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? undefined;
  const ctx = buildContextFromLocation(location.pathname, role, userName);

  return (
    <Link
      to="/ai-assistant"
      className={cn(
        "fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6",
        className,
      )}
      onClick={() => storeReferrerContext(ctx)}
    >
      <Button
        size="lg"
        className="ai-brand-gradient h-12 gap-2 rounded-full px-5 shadow-lg hover:opacity-90"
      >
        <BrainCircuit className="h-4 w-4" />
        <span className="hidden sm:inline">{AI_ASSISTANT_NAV_LABEL}</span>
      </Button>
    </Link>
  );
}
