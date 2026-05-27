import {
  computeGrade,
  getGradeScale,
  LETTER_GRADE_BANDS,
  type GradingFormat,
} from "./grading";

export type { GradingFormat } from "./grading";

export interface SubjectRow {
  name: string;
  classScore: number;
  examScore: number;
  total: number;
  position: string;
  grade: string;
  remark: string;
}

/** @deprecated Use getGradeScale(format) */
export const GRADE_SCALE = LETTER_GRADE_BANDS.map(({ range, grade, remark }) => ({
  range,
  grade,
  remark,
}));

export function computeShepherdGrade(
  total: number,
  format: GradingFormat = "letter",
): { grade: string; remark: string } {
  return computeGrade(total, format);
}
/** Shepherd's Heart brand: black, white, visible professional green. */
export const BRAND_COLORS = {
  /** Main brand green — readable on white (buttons, links, labels). */
  green: "#1a7a5c",
  /** Headers, table bars, footer — slightly deeper but clearly green. */
  greenDark: "#145c47",
  /** Hover / chart accents */
  greenLight: "#2a9d75",
  white: "#ffffff",
  black: "#171717",
  mutedBg: "#f4f7f5",
  border: "rgba(26, 122, 92, 0.28)",
  shadow: "rgba(20, 92, 71, 0.2)",
  /** @deprecated use green */
  navy: "#1a7a5c",
} as const;

/** Report card grade styling — single palette (no per-grade rainbow colors). */
export function gradeStyle(_g?: string) {
  return { bg: BRAND_COLORS.greenDark, text: BRAND_COLORS.white, bar: BRAND_COLORS.green };
}

export function recalcSubject(row: SubjectRow, format: GradingFormat = "letter"): SubjectRow {
  const classScore = Math.min(50, Math.max(0, Number(row.classScore) || 0));
  const examScore = Math.min(50, Math.max(0, Number(row.examScore) || 0));
  const total = Math.round((classScore + examScore) * 100) / 100;
  const { grade, remark } = total > 0 ? computeShepherdGrade(total, format) : { grade: "—", remark: "—" };
  return { ...row, classScore, examScore, total, grade, remark };
}

