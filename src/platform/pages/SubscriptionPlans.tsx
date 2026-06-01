// @ts-nocheck
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { useSubscriptionPlans } from "@/platform/hooks/usePlatformDashboard";

export default function SubscriptionPlansPage() {
  const { data: plans, isLoading } = useSubscriptionPlans();

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to="/platform">
              <ArrowLeft className="mr-1 h-4 w-4" /> Platform
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Subscription plans</h1>
          <p className="text-muted-foreground">Configurable packages for tenant organizations</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {(plans ?? []).map((plan) => (
              <Card key={plan.id} className={plan.slug === "premium" ? "border-primary shadow-md" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.slug === "enterprise" ? (
                      <Badge variant="secondary">Custom</Badge>
                    ) : null}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-2xl font-bold">
                      GHS {Number(plan.price_monthly).toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground"> / month</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      Students: {plan.max_students == null ? "Unlimited" : plan.max_students.toLocaleString()}
                    </li>
                    <li>
                      Teachers: {plan.max_teachers == null ? "Unlimited" : plan.max_teachers.toLocaleString()}
                    </li>
                    <li>
                      Storage: {plan.max_storage_gb == null ? "Unlimited" : `${plan.max_storage_gb} GB`}
                    </li>
                  </ul>
                  <div className="border-t pt-3">
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Included modules</p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                      {(plan.default_modules ?? []).length === 0 ? (
                        <li className="italic">Custom configuration</li>
                      ) : (
                        (plan.default_modules as string[]).map((m) => (
                          <li key={m} className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-emerald-600" />
                            {m.replace(/_/g, " ")}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
