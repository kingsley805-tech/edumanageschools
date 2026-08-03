import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "name", label: "Budget name", required: true },
  { key: "department", label: "Department" },
  { key: "academic_year", label: "Academic year" },
  { key: "planned_amount", label: "Planned", type: "number", required: true },
  { key: "spent_amount", label: "Spent", type: "number" },
  { key: "notes", label: "Notes", type: "textarea", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "closed", label: "Closed" },
    ],
  },
];

export default function BudgetsPage() {
  return (
    <GenericCrudPage
      moduleKey="finance_budgets"
      title="Budget management"
      description="Department budgets, planned vs spent, approval and variance tracking."
      table="finance_budgets"
      accentLabel="Finance"
      fields={fields}
      orderBy="created_at"
      searchKeys={["name", "department", "academic_year", "status"]}
    />
  );
}
