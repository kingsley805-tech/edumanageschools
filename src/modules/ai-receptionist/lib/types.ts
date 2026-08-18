export type KnowledgeCategory =
  | "admissions"
  | "school_info"
  | "academics"
  | "student_life"
  | "finance"
  | "events"
  | "policies"
  | "general";

export type CallDirection = "inbound" | "outbound";
export type CallStatus =
  | "ringing"
  | "in_progress"
  | "completed"
  | "missed"
  | "failed"
  | "escalated"
  | "voicemail";

export type CallSentiment = "positive" | "neutral" | "negative" | "urgent";

export type ActionType =
  | "follow_up"
  | "meeting_request"
  | "attendance_alert"
  | "fee_reminder"
  | "notify_teacher"
  | "notify_admin"
  | "other";

export type ActionStatus = "pending" | "approved" | "in_progress" | "completed" | "cancelled";

export type OpenAiRealtimeModel = "gpt-4o-realtime-preview" | "gpt-4o-mini-realtime-preview";
export type OpenAiVoice = "alloy" | "echo" | "shimmer" | "ash" | "ballad" | "coral" | "sage" | "verse";

export type AiVoiceAgent = {
  id: string;
  school_id: string;
  name: string;
  display_title: string;
  greeting: string;
  voice_style: string;
  languages: string[];
  is_active: boolean;
  handover_phone: string | null;
  escalation_keywords: string[];
  openai_model?: string;
  openai_voice?: string;
  system_prompt?: string | null;
  temperature?: number;
  enabled_tools?: string[];
  max_call_duration_seconds?: number;
};

export type AiVoiceSettings = {
  id: string;
  school_id: string;
  provider: string;
  school_phone_e164: string | null;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  webhook_url: string | null;
  media_stream_url?: string | null;
  status_callback_url?: string | null;
  support_number?: string | null;
  recording_enabled: boolean;
  outbound_enabled: boolean;
  verification_mode: string;
  is_enabled: boolean;
};

export type AiKnowledgeArticle = {
  id: string;
  school_id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string[];
  language: string;
  is_published: boolean;
  is_archived: boolean;
  sort_order: number;
  updated_at: string;
};

export type AiCall = {
  id: string;
  school_id: string;
  direction: CallDirection;
  status: CallStatus;
  caller_phone: string | null;
  caller_name: string | null;
  student_id: string | null;
  parent_id?: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  detected_intent: string | null;
  sentiment: CallSentiment | null;
  satisfaction_score: number | null;
  summary: string | null;
  follow_up_status: string;
  recording_url: string | null;
  provider_call_sid?: string | null;
  parent_call_sid?: string | null;
  ai_session_id?: string | null;
  is_verified?: boolean;
  escalated?: boolean;
  escalation_reason?: string | null;
  metadata?: Record<string, unknown>;
  language?: string | null;
  student_name?: string;
};

