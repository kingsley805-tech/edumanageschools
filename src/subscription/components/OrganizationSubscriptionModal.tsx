// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CreditCard, Loader2, Lock, LogOut, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaystackEdgeFunctionAlert } from "@/components/billing/PaystackEdgeFunctionAlert";
import { invokeEdgeFunction, isEdgeFunctionUnreachable } from "@/lib/invokeEdgeFunction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useOrganizationSubscription,
  useSubscriptionPlansPublic,
} from "@/subscription/hooks/useOrganizationSubscription";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";
import { isPlanAvailableForCheckout } from "@/subscription/lib/subscriptionPlansPublic";
import { sidebarItemsFromPlanModules } from "@/platform/lib/planSidebarLabels";

type BillingCycle = "monthly" | "annual";

type Props = {
  forceOpen?: boolean;
  /** Render plan picker on the subscription page (not only in lock overlay). */
  inline?: boolean;
  onActivated?: () => void;
  access?: OrganizationSubscriptionAccess | null;
};

export default function OrganizationSubscriptionModal({
  forceOpen = false,
  inline = false,
  onActivated,
  access: accessProp,
}: Props) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { access: hookAccess, invalidate, blocked } = useOrganizationSubscription();
  const access = accessProp ?? hookAccess;
  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansError,
    error: plansErrorDetail,
    refetch: refetchPlans,
  } = useSubscriptionPlansPublic();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [enableSms, setEnableSms] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paystackDeployed, setPaystackDeployed] = useState<boolean | null>(null);
  const [paystackProbeDetail, setPaystackProbeDetail] = useState<string | undefined>();

  const visible =
    inline || forceOpen || blocked || access?.access_state === "locked" || access?.access_state === "pending_payment";

  const displayPlans = useMemo(
    () => plans.filter(isPlanAvailableForCheckout),
    [plans],
  );

  useEffect(() => {
    if (!visible) return;
    void refetchPlans();
  }, [visible, refetchPlans]);

  useEffect(() => {
    if (selectedPlanId && !displayPlans.some((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [displayPlans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => displayPlans.find((p) => p.id === selectedPlanId) ?? null,
    [displayPlans, selectedPlanId],
  );

  const packageAmount = useMemo(() => {
    if (!selectedPlan) return 0;
    return billingCycle === "annual"
      ? Number(selectedPlan.price_annual)
      : Number(selectedPlan.price_monthly);
  }, [selectedPlan, billingCycle]);

  const smsAmount = useMemo(() => {
    if (!selectedPlan || !enableSms) return 0;
    return billingCycle === "annual"
      ? Number(selectedPlan.sms_addon_fee_annual ?? 0)
      : Number(selectedPlan.sms_addon_fee_monthly ?? 0);
  }, [selectedPlan, billingCycle, enableSms]);

  const price = useMemo(() => packageAmount + smsAmount, [packageAmount, smsAmount]);

  const smsAvailable = useMemo(() => {
    if (!selectedPlan) return false;
    const fee =
      billingCycle === "annual"
        ? Number(selectedPlan.sms_addon_fee_annual ?? 0)
        : Number(selectedPlan.sms_addon_fee_monthly ?? 0);
    return (
      fee > 0 ||
      (selectedPlan.sms_included_quantity ?? 0) > 0 ||
      (selectedPlan.default_modules ?? []).includes("sms")
    );
  }, [selectedPlan, billingCycle]);

  useEffect(() => {
    if (!smsAvailable) setEnableSms(false);
  }, [smsAvailable, selectedPlanId, billingCycle]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      try {
        await invokeEdgeFunction("paystack", { action: "gateway-list" });
        if (!cancelled) {
          setPaystackDeployed(true);
          setPaystackProbeDetail(undefined);
        }
      } catch (e) {
        if (cancelled) return;
        if (isEdgeFunctionUnreachable(e)) {
          setPaystackDeployed(false);
          setPaystackProbeDetail(e instanceof Error ? e.message : undefined);
        } else {
          setPaystackDeployed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");
    if (!ref || !visible) return;
    void confirmPayment(ref);
  }, [visible]);

  const confirmPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const data = await invokeEdgeFunction<{ ok?: boolean; error?: string }>("paystack", {
        action: "platform-subscription-confirm",
        reference,
      });
      if (data?.ok) {
        toast.success("Subscription activated! Welcome to your dashboard.");
        await invalidate();
        onActivated?.();
        window.history.replaceState({}, "", "/admin/subscription");
        navigate("/admin", { replace: true });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const startPayment = async () => {
    if (!selectedPlanId) {
      toast.error("Select a subscription plan");
      return;
    }
    if (enableSms && smsAmount <= 0) {
      toast.error("SMS add-on is enabled but this plan has no SMS service fee configured");
      return;
    }
    setPaying(true);
    try {
      const callbackUrl = `${window.location.origin}/admin/subscription`;
      const data = await invokeEdgeFunction<{
        authorization_url?: string;
        total_amount?: number;
        package_amount?: number;
        sms_amount?: number;
        error?: string;
      }>("paystack", {
        action: "platform-subscription-init",
        plan_id: selectedPlanId,
        billing_cycle: billingCycle,
        enable_sms: enableSms,
        package_amount: packageAmount,
        sms_amount: smsAmount,
        total_amount: price,
        callback_url: callbackUrl,
      });
      if (typeof data?.total_amount === "number" && Math.abs(data.total_amount - price) > 0.02) {
        throw new Error(
          `Paystack total (GHS ${data.total_amount}) does not match checkout (GHS ${price}). Redeploy the paystack edge function.`,
        );
      }
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error("Could not start payment");
    } catch (e) {
      if (isEdgeFunctionUnreachable(e)) {
        setPaystackDeployed(false);
        setPaystackProbeDetail(e instanceof Error ? e.message : undefined);
      }
      toast.error(e instanceof Error ? e.message : "Payment failed to start");
    } finally {
      setPaying(false);
    }
  };

  if (!visible) return null;

  const planGrid = (
    <>
      {plansLoading || verifying ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : plansError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load plans</AlertTitle>
          <AlertDescription>
            {plansErrorDetail instanceof Error
              ? plansErrorDetail.message
              : "Check your connection or ask the platform owner to enable subscription plans."}
          </AlertDescription>
        </Alert>
      ) : displayPlans.length === 0 && plans.length > 0 ? (
        <Alert>
          <AlertTitle>No self-serve plans available</AlertTitle>
          <AlertDescription>
            Active plans exist but none are available for online checkout. Add monthly or annual pricing, or contact
            your platform administrator.
          </AlertDescription>
        </Alert>
      ) : displayPlans.length === 0 ? (
        <Alert>
          <AlertTitle>No plans available</AlertTitle>
          <AlertDescription>
            No active subscription plans are configured yet. Contact your platform administrator or
            run the platform SaaS SQL migrations in Supabase.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {displayPlans.map((plan) => {
            const planPrice =
              billingCycle === "annual"
                ? Number(plan.price_annual)
                : Number(plan.price_monthly);
            const selected = selectedPlanId === plan.id;
            const sidebarItems = sidebarItemsFromPlanModules(plan.default_modules as string[]);
            const visibleSidebarItems = sidebarItems.slice(0, 12);
            const hiddenSidebarCount = sidebarItems.length - visibleSidebarItems.length;
            return (
              <Card
                key={plan.id}
                className={`cursor-pointer transition-all ${selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"}`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {selected ? <Badge>Selected</Badge> : null}
                      {plan.is_custom ? <Badge variant="secondary">Enterprise</Badge> : null}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-2xl font-bold">GHS {planPrice.toLocaleString()}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {billingCycle === "annual" ? "year" : "month"}
                    </span>
                  </div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    <li>Students: {plan.max_students == null ? "Unlimited" : plan.max_students.toLocaleString()}</li>
                    <li>Teachers: {plan.max_teachers == null ? "Unlimited" : plan.max_teachers.toLocaleString()}</li>
                    <li>
                      Storage:{" "}
                      {plan.max_storage_gb == null ? "Unlimited" : `${plan.max_storage_gb} GB`}
                    </li>
                  </ul>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Sidebar menu</p>
                    {sidebarItems.length === 0 ? (
                      <p className="text-xs italic text-muted-foreground">No pages configured</p>
                    ) : (
                      <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs">
                        {visibleSidebarItems.map((item) => (
                          <li key={item.key} className="flex items-center gap-1">
                            <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                            {item.label}
                          </li>
                        ))}
                        {hiddenSidebarCount > 0 ? (
                          <li className="text-muted-foreground">+{hiddenSidebarCount} more</li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                  {(plan.sms_included_quantity ?? 0) > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Includes {Number(plan.sms_included_quantity).toLocaleString()} SMS credits
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  const planFooter = (
    <div className="space-y-4 border-t px-6 py-4">
      {selectedPlan && smsAvailable ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="enable-sms" className="text-base font-medium">
                Enable Parent SMS Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Parents receive SMS when attendance/register is marked. Adds GHS {smsAmount.toLocaleString()} to your first payment.
                {(selectedPlan.sms_included_quantity ?? 0) > 0
                  ? ` Plan includes ${Number(selectedPlan.sms_included_quantity).toLocaleString()} SMS credits.`
                  : ""}
              </p>
            </div>
          </div>
          <Switch id="enable-sms" checked={enableSms} onCheckedChange={setEnableSms} />
        </div>
      ) : null}

      {selectedPlan ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Package amount</span>
            <span className="font-medium">GHS {packageAmount.toLocaleString()}</span>
          </div>
          {enableSms ? (
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">SMS service fee</span>
              <span className="font-medium">GHS {smsAmount.toLocaleString()}</span>
            </div>
          ) : null}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>Total amount</span>
            <span>GHS {price.toLocaleString()}</span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedPlan ? (
            <>
              <span className="font-medium text-foreground">{selectedPlan.name}</span>
              {" — "}
              GHS {price.toLocaleString()} ({billingCycle === "annual" ? "365 days" : "30 days"})
              {enableSms ? " · SMS included" : ""}
            </>
          ) : (
            "Select a plan to continue"
          )}
        </p>
        <Button
          size="lg"
          disabled={
            !selectedPlanId ||
            paying ||
            verifying ||
            plansLoading ||
            displayPlans.length === 0 ||
            paystackDeployed === false
          }
          onClick={startPayment}
        >
          {paying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting to Paystack…
            </>
          ) : (
            "Pay & activate"
          )}
        </Button>
      </div>
    </div>
  );

  const billingTabs = (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
        <TabsList>
          <TabsTrigger value="monthly">Monthly (30 days)</TabsTrigger>
          <TabsTrigger value="annual">Yearly (365 days)</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button variant="link" className="h-auto p-0" onClick={() => navigate("/admin/subscription/history")}>
        Payment history
      </Button>
      <Button variant="link" className="h-auto p-0" onClick={() => navigate("/admin/support")}>
        Contact support
      </Button>
    </div>
  );

  const paystackAlert =
    paystackDeployed === false ? (
      <div className={inline ? "px-6 pt-4" : "px-6 pt-4"}>
        <PaystackEdgeFunctionAlert detail={paystackProbeDetail} forPlatformSubscription />
      </div>
    ) : null;

  if (inline) {
    return (
      <div className="space-y-6 rounded-xl border bg-card">
        {paystackAlert}
        <div className="border-b px-6 py-4">{billingTabs}</div>
        <div className="px-6 pb-2">{planGrid}</div>
        <div className={displayPlans.length === 0 ? "hidden" : ""}>{planFooter}</div>
      </div>
    );
  }

  const title =
    access?.access_state === "locked"
      ? "Renew your subscription"
      : access?.access_state === "pending_payment"
        ? "Choose a subscription plan"
        : "Subscription required";

  const subtitle =
    access?.access_state === "locked"
      ? "Your organization is locked. Complete payment to restore full access. All your data is safe."
      : access?.access_state === "pending_payment"
        ? "Your account is active but system access is locked until you choose a plan and pay, or your platform owner activates you."
        : "Select a plan and complete payment to unlock your school management dashboard.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
        <div className="border-b px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              {access?.access_state === "locked" ? (
                <Lock className="h-6 w-6 text-primary" />
              ) : (
                <CreditCard className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              {access?.access_state === "pending_payment" ? (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Status: Pending payment · Access: Locked
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={async () => {
                await signOut();
                navigate("/auth", { replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
          <div className="mt-4">{billingTabs}</div>
        </div>

        {paystackAlert}

        <div className="flex-1 overflow-y-auto px-6 py-4">{planGrid}</div>

        {planFooter}
      </div>
    </div>
  );
}
