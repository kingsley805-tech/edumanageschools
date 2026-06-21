import { Link } from "react-router-dom";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildContextFromLocation, storeReferrerContext } from "../lib/context";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useLocation } from "react-router-dom";
import { AI_ASSISTANT_NAV_LABEL } from "../lib/branding";

type Props = {
  label?: string;
  prompt?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

/** Inline AI action button — pass module context and optional prefill prompt */
export function AiQuickAction({
  label = AI_ASSISTANT_NAV_LABEL,
  prompt,
  className,
  variant = "outline",
  size = "sm",
}: Props) {
  const location = useLocation();
  const { user } = useAuth();
  const { role: portalRole } = useUserRole();
  const role = portalRole ?? "admin";
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? undefined;
  const ctx = buildContextFromLocation(location.pathname, role, userName);

  const to = prompt
    ? `/ai-assistant?${new URLSearchParams({ q: prompt }).toString()}`
    : "/ai-assistant";

  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
    >
      <Link
        to={to}
        onClick={() => storeReferrerContext(ctx)}
      >
        <BrainCircuit className="ai-accent-text h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  );
}
