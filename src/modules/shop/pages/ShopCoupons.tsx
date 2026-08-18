import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "code", label: "Code", required: true },
  { key: "description", label: "Description", list: false },
  {
    key: "discount_type",
    label: "Type",
    type: "select",
    options: [
      { value: "percent", label: "Percent" },
      { value: "fixed", label: "Fixed amount" },
    ],
  },
  { key: "discount_value", label: "Value", type: "number", required: true },
  { key: "min_order_total", label: "Min order", type: "number", list: false },
  { key: "max_uses", label: "Max uses", type: "number", list: false },
  { key: "used_count", label: "Used", type: "number" },
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

export default function ShopCouponsPage() {
  return (
    <GenericCrudPage
      moduleKey="school_shop"
      title="Shop coupons"
      description="Discount codes applied at checkout on student, parent, and teacher portals."
      table="shop_coupons"
      accentLabel="Resources"
      fields={fields}
      statusKey="status"
      orderBy="code"
      searchKeys={["code", "description", "status"]}
    />
  );
}
