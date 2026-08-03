export type AchievementType =
  | "award"
  | "honor"
  | "certificate"
  | "competition"
  | "recommendation"
  | "recognition"
  | "other";

export type AchievementStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "inactive"
  | "archived";

export type AchievementCategory = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_archived: boolean;
};

export type Achievement = {
  id: string;
  school_id: string;
  student_id: string;
  category_id: string | null;
  title: string;
  achievement_type: AchievementType;
  description: string | null;
  awarded_by: string | null;
  awarded_on: string;
  academic_year: string | null;
  term_label: string | null;
  level: string | null;
  venue: string | null;
  image_url: string | null;
  document_url: string | null;
  recommendation_letter: string | null;
  notes: string | null;
  status: AchievementStatus;
  is_published: boolean;
  is_archived: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  category_name?: string | null;
};

export type AchievementNote = {
  id: string;
  achievement_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  author_name?: string;
};

export type AchievementsDashboardStats = {
  total: number;
  published: number;
  pending: number;
  approved: number;
  awards: number;
  certificates: number;
  competitions: number;
  archived: number;
};

export type StudentOption = {
  id: string;
  name: string;
  admission: string;
  class_name: string;
};

export const ACHIEVEMENT_TYPE_LABELS: Record<AchievementType, string> = {
  award: "Award",
  honor: "Honor",
  certificate: "Certificate",
  competition: "Competition",
  recommendation: "Recommendation",
  recognition: "Recognition",
  other: "Other",
};
