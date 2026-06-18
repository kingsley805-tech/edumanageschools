import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { PortalPageHeader } from "@/components/PortalPageHeader";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exchangeGoogleCode } from "@/live-classes/lib/api";

export default function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    if (error) {
      toast.error("Google authorization was cancelled");
      window.location.href = "/admin/online-learning";
      return;
    }
    if (!code) return;

    void (async () => {
      try {
        const redirectUri = `${window.location.origin}/admin/online-learning/oauth/callback`;
        const result = await exchangeGoogleCode(code, redirectUri, state ?? undefined);
        toast.success(`Connected as ${result.email}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "OAuth failed");
      } finally {
        setDone(true);
        window.location.href = "/admin/online-learning";
      }
    })();
  }, [searchParams]);

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {done ? "Redirecting…" : "Connecting Google Workspace…"}
        </p>
      </div>
    </DashboardLayout>
  );
}
