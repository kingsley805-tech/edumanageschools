export type PeopleImportEntity = "student" | "teacher" | "parent";

export type ImportRowStatus = "valid" | "invalid" | "update" | "skip";

export type ImportRowResultAction = "created" | "updated" | "skipped" | "failed";

export type NormalizedRow = Record<string, string>;

export type ValidatedImportRow = {
  rowNumber: number;
  raw: NormalizedRow;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  /** Payload ready for the edge function when status is valid or update */
  payload: Record<string, unknown> | null;
};

export type ImportContextLookups = {
  schoolId: string;
  schoolCode: string;
  classes: Array<{ id: string; name: string; stream: string | null; level: string | null }>;
  subjects: Array<{ id: string; name: string }>;
  existingStudents: Array<{
    id: string;
    admission_no: string | null;
    admission_number: string | null;
    full_name: string | null;
    user_id: string | null;
  }>;
  existingTeachers: Array<{
    id: string;
    employee_no: string | null;
    user_id: string | null;
    email: string | null;
    phone: string | null;
  }>;
  existingParents: Array<{
    id: string;
    user_id: string | null;
    phone: string | null;
    email: string | null;
  }>;
};

export type BulkImportRowResult = {
  rowNumber: number;
  action: ImportRowResultAction;
  message?: string;
  entityId?: string;
};

export type BulkImportResponse = {
  success: boolean;
  results: BulkImportRowResult[];
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
};

export type PeopleImportColumn = {
  key: string;
  header: string;
  required?: boolean;
  sample?: string;
};
