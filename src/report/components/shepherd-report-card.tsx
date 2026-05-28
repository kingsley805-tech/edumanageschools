import { useEffect, useRef, useState } from "react";
import {
  BRAND_COLORS,
  recalcSubject,
  fmtScore,
  totalFromSubjects,
  displayTotalStudentsInClass,
  type ReportFormData,
  type SubjectRow,
} from "@/report/lib/shepherd-grading";
import { getGradeScale } from "@/report/lib/grading";
import { exportElementToPdf, waitForReportAssets } from "@/report/lib/report-pdf";
import { canExportPdf, statusLabel } from "@/report/lib/report-card-status";
import { useGradingFormat, useSchool } from "@/report/hooks/use-school-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveReportAssetUrl } from "@/report/lib/report-assets";

const DEFAULT_LOGO = "/shepherd-logo.png";

export const SHEPHERD_SCHOOL = {
  name: "SHEPHERD'S HEART SCHOOL",
  motto: '"Those Led By Love Will Never Lose Their Way"',
  email: "shepherdheart22@gmail.com",
  contacts: "0541235596 / 0570223940",
  address: "AMASAMAN (STADIUM ROAD), AGARTHA JUNCTION",
  logo: DEFAULT_LOGO,
};

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
};

export function ShepherdReportCard({
  data,
  academicYear = "2024 / 2025 Academic Year",
  editable = false,
  onChange,
  onSave,
  saving = false,
  showToolbar = true,
  toolbarTitle = "Shepherd's Heart School — Report Card",
  status = "draft",
  lastSaved,
  adminComment,
  rejectionReason,
  teacherSignatureUrl,
  headSignatureUrl,
  allowHeadSignEdit = false,
  schoolId,
}: Props) {
  const exportEnabled = canExportPdf(status);
  const [animated, setAnimated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { data: school } = useSchool(schoolId);
  const gradingFormat = useGradingFormat();
  const gradeScale = getGradeScale(gradingFormat);
  const logoSrc = resolveReportAssetUrl(school?.logo_url) || DEFAULT_LOGO;
  const stampSrc = resolveReportAssetUrl(school?.stamp_url);
  const teacherSigSrc = resolveReportAssetUrl(teacherSignatureUrl);
  const headSigSrc = resolveReportAssetUrl(headSignatureUrl);
  const schoolName = school?.name?.trim() || SHEPHERD_SCHOOL.name;
  const schoolMotto = school?.motto?.trim() || SHEPHERD_SCHOOL.motto;
  const schoolAddress = school?.address?.trim() || SHEPHERD_SCHOOL.address;
  const schoolEmail = school?.email?.trim() || SHEPHERD_SCHOOL.email;
  const schoolContacts = school?.phone?.trim() || SHEPHERD_SCHOOL.contacts;
  const principalName = school?.principal_name?.trim() || "Headmaster";
  const displayToolbarTitle =
    toolbarTitle === "Shepherd's Heart School — Report Card"
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
      <style data-report-export>{SHEPHERD_CSS}</style>
      <div className="rc-page no-print-root">
        {showToolbar && (
          <div className="rc-toolbar no-print">
            <div>
              <span className="rc-toolbar-title">{displayToolbarTitle}</span>
              <div className="rc-status-row">
                <span className="rc-status-pill">{statusLabel(status)}</span>
                {lastSaved && (
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
                <img
                  src={logoSrc}
                  alt="School logo"
                  crossOrigin="anonymous"
                  onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LOGO; }}
                />
              </div>
              <div className="rc-school-info">
                <div className="rc-school-name">{schoolName}</div>
                <div className="rc-school-motto">{schoolMotto}</div>
                <div className="rc-school-contact">EMAIL: {schoolEmail} &nbsp;·&nbsp; CONTACTS: {schoolContacts}</div>
                <div className="rc-school-addr">LOCATION: {schoolAddress}</div>
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
                          <span style={{ fontWeight: 700, color: BRAND_COLORS.black }}>{s.position}</span>
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
                      <td style={{ fontSize: 12, fontStyle: "italic", color: BRAND_COLORS.black }}>
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
              <div className="rc-footer-text">{schoolName} — Official Academic Report Card</div>
              <div className="rc-footer-text">Confidential — for the named learner and their guardian.</div>
            </div>
            <div className="rc-footer-seal">OFFICIAL<br />RECORD</div>
          </div>
        </div>
      </div>
    </>
  );
}

const SHEPHERD_CSS = `
.rc-page{background:${BRAND_COLORS.white};min-height:100vh;padding:24px 16px 48px;display:flex;flex-direction:column;align-items:center;gap:16px;font-family:'Manrope',sans-serif;color:${BRAND_COLORS.black};color-scheme:light;forced-color-adjust:none}
.rc-toolbar{width:100%;max-width:860px;background:${BRAND_COLORS.greenDark};border-radius:10px;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border:1px solid ${BRAND_COLORS.greenDark}}
.rc-toolbar-title{color:${BRAND_COLORS.white};font-family:'Manrope',sans-serif;font-size:14px;display:block;font-weight:700}
.rc-status-row{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}
.rc-status-pill{background:${BRAND_COLORS.white};color:${BRAND_COLORS.greenDark};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px}
.rc-status-saved{color:${BRAND_COLORS.white};font-size:11px;opacity:.85}
.rc-export-hint{color:${BRAND_COLORS.white};font-size:12px;padding:8px 12px;opacity:.9}
.rc-admin-feedback{width:100%;max-width:860px;background:${BRAND_COLORS.white};border:1px solid ${BRAND_COLORS.green};border-radius:8px;padding:12px 16px;font-size:13px;color:${BRAND_COLORS.black}}
.rc-admin-feedback p{margin:4px 0;color:${BRAND_COLORS.black}}
.rc-date-inline{display:inline;width:120px;margin-left:4px}
.rc-parent-sig{border:1px solid ${BRAND_COLORS.green};border-radius:10px;padding:18px;background:${BRAND_COLORS.white};margin-bottom:22px}
@media(max-width:640px){
  .rc-header-inner{flex-direction:column;text-align:center}
  .rc-header-right{text-align:center}
  .rc-info-grid{grid-template-columns:1fr}
  .rc-stats{grid-template-columns:repeat(2,1fr)}
  .rc-scale-grid{grid-template-columns:repeat(3,1fr)}
  .rc-head-grid{grid-template-columns:1fr}
  .rc-dates-grid{grid-template-columns:1fr}
  .rc-table{font-size:11px}
  .rc-body{padding:16px}
}
.rc-btns{display:flex;gap:10px;flex-wrap:wrap}
.rc-btn{padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-weight:700;font-size:13px}
.rc-btn-print{background:${BRAND_COLORS.white};color:${BRAND_COLORS.greenDark};border:1.5px solid ${BRAND_COLORS.white}}
.rc-btn-pdf{background:transparent;color:${BRAND_COLORS.white};border:1.5px solid ${BRAND_COLORS.white}}
.rc-btn-save{background:${BRAND_COLORS.white};color:${BRAND_COLORS.greenDark}}
.rc-card{width:100%;max-width:860px;background:${BRAND_COLORS.white};border-radius:14px;overflow:hidden;box-shadow:0 6px 40px ${BRAND_COLORS.shadow};border:1px solid ${BRAND_COLORS.green}}
.rc-header{background:${BRAND_COLORS.greenDark};padding:28px 40px 20px}
.rc-header-inner{display:flex;align-items:center;gap:20px}
.rc-logo{width:90px;height:90px;border-radius:50%;background:#fff;padding:4px;box-shadow:0 0 0 3px #ffffff55;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rc-logo img{width:80px;height:80px;object-fit:contain}
.rc-school-name{font-family:'Manrope',sans-serif;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:1px;text-transform:uppercase}
.rc-school-motto{color:#ffffff;font-size:11px;font-style:italic;margin-top:4px;opacity:.9}
.rc-school-contact{color:#ffffff;font-size:11px;margin-top:6px;opacity:.95;font-weight:600}
.rc-school-addr{color:#ffffff;font-size:12px;margin-top:3px;opacity:.9}
.rc-header-right{text-align:right}
.rc-header-label{color:#ffffff;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.8}
.rc-header-value{color:#ffffff;font-family:'Manrope',sans-serif;font-size:15px;font-weight:700}
.rc-gold-stripe{height:4px;background:${BRAND_COLORS.green}}
.rc-term-period{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:10px 24px;background:${BRAND_COLORS.green};color:#fff;font-size:13px}
.rc-term-period-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.85;font-weight:700}
.rc-term-period-value{font-family:'Manrope',sans-serif;font-weight:800;font-size:14px}
.rc-body{padding:28px 36px;color:${BRAND_COLORS.black}}
.rc-info-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;background:${BRAND_COLORS.white};border:1px solid ${BRAND_COLORS.green};border-radius:10px;padding:18px;margin-bottom:24px}
.rc-info-full{grid-column:1/-1}
.rc-info-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND_COLORS.green};font-weight:700;display:block;margin-bottom:4px}
.rc-info-value{font-size:14px;font-weight:600;color:${BRAND_COLORS.black}}
.rc-info-value.big{font-family:'Manrope',sans-serif;font-size:18px;color:${BRAND_COLORS.black}}
.rc-inline-input{border:1px solid ${BRAND_COLORS.green};border-radius:4px;padding:4px 8px;font-size:14px;width:100%;background:#fff;color:${BRAND_COLORS.black}}
.rc-cell-input{width:64px;padding:4px;border:1px solid ${BRAND_COLORS.green};border-radius:4px;text-align:center;color:${BRAND_COLORS.black};background:#fff}
.rc-cell-sm{width:48px}
.rc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.rc-stat{background:${BRAND_COLORS.greenDark};border-radius:10px;padding:14px;text-align:center;border:1px solid ${BRAND_COLORS.greenDark}}
.rc-stat-value{font-family:'Manrope',sans-serif;font-size:22px;font-weight:700;color:#ffffff;display:block}
.rc-stat-input{width:100%;background:transparent;border:none;color:#ffffff;font-family:'Manrope',sans-serif;font-size:20px;font-weight:700;text-align:center}
.rc-stat-label{font-size:10px;text-transform:uppercase;color:#ffffff;margin-top:6px;display:block;opacity:.85}
.rc-sec-title{font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;color:${BRAND_COLORS.green};margin-bottom:14px;display:flex;align-items:center;gap:10px}
.rc-sec-title::after{content:'';flex:1;height:1px;background:${BRAND_COLORS.green};opacity:.35}
.rc-sec-title-dot{width:8px;height:8px;border-radius:50%;background:${BRAND_COLORS.green}}
.rc-table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;color:${BRAND_COLORS.black}}
.rc-table thead th{background:${BRAND_COLORS.greenDark};color:${BRAND_COLORS.white};font-size:10px;padding:9px 10px;text-align:left;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.rc-table tbody td{padding:8px 10px;border-bottom:1px solid ${BRAND_COLORS.border};vertical-align:middle;color:${BRAND_COLORS.black}}
.rc-subj{font-weight:700;color:${BRAND_COLORS.black};font-size:12px}
.rc-score-cell{display:flex;align-items:center;gap:8px}
.rc-score-num{font-family:'Manrope',sans-serif;font-weight:700;min-width:36px;color:${BRAND_COLORS.black}}
.rc-bar-track{flex:1;height:6px;background:#e8ecea;border-radius:3px;overflow:hidden;min-width:50px}
.rc-bar-fill{height:100%;border-radius:3px;background:${BRAND_COLORS.green} !important}
.rc-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-weight:700;font-size:12px;background:${BRAND_COLORS.greenDark} !important;color:${BRAND_COLORS.white} !important}
.rc-scale-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:24px}
.rc-scale-cell{border-radius:6px;padding:6px 4px;text-align:center;font-size:9px;background:${BRAND_COLORS.white} !important;color:${BRAND_COLORS.black};border:1px solid ${BRAND_COLORS.green}}
.rc-scale-range{color:${BRAND_COLORS.black}}
.rc-scale-grade{font-weight:700;font-size:13px;color:${BRAND_COLORS.green} !important}
.rc-scale-remark{color:${BRAND_COLORS.black}}
.rc-att-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}
.rc-att-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.rc-att-box,.rc-att-pill{border:1px solid ${BRAND_COLORS.green};border-radius:8px;padding:12px;background:${BRAND_COLORS.white};display:flex;align-items:center;gap:8px;color:${BRAND_COLORS.black}}
.rc-att-pill{flex-direction:column;align-items:center}
.rc-att-label{font-size:10px;color:${BRAND_COLORS.green};font-weight:700;text-transform:uppercase}
.rc-remark-box{border:1px solid ${BRAND_COLORS.green};border-radius:10px;padding:18px;background:${BRAND_COLORS.white};margin-bottom:22px;color:${BRAND_COLORS.black}}
.rc-remark-stack{display:flex;flex-direction:column;gap:20px}
.rc-quote-block{background:${BRAND_COLORS.mutedBg};border-left:4px solid ${BRAND_COLORS.green};padding:12px 16px;font-style:italic;margin-top:8px;color:${BRAND_COLORS.black}}
.rc-textarea{width:100%;border:1px solid ${BRAND_COLORS.green};border-radius:8px;padding:10px;font-family:inherit;margin-top:8px;resize:vertical;color:${BRAND_COLORS.black};background:#fff}
.rc-sig-box{text-align:center}
.rc-sig-box-centered{width:100%;max-width:320px;margin-left:auto;margin-right:auto}
.rc-sig-area{width:100%;height:70px;border:1px dashed ${BRAND_COLORS.green};border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;padding:8px 12px;margin-top:8px;overflow:hidden;box-sizing:border-box}
.rc-sig-img{max-height:54px;max-width:100%;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;flex-shrink:0}
.rc-sig-line-inner{width:80%;height:1px;background:${BRAND_COLORS.green}}
.rc-sig-placeholder{width:100%;text-align:center;font-size:14px;font-weight:700;color:${BRAND_COLORS.green};letter-spacing:1px}
.rc-sig-caption{font-size:11px;color:${BRAND_COLORS.green};margin-top:6px;text-align:center}
.rc-head-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;border:1px solid ${BRAND_COLORS.green};border-radius:10px;padding:18px;background:${BRAND_COLORS.white};margin-bottom:22px;align-items:center}
.rc-head-stamp{display:flex;align-items:center;justify-content:center}
.rc-head-grid .rc-sig-box-centered{justify-self:center}
.rc-stamp{width:80px;height:80px;border-radius:50%;border:2px dashed ${BRAND_COLORS.green};display:flex;align-items:center;justify-content:center;font-size:10px;color:${BRAND_COLORS.green};text-align:center;line-height:1.4;font-weight:700}
.rc-stamp-img{width:110px;height:110px;display:flex;align-items:center;justify-content:center}
.rc-stamp-img img{max-width:100%;max-height:100%;object-fit:contain}
.rc-dates-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.rc-date-cell{border:1px solid ${BRAND_COLORS.green};border-radius:8px;padding:10px;background:${BRAND_COLORS.white};color:${BRAND_COLORS.black}}
.rc-date-label{font-size:9px;text-transform:uppercase;color:${BRAND_COLORS.green};margin-bottom:4px;font-weight:700;letter-spacing:.5px}
.rc-footer{background:${BRAND_COLORS.greenDark};padding:14px 36px;display:flex;justify-content:space-between;align-items:center}
.rc-footer-text{color:#ffffff;font-size:11px;opacity:.9}
.rc-footer-seal{width:52px;height:52px;border-radius:50%;border:1.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:8px;color:#ffffff;text-align:center;font-family:'Manrope',sans-serif;font-weight:700}
.rc-exporting,.rc-exporting *{animation:none!important;transition:none!important}
.rc-exporting .rc-bar-fill{transition:none!important}
@media print{
  .no-print,.no-print-root .rc-toolbar,.no-print-root .rc-admin-feedback{display:none!important}
  .rc-page{position:absolute;left:0;top:0;padding:0;margin:0;background:#fff;min-height:0;height:auto;width:100%}
  .rc-card,.rc-exporting{box-shadow:none;border-radius:0;max-width:100%;width:100%;border:1px solid ${BRAND_COLORS.green};overflow:visible;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rc-card *,.rc-exporting *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rc-body{padding:20px 24px}
}
`;
