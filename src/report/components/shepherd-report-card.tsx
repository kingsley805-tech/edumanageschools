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
import { useReportTheme } from "@/report/hooks/use-report-theme";
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
  const printRef = useRef<HTMLDivElement>(null);
  const { data: school } = useSchool(schoolId);
  const { data: schoolSettings } = useSchoolSettings(schoolId);
  const { brand } = useReportTheme(schoolId);
  const reportCss = useMemo(() => buildReportCardCss(brand), [brand]);
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

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

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

  const handlePdf = async () => {
    if (!printRef.current) return;
    setExporting(true);
    try {
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

  const inp = (value: string, onVal: (v: string) => void, opts?: { wide?: boolean; mono?: boolean }) =>
    editable ? (
      <input
        className="rc-inline-input"
        style={opts?.wide ? { width: "100%" } : undefined}
        value={value}
        onChange={(e) => onVal(e.target.value)}
      />
    ) : (
      <span className={opts?.mono ? "rc-info-value big" : "rc-info-value"}>{value || "—"}</span>
    );

  return (
    <>
      <style data-report-export>{reportCss}</style>
      <div className="rc-page-shell no-print-root">
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
              <div className="rc-logo">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={schoolName ? `${schoolName} logo` : "School logo"}
                    crossOrigin="anonymous"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
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
                {editable ? (
                  <input className="rc-inline-input" type="number" value={data.rollNo} onChange={(e) => update({ rollNo: e.target.value })} />
                ) : (
                  <span className="rc-info-value">{data.rollNo}</span>
                )}
              </div>
              <div className="rc-info-field">
                <span className="rc-info-label">Total Students in Class</span>
                {editable ? (
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
                    <span className="block text-[10px] leading-tight text-muted-foreground">
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
                { v: data.attendanceMade, l: "Attendance", key: "attendanceMade" as const },
                { v: data.conduct, l: "Conduct", key: "conduct" as const },
              ].map((s) => (
                <div className="rc-stat" key={s.l}>
                  {editable && s.key ? (
                    <input className="rc-stat-input" value={String(s.v)} onChange={(e) => update({ [s.key!]: e.target.value })} />
                  ) : (
                    <span className="rc-stat-value">{s.v || "—"}</span>
                  )}
                  <span className="rc-stat-label">{s.l}</span>
                </div>
              ))}
            </div>

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Academic Performance</div>
            <table className="rc-table">
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
                    <tr key={`${s.name}-${i}`} style={{ animationDelay: `${i * 0.05}s` }}>
                      <td><span className="rc-subj">{s.name}</span></td>
                      <td>
                        {editable ? (
                          <input type="number" min={0} max={50} step={0.5} className="rc-cell-input"
                            value={s.classScore || ""} onChange={(e) => updateSubject(i, { classScore: Number(e.target.value) })} />
                        ) : fmtScore(s.classScore)}
                      </td>
                      <td>
                        {editable ? (
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
                        {editable ? (
                          <input className="rc-cell-input rc-cell-sm" value={s.position}
                            onChange={(e) => updateSubject(i, { position: e.target.value })} />
                        ) : (
                          <span style={{ fontWeight: 700, color: brand.black }}>{s.position}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {editable ? (
                          <input className="rc-cell-input rc-cell-sm" value={s.grade}
                            onChange={(e) => updateSubject(i, { grade: e.target.value })} />
                        ) : (
                          <span className="rc-badge">{s.grade}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, fontStyle: "italic", color: brand.black }}>
                        {editable ? (
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

            <div className="rc-sec-title"><div className="rc-sec-title-dot" />Attendance & Affective Domain</div>
            <div className="rc-att-grid-2">
              {[
                { label: "Attendance Made", key: "attendanceMade" as const },
                { label: "Total Attendance", key: "attendanceTotal" as const },
              ].map((a) => (
                <div key={a.label} className="rc-att-box">
                  <span className="rc-att-label">{a.label}:</span>
                  {inp(data[a.key], (v) => update({ [a.key]: v }))}
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
                  {editable ? (
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
                    {editable ? (
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
                  {editable && allowHeadSignEdit ? (
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
                  {editable ? (
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
                  {inp(data[key], (v) => update({ [key]: v }))}
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
            <div className="rc-footer-seal">OFFICIAL<br />RECORD</div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

