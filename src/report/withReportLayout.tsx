import type { ComponentType } from "react";
import DashboardLayout from "@/components/DashboardLayout";

type LayoutRole = "admin" | "teacher" | "parent" | "student" | "super_admin";

export function withReportLayout<P extends object>(
  role: LayoutRole,
  Component: ComponentType<P>,
) {
  return function ReportLayoutPage(props: P) {
    return (
      <DashboardLayout role={role}>
        <Component {...props} />
      </DashboardLayout>
    );
  };
}
