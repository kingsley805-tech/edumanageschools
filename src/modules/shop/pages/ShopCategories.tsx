import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "name", label: "Category", required: true },
  { key: "description", label: "Description", type: "textarea" },
];

export default function ShopCategoriesPage() {
  return (
    <GenericCrudPage
      moduleKey="school_shop"
      title="Shop categories"
      description="Group products for the school storefront."
      table="shop_categories"
      accentLabel="Resources"
      fields={fields}
      orderBy="name"
      searchKeys={["name", "description"]}
    />
  );
}
