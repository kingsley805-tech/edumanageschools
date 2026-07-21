import { useEffect, useMemo, useRef, useState } from "react";
import {
  recalcSubject,
  fmtScore,
  totalFromSubjects,
  displayTotalStudentsInClass,
  type ReportFormData,
  type SubjectRow,
} from "@/report/lib/shepherd-grading";
import { buildReportCardCss } from "@/report/lib/report-brand-colors";
import { getGradeScale } from "@/report/lib/grading";
import { exportElementToPdf, waitForReportAssets } from "@/report/lib/report-pdf";
import { canExportPdf, statusLabel } from "@/report/lib/report-card-status";
import { useGradingFormat, useSchool, useSchoolSettings } from "@/report/hooks/use-school-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveReportAssetUrl } from "@/report/lib/report-assets";

type Props = {
  data: ReportFormData;
  academicYear?: string;
  editable?: boolean;
  onChange?: (data: ReportFormData) => void;
  onSave?: () => void;
  saving?: boolean;
  showToolbar?: boolean;
  toolbarTitle?: string;
  status?: string;
  lastSaved?: Date | null;
  adminComment?: string | null;
  rejectionReason?: string | null;
  teacherSignatureUrl?: string | null;
  headSignatureUrl?: string | null;
  /** When false, headmaster date is read-only (teacher view). */
  allowHeadSignEdit?: boolean;
  /** School whose branding appears on the card (defaults to signed-in user's school). */
  schoolId?: string | null;
  /** True while background auto-save is in flight */
  autosavePending?: boolean;
};

/**
 * Print / PDF export normalization styles.
 *
 * Layered ON TOP of `buildReportCardCss()`. Two jobs:
 *
 * 1. Contain the logo and lock the results table to fixed, predictable
 *    column widths so nothing (in particular the score progress bar) can
 *    bleed across a column boundary when the DOM is rasterized for PDF
 *    export — canvas-based exporters size things from live layout, and any
 *    element relying on "auto" width is the classic source of that kind of
 *    overlap.
 * 2. A defensive `@media print` / `.rc-exporting` net for any native form
 *    control that might still be present, so backgrounds/borders never leak
 *    into the printed page even if something upstream forces `editable`
 *    during export.
 *
 * The bigger, more reliable fix for "lines running through text" lives in
 * the component itself: `isReadOnlyView` (see below) swaps every `<input>` /
 * `<textarea>` for a plain read-only `<span>` while exporting or printing.
 * Canvas-based PDF renderers (html2canvas and similar) are known to
 * mis-measure native form control text/baseline, which is what produces a
 * border or underline appearing to strike through the value instead of
 * sitting beneath it. Not rendering an `<input>` at all during export removes
 * that failure mode entirely, rather than trying to patch it with CSS.
 */
