import { normalizeHex } from "@/lib/themeColors";

/** Default report card theme — professional black */
export const DEFAULT_REPORT_THEME = "#000000";

export const REPORT_THEME_PRESETS: { label: string; hex: string }[] = [
  { label: "Black", hex: "#000000" },
  { label: "Blue", hex: "#1e40af" },
  { label: "Red", hex: "#dc2626" },
  { label: "Green", hex: "#16a34a" },
  { label: "Navy", hex: "#1e3a5f" },
  { label: "Purple", hex: "#6d28d9" },
];

export type ReportBrandColors = {
  /** User-selected primary (headers, accents, borders) */
  primary: string;
  /** Darker shade for header/footer/table head */
  primaryDark: string;
  /** Lighter accent for stripes */
  primaryLight: string;
  white: string;
  black: string;
  mutedBg: string;
  border: string;
  shadow: string;
};

export function isValidHexColor(value: string): boolean {
  const h = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h.startsWith("#") ? h : `#${h}`);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex).replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (c: number) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Darken or lighten a hex color by percent (-100..100) */
export function adjustHex(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = percent / 100;
  if (factor >= 0) {
    return rgbToHex(
      r + (255 - r) * factor,
      g + (255 - g) * factor,
      b + (255 - b) * factor,
    );
  }
  const f = 1 + factor;
  return rgbToHex(r * f, g * f, b * f);
}

export function reportThemeFromSettings(
  raw: string | null | undefined,
): string {
  if (raw && isValidHexColor(raw)) return normalizeHex(raw);
  return DEFAULT_REPORT_THEME;
}

/**
 * Pick report card primary color: school brand (School Settings) with optional
 * per-school override from Report Settings (`report_theme_primary`).
 */
export function resolveReportThemePrimary(
  settingsPrimary: string | null | undefined,
  schoolThemePrimary: string | null | undefined,
): string {
  const school = schoolThemePrimary && isValidHexColor(schoolThemePrimary)
    ? normalizeHex(schoolThemePrimary)
    : null;
  const settings = settingsPrimary && isValidHexColor(settingsPrimary)
    ? normalizeHex(settingsPrimary)
    : null;

  if (!school && !settings) return DEFAULT_REPORT_THEME;
  if (!school) return settings!;
  if (!settings) return school;

  // Legacy rows: report_theme defaulted to black while school brand is customized
  if (settings === DEFAULT_REPORT_THEME && school !== DEFAULT_REPORT_THEME) {
    return school;
  }
  // Report Settings override when it differs from portal brand primary
  if (settings !== school) return settings;
  return school;
}

/** Build full report card palette from a single primary hex */
export function buildReportBrandColors(primaryHex: string): ReportBrandColors {
  const primary = isValidHexColor(primaryHex)
    ? normalizeHex(primaryHex)
    : DEFAULT_REPORT_THEME;
  return {
    primary,
    primaryDark: adjustHex(primary, -22),
    primaryLight: adjustHex(primary, 12),
    white: "#ffffff",
    black: "#171717",
    mutedBg: "#f5f5f5",
    border: "rgba(0, 0, 0, 0.18)",
    shadow: "rgba(0, 0, 0, 0.12)",
  };
}

/** @deprecated Use buildReportBrandColors — kept for imports */
export const BRAND_COLORS = buildReportBrandColors(DEFAULT_REPORT_THEME);

export function gradeStyleFromBrand(brand: ReportBrandColors, _g?: string) {
  return { bg: brand.primaryDark, text: brand.white, bar: brand.primary };
}