export type CallFilters = {
  search?: string;
  status?: CallStatus | "all";
  direction?: CallDirection | "all";
  studentId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type EscalationUrgency = "low" | "normal" | "high" | "critical";

export type AiEscalation = {
  id: string;
  school_id: string;
  call_id: string;
  reason: string;
  urgency: EscalationUrgency;
  handed_to: string | null;
  status: "open" | "accepted" | "resolved" | "cancelled";
  context_summary: string | null;
  created_at: string;
};

export type AiCallTranscript = {
  id: string;
  call_id: string;
  speaker: "ai" | "caller" | "staff" | "system";
  content: string;
  spoken_at: string;
  sequence_no: number;
};

export type AiConversationLog = {
  id: string;
  school_id: string;
  call_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AiAction = {
  id: string;
  school_id: string;
  call_id: string | null;
  action_type: ActionType;
  title: string;
  description: string | null;
  assigned_department: string | null;
  status: ActionStatus;
  due_at: string | null;
  is_archived: boolean;
  created_at: string;
};

export type AiReceptionistDashboardStats = {
  calls_today: number;
  completed_today: number;
  escalated_today: number;
  avg_duration_seconds: number;
  pending_followups: number;
  knowledge_articles: number;
  avg_satisfaction: number;
  total_calls: number;
};

export type OutboundCallPayload = {
  schoolId: string;
  toPhone: string;
  studentId?: string;
  purpose: string;
  context?: string;
  recipientName?: string;
};

export const OPENAI_REALTIME_MODELS: { value: string; label: string; description: string }[] = [
  {
    value: "gpt-4o-realtime-preview",
    label: "GPT-4o Realtime",
    description: "Highest accuracy, nuanced reasoning, rich conversational tone.",
  },
  {
    value: "gpt-4o-mini-realtime-preview",
    label: "GPT-4o Mini Realtime",
    description: "Ultra-low latency, cost-effective for high call volumes.",
  },
];

export const OPENAI_REALTIME_VOICES: { value: OpenAiVoice; label: string; tone: string; gender: string }[] = [
  { value: "alloy", label: "Alloy", tone: "Neutral, balanced & clear", gender: "Neutral" },
  { value: "echo", label: "Echo", tone: "Warm, authoritative & rounded", gender: "Male" },
  { value: "shimmer", label: "Shimmer", tone: "Bright, engaging & cheerful", gender: "Female" },
  { value: "ash", label: "Ash", tone: "Articulate, precise & calm", gender: "Male" },
  { value: "ballad", label: "Ballad", tone: "Deep, calm & melodic", gender: "Male" },
  { value: "coral", label: "Coral", tone: "Friendly, expressive & warm", gender: "Female" },
  { value: "sage", label: "Sage", tone: "Professional, mature & reassuring", gender: "Female" },
  { value: "verse", label: "Verse", tone: "Dynamic, modern & versatile", gender: "Neutral" },
];

export const AVAILABLE_VOICE_TOOLS: { key: string; label: string; description: string; category: string }[] = [
  {
    key: "verify_caller_identity",
    label: "Caller Identity Verification",
    description: "Verifies parent phone or student admission number before disclosing private student records.",
    category: "Security",
  },
  {
    key: "get_student_info",
    label: "Student Profile Lookup",
    description: "Provides basic student info, assigned class, and enrollment details.",
    category: "Student Records",
  },
  {
    key: "get_attendance_summary",
    label: "Attendance Statistics",
    description: "Reports present, late, and absent days over the last 30 days.",
    category: "Student Records",
  },
  {
    key: "get_fee_balance",
    label: "Fee & Invoice Lookup",
    description: "Calculates total billed, total paid, outstanding balance, and next due date.",
    category: "Billing & Finance",
  },
  {
    key: "get_academic_grades",
    label: "Academic Grades & Reports",
    description: "Retrieves recent exam scores and subject report card results.",
    category: "Academics",
  },
  {
    key: "report_student_absence",
    label: "Record Student Absence",
    description: "Logs an official absence notice and notifies the class teacher.",
    category: "Attendance",
  },
  {
    key: "schedule_meeting",
    label: "Schedule Meeting / Callback",
    description: "Submits an appointment request with teachers or administration.",
    category: "Appointments",
  },
  {
    key: "search_knowledge_base",
    label: "School Knowledge Base",
    description: "Answers FAQs regarding term dates, admissions, uniform policies, and tuition.",
    category: "Information",
  },
  {
    key: "transfer_to_human",
    label: "Human Staff Escalation",
    description: "Transfers the call to a live staff member when requested or during emergencies.",
    category: "Telephony",
  },
];

export const OUTBOUND_PURPOSES: { value: string; label: string; defaultContext: string }[] = [
  {
    value: "fee_reminder",
    label: "School Fees Reminder",
    defaultContext: "Reminder regarding upcoming or overdue school fee payments for this term.",
  },
  {
    value: "attendance_alert",
    label: "Unexcused Absence Alert",
    defaultContext: "Informing the parent that their child was marked absent today without prior notice.",
  },
  {
    value: "meeting_confirmation",
    label: "Parent-Teacher Meeting",
    defaultContext: "Confirming scheduled appointment with the class teacher or school principal.",
  },
  {
    value: "emergency_notice",
    label: "Urgent School Announcement",
    defaultContext: "Urgent update regarding school schedule, weather closure, or special event.",
  },
  {
    value: "callback",
    label: "Support Callback",
    defaultContext: "Following up on a previous parent inquiry or ticket submitted to the office.",
  },
];

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  admissions: "Admissions",
  school_info: "School information",
  academics: "Academics",
  student_life: "Student life",
  finance: "Finance",
  events: "Events",
  policies: "Policies",
  general: "General",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  follow_up: "Follow-up",
  meeting_request: "Meeting request",
  attendance_alert: "Attendance alert",
  fee_reminder: "Fee reminder",
  notify_teacher: "Notify teacher",
  notify_admin: "Notify admin",
  other: "Other",
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  ringing: "Ringing",
  in_progress: "In progress",
  completed: "Completed",
  missed: "Missed",
  failed: "Failed",
  escalated: "Escalated",
  voicemail: "Voicemail",
};

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "en-GH", label: "Ghanaian English" },
  { code: "tw", label: "Twi" },
  { code: "gaa", label: "Ga" },
  { code: "ee", label: "Ewe" },
];

export function formatCallDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
