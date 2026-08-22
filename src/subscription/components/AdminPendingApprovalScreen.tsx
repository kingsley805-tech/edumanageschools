import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  LogOut,
  Phone,
  RefreshCw,
  ShieldCheck,
  Building2,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import { toast } from "sonner";
import { EduManageLogo } from "@/components/EduManageLogo";

const SUPPORT_PHONE = "+233 503 688 781";
const SUPPORT_PHONE_CLEAN = "+233503688781";

export default function AdminPendingApprovalScreen() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const { access, invalidate, isFetching } = useOrganizationSubscription();
  const [checking, setChecking] = useState(false);

  // Auto-open dashboard once Super Admin approves (poll + invalidate)
  useEffect(() => {
    if (access?.can_use_platform || access?.access_state === "active" || access?.access_state === "expiring_soon") {
      toast.success("Your account has been approved. Welcome to Edumanage.");
      navigate("/admin", { replace: true });
      return;
    }
    if (checking === false && access?.access_state === "pending_approval") {
      // no-op; keep screen
    }
  }, [access?.can_use_platform, access?.access_state, navigate, checking]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await invalidate();
    } catch {
      toast.error("Failed to check status. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pb-4">
        <div className="flex items-center gap-3">
          <EduManageLogo className="h-8 w-auto" />
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
            Admin Onboarding
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="mr-1.5 h-4 w-4" />
          Log out
        </Button>
      </header>

      <main className="max-w-2xl mx-auto w-full my-auto py-8">
        <div className="kt-card channel-stats-bg overflow-hidden shadow-xl">
          <div className="border-b border-border/60 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
              <CheckCircle2 className="size-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-mono text-foreground">
              Account Under Review
            </h1>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1.5">
              <Sparkles className="size-4 shrink-0" />
              Registration &amp; payment completed successfully
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-foreground space-y-2">
              <div className="flex items-start gap-3">
                <div className="size-7 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="size-4 animate-pulse" />
                </div>
                <div className="text-sm leading-relaxed text-secondary-foreground">
                  <p className="font-semibold text-foreground mb-1">
                    Your account has been created successfully.
                  </p>
                  <p>
                    Your account is currently under review and approval may take approximately{" "}
                    <strong className="text-foreground">20–30 minutes</strong>. You will be able to
                    access the system once a <strong className="text-foreground">Super Admin</strong>{" "}
                    grants permission. If it takes longer than expected, contact{" "}
                    <a
                      href={`tel:${SUPPORT_PHONE_CLEAN}`}
                      className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      {SUPPORT_PHONE}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Onboarding progress
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Step 1</span>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Account created</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5 truncate">{user?.email || "Completed"}</span>
                </div>

                <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Step 2</span>
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Payment received</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Verified</span>
                </div>

                <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 flex flex-col justify-between ring-1 ring-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 3</span>
                    <Clock className="size-4 text-amber-600 dark:text-amber-400 animate-spin" />
                  </div>
                  <span className="text-xs font-medium text-foreground">Super Admin approval</span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                    Pending · ~20–30 min
                  </span>
                </div>
              </div>
            </div>

            {currentSchool && (
              <div className="p-4 rounded-xl border border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                    <Building2 className="size-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground truncate">
                      {currentSchool.school_name || currentSchool.name || "School"}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      Code: {currentSchool.school_code}
                    </span>
                  </div>
                </div>

                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                  Pending activation
                </Badge>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                variant="default"
                className="w-full sm:flex-1 h-10 gap-2 font-medium kt-btn kt-btn-primary"
                onClick={() => void handleCheckStatus()}
                disabled={checking || isFetching}
              >
                <RefreshCw className={`size-4 ${checking || isFetching ? "animate-spin" : ""}`} />
                {checking || isFetching ? "Checking status…" : "Check status"}
              </Button>

              <Button type="button" variant="outline" className="w-full sm:w-auto h-10 gap-2" asChild>
                <a href={`tel:${SUPPORT_PHONE_CLEAN}`}>
                  <Phone className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Call {SUPPORT_PHONE}</span>
                </a>
              </Button>

              <Button type="button" variant="outline" className="w-full sm:w-auto h-10 gap-2" asChild>
                <a
                  href={`https://wa.me/${SUPPORT_PHONE_CLEAN.replace(/[^0-9]/g, "")}?text=Hello%20Edumanage%20Team,%20I%20have%20registered%20and%20completed%20payment%20and%20would%20like%20to%20follow%20up%20on%20Super%20Admin%20approval.`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-4">
        © {new Date().getFullYear()} EduManage. All rights reserved. Support: {SUPPORT_PHONE}
      </footer>
    </div>
  );
}
