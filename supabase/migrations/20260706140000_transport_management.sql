-- Transport Management: buses, stops, student assignments, billing sync
-- Run after apply-operations-modules.sql (transport_routes must exist)

-- ---------------------------------------------------------------------------
-- Buses (e.g. School Bus 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  name text NOT NULL,
  vehicle_plate text,
  driver_name text,
  driver_phone text,
  capacity int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_transport_buses_school ON public.transport_buses(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_buses_route ON public.transport_buses(route_id);

-- ---------------------------------------------------------------------------
-- Stops with fare (e.g. Katapor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  fare numeric(12,2) NOT NULL DEFAULT 0 CHECK (fare >= 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, name)
);

CREATE INDEX IF NOT EXISTS idx_transport_stops_school ON public.transport_stops(school_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id);

-- ---------------------------------------------------------------------------
-- Student transport assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_transport_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE RESTRICT,
  stop_id uuid NOT NULL REFERENCES public.transport_stops(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  fare_amount numeric(12,2) NOT NULL DEFAULT 0,
  fee_item_id uuid REFERENCES public.fee_items(id) ON DELETE SET NULL,
  notes text,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_transport_school ON public.student_transport_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_bus ON public.student_transport_assignments(bus_id);
CREATE INDEX IF NOT EXISTS idx_student_transport_stop ON public.student_transport_assignments(stop_id);

-- Migrate legacy route vehicle fields into buses where possible
INSERT INTO public.transport_buses (school_id, route_id, name, vehicle_plate, driver_name, capacity, is_active)
SELECT
  r.school_id,
  r.id,
  coalesce(nullif(trim(r.name), ''), 'Bus') || coalesce(' (' || nullif(trim(r.vehicle_plate), '') || ')', ''),
  r.vehicle_plate,
  r.driver_name,
  r.capacity,
  true
FROM public.transport_routes r
WHERE coalesce(nullif(trim(r.vehicle_plate), ''), nullif(trim(r.driver_name), '')) IS NOT NULL
ON CONFLICT (school_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.transport_buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transport_assignments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transport_buses', 'transport_stops', 'student_transport_assignments']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_school_rw ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_school_rw ON public.%I FOR ALL USING (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      ) WITH CHECK (
        school_id = public.get_user_school_id(auth.uid())
        OR public.has_role(auth.uid(), ''super_admin''::app_role)
      )',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Billing: sync transport fare to fee_items + fee_assignments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_transport_fee_category(p_school_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.fee_categories
  WHERE school_id = p_school_id AND lower(name) = 'transport'
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.fee_categories (school_id, name, description)
    VALUES (p_school_id, 'Transport', 'School bus transport fees')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_transport_billing_for_assignment(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a public.student_transport_assignments%ROWTYPE;
  v_bus public.transport_buses%ROWTYPE;
  v_stop public.transport_stops%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_term_id uuid;
  v_category_id uuid;
  v_fee_item_id uuid;
  v_description text;
BEGIN
  SELECT * INTO v_a FROM public.student_transport_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Assignment not found');
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = v_a.student_id;
  SELECT * INTO v_bus FROM public.transport_buses WHERE id = v_a.bus_id;
  SELECT * INTO v_stop FROM public.transport_stops WHERE id = v_a.stop_id;

  IF v_a.status = 'inactive' OR v_a.fare_amount <= 0 THEN
    IF v_a.fee_item_id IS NOT NULL THEN
      DELETE FROM public.fee_assignments
      WHERE fee_item_id = v_a.fee_item_id AND student_id = v_a.student_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'billing', 'skipped_inactive');
  END IF;

  SELECT t.id INTO v_term_id
  FROM public.terms t
  WHERE t.school_id = v_a.school_id AND t.is_current = true
  ORDER BY t.start_date DESC
  LIMIT 1;

  IF v_term_id IS NULL THEN
    SELECT t.id INTO v_term_id
    FROM public.terms t
    WHERE t.school_id = v_a.school_id
    ORDER BY t.start_date DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_term_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'billing', 'no_term', 'message', 'Assignment saved; add an academic term to sync billing.');
  END IF;

  v_category_id := public.ensure_transport_fee_category(v_a.school_id);
  v_description := format('Transport — %s (%s)', v_stop.name, v_bus.name);

  IF v_a.fee_item_id IS NOT NULL THEN
    UPDATE public.fee_items
    SET amount = v_a.fare_amount,
        category_id = v_category_id,
        term_id = v_term_id,
        updated_at = now()
    WHERE id = v_a.fee_item_id;
    v_fee_item_id := v_a.fee_item_id;
  ELSE
    INSERT INTO public.fee_items (school_id, category_id, term_id, amount, currency)
    VALUES (v_a.school_id, v_category_id, v_term_id, v_a.fare_amount, 'GHS')
    RETURNING id INTO v_fee_item_id;

    UPDATE public.student_transport_assignments
    SET fee_item_id = v_fee_item_id, updated_at = now()
    WHERE id = p_assignment_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fee_assignments
    WHERE fee_item_id = v_fee_item_id AND student_id = v_a.student_id
  ) THEN
    NULL;
  ELSE
    INSERT INTO public.fee_assignments (school_id, fee_item_id, student_id)
    VALUES (v_a.school_id, v_fee_item_id, v_a.student_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'billing', 'synced',
    'fee_item_id', v_fee_item_id,
    'description', v_description
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_student_transport_assignment(
  p_student_id uuid,
  p_bus_id uuid,
  p_stop_id uuid,
  p_status text DEFAULT 'active',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_bus public.transport_buses%ROWTYPE;
  v_stop public.transport_stops%ROWTYPE;
  v_fare numeric(12,2);
  v_assignment_id uuid;
  v_billing jsonb;
BEGIN
  IF p_status NOT IN ('active', 'inactive') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student not found');
  END IF;

  IF NOT (
    public.is_platform_super_admin()
    OR (
      v_student.school_id = public.get_user_school_id(auth.uid())
      AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_bus FROM public.transport_buses WHERE id = p_bus_id AND school_id = v_student.school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bus not found');
  END IF;

  SELECT * INTO v_stop FROM public.transport_stops WHERE id = p_stop_id AND school_id = v_student.school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stop not found');
  END IF;

  IF v_bus.route_id IS NOT NULL AND v_stop.route_id IS DISTINCT FROM v_bus.route_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stop does not belong to the bus route');
  END IF;

  v_fare := v_stop.fare;

  INSERT INTO public.student_transport_assignments (
    school_id, student_id, bus_id, stop_id, status, fare_amount, notes, assigned_by
  ) VALUES (
    v_student.school_id, p_student_id, p_bus_id, p_stop_id, p_status, v_fare, p_notes, auth.uid()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    bus_id = EXCLUDED.bus_id,
    stop_id = EXCLUDED.stop_id,
    status = EXCLUDED.status,
    fare_amount = EXCLUDED.fare_amount,
    notes = EXCLUDED.notes,
    assigned_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_assignment_id;

  v_billing := public.sync_transport_billing_for_assignment(v_assignment_id);

  INSERT INTO public.audit_logs (school_id, action_type, entity_type, entity_id, performed_by, module, details)
  VALUES (
    v_student.school_id,
    'student_transport_assigned',
    'student_transport',
    v_assignment_id,
    auth.uid(),
    'transport',
    jsonb_build_object(
      'student_id', p_student_id,
      'bus_id', p_bus_id,
      'stop_id', p_stop_id,
      'status', p_status,
      'fare_amount', v_fare,
      'billing', v_billing
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'assignment_id', v_assignment_id,
    'fare_amount', v_fare,
    'billing', v_billing
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_transport_info(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT
    sta.id,
    sta.status,
    sta.fare_amount,
    sta.notes,
    sta.created_at,
    sta.updated_at,
    tb.id AS bus_id,
    tb.name AS bus_name,
    tb.vehicle_plate,
    tb.driver_name,
    ts.id AS stop_id,
    ts.name AS stop_name,
    tr.name AS route_name
  INTO v_row
  FROM public.student_transport_assignments sta
  JOIN public.transport_buses tb ON tb.id = sta.bus_id
  JOIN public.transport_stops ts ON ts.id = sta.stop_id
  LEFT JOIN public.transport_routes tr ON tr.id = ts.route_id
  WHERE sta.student_id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('assigned', false);
  END IF;

  RETURN jsonb_build_object(
    'assigned', true,
    'id', v_row.id,
    'status', v_row.status,
    'fare_amount', v_row.fare_amount,
    'notes', v_row.notes,
    'bus_id', v_row.bus_id,
    'bus_name', v_row.bus_name,
    'vehicle_plate', v_row.vehicle_plate,
    'driver_name', v_row.driver_name,
    'stop_id', v_row.stop_id,
    'stop_name', v_row.stop_name,
    'route_name', v_row.route_name,
    'pickup_location', v_row.stop_name,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_transport_assignments_report(p_school_id uuid)
RETURNS TABLE (
  student_id uuid,
  student_name text,
  admission_number text,
  class_name text,
  bus_name text,
  route_name text,
  stop_name text,
  fare_amount numeric,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_platform_super_admin()
    OR (
      p_school_id = public.get_user_school_id(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'accountant'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    coalesce(p.full_name, s.full_name, '—')::text,
    coalesce(s.admission_number, s.admission_no, '—')::text,
    coalesce(c.name, '—')::text,
    tb.name,
    coalesce(tr.name, '—')::text,
    ts.name,
    sta.fare_amount,
    sta.status
  FROM public.student_transport_assignments sta
  JOIN public.students s ON s.id = sta.student_id
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.classes c ON c.id = s.class_id
  JOIN public.transport_buses tb ON tb.id = sta.bus_id
  JOIN public.transport_stops ts ON ts.id = sta.stop_id
  LEFT JOIN public.transport_routes tr ON tr.id = ts.route_id
  WHERE sta.school_id = p_school_id
  ORDER BY tb.name, ts.name, coalesce(p.full_name, s.full_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_student_transport_assignment(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_transport_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transport_assignments_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_transport_billing_for_assignment(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
