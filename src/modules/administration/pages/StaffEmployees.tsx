import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "staff_id", label: "Staff ID", required: true },
  { key: "full_name", label: "Full name", required: true },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "date_of_birth", label: "Date of birth", type: "date", list: false },
  { key: "position", label: "Position" },
  { key: "qualification", label: "Qualification", list: false },
  { key: "experience_years", label: "Experience (years)", type: "number", list: false },
  {
    key: "employment_type",
    label: "Employment type",
    type: "select",
    options: [
      { value: "full_time", label: "Full time" },
      { value: "part_time", label: "Part time" },
      { value: "contract", label: "Contract" },
      { value: "intern", label: "Intern" },
      { value: "volunteer", label: "Volunteer" },
    ],
  },
  { key: "salary", label: "Salary", type: "number", list: false },
  { key: "phone", label: "Phone", list: false },
  { key: "email", label: "Email" },
  { key: "address", label: "Address", type: "textarea", list: false },
  { key: "emergency_contact_name", label: "Emergency contact", list: false },
  { key: "emergency_contact_phone", label: "Emergency phone", list: false },
  { key: "photo_url", label: "Photo URL", list: false },
  { key: "documents_url", label: "Documents URL", list: false },
  { key: "hire_date", label: "Hire date", type: "date", list: false },
  { key: "contract_end_date", label: "Contract end", type: "date", list: false },
  {
    key: "employment_status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "on_leave", label: "On leave" },
      { value: "suspended", label: "Suspended" },
      { value: "terminated", label: "Terminated" },
      { value: "retired", label: "Retired" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  { key: "notes", label: "Notes", type: "textarea", list: false },
];

export default function StaffEmployeesPage() {
  return (
    <GenericCrudPage
      moduleKey="staff_employees"
      title="Staff"
      description="Employee records — contracts, contacts, employment status, and documents."
      table="staff_employees"
      accentLabel="Administration"
      fields={fields}
      statusKey="employment_status"
      orderBy="full_name"
      searchKeys={["staff_id", "full_name", "email", "position", "phone"]}
    />
  );
}
