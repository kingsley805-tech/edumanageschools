import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "title", label: "Title", required: true },
  {
    key: "event_type",
    label: "Type",
    type: "select",
    options: [
      { value: "holiday", label: "Holiday" },
      { value: "public_holiday", label: "Public holiday" },
      { value: "exam", label: "Exam" },
      { value: "mid_semester", label: "Mid semester" },
      { value: "event", label: "Event" },
      { value: "admission", label: "Admissions" },
      { value: "registration", label: "Registration" },
      { value: "fee_deadline", label: "Fee deadline" },
      { value: "graduation", label: "Graduation" },
      { value: "vacation", label: "Vacation" },
      { value: "semester_start", label: "Semester start" },
      { value: "semester_end", label: "Semester end" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "academic_year", label: "Academic year" },
  { key: "semester", label: "Semester / Term", list: false },
  { key: "start_at", label: "Start", type: "datetime", required: true },
  { key: "end_at", label: "End", type: "datetime", list: false },
  { key: "location", label: "Location", list: false },
  { key: "description", label: "Description", type: "textarea", list: false },
  { key: "is_published", label: "Published", type: "checkbox", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
];

export default function AcademicCalendarPage() {
  return (
    <GenericCrudPage
      moduleKey="academic_calendar"
      title="Academic calendar"
      description="Holidays, exams, registration windows, fee deadlines, and school events."
      table="calendar_events"
      accentLabel="Administration"
      fields={fields}
      orderBy="start_at"
      searchKeys={["title", "event_type", "academic_year", "location"]}
      beforeSave={(form) => {
        const start = form.start_at;
        if (typeof start === "string" && start && !start.includes("Z") && start.length === 16) {
          form.start_at = new Date(start).toISOString();
        }
        const end = form.end_at;
        if (typeof end === "string" && end && !end.includes("Z") && end.length === 16) {
          form.end_at = new Date(end).toISOString();
        }
        return form;
      }}
    />
  );
}