export function fmtScore(n: number) {
  if (!n || n <= 0) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** 1 → "1st", 2 → "2nd" (competition rank display). */
export function formatRankLabel(rank: number | string | null | undefined): string {
  if (rank == null || rank === "" || rank === "—") return "—";
  const n =
    typeof rank === "string"
      ? parseInt(rank.replace(/\D/g, ""), 10)
      : rank;
  if (Number.isNaN(n) || n < 1) return String(rank);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

/** Canonical keys so DB names (e.g. "Our World & Our People") match report rows (e.g. "O.W.O.P"). */
const SUBJECT_CANONICAL: Record<string, string> = {
  "english language": "english",
  englishlanguage: "english",
  english: "english",
  mathematics: "mathematics",
  maths: "mathematics",
  math: "mathematics",
  science: "science",
  history: "history",
  "social studies": "history",
  socialstudies: "history",
  "religious & moral education": "rme",
  "religious and moral education": "rme",
  religiousmoraleducation: "rme",
  religiousandmoraleducation: "rme",
  relmoraledu: "rme",
  rme: "rme",
  "ghanaian language": "ghanaian",
  ghanaianlanguage: "ghanaian",
  "creative arts": "creative-arts",
  creativearts: "creative-arts",
  computing: "computing",
  ict: "computing",
  "our world & our people": "owop",
  "our world and our people": "owop",
  ourworldourpeople: "owop",
  ourworldandourpeople: "owop",
  "o.w.o.p": "owop",
  "o.w.o.p.": "owop",
  owop: "owop",
  "french language": "french",
  frenchlanguage: "french",
};

export function subjectCanonicalKey(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  return SUBJECT_CANONICAL[normalized] ?? SUBJECT_CANONICAL[compact] ?? compact;
}

export function subjectsMatch(a: string, b: string): boolean {
  return subjectCanonicalKey(a) === subjectCanonicalKey(b);
}

export function lookupBySubjectName<T>(map: Map<string, T>, name: string): T | undefined {
  const key = subjectCanonicalKey(name);
  for (const [k, v] of map) {
    if (subjectCanonicalKey(k) === key) return v;
  }
  return undefined;
}

/** Map a database / admin subject name to the report-card display name. */
export function toReportSubjectName(dbName: string): string {
  const match = DEFAULT_SUBJECTS.find((s) => subjectsMatch(s.name, dbName));
  return match?.name ?? dbName;
}

export function emptySubjectRow(name: string): SubjectRow {
  return {
    name,
    classScore: 0,
    examScore: 0,
    total: 0,
    position: "—",
    grade: "—",
    remark: "—",
  };
}

export function reportSubjectTemplate(dbName: string): SubjectRow {
  const match = DEFAULT_SUBJECTS.find((s) => subjectsMatch(s.name, dbName));
  return match ? { ...match, name: match.name } : emptySubjectRow(dbName);
}

export const DEFAULT_SUBJECTS: SubjectRow[] = [
  { name: "English Language", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Mathematics", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Science", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "History", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Religious & Moral Education", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Ghanaian Language", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Creative Arts", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "Computing", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
  { name: "O.W.O.P", classScore: 0, examScore: 0, total: 0, position: "—", grade: "—", remark: "—" },
];

/** Ensure every standard report-card subject row exists; merge stored scores and positions. */
/** Blank class + subject positions until teacher runs Generate Positions. */
export function clearReportPositions(form: ReportFormData): ReportFormData {
  return {
    ...form,
    position: "",
    subjects: form.subjects.map((s) => ({ ...s, position: "—" })),
  };
}

export function mergeReportSubjects(
  stored: SubjectRow[] = [],
  positions?: Map<string, number>,
  format: GradingFormat = "letter",
  templates: SubjectRow[] = DEFAULT_SUBJECTS,
): SubjectRow[] {
  const storedByKey = new Map(stored.map((s) => [subjectCanonicalKey(s.name), s]));
  const list = templates.length ? templates : DEFAULT_SUBJECTS;

  return list.map((template) => {
    const row = storedByKey.get(subjectCanonicalKey(template.name));
    const pos = positions?.get(subjectCanonicalKey(template.name));
    const position =
      pos != null
        ? formatRankLabel(pos)
        : row?.position && row.position !== "—" && row.position !== ""
          ? formatRankLabel(row.position)
          : "—";

    return recalcSubject(
      {
        ...template,
        ...row,
        name: template.name,
        position,
      },
      format,
    );
  });
}

export interface ReportFormData {
  studentName: string;
  className: string;
  rollNo: number | string;
  /** Manual override; empty string = use totalStudentsInClassAuto. */
  totalStudentsInClassManual: string;
  /** Count of term report rows for this class + term (not persisted on save). */
  totalStudentsInClassAuto: number | null;
  position: string;
  term: string;
  academicYear: string;
  attendanceMade: string;
  attendanceTotal: string;
  conduct: string;
  interest: string;
  club: string;
  attitude: string;
  teacherRemark: string;
  schoolCloses: string;
  reopeningDate: string;
  nextTerm: string;
  teacherSignDate: string;
  headSignDate: string;
  parentSignDate: string;
  subjects: SubjectRow[];
}

export function totalFromSubjects(subjects: SubjectRow[]) {
  return subjects.reduce((a, s) => a + (s.total || 0), 0);
}

/** Effective total students shown on the report card. */
export function displayTotalStudentsInClass(
  form: Pick<ReportFormData, "totalStudentsInClassManual" | "totalStudentsInClassAuto">,
): string {
  const manual = String(form.totalStudentsInClassManual ?? "").trim();
  if (manual) return manual;
  const auto = form.totalStudentsInClassAuto;
  if (auto != null && auto > 0) return String(auto);
  return "";
}
