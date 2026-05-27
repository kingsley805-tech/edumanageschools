import { forwardRef, useImperativeHandle, useRef } from "react";
import { ShepherdReportCard } from "@/report/components/shepherd-report-card";
import type { ClassTermExportReport } from "@/report/lib/term-report";

export type BulkReportExportHandle = {
  getCardElements: () => HTMLElement[];
};

type Props = {
  items: ClassTermExportReport[];
  schoolId?: string | null;
  teacherSignatureUrl?: string | null;
  headSignatureUrl?: string | null;
};

/** Off-screen stack of report cards for bulk print / merged PDF capture. */
export const BulkReportPrintStack = forwardRef<BulkReportExportHandle, Props>(
  function BulkReportPrintStack({ items, schoolId, teacherSignatureUrl, headSignatureUrl }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getCardElements: () => {
        const root = containerRef.current;
        if (!root) return [];
        return Array.from(root.querySelectorAll<HTMLElement>(".rc-card"));
      },
    }));

    if (!items.length) return null;

    return (
      <div
        ref={containerRef}
        className="bulk-report-stack"
        aria-hidden
        style={{
          position: "fixed",
          left: -20000,
          top: 0,
          width: 860,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {items.map((item) => (
          <div key={item.id} className="bulk-report-page" data-student-id={item.studentId}>
            <ShepherdReportCard
              data={item.form}
              academicYear={item.form.academicYear}
              editable={false}
              showToolbar={false}
              status={item.status}
              schoolId={schoolId}
              teacherSignatureUrl={teacherSignatureUrl}
              headSignatureUrl={headSignatureUrl}
            />
          </div>
        ))}
      </div>
    );
  },
);
