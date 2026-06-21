import { Link, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildContextFromLocation, storeReferrerContext } from "@/ai-assistant/lib/context";
import { useAuth } from "@/contexts/AuthContext";

type Props = {
  className?: string;
};

/** Floating quick-access button — hidden on AI page itself */
export function AiFloatingButton({ className }: Props) {
  const location = useLocation();
  const { profile } = useAuth();

  if (location.pathname.startsWith("/ai-assistant") || location.pathname.startsWith("/dashboard/ai-assistant")) {
    return null;
  }

  const role = profile?.role ?? "admin";
  const ctx = buildContextFromLocation(location.pathname, role, profile?.full_name);

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
        className="h-12 gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 shadow-lg hover:from-violet-500 hover:to-indigo-500"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">AI Assistant</span>
      </Button>
    </Link>
  );
}
