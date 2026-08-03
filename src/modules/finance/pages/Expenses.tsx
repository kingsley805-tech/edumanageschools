import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "title", label: "Title", required: true },
  { key: "category", label: "Category", required: true },
  { key: "supplier", label: "Supplier" },
  { key: "amount", label: "Amount", type: "number", required: true },
  { key: "expense_date", label: "Date", type: "date" },
  { key: "payment_method", label: "Payment method", list: false },
  { key: "department", label: "Department", list: false },
  { key: "receipt_url", label: "Receipt URL", list: false },
  { key: "is_recurring", label: "Recurring", type: "checkbox", list: false },
  { key: "notes", label: "Notes", type: "textarea", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "paid", label: "Paid" },
    ],
  },
];

export default function ExpensesPage() {
  return (
    <GenericCrudPage
      moduleKey="finance_expenses"
      title="Expenses"
      description="Expense categories, suppliers, approvals, receipts, and recurring costs."
      table="finance_expenses"
      accentLabel="Finance"
      fields={fields}
      orderBy="expense_date"
      searchKeys={["title", "category", "supplier", "department", "status"]}
    />
  );
}
