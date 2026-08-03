import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "student_id", label: "Student ID (UUID)", required: true, list: false },
  { key: "blood_group", label: "Blood group" },
  { key: "emergency_contact_name", label: "Emergency contact" },
  { key: "emergency_contact_phone", label: "Emergency phone" },
  { key: "emergency_relationship", label: "Relationship", list: false },
  { key: "medical_conditions", label: "Medical conditions", type: "textarea", list: false },
  { key: "allergies", label: "Allergies", type: "textarea" },
  { key: "current_medication", label: "Current medication", type: "textarea", list: false },
  { key: "disabilities", label: "Disabilities", list: false },
  { key: "doctor_name", label: "Doctor", list: false },
  { key: "hospital", label: "Hospital", list: false },
  { key: "insurance", label: "Insurance", list: false },
  { key: "vaccination_history", label: "Vaccination history", type: "textarea", list: false },
  { key: "height_cm", label: "Height (cm)", type: "number", list: false },
  { key: "weight_kg", label: "Weight (kg)", type: "number", list: false },
  { key: "vision", label: "Vision", list: false },
  { key: "hearing", label: "Hearing", list: false },
  { key: "medical_notes", label: "Medical notes", type: "textarea", list: false },
  { key: "documents_url", label: "Documents URL", list: false },
  { key: "health_clearance", label: "Health clearance", type: "checkbox", list: false },
  { key: "critical_alert", label: "Critical alert", type: "checkbox" },
  {
    key: "health_status",
    label: "Status",
    type: "select",
    options: [
      { value: "clear", label: "Clear" },
      { value: "monitor", label: "Monitor" },
      { value: "critical", label: "Critical" },
      { value: "cleared_for_sports", label: "Cleared for sports" },
      { value: "restricted", label: "Restricted" },
    ],
  },
];

export default function StudentHealthPage() {
  return (
    <GenericCrudPage
      moduleKey="student_health"
      title="Student health"
      description="Health profiles, emergencies, allergies, clearance, and critical alerts."
      table="student_health_profiles"
      accentLabel="Health"
      fields={fields}
      statusKey="health_status"
      orderBy="updated_at"
      searchKeys={["blood_group", "emergency_contact_name", "allergies", "health_status", "student_id"]}
    />
  );
}
