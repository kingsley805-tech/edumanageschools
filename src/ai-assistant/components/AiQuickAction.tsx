import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildContextFromLocation, storeReferrerContext } from "../lib/context";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

type Props = {
  label?: string;
  prompt?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

/** Inline AI action button — pass module context and optional prefill prompt */
export function AiQuickAction({
  label = "AI Assistant",
  prompt,
  className,
  variant = "outline",
  size = "sm",
}: Props) {
  const location = useLocation();
  const { profile } = useAuth();
  const role = profile?.role ?? "admin";
  const ctx = buildContextFromLocation(location.pathname, role, profile?.full_name);

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
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </Link>
    </Button>
  );
}
