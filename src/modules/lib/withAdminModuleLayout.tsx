import type { ComponentType } from "react";
import DashboardLayout from "@/components/DashboardLayout";

export function withAdminModuleLayout<P extends object>(Component: ComponentType<P>) {
  return function AdminModulePage(props: P) {
    return (
      <DashboardLayout role="admin">
        <Component {...props} />
      </DashboardLayout>
    );
  };
}
