-- School shop e-commerce: cart, wishlist, coupons, buyer tracking

ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_role text,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_shop_orders_buyer ON public.shop_orders(buyer_user_id);

CREATE TABLE IF NOT EXISTS public.shop_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_cart_user ON public.shop_cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_cart_school ON public.shop_cart_items(school_id);

CREATE TABLE IF NOT EXISTS public.shop_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_wishlists_user ON public.shop_wishlists(user_id);

CREATE TABLE IF NOT EXISTS public.shop_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent'
    CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(14,2) NOT NULL DEFAULT 0,
  min_order_total numeric(14,2) NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_shop_coupons_school ON public.shop_coupons(school_id);

CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_product ON public.shop_reviews(product_id);

ALTER TABLE public.shop_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;

-- Harden catalog: school members read; only admins/accountants write
DROP POLICY IF EXISTS shop_products_school_rw ON public.shop_products;
DROP POLICY IF EXISTS shop_products_portal_read ON public.shop_products;
DROP POLICY IF EXISTS shop_products_select ON public.shop_products;
DROP POLICY IF EXISTS shop_products_write ON public.shop_products;
CREATE POLICY shop_products_select ON public.shop_products FOR SELECT USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY shop_products_write ON public.shop_products FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);

DROP POLICY IF EXISTS shop_categories_school_rw ON public.shop_categories;
DROP POLICY IF EXISTS shop_categories_portal_read ON public.shop_categories;
DROP POLICY IF EXISTS shop_categories_select ON public.shop_categories;
DROP POLICY IF EXISTS shop_categories_write ON public.shop_categories;
CREATE POLICY shop_categories_select ON public.shop_categories FOR SELECT USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY shop_categories_write ON public.shop_categories FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);

DROP POLICY IF EXISTS shop_orders_school_rw ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_buyer ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_buyer_insert ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_select ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_insert ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_update ON public.shop_orders;
DROP POLICY IF EXISTS shop_orders_delete ON public.shop_orders;
CREATE POLICY shop_orders_select ON public.shop_orders FOR SELECT USING (
  buyer_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);
CREATE POLICY shop_orders_insert ON public.shop_orders FOR INSERT WITH CHECK (
  (
    buyer_user_id = auth.uid()
    AND school_id = public.get_user_school_id(auth.uid())
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'accountant'::app_role)
);
CREATE POLICY shop_orders_update ON public.shop_orders FOR UPDATE USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);
CREATE POLICY shop_orders_delete ON public.shop_orders FOR DELETE USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);

DROP POLICY IF EXISTS shop_order_items_school_rw ON public.shop_order_items;
DROP POLICY IF EXISTS shop_order_items_buyer ON public.shop_order_items;
DROP POLICY IF EXISTS shop_order_items_buyer_insert ON public.shop_order_items;
DROP POLICY IF EXISTS shop_order_items_select ON public.shop_order_items;
DROP POLICY IF EXISTS shop_order_items_insert ON public.shop_order_items;
DROP POLICY IF EXISTS shop_order_items_write_admin ON public.shop_order_items;
CREATE POLICY shop_order_items_select ON public.shop_order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.shop_orders o
    WHERE o.id = order_id
      AND (
        o.buyer_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR (
          o.school_id = public.get_user_school_id(auth.uid())
          AND (
            public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'accountant'::app_role)
          )
        )
      )
  )
);
CREATE POLICY shop_order_items_insert ON public.shop_order_items FOR INSERT WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY shop_order_items_write_admin ON public.shop_order_items FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);

DROP POLICY IF EXISTS shop_cart_items_own ON public.shop_cart_items;
CREATE POLICY shop_cart_items_own ON public.shop_cart_items FOR ALL USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS shop_wishlists_own ON public.shop_wishlists;
CREATE POLICY shop_wishlists_own ON public.shop_wishlists FOR ALL USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS shop_coupons_school_rw ON public.shop_coupons;
DROP POLICY IF EXISTS shop_coupons_read ON public.shop_coupons;
DROP POLICY IF EXISTS shop_coupons_select ON public.shop_coupons;
DROP POLICY IF EXISTS shop_coupons_write ON public.shop_coupons;
CREATE POLICY shop_coupons_select ON public.shop_coupons FOR SELECT USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
CREATE POLICY shop_coupons_write ON public.shop_coupons FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
) WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    school_id = public.get_user_school_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'accountant'::app_role)
    )
  )
);

DROP POLICY IF EXISTS shop_reviews_school_rw ON public.shop_reviews;
CREATE POLICY shop_reviews_school_rw ON public.shop_reviews FOR ALL USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
) WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Place order RPC: atomic stock decrement + order create
CREATE OR REPLACE FUNCTION public.place_shop_order(
  p_school_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_portal_role text DEFAULT NULL,
  p_fulfillment_method text DEFAULT 'pickup',
  p_shipping_address text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_qty int;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_coupon record;
  v_line_total numeric(14,2);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.get_user_school_id(v_uid) IS DISTINCT FROM p_school_id
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT * INTO v_product FROM public.shop_products
    WHERE id = (v_item->>'product_id')::uuid
      AND school_id = p_school_id
      AND status = 'active'
      AND NOT is_archived
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    IF v_product.stock_qty < v_qty AND NOT v_product.is_digital THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.shop_coupons
    WHERE school_id = p_school_id
      AND upper(code) = upper(trim(p_coupon_code))
      AND status = 'active'
      AND NOT is_archived
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
      AND (max_uses IS NULL OR used_count < max_uses);
    IF FOUND AND v_subtotal >= COALESCE(v_coupon.min_order_total, 0) THEN
      IF v_coupon.discount_type = 'percent' THEN
        v_discount := round(v_subtotal * (v_coupon.discount_value / 100.0), 2);
      ELSE
        v_discount := least(v_coupon.discount_value, v_subtotal);
      END IF;
      UPDATE public.shop_coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;
    END IF;
  END IF;

  v_total := greatest(0, v_subtotal - v_discount);
  v_order_number := 'SHP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.shop_orders (
    school_id, order_number, customer_name, customer_phone, customer_email,
    student_id, buyer_user_id, portal_role, subtotal, discount, total,
    payment_status, fulfillment_status, fulfillment_method, shipping_address,
    coupon_code, notes, created_by
  ) VALUES (
    p_school_id, v_order_number, p_customer_name, p_customer_phone, p_customer_email,
    p_student_id, v_uid, p_portal_role, v_subtotal, v_discount, v_total,
    'unpaid', 'pending', COALESCE(p_fulfillment_method, 'pickup'), p_shipping_address,
    NULLIF(trim(COALESCE(p_coupon_code, '')), ''), p_notes, v_uid
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT * INTO v_product FROM public.shop_products
    WHERE id = (v_item->>'product_id')::uuid AND school_id = p_school_id;
    v_line_total := v_product.price * v_qty;
    INSERT INTO public.shop_order_items (
      school_id, order_id, product_id, product_name, quantity, unit_price, line_total
    ) VALUES (
      p_school_id, v_order_id, v_product.id, v_product.name, v_qty, v_product.price, v_line_total
    );
    IF NOT v_product.is_digital THEN
      UPDATE public.shop_products
      SET stock_qty = stock_qty - v_qty, updated_at = now()
      WHERE id = v_product.id;
    END IF;
  END LOOP;

  DELETE FROM public.shop_cart_items WHERE user_id = v_uid AND school_id = p_school_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_shop_order(
  uuid, jsonb, text, text, text, uuid, text, text, text, text, text
) TO authenticated;
