export type SubscriptionStatus = "trial" | "pending" | "active" | "suspended" | "expired" | "locked" | "cancelled";

export type PlatformModule = {
  module_key: string;
  category: string;
  label: string;
  description?: string | null;
  portal_module_key?: string | null;
  sort_order: number;
};

export type SubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  sms_addon_fee_monthly?: number;
  sms_addon_fee_annual?: number;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_gb: number | null;
  is_custom: boolean;
  is_active: boolean;
  sort_order?: number;
  default_modules: string[];
};

export type PlatformSchoolSmsOverview = {
  school_id: string;
  school_name: string;
  school_code: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  sms_enabled: boolean;
  sms_admin_override: boolean;
  sms_enabled_at: string | null;
  subscription_expires_at: string | null;
  sms_sent_30d: number;
  sms_sent_total: number;
  last_sms_at: string | null;
};

export type TenantOverview = {
  school_id: string;
  school_name: string;
  school_code: string;
  is_active: boolean;
  subscription_status: SubscriptionStatus | null;
  plan_slug: string | null;
  plan_name: string | null;
  expires_at: string | null;
  trial_ends_at: string | null;
  storage_used_mb: number | null;
  storage_limit_mb: number | null;
  student_count: number;
  teacher_count: number;
  parent_count: number;
  user_count: number;
  created_at: string | null;
};

export type ModuleEntitlementRow = {
  module_key: string;
  label: string;
  category: string;
  portal_module_key: string | null;
  enabled: boolean;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
};

export type PlatformDashboardStats = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  expiredOrganizations: number;
  trialOrganizations: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalUsers: number;
  monthlyRevenue: number;
};
