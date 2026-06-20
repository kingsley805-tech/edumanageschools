import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exchangeGoogleCode } from "@/live-classes/lib/api";

export default function GoogleOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      const description = searchParams.get("error_description") ?? "";
      if (error === "access_denied" || description.includes("verification")) {
        toast.error(
          "Google blocked sign-in: add your email as a Test user in Google Cloud Console → OAuth consent screen, then try again.",
          { duration: 12000 },
        );
      } else {
        toast.error("Google authorization was cancelled");
      }
      navigate("/admin/online-learning", { replace: true });
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
        navigate("/admin/online-learning", { replace: true });
      }
    })();
  }, [navigate, searchParams]);

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
