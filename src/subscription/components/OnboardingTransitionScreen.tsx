import { Loader2 } from "lucide-react";
import { EduManageLogo } from "@/components/EduManageLogo";

type Props = {
  message?: string;
};

/** Stable full-screen hold while routing between subscription ↔ verification. */
export default function OnboardingTransitionScreen({
  message = "Please wait…",
}: Props) {
  return (
    <div className="fixed inset-0 z-[120] flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <EduManageLogo className="h-8 w-auto opacity-90" />
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
    </div>
  );
}
