// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CreditCard, Loader2, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useOrganizationSubscription,
  useSubscriptionPlansPublic,
} from "@/subscription/hooks/useOrganizationSubscription";
import type { OrganizationSubscriptionAccess } from "@/subscription/lib/subscriptionAccess";

type BillingCycle = "monthly" | "annual";

type Props = {
  forceOpen?: boolean;
  onActivated?: () => void;
  access?: OrganizationSubscriptionAccess | null;
};

export default function OrganizationSubscriptionModal({
  forceOpen = false,
  onActivated,
  access: accessProp,
}: Props) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { access: hookAccess, invalidate, blocked } = useOrganizationSubscription();
  const access = accessProp ?? hookAccess;
  const { data: plans = [], isLoading: plansLoading } = useSubscriptionPlansPublic();

  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const visible = forceOpen || blocked || access?.access_state === "locked";

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const price = useMemo(() => {
    if (!selectedPlan) return 0;
    return billingCycle === "annual"
      ? Number(selectedPlan.price_annual)
      : Number(selectedPlan.price_monthly);
  }, [selectedPlan, billingCycle]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");
    if (!ref || !visible) return;
    void confirmPayment(ref);
  }, [visible]);

  const confirmPayment = async (reference: string) => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack", {
        body: { action: "platform-subscription-confirm", reference },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
    setPaying(true);
    try {
      const callbackUrl = `${window.location.origin}/admin/subscription`;
      const { data, error } = await supabase.functions.invoke("paystack", {
        body: {
          action: "platform-subscription-init",
          plan_id: selectedPlanId,
          billing_cycle: billingCycle,
          callback_url: callbackUrl,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error("Could not start payment");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed to start");
    } finally {
      setPaying(false);
    }
  };

  if (!visible) return null;

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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Tabs
              value={billingCycle}
              onValueChange={(v) => setBillingCycle(v as BillingCycle)}
            >
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
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {plansLoading || verifying ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {plans
                .filter((p) => !p.is_custom || Number(p.price_monthly) === 0)
                .map((plan) => {
                  const planPrice =
                    billingCycle === "annual"
                      ? Number(plan.price_annual)
                      : Number(plan.price_monthly);
                  const selected = selectedPlanId === plan.id;
                  return (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all ${selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          {selected ? <Badge>Selected</Badge> : null}
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
                        <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs">
                          {(plan.default_modules ?? []).slice(0, 8).map((m: string) => (
                            <li key={m} className="flex items-center gap-1">
                              <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                              {m.replace(/_/g, " ")}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {selectedPlan ? (
              <>
                <span className="font-medium text-foreground">{selectedPlan.name}</span>
                {" — "}
                GHS {price.toLocaleString()} ({billingCycle === "annual" ? "365 days" : "30 days"})
              </>
            ) : (
              "Select a plan to continue"
            )}
          </p>
          <Button
            size="lg"
            disabled={!selectedPlanId || paying || verifying || plansLoading}
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
    </div>
  );
}
