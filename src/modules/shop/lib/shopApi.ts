import { supabase } from "@/integrations/supabase/client";
import type {
  PlaceOrderInput,
  PlaceOrderResult,
  ShopCartItem,
  ShopCategory,
  ShopOrder,
  ShopOrderItem,
  ShopProduct,
} from "./types";

/** Untyped accessor until shop tables are regenerated into Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchShopSchoolContext(userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, school_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile?.school_id) throw new Error("School profile not found");

  const { data: school } = await supabase
    .from("schools")
    .select("id, currency, school_name, name")
    .eq("id", profile.school_id)
    .maybeSingle();

  return {
    profile: profile as {
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      school_id: string;
    },
    schoolId: profile.school_id as string,
    currency: (school as { currency?: string } | null)?.currency || "GHS",
    schoolName:
      (school as { school_name?: string; name?: string } | null)?.school_name ||
      (school as { name?: string } | null)?.name ||
      "School Shop",
  };
}

export async function listActiveProducts(schoolId: string): Promise<ShopProduct[]> {
  const { data, error } = await db
    .from("shop_products")
    .select(
      "id, school_id, category_id, name, sku, product_type, description, price, stock_qty, image_url, is_digital, status, is_archived",
    )
    .eq("school_id", schoolId)
    .eq("status", "active")
    .eq("is_archived", false)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ShopProduct[];
}

export async function listCategories(schoolId: string): Promise<ShopCategory[]> {
  const { data, error } = await db
    .from("shop_categories")
    .select("id, school_id, name, description, is_archived")
    .eq("school_id", schoolId)
    .eq("is_archived", false)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ShopCategory[];
}

export async function listCartItems(userId: string, schoolId: string): Promise<ShopCartItem[]> {
  const { data, error } = await db
    .from("shop_cart_items")
    .select(
      "id, school_id, user_id, product_id, quantity, product:shop_products(id, school_id, category_id, name, sku, product_type, description, price, stock_qty, image_url, is_digital, status, is_archived)",
    )
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: ShopCartItem & { product?: ShopProduct | ShopProduct[] | null }) => ({
    ...row,
    product: Array.isArray(row.product) ? (row.product[0] ?? null) : (row.product ?? null),
  }));
}

export async function addToCart(params: {
  schoolId: string;
  userId: string;
  productId: string;
  quantity?: number;
}) {
  const qty = Math.max(1, params.quantity ?? 1);
  const { data: existing } = await db
    .from("shop_cart_items")
    .select("id, quantity")
    .eq("user_id", params.userId)
    .eq("product_id", params.productId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db
      .from("shop_cart_items")
      .update({ quantity: Number(existing.quantity) + qty, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("shop_cart_items").insert({
    school_id: params.schoolId,
    user_id: params.userId,
    product_id: params.productId,
    quantity: qty,
  });
  if (error) throw error;
}

export async function updateCartQuantity(cartItemId: string, quantity: number) {
  if (quantity <= 0) {
    const { error } = await db.from("shop_cart_items").delete().eq("id", cartItemId);
    if (error) throw error;
    return;
  }
  const { error } = await db
    .from("shop_cart_items")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", cartItemId);
  if (error) throw error;
}

export async function removeCartItem(cartItemId: string) {
  const { error } = await db.from("shop_cart_items").delete().eq("id", cartItemId);
  if (error) throw error;
}

export async function listWishlistIds(userId: string, schoolId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("shop_wishlists")
    .select("product_id")
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { product_id: string }) => r.product_id));
}

export async function toggleWishlist(params: {
  schoolId: string;
  userId: string;
  productId: string;
  currentlySaved: boolean;
}) {
  if (params.currentlySaved) {
    const { error } = await db
      .from("shop_wishlists")
      .delete()
      .eq("user_id", params.userId)
      .eq("product_id", params.productId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("shop_wishlists").insert({
    school_id: params.schoolId,
    user_id: params.userId,
    product_id: params.productId,
  });
  if (error) throw error;
}

export async function listMyOrders(userId: string, schoolId: string): Promise<ShopOrder[]> {
  const { data, error } = await db
    .from("shop_orders")
    .select(
      "id, school_id, order_number, customer_name, customer_phone, customer_email, student_id, buyer_user_id, portal_role, subtotal, discount, total, payment_status, fulfillment_status, fulfillment_method, shipping_address, coupon_code, notes, created_at",
    )
    .eq("school_id", schoolId)
    .eq("buyer_user_id", userId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const orders = (data ?? []) as ShopOrder[];
  if (!orders.length) return [];

  const ids = orders.map((o) => o.id);
  const { data: items, error: itemsError } = await db
    .from("shop_order_items")
    .select("id, order_id, product_id, product_name, quantity, unit_price, line_total")
    .in("order_id", ids);
  if (itemsError) throw itemsError;

  const byOrder = new Map<string, ShopOrderItem[]>();
  for (const item of (items ?? []) as ShopOrderItem[]) {
    const list = byOrder.get(item.order_id) ?? [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }

  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { data, error } = await db.rpc("place_shop_order", {
    p_school_id: input.schoolId,
    p_items: input.items,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone ?? null,
    p_customer_email: input.customerEmail ?? null,
    p_student_id: input.studentId ?? null,
    p_portal_role: input.portalRole,
    p_fulfillment_method: input.fulfillmentMethod ?? "pickup",
    p_shipping_address: input.shippingAddress ?? null,
    p_coupon_code: input.couponCode ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as PlaceOrderResult;
}

export async function fetchStudentForUser(userId: string) {
  const { data } = await supabase
    .from("students")
    .select("id, full_name, admission_number, school_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data as {
    id: string;
    full_name: string;
    admission_number: string | null;
    school_id: string;
  } | null;
}

export async function fetchParentChildren(parentUserId: string) {
  const { data: links } = await supabase
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", parentUserId);
  const ids = (links ?? []).map((l) => l.student_id as string).filter(Boolean);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("students")
    .select("id, full_name, admission_number")
    .in("id", ids)
    .order("full_name");
  return (data ?? []) as { id: string; full_name: string; admission_number: string | null }[];
}
