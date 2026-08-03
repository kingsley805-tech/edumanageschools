import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "name", label: "Product name", required: true },
  { key: "sku", label: "SKU" },
  {
    key: "product_type",
    label: "Type",
    type: "select",
    options: [
      { value: "uniform", label: "Uniform" },
      { value: "book", label: "Book" },
      { value: "stationery", label: "Stationery" },
      { value: "sports", label: "Sports" },
      { value: "accessory", label: "Accessory" },
      { value: "digital", label: "Digital" },
      { value: "general", label: "General" },
    ],
  },
  { key: "price", label: "Price", type: "number", required: true },
  { key: "cost", label: "Cost", type: "number", list: false },
  { key: "stock_qty", label: "Stock", type: "number" },
  { key: "reorder_level", label: "Reorder level", type: "number", list: false },
  { key: "image_url", label: "Image URL", list: false },
  { key: "description", label: "Description", type: "textarea", list: false },
  { key: "is_digital", label: "Digital product", type: "checkbox", list: false },
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

export default function ShopProductsPage() {
  return (
    <GenericCrudPage
      moduleKey="school_shop"
      title="School shop"
      description="Uniforms, books, stationery, sports gear — products and stock."
      table="shop_products"
      accentLabel="Resources"
      fields={fields}
      orderBy="name"
      searchKeys={["name", "sku", "product_type", "status"]}
    />
  );
}