const REPORT_PRINT_FIX_CSS = `
  /* ---------- Logo: contain, never stretch/crop ---------- */
  .rc-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .rc-logo img {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: center;
    image-rendering: -webkit-optimize-contrast;
  }

  /* ---------- Fixed, print-safe A4 canvas ---------- */
  .rc-page-shell {
    display: flex;
    justify-content: center;
    width: 100%;
  }
  .rc-page {
    width: 100%;
    max-width: 850px;
    margin: 0 auto;
  }
  .rc-card {
    box-sizing: border-box;
    width: 100%;
    max-width: 794px; /* A4 @ 96dpi */
    margin: 0 auto;
    background: #ffffff;
  }
  .rc-card * {
    box-sizing: border-box;
  }

  /* ---------- Results table: locked columns, zero overflow ---------- */
  .rc-table {
    table-layout: fixed;
    width: 100%;
    border-collapse: collapse;
  }
  .rc-table th,
  .rc-table td {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Score bar: fully contained within its own cell, can never render past
     the cell boundary regardless of how the exporter measures widths. */
  .rc-score-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }
  .rc-bar-track {
    position: relative;
    display: block;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }
  .rc-bar-fill {
    display: block;
    max-width: 100%;
    overflow: hidden;
  }

  /* ---------- Read-only export values ---------- */
  .rc-info-value,
  .rc-stat-value,
  .rc-position-value {
    display: inline-block;
    line-height: 1.4;
    vertical-align: baseline;
  }

  /* ---------- Grade / position badge circles: force true centering ----------
     These render their number/letter inside a round shape. Centering that
     relies on line-height math (rather than flex) is a common source of the
     glyph drifting toward the top edge and getting clipped once the DOM is
     rasterized for PDF export, since canvas exporters don't always resolve
     line-height the same way the browser does. Flex + line-height: 1 pins the
     glyph to true visual center regardless of renderer. */
  .rc-badge {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    line-height: 1 !important;
    vertical-align: middle !important;
    padding: 0 !important;
  }
  .rc-badge > * {
    line-height: 1 !important;
  }

  /* ---------- Defensive net: strip any remaining input chrome ---------- */
  .rc-card.rc-exporting input,
  .rc-card.rc-exporting textarea,
  .rc-card.rc-exporting select {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    -webkit-text-fill-color: currentColor !important;
    padding: 0 !important;
    resize: none;
  }
  .rc-card.rc-exporting input.rc-stat-input {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  .rc-card.rc-exporting input.rc-stat-input.rc-field-accent {
    color: #4ade80 !important;
    -webkit-text-fill-color: #4ade80 !important;
  }

  @media print {
    .no-print,
    .no-print-root .no-print {
      display: none !important;
    }
    body.printing-report {
      background: #ffffff !important;
    }
    .rc-page-shell {
      display: block !important;
    }
    .rc-card {
      max-width: 100% !important;
      width: 100% !important;
      box-shadow: none !important;
      margin: 0 !important;
    }
    .rc-card input,
    .rc-card textarea,
    .rc-card select {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      -webkit-appearance: none !important;
      appearance: none !important;
      -webkit-text-fill-color: currentColor !important;
      padding: 0 !important;
    }
    .rc-card input.rc-stat-input {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .rc-table,
    .rc-table th,
    .rc-table td {
      border-color: currentColor;
    }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    .rc-sec-title { page-break-after: avoid; }
    .rc-sig-box, .rc-head-grid, .rc-remark-box { page-break-inside: avoid; }
    @page {
      size: A4;
      margin: 12mm;
    }
  }

  /* ---------- Stat card inputs: white/green text on dark background ---------- */
  .rc-stat-input {
    background: transparent !important;
    background-color: transparent !important;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .rc-stat-input.rc-field-accent {
    color: #4ade80 !important;
    -webkit-text-fill-color: #4ade80 !important;
  }
  .rc-stat-input::placeholder {
    color: rgba(255, 255, 255, 0.55) !important;
    opacity: 1;
  }

  /* ---------- Accent fields (Class Position / Conduct / Attitude / signature dates) ---------- */
  .rc-field-accent {
    color: #15803d;
  }
`;