/** Inline CSS for Shepherd report card (print + PDF + screen) */
export function buildReportCardCss(c: ReportBrandColors): string {
  const accent = c.primary;
  const dark = c.primaryDark;
  const light = c.primaryLight;
  const pageBg = "#000000";
  return `
.rc-page-shell{background:${pageBg};width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.rc-page{background:transparent;min-height:100vh;padding:24px 16px 48px;display:flex;flex-direction:column;align-items:center;gap:16px;font-family:'Manrope',sans-serif;color:${c.white};color-scheme:dark;forced-color-adjust:none}
.rc-toolbar{width:100%;max-width:860px;background:${dark};border-radius:10px;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border:1px solid ${dark}}
.rc-toolbar-title{color:${c.white};font-family:'Manrope',sans-serif;font-size:14px;display:block;font-weight:700}
.rc-status-row{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}
.rc-status-pill{background:${c.white};color:${dark};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px}
.rc-status-saved{color:${c.white};font-size:11px;opacity:.85}
.rc-status-saving{color:${c.white};font-size:11px;opacity:.9;font-style:italic}
.rc-export-hint{color:${c.white};font-size:12px;padding:8px 12px;opacity:.9}
.rc-admin-feedback{width:100%;max-width:860px;background:${c.white};border:1px solid ${accent};border-radius:8px;padding:12px 16px;font-size:13px;color:${c.black}}
.rc-admin-feedback p{margin:4px 0;color:${c.black}}
.rc-date-inline{display:inline;width:120px;margin-left:4px}
.rc-parent-sig{border:1px solid ${accent};border-radius:10px;padding:18px;background:${c.white};margin-bottom:22px}
@media(max-width:640px){
  .rc-header-inner{flex-direction:column;text-align:center}
  .rc-header-right{text-align:center}
  .rc-info-grid{grid-template-columns:1fr}
  .rc-stats{grid-template-columns:repeat(2,1fr)}
  .rc-scale-grid{grid-template-columns:repeat(3,1fr)}
  .rc-head-grid{grid-template-columns:1fr}
  .rc-dates-grid{grid-template-columns:1fr}
  .rc-table{font-size:11px;display:block;overflow-x:auto}
  .rc-body{padding:16px}
  .rc-page{padding:12px 8px 32px}
}
@media(max-width:900px){
  .rc-info-grid{grid-template-columns:1fr 1fr}
  .rc-scale-grid{grid-template-columns:repeat(5,1fr)}
}
.rc-btns{display:flex;gap:10px;flex-wrap:wrap}
.rc-btn{padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-weight:700;font-size:13px}
.rc-btn-print{background:${c.white};color:${dark};border:1.5px solid ${c.white}}
.rc-btn-pdf{background:transparent;color:${c.white};border:1.5px solid ${c.white}}
.rc-btn-save{background:${c.white};color:${dark}}
.rc-card{width:100%;max-width:860px;background:${c.white};border-radius:14px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.45);border:1px solid ${accent}}
.rc-header{background:${dark};padding:28px 40px 20px}
.rc-header-inner{display:flex;align-items:center;gap:20px}
.rc-logo{width:90px;height:90px;border-radius:50%;background:#fff;padding:4px;box-shadow:0 0 0 3px #ffffff55;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rc-logo img{width:80px;height:80px;object-fit:contain;image-rendering:auto}
.rc-school-name{font-family:'Manrope',sans-serif;font-size:clamp(16px,4vw,24px);font-weight:900;color:#ffffff;letter-spacing:1px;text-transform:uppercase}
.rc-school-motto{color:#ffffff;font-size:11px;font-style:italic;margin-top:4px;opacity:.9}
.rc-school-contact{color:#ffffff;font-size:11px;margin-top:6px;opacity:.95;font-weight:600;word-break:break-word}
.rc-school-addr{color:#ffffff;font-size:12px;margin-top:3px;opacity:.9}
.rc-header-right{text-align:right}
.rc-header-label{color:#ffffff;font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.8}
.rc-header-value{color:#ffffff;font-family:'Manrope',sans-serif;font-size:15px;font-weight:700}
.rc-gold-stripe{height:4px;background:${light}}
.rc-term-period{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:10px 24px;background:${accent};color:#fff;font-size:13px}
.rc-term-period-label{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.85;font-weight:700}
.rc-term-period-value{font-family:'Manrope',sans-serif;font-weight:800;font-size:14px}
.rc-body{padding:28px 36px;color:${c.black}}
.rc-info-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;background:${c.white};border:1px solid ${accent};border-radius:10px;padding:18px;margin-bottom:24px}
.rc-info-full{grid-column:1/-1}
.rc-info-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:${accent};font-weight:700;display:block;margin-bottom:4px}
.rc-info-value{font-size:14px;font-weight:600;color:${c.black}}
.rc-info-value.big{font-family:'Manrope',sans-serif;font-size:18px;color:${c.black}}
.rc-inline-input{border:1px solid ${accent};border-radius:4px;padding:4px 8px;font-size:14px;width:100%;background:#fff;color:${c.black}}
.rc-cell-input{width:64px;padding:4px;border:1px solid ${accent};border-radius:4px;text-align:center;color:${c.black};background:#fff}
.rc-cell-sm{width:48px}
.rc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.rc-stat{background:${dark};border-radius:10px;padding:14px;text-align:center;border:1px solid ${dark}}
.rc-stat-value{font-family:'Manrope',sans-serif;font-size:22px;font-weight:700;color:#ffffff;display:block}
.rc-stat-input{width:100%;background:transparent;border:none;color:#ffffff;font-family:'Manrope',sans-serif;font-size:20px;font-weight:700;text-align:center}
.rc-stat-label{font-size:10px;text-transform:uppercase;color:#ffffff;margin-top:6px;display:block;opacity:.85}
.rc-sec-title{font-family:'Manrope',sans-serif;font-size:13px;font-weight:700;color:${accent};margin-bottom:14px;display:flex;align-items:center;gap:10px}
.rc-sec-title::after{content:'';flex:1;height:1px;background:${accent};opacity:.35}
.rc-sec-title-dot{width:8px;height:8px;border-radius:50%;background:${accent}}
.rc-table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;color:${c.black}}
.rc-table thead th{background:${dark};color:${c.white};font-size:10px;padding:9px 10px;text-align:left;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.rc-table tbody td{padding:8px 10px;border-bottom:1px solid ${c.border};vertical-align:middle;color:${c.black}}
.rc-subj{font-weight:700;color:${c.black};font-size:12px}
.rc-score-cell{display:flex;align-items:center;gap:8px}
.rc-score-num{font-family:'Manrope',sans-serif;font-weight:700;min-width:36px;color:${c.black}}
.rc-bar-track{flex:1;height:6px;background:#e8ecea;border-radius:3px;overflow:hidden;min-width:50px}
.rc-bar-fill{height:100%;border-radius:3px;background:${accent} !important}
.rc-badge{display:inline-block;padding:2px 10px;border-radius:20px;font-weight:700;font-size:12px;background:${dark} !important;color:${c.white} !important}
.rc-scale-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:24px}
.rc-scale-cell{border-radius:6px;padding:6px 4px;text-align:center;font-size:9px;background:${c.white} !important;color:${c.black};border:1px solid ${accent}}
.rc-scale-range{color:${c.black}}
.rc-scale-grade{font-weight:700;font-size:13px;color:${accent} !important}
.rc-scale-remark{color:${c.black}}
.rc-att-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px}
.rc-att-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.rc-att-box,.rc-att-pill{border:1px solid ${accent};border-radius:8px;padding:12px;background:${c.white};display:flex;align-items:center;gap:8px;color:${c.black}}
.rc-att-pill{flex-direction:column;align-items:center}
.rc-att-label{font-size:10px;color:${accent};font-weight:700;text-transform:uppercase}
.rc-remark-box{border:1px solid ${accent};border-radius:10px;padding:18px;background:${c.white};margin-bottom:22px;color:${c.black}}
.rc-remark-stack{display:flex;flex-direction:column;gap:20px}
.rc-quote-block{background:${c.mutedBg};border-left:4px solid ${accent};padding:12px 16px;font-style:italic;margin-top:8px;color:${c.black}}
.rc-textarea{width:100%;border:1px solid ${accent};border-radius:8px;padding:10px;font-family:inherit;margin-top:8px;resize:vertical;color:${c.black};background:#fff}
.rc-sig-box{text-align:center}
.rc-sig-box-centered{width:100%;max-width:320px;margin-left:auto;margin-right:auto}
.rc-sig-area{width:100%;height:70px;border:1px dashed ${accent};border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;padding:8px 12px;margin-top:8px;overflow:hidden;box-sizing:border-box}
.rc-sig-img{max-height:54px;max-width:100%;width:auto;height:auto;object-fit:contain;display:block;margin:0 auto;flex-shrink:0}
.rc-sig-placeholder{width:100%;text-align:center;font-size:14px;font-weight:700;color:${accent};letter-spacing:1px}
.rc-sig-caption{font-size:11px;color:${accent};margin-top:6px;text-align:center}
.rc-head-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;border:1px solid ${accent};border-radius:10px;padding:18px;background:${c.white};margin-bottom:22px;align-items:center}
.rc-head-stamp{display:flex;align-items:center;justify-content:center}
.rc-head-grid .rc-sig-box-centered{justify-self:center}
.rc-stamp{width:80px;height:80px;border-radius:50%;border:2px dashed ${accent};display:flex;align-items:center;justify-content:center;font-size:10px;color:${accent};text-align:center;line-height:1.4;font-weight:700}
.rc-stamp-img{width:110px;height:110px;display:flex;align-items:center;justify-content:center}
.rc-stamp-img img{max-width:100%;max-height:100%;object-fit:contain}
.rc-dates-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.rc-date-cell{border:1px solid ${accent};border-radius:8px;padding:10px;background:${c.white};color:${c.black}}
.rc-date-label{font-size:9px;text-transform:uppercase;color:${accent};margin-bottom:4px;font-weight:700;letter-spacing:.5px}
.rc-footer{background:${dark};padding:14px 36px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.rc-footer-text{color:#ffffff;font-size:11px;opacity:.9}
.rc-footer-seal{width:52px;height:52px;border-radius:50%;border:1.5px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:8px;color:#ffffff;text-align:center;font-family:'Manrope',sans-serif;font-weight:700;flex-shrink:0}
.rc-exporting,.rc-exporting *{animation:none!important;transition:none!important}
.rc-exporting .rc-bar-fill{transition:none!important}
@media print{
  .no-print,.no-print-root .rc-toolbar,.no-print-root .rc-admin-feedback{display:none!important}
  .rc-page-shell{background:#fff;width:auto;margin-left:0;margin-right:0}
  .rc-page{position:absolute;left:0;top:0;padding:0;margin:0;background:#fff;min-height:0;height:auto;width:100%}
  .rc-card,.rc-exporting{box-shadow:none;border-radius:0;max-width:100%;width:100%;border:1px solid ${accent};overflow:visible;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rc-card *,.rc-exporting *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rc-body{padding:20px 24px}
}
`;
}
