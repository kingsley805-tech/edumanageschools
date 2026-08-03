import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "title", label: "Title", required: true },
  {
    key: "income_type",
    label: "Type",
    type: "select",
    options: [
      { value: "donation", label: "Donation" },
      { value: "fundraising", label: "Fundraising" },
      { value: "rental", label: "Rental" },
      { value: "event", label: "Event" },
      { value: "shop_sales", label: "Shop sales" },
      { value: "interest", label: "Interest" },
      { value: "miscellaneous", label: "Miscellaneous" },
    ],
  },
  { key: "amount", label: "Amount", type: "number", required: true },
  { key: "income_date", label: "Date", type: "date" },
  { key: "source_name", label: "Source" },
  { key: "attachment_url", label: "Attachment URL", list: false },
  { key: "notes", label: "Notes", type: "textarea", list: false },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "recorded", label: "Recorded" },
      { value: "verified", label: "Verified" },
    ],
  },
];

export default function OtherIncomePage() {
  return (
    <GenericCrudPage
      moduleKey="finance_other_income"
      title="Other income"
      description="Donations, fundraising, rentals, events, shop sales, and miscellaneous income."
      table="finance_other_income"
      accentLabel="Finance"
      fields={fields}
      orderBy="income_date"
      searchKeys={["title", "income_type", "source_name", "status"]}
    />
  );
}