export function ShepherdReportCard({
  data,
  academicYear = "2024 / 2025 Academic Year",
  editable = false,
  onChange,
  onSave,
  saving = false,
  showToolbar = true,
  toolbarTitle = "Report Card",
  status = "draft",
  lastSaved,
  adminComment,
  rejectionReason,
  teacherSignatureUrl,
  headSignatureUrl,
  allowHeadSignEdit = false,
  schoolId,
  autosavePending = false,
}: Props) {
  const exportEnabled = canExportPdf(status);
  const [animated, setAnimated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { data: school } = useSchool(schoolId);
  const { data: schoolSettings } = useSchoolSettings(schoolId);
  const reportCss = useMemo(() => buildReportCardCss(), []);
  const gradingFormat = useGradingFormat();
  const footerNote = (schoolSettings as { report_card_footer?: string | null } | null | undefined)
    ?.report_card_footer?.trim();
  const gradeScale = getGradeScale(gradingFormat);
  const logoSrc = resolveReportAssetUrl(school?.logo_url);
  const stampSrc = resolveReportAssetUrl(school?.stamp_url);
  const teacherSigSrc = resolveReportAssetUrl(teacherSignatureUrl);
  const headSigSrc = resolveReportAssetUrl(headSignatureUrl);
  const schoolName = (school?.name ?? school?.school_name ?? "").trim();
  const schoolMotto = school?.motto?.trim() ?? "";
  const schoolAddress = school?.address?.trim() ?? "";
  const schoolEmail = school?.email?.trim() ?? "";
  const schoolContacts = school?.phone?.trim() ?? "";
  const principalName = school?.principal_name?.trim() || "Headmaster";
  const contactLine = [
    schoolEmail ? `EMAIL: ${schoolEmail}` : "",
    schoolContacts ? `CONTACTS: ${schoolContacts}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const displayToolbarTitle =
    toolbarTitle === "Report Card" && schoolName
      ? `${schoolName} — Report Card`
      : toolbarTitle;

  // While a PDF/print snapshot is being taken, every field renders as plain
  // read-only text instead of a live <input>/<textarea>.
  const isReadOnlyView = !editable || exporting;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Reset the "failed to load" flag whenever the school (and therefore the
  // logo URL) changes, so switching schools doesn't keep a stale broken state.
  useEffect(() => {
    setLogoLoadFailed(false);
  }, [logoSrc]);

  const update = (patch: Partial<ReportFormData>) => {
    if (!onChange) return;
    onChange({ ...data, ...patch });
  };

  const updateSubject = (index: number, patch: Partial<SubjectRow>) => {
    const subjects = [...data.subjects];
    subjects[index] = recalcSubject({ ...subjects[index], ...patch }, gradingFormat);
    onChange?.({ ...data, subjects });
  };

  const totalScore = totalFromSubjects(data.subjects);

  const attendanceStatDisplay = data.attendancePercent
    ? `${data.attendancePercent}%`
    : data.attendanceMade && data.attendanceTotal
      ? `${((Number(data.attendanceMade) / Number(data.attendanceTotal)) * 100).toFixed(1)}%`
      : data.attendanceMade || "—";

  const attendanceStatPlaceholder =
    data.attendanceMade && data.attendanceTotal
      ? `${((Number(data.attendanceMade) / Number(data.attendanceTotal)) * 100).toFixed(1)}`
      : data.attendanceMade || "";

  const handlePdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      // Wait a tick for the `.rc-exporting` / isReadOnlyView re-render to
      // flush (inputs swapped for spans) before snapshotting.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await waitForReportAssets(printRef.current);
      await exportElementToPdf(
        printRef.current,
        `Report_${data.studentName.replace(/\s+/g, "_")}.pdf`,
      );
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error(err instanceof Error ? err.message : "PDF download failed. Try Print → Save as PDF.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
      await waitForReportAssets(printRef.current);
      document.body.classList.add("printing-report");
      window.addEventListener(
        "afterprint",
        () => {
          document.body.classList.remove("printing-report");
          setExporting(false);
        },
        { once: true },
      );
      window.print();
    } catch {
      document.body.classList.remove("printing-report");
      setExporting(false);
    }
  };

  const inp = (value: string, onVal: (v: string) => void, opts?: { wide?: boolean; mono?: boolean; accent?: boolean }) =>
    !isReadOnlyView ? (
      <input
        className={cn("rc-inline-input", opts?.wide && "rc-inline-input-wide", opts?.accent !== false && "rc-field-accent")}
        style={opts?.wide ? { width: "100%" } : undefined}
        value={value}
        onChange={(e) => onVal(e.target.value)}
      />
    ) : (
      <span className={cn(opts?.mono ? "rc-info-value big" : "rc-info-value", opts?.accent && "rc-field-accent")}>
        {value || "—"}
      </span>
    );

  return (
    <>
      <style data-report-export>{reportCss}</style>
      <style data-report-export-print-fix>{REPORT_PRINT_FIX_CSS}</style>
      <div className="rc-page-shell no-print-root" data-report-card-root data-report-in-portal>
      <div className="rc-page">
        {showToolbar && (
          <div className="rc-toolbar no-print">
            <div>
              <span className="rc-toolbar-title">{displayToolbarTitle}</span>
              <div className="rc-status-row">
                <span className="rc-status-pill">{statusLabel(status)}</span>
                {autosavePending && (
                  <span className="rc-status-saving">Saving…</span>
                )}
                {!autosavePending && lastSaved && (
                  <span className="rc-status-saved">Saved {lastSaved.toLocaleTimeString()}</span>
                )}
              </div>
            </div>
            <div className="rc-btns">
              {editable && onSave && (
                <button className="rc-btn rc-btn-save" onClick={onSave} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save progress"}
                </button>
              )}
              {exportEnabled ? (
                <>
                  <button className="rc-btn rc-btn-pdf" onClick={handlePdf} disabled={exporting}>
                    {exporting ? "Preparing…" : "⬇ Download PDF"}
                  </button>
                  <button className="rc-btn rc-btn-print" onClick={handlePrint} disabled={exporting}>
                    🖨 Print
                  </button>
                </>
              ) : (
                <span className="rc-export-hint">Submit for review to enable PDF &amp; print</span>
              )}
            </div>
          </div>
        )}

        {(adminComment || rejectionReason) && (
          <div className="rc-admin-feedback no-print">
            {rejectionReason && <p><strong>Returned:</strong> {rejectionReason}</p>}
            {adminComment && <p><strong>Admin feedback:</strong> {adminComment}</p>}
          </div>
        )}

        <div className={cn("rc-card", exporting && "rc-exporting")} ref={printRef}>
          <div className="rc-header">
            <div className="rc-header-inner">
              <div
                className="rc-logo"
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 8,
                  background: logoSrc && !logoLoadFailed ? "#ffffff" : "transparent",
                }}
              >
                {logoSrc && !logoLoadFailed ? (
                  <img
                    src={logoSrc}
                    alt={schoolName ? `${schoolName} logo` : "School logo"}
                    crossOrigin="anonymous"
                    loading="eager"
                    decoding="async"
                    onError={() => setLogoLoadFailed(true)}
                  />
                ) : null}
              </div>
              <div className="rc-school-info">
                {schoolName ? <div className="rc-school-name">{schoolName}</div> : null}
                {schoolMotto ? <div className="rc-school-motto">{schoolMotto}</div> : null}
                {contactLine ? <div className="rc-school-contact">{contactLine}</div> : null}
                {schoolAddress ? <div className="rc-school-addr">LOCATION: {schoolAddress}</div> : null}
              </div>
              <div className="rc-header-right">
                <div className="rc-header-label">Academic Year</div>
                <div className="rc-header-value">{academicYear}</div>
                <br />
                <div className="rc-header-label">Report Type</div>
                <div className="rc-header-value" style={{ fontSize: 12 }}>End-of-Term Examination</div>
              </div>
            </div>
          </div>
          <div className="rc-gold-stripe" />
          {(data.term || academicYear) && (
            <div className="rc-term-period" aria-label="Academic period">
              <span className="rc-term-period-label">Academic period</span>
              <span className="rc-term-period-value">
                {[data.term, academicYear].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          <div className="rc-body">
            <div className="rc-info-grid">
              <div className="rc-info-field rc-info-full">
                <span className="rc-info-label">Name of Learner</span>
                {inp(data.studentName, (v) => update({ studentName: v }), { wide: true, mono: true })}
              </div>
              <div className="rc-info-field">
                <span className="rc-info-label">Class</span>
                {inp(data.className, (v) => update({ className: v }))}
              </div>
              <div className="rc-info-field">
                <span className="rc-info-label">Term</span>
                {inp(data.term, (v) => update({ term: v }))}
              </div>
              <div className="rc-info-field">
                <span className="rc-info-label">No. on Roll</span>
                {!isReadOnlyView ? (
                  <input className="rc-inline-input" type="number" value={data.rollNo} onChange={(e) => update({ rollNo: e.target.value })} />
                ) : (
                  <span className="rc-info-value">{data.rollNo || "—"}</span>
                )}
              </div>
              <div className="rc-info-field">
                <span className="rc-info-label">Total Students in Class</span>
                {!isReadOnlyView ? (
                  <div className="space-y-1">
                    <input
                      className="rc-inline-input"
                      type="number"
                      min={0}
                      value={data.totalStudentsInClassManual}
                      placeholder={
                        data.totalStudentsInClassAuto != null && data.totalStudentsInClassAuto > 0
                          ? String(data.totalStudentsInClassAuto)
                          : "Auto"
                      }
                      onChange={(e) => update({ totalStudentsInClassManual: e.target.value })}
                    />
                    <span className="rc-hint">
                      {data.totalStudentsInClassManual.trim()
                        ? "Manual override"
                        : data.totalStudentsInClassAuto != null && data.totalStudentsInClassAuto > 0
                          ? `Auto: ${data.totalStudentsInClassAuto} report${data.totalStudentsInClassAuto === 1 ? "" : "s"} for this class & term`
                          : "Auto when reports exist for this class & term"}
                    </span>
                  </div>
                ) : (
                  <span className="rc-info-value">{displayTotalStudentsInClass(data) || "—"}</span>
                )}
              </div>
            </div>

            <div className="rc-stats">
              {[
                { v: data.position, l: "Class Position", key: "position" as const },
                { v: totalScore.toFixed(1), l: "Total Score", key: null },
                {
                  v: attendanceStatDisplay,
                  l: "Attendance",
                  key: "attendancePercent" as const,
                  editValue: data.attendancePercent,
                  placeholder: attendanceStatPlaceholder,
                },
                { v: data.conduct, l: "Conduct", key: "conduct" as const },
              ].map((s) => (
                <div className="rc-stat" key={s.l}>
                  {!isReadOnlyView && s.key ? (
                    <input
                      className={cn(
                        "rc-stat-input",
                        (s.key === "position" || s.key === "conduct") && "rc-field-accent",
                      )}
                      value={"editValue" in s ? String(s.editValue ?? "") : String(s.v)}
                      placeholder={"placeholder" in s ? s.placeholder : undefined}
                      onChange={(e) => {
                        const val =
                          s.key === "attendancePercent"
                            ? e.target.value.replace(/%/g, "").trim()
                            : e.target.value;
                        update({ [s.key!]: val });
                      }}
                    />
                  ) : (
                    <span
                      className={cn(
                        "rc-stat-value",
                        (s.key === "position" || s.key === "conduct") && "rc-field-accent",
                      )}
                    >
                      {s.v || "—"}
                    </span>
                  )}
                  <span className="rc-stat-label">{s.l}</span>
                </div>
              ))}
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Academic Performance</div>
            <table className="rc-table">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Class Score (50%)</th>
                  <th>Exam Score (50%)</th>
                  <th>Total (100%)</th>
                  <th>Position</th>
                  <th>Grade</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((s, i) => {
                  const pct = Math.min((s.total / 100) * 100, 100);
                  return (
                    <tr key={`${s.name}-${i}`}>
                      <td><span className="rc-subj">{s.name}</span></td>
                      <td>
                        {!isReadOnlyView ? (
                          <input type="number" min={0} max={50} step={0.5} className="rc-cell-input"
                            value={s.classScore || ""} onChange={(e) => updateSubject(i, { classScore: Number(e.target.value) })} />
                        ) : fmtScore(s.classScore)}
                      </td>
                      <td>
                        {!isReadOnlyView ? (
                          <input type="number" min={0} max={50} step={0.5} className="rc-cell-input"
                            value={s.examScore || ""} onChange={(e) => updateSubject(i, { examScore: Number(e.target.value) })} />
                        ) : fmtScore(s.examScore)}
                      </td>
                      <td>
                        <div className="rc-score-cell">
                          <span className="rc-score-num">{fmtScore(s.total)}</span>
                          {s.total > 0 && (
                            <div className="rc-bar-track">
                              <div
                                className="rc-bar-fill"
                                style={{
                                  width: animated || exporting ? `${pct}%` : "0%",
                                  transition: exporting ? "none" : `width 1s ease ${i * 0.08}s`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {!isReadOnlyView ? (
                          <input
                            className="rc-cell-input rc-cell-sm rc-field-accent"
                            value={s.position}
                            onChange={(e) => updateSubject(i, { position: e.target.value })}
                          />
                        ) : (
                          <span className="rc-position-value">{s.position}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {!isReadOnlyView ? (
                          <input className="rc-cell-input rc-cell-sm" value={s.grade}
                            onChange={(e) => updateSubject(i, { grade: e.target.value })} />
                        ) : (
                          <span className="rc-badge">{s.grade}</span>
                        )}
                      </td>
                      <td className="rc-remark-cell">
                        {!isReadOnlyView ? (
                          <input className="rc-cell-input" style={{ width: "100%" }} value={s.remark}
                            onChange={(e) => updateSubject(i, { remark: e.target.value })} />
                        ) : s.remark}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Grading Scale</div>
            <div className="rc-scale-grid">
              {gradeScale.map((g) => (
                <div key={g.grade} className="rc-scale-cell">
                  <div className="rc-scale-range">{g.range}</div>
                  <div className="rc-scale-grade">{g.grade}</div>
                  <div className="rc-scale-remark">{g.remark}</div>
                </div>
              ))}
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Attendance Summary</div>
            <div className="rc-att-summary-grid">
              {[
                { label: "Total School Days", key: "attendanceTotal" as const, value: data.attendanceTotal || "—" },
                { label: "Present", key: "attendanceMade" as const, value: data.attendanceMade || "—" },
                { label: "Absent", key: "attendanceAbsent" as const, value: data.attendanceAbsent || "—" },
                { label: "Late", key: "attendanceLate" as const, value: data.attendanceLate || "—" },
                { label: "Excused", key: "attendanceExcused" as const, value: data.attendanceExcused || "—" },
                {
                  label: "Attendance Percentage",
                  value: data.attendancePercent ? `${data.attendancePercent}%` : "—",
                },
              ].map((item) => (
                <div key={item.label} className="rc-att-summary-row">
                  <span className="rc-att-summary-label">{item.label}:</span>
                  {"key" in item && item.key ? (
                    <span className="rc-att-summary-value">
                      {inp(data[item.key] ?? "", (v) => update({ [item.key]: v }), { accent: false })}
                    </span>
                  ) : (
                    <span className="rc-att-summary-value">{item.value}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Attendance & Affective Domain</div>
            <div className="rc-att-grid-2">
              {[
                { label: "Attendance Made", key: "attendanceMade" as const },
                { label: "Total Attendance", key: "attendanceTotal" as const },
                { label: "Absent", key: "attendanceAbsent" as const },
                { label: "Late", key: "attendanceLate" as const },
                { label: "Excused", key: "attendanceExcused" as const },
              ].map((a) => (
                <div key={a.label} className="rc-att-box">
                  <span className="rc-att-label">{a.label}:</span>
                  {inp(data[a.key], (v) => update({ [a.key]: v }), { accent: false })}
                </div>
              ))}
            </div>
            <div className="rc-att-grid-4">
              {([
                ["Conduct", "conduct"],
                ["Interest", "interest"],
                ["Club", "club"],
                ["Attitude", "attitude"],
              ] as const).map(([label, key]) => (
                <div key={key} className="rc-att-pill">
                  <span className="rc-att-label">{label}</span>
                  {inp(data[key], (v) => update({ [key]: v }))}
                </div>
              ))}
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Class Teacher&apos;s Remarks</div>
            <div className="rc-remark-box">
              <div className="rc-remark-stack">
                <div>
                  <span className="rc-info-label">Remarks</span>
                  {!isReadOnlyView ? (
                    <textarea className="rc-textarea" rows={4} value={data.teacherRemark}
                      onChange={(e) => update({ teacherRemark: e.target.value })} />
                  ) : (
                    <div className="rc-quote-block"><p>{data.teacherRemark || "—"}</p></div>
                  )}
                </div>
                <div className="rc-sig-box rc-sig-box-centered">
                  <span className="rc-info-label">Class Teacher Signature</span>
                  <div className="rc-sig-area">
                    {teacherSigSrc ? (
                      <img
                        src={teacherSigSrc}
                        alt="Class teacher signature"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        className="rc-sig-img"
                      />
                    ) : (
                      <div className="rc-sig-placeholder">___________</div>
                    )}
                  </div>
                  <div className="rc-sig-caption">
                    Class Teacher · Date:{" "}
                    {!isReadOnlyView ? (
                      <input className="rc-inline-input rc-date-inline" value={data.teacherSignDate}
                        onChange={(e) => update({ teacherSignDate: e.target.value })} placeholder="___________" />
                    ) : (data.teacherSignDate || "___________")}
                  </div>
                </div>
              </div>
            </div>

            <div className="rc-sec-title">
              <div className="rc-sec-title-dot" />
              {principalName} / Admin Signature
            </div>
            <div className="rc-head-grid">
              <div className="rc-head-stamp">
                {stampSrc ? (
                  <div className="rc-stamp-img">
                    <img src={stampSrc} alt="School stamp" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="rc-stamp">SCHOOL<br />STAMP</div>
                )}
              </div>
              <div className="rc-sig-box rc-sig-box-centered">
                <span className="rc-info-label">{principalName} Signature</span>
                <div className="rc-sig-area">
                  {headSigSrc ? (
                    <img
                      src={headSigSrc}
                      alt={`${principalName} signature`}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="rc-sig-img"
                    />
                  ) : (
                    <div className="rc-sig-placeholder">___________</div>
                  )}
                </div>
                <div className="rc-sig-caption">
                  {principalName} · Date:{" "}
                  {!isReadOnlyView && allowHeadSignEdit ? (
                    <input className="rc-inline-input rc-date-inline" value={data.headSignDate}
                      onChange={(e) => update({ headSignDate: e.target.value })} placeholder="___________" />
                  ) : (data.headSignDate || "___________")}
                </div>
              </div>
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Parent / Guardian Signature</div>
            <div className="rc-parent-sig">
              <div className="rc-sig-box rc-sig-box-centered">
                <span className="rc-info-label">Parent / Guardian</span>
                <div className="rc-sig-area"><div className="rc-sig-placeholder">___________</div></div>
                <div className="rc-sig-caption">
                  Signature · Date:{" "}
                  {!isReadOnlyView ? (
                    <input className="rc-inline-input rc-date-inline" value={data.parentSignDate}
                      onChange={(e) => update({ parentSignDate: e.target.value })} placeholder="___________" />
                  ) : (data.parentSignDate || "___________")}
                </div>
              </div>
            </div>

            <div className="rc-dates-grid">
              {([
                ["School Closes", "schoolCloses"],
                ["Reopening Date", "reopeningDate"],
                ["Next Term", "nextTerm"],
              ] as const).map(([label, key]) => (
                <div key={key} className="rc-date-cell">
                  <div className="rc-date-label">{label}</div>
                  {inp(data[key], (v) => update({ [key]: v }), { accent: false })}
                </div>
              ))}
            </div>
          </div>

          <div className="rc-footer">
            <div>
              <div className="rc-footer-text">
                {schoolName ? `${schoolName} — ` : ""}Official Academic Report Card
              </div>
              <div className="rc-footer-text">
                {footerNote || "Confidential — for the named learner and their guardian."}
              </div>
            </div>
            <div className="rc-footer-seal">
              <span>OFFICIAL</span>
              <span>RECORD</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}