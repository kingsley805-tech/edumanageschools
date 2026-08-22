import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Building2,
  MessageCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useSupportSettings } from "@/hooks/useSupportSettings";
import { useOrganizationSubscription } from "@/subscription/hooks/useOrganizationSubscription";
import {
  isPendingVerificationState,
  isRejectedVerificationState,
} from "@/subscription/lib/subscriptionAccess";
import { phoneToTelHref, phoneToWhatsAppHref } from "@/lib/supportSettings";
import {
  clearAdminPendingVerificationFlow,
  isAdminPostPaymentTransition,
} from "@/subscription/lib/adminOnboardingFlow";
import OnboardingTransitionScreen from "@/subscription/components/OnboardingTransitionScreen";
import { toast } from "sonner";
import { EduManageLogo } from "@/components/EduManageLogo";

export default function AdminPendingApprovalScreen() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { currentSchool } = useSchoolInfo();
  const { data: support } = useSupportSettings();
  const { access, invalidate, isFetching, loading } = useOrganizationSubscription();
  const [checking, setChecking] = useState(false);

  const rejected = isRejectedVerificationState(access);
  const pending = isPendingVerificationState(access);
  const paymentSuccessful = Boolean(access?.plan_id) || isAdminPostPaymentTransition();

  // Only open the dashboard after explicit Super Admin approval — never after payment alone.
  useEffect(() => {
    if (!access?.plan_id) return;

    const approved =
      access?.admin_approval_status === "approved" ||
      ((access?.access_state === "active" || access?.access_state === "expiring_soon") &&
        access?.can_use_platform === true &&
        access?.admin_approval_status !== "pending_verification" &&
        access?.admin_approval_status !== "rejected");

    if (!approved) return;

    clearAdminPendingVerificationFlow();
    toast.success("Your account has been approved. Welcome to Edumanage.");
    navigate("/admin", { replace: true });
  }, [access?.can_use_platform, access?.access_state, access?.admin_approval_status, access?.plan_id, navigate]);

  // Unpaid only — wait until access has settled; never bounce during post-payment.
  useEffect(() => {
    if (loading || !access) return;
    if (isAdminPostPaymentTransition()) return;
    if (access.access_state === "pending_payment" || !access.plan_id) {
      clearAdminPendingVerificationFlow();
      navigate("/admin/subscription", { replace: true });
    }
  }, [access, loading, navigate]);

  // Once verification page is stable with a paid plan, clear transition flag.
  useEffect(() => {
    if (pending && access?.plan_id) {
      try {
        sessionStorage.removeItem("admin_post_payment_transition");
      } catch {
        /* ignore */
      }
    }
  }, [pending, access?.plan_id]);

  if (loading && !paymentSuccessful) {
    return <OnboardingTransitionScreen message="Loading verification status…" />;
  }

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

  const phonePrimary = support?.phonePrimary ?? "+233 50 368 8781";
  const phoneSecondary = support?.phoneSecondary;
  const supportEmail = support?.email ?? "edumanagesystems@gmail.com";

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans">
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pb-4">
        <div className="flex items-center gap-3">
          <EduManageLogo className="h-8 w-auto" />
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
            Account Verification
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
            <div
              className={`inline-flex items-center justify-center size-16 rounded-full border-2 mb-4 shadow-sm ${
                rejected
                  ? "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {rejected ? <XCircle className="size-8" /> : <CheckCircle2 className="size-8" />}
            </div>

            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-mono text-foreground">
              {rejected ? "Account Verification Declined" : "Your account is awaiting verification."}
            </h1>
            {!rejected && paymentSuccessful ? (
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="size-4 shrink-0" />
                Your subscription payment was successfully completed.
              </p>
            ) : null}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {rejected ? (
              <div className="p-4 sm:p-5 rounded-xl bg-red-500/10 border border-red-500/25 text-foreground space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm leading-relaxed text-secondary-foreground">
                    <p className="font-semibold text-foreground mb-1">Your administrator account was not approved.</p>
                    <p>
                      Please contact our support team using the contact information below if you believe this was an
                      error or need further assistance.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-foreground space-y-2">
                <div className="flex items-start gap-3">
                  <div className="size-7 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="size-4" />
                  </div>
                  <div className="text-sm leading-relaxed text-secondary-foreground">
                    <p className="font-semibold text-foreground mb-1">Your account is awaiting verification.</p>
                    <p>
                      Your subscription payment was successfully completed. Our system authorities will review and verify
                      your administrator account within <strong className="text-foreground">2 hours</strong>.
                    </p>
                    <p className="mt-2">
                      Once your account has been approved, you will be able to access your administrator portal. Portal
                      access will only become available after explicit approval — it is not granted automatically after
                      the 2-hour window.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account status</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3.5 rounded-lg border border-border bg-muted/30">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Payment status</span>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    {paymentSuccessful ? "Successful" : "Pending"}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border bg-muted/30">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Account status</span>
                  <p
                    className={`text-sm font-semibold mt-1 ${
                      rejected
                        ? "text-red-600 dark:text-red-400"
                        : pending
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                    }`}
                  >
                    {rejected
                      ? "Rejected"
                      : pending
                        ? "Pending Verification"
                        : (access?.admin_approval_status ?? "Pending Verification")}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border bg-muted/30">
                  <span className="text-[11px] font-semibold uppercase text-muted-foreground">Expected review</span>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {rejected ? "Contact support" : "Within 2 hours"}
                  </p>
                </div>
              </div>
            </div>

            {!rejected ? (
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
                    <span className="text-[11px] text-muted-foreground mt-0.5">Successful</span>
                  </div>

                  <div className="p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 flex flex-col justify-between ring-1 ring-amber-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Step 3</span>
                      <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Super Admin approval</span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                      Pending · within 2 hours
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {currentSchool ? (
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

                <Badge
                  variant="outline"
                  className={
                    rejected
                      ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-xs"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                  }
                >
                  {rejected ? "Rejected" : "Pending verification"}
                </Badge>
              </div>
            ) : null}

            {!rejected ? (
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
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Need assistance?</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  If you need support with your registration, subscription, or account verification, please contact our
                  support team using the phone numbers or email address provided below.
                </p>
              </div>
              <div className="space-y-2">
                <a
                  href={phoneToTelHref(phonePrimary)}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium"
                >
                  <Phone className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {phonePrimary}
                  <span className="ml-auto text-[11px] text-muted-foreground">Primary</span>
                </a>
                {phoneSecondary ? (
                  <a
                    href={phoneToTelHref(phoneSecondary)}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium"
                  >
                    <Phone className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {phoneSecondary}
                    <span className="ml-auto text-[11px] text-muted-foreground">Secondary</span>
                  </a>
                ) : null}
                <a
                  href={`mailto:${supportEmail}`}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium break-all"
                >
                  <Mail className="size-4 text-primary shrink-0" />
                  {supportEmail}
                </a>
                <Button type="button" variant="outline" className="w-full h-10 gap-2" asChild>
                  <a
                    href={phoneToWhatsAppHref(phonePrimary)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>WhatsApp support</span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-muted-foreground py-4">
        © {new Date().getFullYear()} EduManage. All rights reserved.
      </footer>
    </div>
  );
}
