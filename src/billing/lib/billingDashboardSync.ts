export const BILLING_DASHBOARD_STATS_REFETCH_EVENT = "school-hub:billing-dashboard-refetch";

export function requestBillingDashboardRefetch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BILLING_DASHBOARD_STATS_REFETCH_EVENT));
  }
}
