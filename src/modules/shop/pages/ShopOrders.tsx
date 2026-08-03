import { GenericCrudPage, type FieldDef } from "@/modules/lib/GenericCrudPage";

const fields: FieldDef[] = [
  { key: "order_number", label: "Order #", required: true },
  { key: "customer_name", label: "Customer", required: true },
  { key: "customer_phone", label: "Phone", list: false },
  { key: "customer_email", label: "Email", list: false },
  { key: "subtotal", label: "Subtotal", type: "number", list: false },
  { key: "discount", label: "Discount", type: "number", list: false },
  { key: "total", label: "Total", type: "number", required: true },
  {
    key: "payment_status",
    label: "Payment",
    type: "select",
    options: [
      { value: "unpaid", label: "Unpaid" },
      { value: "partial", label: "Partial" },
      { value: "paid", label: "Paid" },
      { value: "refunded", label: "Refunded" },
    ],
  },
  {
    key: "fulfillment_status",
    label: "Fulfillment",
    type: "select",
    options: [
      { value: "pending", label: "Pending" },
      { value: "processing", label: "Processing" },
      { value: "ready", label: "Ready" },
      { value: "picked_up", label: "Picked up" },
      { value: "shipped", label: "Shipped" },
      { value: "delivered", label: "Delivered" },
      { value: "cancelled", label: "Cancelled" },
      { value: "returned", label: "Returned" },
    ],
  },
  {
    key: "fulfillment_method",
    label: "Method",
    type: "select",
    list: false,
    options: [
      { value: "pickup", label: "Pickup" },
      { value: "shipping", label: "Shipping" },
    ],
  },
  { key: "notes", label: "Notes", type: "textarea", list: false },
];

export default function ShopOrdersPage() {
  return (
    <GenericCrudPage
      moduleKey="school_shop"
      title="Shop orders"
      description="Customer orders, payments, pickup/shipping, returns and refunds."
      table="shop_orders"
      accentLabel="Resources"
      fields={fields}
      statusKey="fulfillment_status"
      orderBy="created_at"
      searchKeys={["order_number", "customer_name", "payment_status", "fulfillment_status"]}
    />
  );
}
