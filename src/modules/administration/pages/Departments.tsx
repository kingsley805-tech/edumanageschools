import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "name", label: "Department name", required: true },
  { key: "code", label: "Code", required: true },
  { key: "head_name", label: "Head of department" },
  { key: "description", label: "Description", type: "textarea", list: false },
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

export default function DepartmentsPage() {
  return (
    <GenericCrudPage
      moduleKey="departments"
      title="Departments"
      description="Institutional departments, codes, and heads of department."
      table="departments"
      accentLabel="Administration"
      fields={fields}
      orderBy="name"
      searchKeys={["name", "code", "head_name"]}
    />
  );
}
