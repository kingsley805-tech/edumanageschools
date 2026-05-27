import { format } from "date-fns";
import type { TermReportRow } from "@/report/lib/term-report";
import { formatTermLabel } from "@/report/lib/terms";

type SenderInfo = { name: string; role?: string } | null;

export function ReportMetaPanel({
  report,
  sentBy,
  className,
}: {
  report: Pick<
    TermReportRow,
    | "term_label"
    | "academic_year"
    | "created_at"
    | "updated_at"
    | "saved_at"
    | "submitted_at"
    | "sent_to_parents_at"
  >;
  sentBy?: SenderInfo;
  className?: string;
}) {
  const termDisplay =
    report.term_label && report.academic_year
      ? `${report.term_label} · ${report.academic_year}`
      : report.term_label || report.academic_year || "—";

  return (
    <div
      className={
        className ??
        "no-print rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm space-y-2"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">Academic period</span>
        <span className="font-semibold text-foreground">{termDisplay}</span>
      </div>
      <dl className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 text-xs text-muted-foreground">
        <div>
          <dt className="font-medium text-foreground/80">Created</dt>
          <dd>{format(new Date(report.created_at), "PPp")}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground/80">Last updated</dt>
          <dd>{format(new Date(report.updated_at), "PPp")}</dd>
        </div>
        {report.submitted_at && (
          <div>
            <dt className="font-medium text-foreground/80">Submitted</dt>
            <dd>{format(new Date(report.submitted_at), "PPp")}</dd>
          </div>
        )}
        {report.sent_to_parents_at && (
          <div>
            <dt className="font-medium text-foreground/80">Sent to parents</dt>
            <dd>
              {format(new Date(report.sent_to_parents_at), "PPp")}
              {sentBy?.name ? ` · ${sentBy.name}${sentBy.role ? ` (${sentBy.role})` : ""}` : ""}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function termBannerTitle(termLabel?: string | null, academicYear?: string | null): string {
  if (!termLabel && !academicYear) return "";
  if (termLabel && academicYear) return `${termLabel} · ${academicYear}`;
  return termLabel || academicYear || "";
}
