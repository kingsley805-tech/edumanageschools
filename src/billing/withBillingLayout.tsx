import type { ComponentType } from "react";
import DashboardLayout from "@/components/DashboardLayout";

type BillingLayoutRole = "admin" | "accountant" | "auditor";

export function withBillingLayout<P extends object>(
  role: BillingLayoutRole,
  Component: ComponentType<P>,
) {
  return function BillingLayoutPage(props: P) {
    return (
      <DashboardLayout role={role}>
        <Component {...props} />
      </DashboardLayout>
    );
  };
}
