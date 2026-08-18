export type ShopPortalRole = "student" | "parent" | "teacher";

export type ShopProduct = {
  id: string;
  school_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  product_type: string;
  description: string | null;
  price: number;
  stock_qty: number;
  image_url: string | null;
  is_digital: boolean;
  status: string;
  is_archived: boolean;
};

export type ShopCategory = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  is_archived: boolean;
};

export type ShopCartItem = {
  id: string;
  school_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  product?: ShopProduct | null;
};

export type ShopOrder = {
  id: string;
  school_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  student_id: string | null;
  buyer_user_id: string | null;
  portal_role: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_status: string;
  fulfillment_status: string;
  fulfillment_method: string;
  shipping_address: string | null;
  coupon_code: string | null;
  notes: string | null;
  created_at: string;
  items?: ShopOrderItem[];
};

export type ShopOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PlaceOrderInput = {
  schoolId: string;
  items: { product_id: string; quantity: number }[];
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  studentId?: string | null;
  portalRole: ShopPortalRole;
  fulfillmentMethod?: "pickup" | "shipping";
  shippingAddress?: string;
  couponCode?: string;
  notes?: string;
};

export type PlaceOrderResult = {
  order_id: string;
  order_number: string;
  subtotal: number;
  discount: number;
  total: number;
};
