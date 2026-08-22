import type { ReactNode } from "react";
import { BILLING_FEE_PAGE_STYLES } from "@/billing/components/billingFeePageStyles";

type BillingFeePageShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function BillingFeePageShell({
  title,
  description,
  actions,
  children,
}: BillingFeePageShellProps) {
  return (
    <div className="fee-root fee-bg" style={{ padding: "32px 28px", minHeight: "100vh" }}>
      <style>{BILLING_FEE_PAGE_STYLES}</style>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                margin: "0 0 6px",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: "hsl(var(--muted-foreground))",
                margin: 0,
              }}
            >
              {description}
            </p>
          </div>
          {actions ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      {children}
    </div>
  );
}

export function BillingFeeLoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="fee-loading">{label}</p>;
}
