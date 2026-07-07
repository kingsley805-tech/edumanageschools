export type WaecLevel = "bece" | "wassce";
export type WaecPaperType = "paper_1" | "paper_2" | "paper_3";
export type WaecDifficulty = "easy" | "medium" | "hard" | "advanced";
export type WaecQuestionType = "objective" | "structured" | "mock";
export type WaecQuestionStatus = "draft" | "approved" | "rejected";
export type WaecGeneratedBy = "manual" | "ai";
export type WaecSessionMode = "practice" | "exam";
export type WaecSessionStatus = "in_progress" | "submitted" | "abandoned";

export type WaecSubject = {
  id: string;
  level: WaecLevel;
  name: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
};

export type WaecQuestionOption = { id: string; text: string };

export type WaecQuestion = {
  id: string;
  school_id: string | null;
  subject_id: string;
  year: number;
  paper_type: WaecPaperType;
  topic: string | null;
  sub_topic?: string | null;
  difficulty: WaecDifficulty;
  question_type?: WaecQuestionType;
  question_text: string;
  options: WaecQuestionOption[] | null;
  correct_answer: string;
  explanation: string | null;
  marking_scheme: string | null;
  learning_objective?: string | null;
  estimated_time_seconds?: number | null;
  keywords?: string[] | null;
  marks: number;
  is_active: boolean;
  status?: WaecQuestionStatus;
  generated_by?: WaecGeneratedBy;
  ai_model?: string | null;
  subject_name?: string;
};

export type WaecGenerationRequest = {
  subjectId: string;
  subjectName: string;
  level: WaecLevel;
  topic?: string;
  subTopic?: string;
  difficulty?: WaecDifficulty | "mixed";
  questionType?: WaecQuestionType;
  count?: number;
  year?: number;
  schoolId?: string | null;
};

export type WaecGenerationResult = {
  ok: boolean;
  requested: number;
  inserted: number;
  skipped: number;
  tokens?: number;
};

export type WaecPracticeSession = {
  id: string;
  school_id: string | null;
  student_id: string | null;
  user_id: string;
  subject_id: string;
  level: WaecLevel;
  mode: WaecSessionMode;
  year_filter: number | null;
  paper_type: WaecPaperType;
  topic_filter: string | null;
  question_count: number;
  duration_minutes: number | null;
  score: number;
  max_score: number;
  percentage: number;
  grade: string | null;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  status: WaecSessionStatus;
  question_ids: string[];
  started_at: string;
  submitted_at: string | null;
  subject_name?: string;
};

export type WaecSessionAnswer = {
  id: string;
  session_id: string;
  question_id: string;
  selected_answer: string | null;
  is_correct: boolean | null;
  marks_awarded: number;
  question?: WaecQuestion;
};

export type WaecStudentDashboard = {
  total_attempts: number;
  average_score: number;
  best_subject: string | null;
  weak_subject: string | null;
  questions_solved: number;
};

export type WaecLeaderboardEntry = {
  user_id: string;
  student_name: string;
  school_name: string | null;
  total_score: number;
  attempts: number;
  avg_percentage: number;
};

export type WaecCatalogEntry = {
  subject_id: string;
  subject_name: string;
  level: WaecLevel;
  category: string | null;
  years: { year: number; question_count: number; paper_types: string[] }[];
  total_questions: number;
};

export type WaecLevelYears = {
  level: WaecLevel;
  years: number[];
};

export type WaecPracticeConfig = {
  level: WaecLevel;
  subjectId: string;
  year?: number;
  paperType: WaecPaperType;
  topic?: string;
  questionCount: number;
  mode: WaecSessionMode;
  durationMinutes?: number;
};

export const WAEC_LEVEL_LABELS: Record<WaecLevel, string> = {
  bece: "BECE (JHS)",
  wassce: "WASSCE (SHS)",
};

export const WAEC_PAPER_LABELS: Record<WaecPaperType, string> = {
  paper_1: "Paper 1 (Objective)",
  paper_2: "Paper 2 (Theory)",
  paper_3: "Paper 3 (Practical)",
};

export const WAEC_GRADE_INFO: Record<string, { label: string; color: string }> = {
  A1: { label: "Excellent", color: "text-emerald-600" },
  B2: { label: "Very Good", color: "text-green-600" },
  B3: { label: "Good", color: "text-lime-600" },
  C4: { label: "Credit", color: "text-blue-600" },
  C5: { label: "Credit", color: "text-blue-500" },
  C6: { label: "Credit", color: "text-sky-600" },
  D7: { label: "Pass", color: "text-amber-600" },
  E8: { label: "Pass", color: "text-orange-600" },
  F9: { label: "Fail", color: "text-red-600" },
};
