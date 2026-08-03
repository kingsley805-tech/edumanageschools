export type ProgramStatus = "active" | "inactive" | "archived";

export type AcademicProgram = {
  id: string;
  school_id: string;
  name: string;
  code: string;
  department: string | null;
  faculty: string | null;
  description: string | null;
  duration_years: number | null;
  credits: number | null;
  level: string | null;
  semester_structure: string | null;
  coordinator_name: string | null;
  coordinator_teacher_id: string | null;
  subjects: string[] | null;
  status: ProgramStatus;
  is_archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProgramsDashboardStats = {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  departments: number;
};
