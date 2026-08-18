import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "student_id", label: "Student name", type: "student", required: true },
  {
    key: "exeat_type",
    label: "Type",
    type: "select",
    options: [
      { value: "day", label: "Day exeat" },
      { value: "weekend", label: "Weekend" },
      { value: "medical", label: "Medical" },
      { value: "emergency", label: "Emergency" },
    ],
  },
  { key: "reason", label: "Reason", required: true, type: "textarea" },
  { key: "destination", label: "Destination" },
  { key: "departure_at", label: "Departure", type: "datetime", required: true },
  { key: "return_at", label: "Expected return", type: "datetime" },
  { key: "actual_checkout_at", label: "Checked out at", type: "datetime", list: false },
  { key: "actual_checkin_at", label: "Checked in at", type: "datetime", list: false },
  { key: "guardian_approved", label: "Guardian approved", type: "checkbox", list: false },
  { key: "parent_approved", label: "Parent approved", type: "checkbox", list: false },
  { key: "qr_code", label: "QR / pass code", list: false },
  { key: "notes", label: "Notes", type: "textarea", list: false },
  {
    key: "approval_status",
    label: "Approval",
    type: "select",
    options: [
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "cancelled", label: "Cancelled" },
      { value: "completed", label: "Completed" },
    ],
  },
];

export default function ExeatsPage() {
  return (
    <GenericCrudPage
      moduleKey="exeats"
      title="Exeats"
      description="Day, weekend, medical, and emergency leave permissions with check-in/out."
      table="exeats"
      accentLabel="Domestics"
      fields={fields}
      statusKey="approval_status"
      orderBy="departure_at"
      searchKeys={[
        "reason",
        "destination",
        "exeat_type",
        "approval_status",
        "qr_code",
        "student_name",
        "admission_number",
        "class_name",
      ]}
      beforeSave={(form) => {
        for (const key of ["departure_at", "return_at", "actual_checkout_at", "actual_checkin_at"]) {
          const v = form[key];
          if (typeof v === "string" && v && v.length === 16) form[key] = new Date(v).toISOString();
        }
        return form;
      }}
    />
  );
}
