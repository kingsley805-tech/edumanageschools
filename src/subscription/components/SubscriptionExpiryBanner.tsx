// @ts-nocheck
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  subscriptionBannerMessage,
  subscriptionBannerVariant,
  type OrganizationSubscriptionAccess,
} from "@/subscription/lib/subscriptionAccess";

type Props = {
  access: OrganizationSubscriptionAccess | null | undefined;
};

export default function SubscriptionExpiryBanner({ access }: Props) {
  const message = subscriptionBannerMessage(access);
  if (!message) return null;

  const variant = subscriptionBannerVariant(access);

  return (
    <div className="mx-auto mb-4 w-full max-w-[1400px] md:mb-6">
      <Alert variant={variant} className="rounded-lg border shadow-sm">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {access?.access_state === "expiring_soon"
            ? "Subscription expiring soon"
            : access?.access_state === "locked"
              ? "Account locked"
              : "Subscription expired"}
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{message}</span>
          <Button size="sm" variant={variant === "destructive" ? "destructive" : "default"} asChild>
            <Link to="/admin/subscription">Renew now</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
