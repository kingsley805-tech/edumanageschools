export const BILLING_DASHBOARD_STATS_REFETCH_EVENT = "school-hub:billing-dashboard-refetch";

export function requestBillingDashboardRefetch() {
  window.dispatchEvent(new CustomEvent(BILLING_DASHBOARD_STATS_REFETCH_EVENT));
}
