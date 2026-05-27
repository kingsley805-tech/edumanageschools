import { withBillingLayout } from "@/billing/withBillingLayout";
import BillingReports from "@/billing/pages/admin/Reports";
import BillingInvoices from "@/billing/pages/admin/Invoices";
import BillingPayments from "@/billing/pages/admin/Payments";
import BillingFeeStructure from "@/billing/pages/admin/FeeStructure";
import BillingPaidStudents from "@/billing/pages/admin/PaidStudents";
import BillingOutstandingStudents from "@/billing/pages/admin/OutstandingStudents";
import ConsolidatedBilling from "@/billing/pages/admin/ConsolidatedBilling";

export const BillingReportsPage = withBillingLayout("admin", BillingReports);
export const BillingConsolidatedPage = withBillingLayout("admin", ConsolidatedBilling);
export const BillingInvoicesPage = withBillingLayout("admin", BillingInvoices);
export const BillingPaymentsPage = withBillingLayout("admin", BillingPayments);
export const BillingFeesPage = withBillingLayout("admin", BillingFeeStructure);
export const BillingPaidStudentsPage = withBillingLayout("admin", BillingPaidStudents);
export const BillingOutstandingStudentsPage = withBillingLayout("admin", BillingOutstandingStudents);
