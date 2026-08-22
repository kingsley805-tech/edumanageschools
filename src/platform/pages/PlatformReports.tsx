import PlatformLayout from "@/platform/components/PlatformLayout";
import { SuperAdminReportsContent } from "@/report/pages/super-admin/Reports";

export default function PlatformReports() {
  return (
    <PlatformLayout
      title="Reports"
      description="Review and approve report cards across all schools"
    >
      <div className="mx-auto max-w-6xl">
        <SuperAdminReportsContent embedded />
      </div>
    </PlatformLayout>
  );
}
