import { PageHeader } from "@/report/portal/page-header";
import { SignatureManager } from "@/report/portal/signature-manager";
import { withReportLayout } from "@/report/withReportLayout";

function TeacherSignaturesPage() {
  return (
    <>
      <PageHeader
        title="My signatures"
        description="Upload and manage signatures used on class teacher report cards."
      />
      <div className="max-w-2xl p-6 md:p-8">
        <SignatureManager
          roleKind="teacher"
          title="Class teacher signature"
          description="Your active signature is shown in the Class Teacher Signature field on every report you create or edit."
        />
      </div>
    </>
  );
}

export default withReportLayout("teacher", TeacherSignaturesPage);
