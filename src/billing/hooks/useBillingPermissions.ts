// @ts-nocheck
﻿import { useCallback, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { PERMISSIONS } from "@/lib/permissions";

export type BillingPageKey =
  | "invoices"
  | "payments"
  | "fees"
  | "reports"
  | "paid_students"
  | "outstanding"
  | "payroll";

export type BillingPagePermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  update: boolean;
  manage: boolean;
};

const PAGE_PERM_MAP: Record<
  BillingPageKey,
  { view: string; create?: string; edit?: string; delete?: string; manage?: string }
> = {
  invoices: {
    view: PERMISSIONS.invoices.view,
    create: PERMISSIONS.invoices.create,
    edit: PERMISSIONS.invoices.edit,
    delete: PERMISSIONS.invoices.delete,
    manage: PERMISSIONS.invoices.approve,
  },
  payments: {
    view: PERMISSIONS.payments.view,
    create: PERMISSIONS.payments.process,
    edit: PERMISSIONS.payments.allocate,
    delete: PERMISSIONS.payments.reverse,
    manage: PERMISSIONS.payments.approveRefund,
  },
  fees: {
    view: PERMISSIONS.billing.feeCategories,
    create: PERMISSIONS.billing.feeTemplates,
    edit: PERMISSIONS.billing.feeTemplates,
    delete: PERMISSIONS.billing.feeTemplates,
    manage: PERMISSIONS.billing.feeTemplates,
  },
  reports: {
    view: PERMISSIONS.reports.viewFinancial,
    create: PERMISSIONS.reports.exportFinancial,
    manage: PERMISSIONS.reports.exportFinancial,
  },
  paid_students: { view: PERMISSIONS.fees.viewStatus },
  outstanding: { view: PERMISSIONS.invoices.view },
  payroll: {
    view: "payroll.view",
    create: "payroll.manage",
    edit: "payroll.manage",
    delete: "payroll.manage",
    manage: "payroll.manage",
  },
};

/** edubill-compatible permission API backed by school-hub RBAC. */
export function useBillingPermissions() {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { role } = useUserRole();
  const isFinanceAdmin = role === "admin" || role === "super_admin" || role === "accountant" || isSuperAdmin;

  const getPermission = useCallback(
    (page: BillingPageKey): BillingPagePermission => {
      const map = PAGE_PERM_MAP[page];
      const view = isFinanceAdmin || hasPermission(map.view);
      const create = isFinanceAdmin || (map.create ? hasPermission(map.create) : false);
      const edit = isFinanceAdmin || (map.edit ? hasPermission(map.edit) : false);
      const del = isFinanceAdmin || (map.delete ? hasPermission(map.delete) : false);
      const manage = isFinanceAdmin || (map.manage ? hasPermission(map.manage) : false);
      return {
        view,
        create: create || manage,
        edit: edit || manage,
        delete: del || manage,
        update: edit || manage,
        manage,
      };
    },
    [hasPermission, isFinanceAdmin],
  );

  return useMemo(() => ({ getPermission }), [getPermission]);
}