-- Allow school admins to save Paystack settings without Edge Function (public keys + optional secret column)
DROP POLICY IF EXISTS "school admins manage payment gateway configs" ON public.tenant_payment_gateway_configs;
CREATE POLICY "school admins manage payment gateway configs"
  ON public.tenant_payment_gateway_configs
  FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

NOTIFY pgrst, 'reload schema';
