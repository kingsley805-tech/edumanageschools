import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "student_id", label: "Student ID (UUID)", required: true, list: false, placeholder: "Paste student UUID" },
  { key: "title", label: "Title", required: true },
  {
    key: "report_type",
    label: "Type",
    type: "select",
    options: [
      { value: "positive", label: "Positive" },
      { value: "negative", label: "Negative" },
      { value: "warning", label: "Warning" },
      { value: "disciplinary", label: "Disciplinary" },
      { value: "merit", label: "Merit" },
      { value: "demerit", label: "Demerit" },
      { value: "incident", label: "Incident" },
    ],
  },
  { key: "incident_date", label: "Incident date", type: "date" },
  { key: "behavior_score", label: "Behavior score", type: "number", list: false },
  { key: "merits", label: "Merits", type: "number", list: false },
  { key: "demerits", label: "Demerits", type: "number", list: false },
  { key: "description", label: "Description", type: "textarea", list: false },
  { key: "teacher_remark", label: "Teacher remark", type: "textarea", list: false },
  { key: "action_taken", label: "Action taken", list: false },
  { key: "follow_up", label: "Follow-up", list: false },
  { key: "attachment_url", label: "Attachment URL", list: false },
  { key: "reported_by_name", label: "Reported by" },
  { key: "parent_notified", label: "Parent notified", type: "checkbox", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "closed", label: "Closed" },
    ],
  },
];

export default function BehaviorReportsPage() {
  return (
    <GenericCrudPage
      moduleKey="behavior_reports"
      title="Behavior reports"
      description="Positive/negative reports, warnings, merits, demerits, and disciplinary actions."
      table="behavior_reports"
      accentLabel="Domestics"
      fields={fields}
      orderBy="incident_date"
      searchKeys={["title", "report_type", "reported_by_name", "status"]}
    />
  );
}
