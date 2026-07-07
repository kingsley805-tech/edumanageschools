-- Hostel Management: full module (hostels, rooms, beds, allocations, payments)
-- Run after apply-operations-modules.sql or apply-hostel-tables.sql

-- ---------------------------------------------------------------------------
-- Extend hostel_blocks → hostels
-- ---------------------------------------------------------------------------
ALTER TABLE public.hostel_blocks
  ADD COLUMN IF NOT EXISTS hostel_type text,
  ADD COLUMN IF NOT EXISTS warden_name text,
  ADD COLUMN IF NOT EXISTS warden_phone text,
  ADD COLUMN IF NOT EXISTS warden_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.hostel_blocks
SET hostel_type = CASE
  WHEN lower(coalesce(gender, '')) IN ('male', 'boys', 'boy') THEN 'boys'
  WHEN lower(coalesce(gender, '')) IN ('female', 'girls', 'girl') THEN 'girls'
  ELSE 'mixed'
END
WHERE hostel_type IS NULL;

-- ---------------------------------------------------------------------------
-- Extend hostel_rooms
-- ---------------------------------------------------------------------------
ALTER TABLE public.hostel_rooms
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS wing text,
  ADD COLUMN IF NOT EXISTS room_type text NOT NULL DEFAULT 'dormitory',
  ADD COLUMN IF NOT EXISTS monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS term_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Beds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hostel_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  bed_number text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, bed_number)
);

CREATE INDEX IF NOT EXISTS idx_hostel_beds_school ON public.hostel_beds(school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_room ON public.hostel_beds(room_id);

-- ---------------------------------------------------------------------------
-- Student allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hostel_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE RESTRICT,
  room_id uuid NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE RESTRICT,
  bed_id uuid REFERENCES public.hostel_beds(id) ON DELETE SET NULL,
  check_in_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_check_out_date date,
  actual_check_out_date date,
  fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  allocation_status text NOT NULL DEFAULT 'active' CHECK (allocation_status IN ('active', 'pending', 'checked_out')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  notes text,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hostel_allocations_active_student
  ON public.hostel_allocations(student_id)
  WHERE allocation_status IN ('active', 'pending');

CREATE INDEX IF NOT EXISTS idx_hostel_allocations_school ON public.hostel_allocations(school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_room ON public.hostel_allocations(room_id);

-- ---------------------------------------------------------------------------
-- Fee payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hostel_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  allocation_id uuid NOT NULL REFERENCES public.hostel_allocations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  receipt_number text,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hostel_payments_school ON public.hostel_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_payments_allocation ON public.hostel_payments(allocation_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hostel_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hostel_beds', 'hostel_allocations', 'hostel_payments']
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
-- Sync occupancy counts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_hostel_room_occupancy(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_occupied int;
  v_capacity int;
BEGIN
  SELECT COUNT(*)::int INTO v_occupied
  FROM public.hostel_allocations
  WHERE room_id = p_room_id AND allocation_status IN ('active', 'pending');

  SELECT capacity INTO v_capacity FROM public.hostel_rooms WHERE id = p_room_id;

  UPDATE public.hostel_rooms
  SET
    occupied = v_occupied,
    room_status = CASE
      WHEN v_occupied >= coalesce(v_capacity, 0) AND coalesce(v_capacity, 0) > 0 THEN 'full'
      WHEN room_status = 'maintenance' THEN 'maintenance'
      ELSE 'available'
    END,
    updated_at = now()
  WHERE id = p_room_id;

  UPDATE public.hostel_beds b
  SET status = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.hostel_allocations a
      WHERE a.bed_id = b.id AND a.allocation_status IN ('active', 'pending')
    ) THEN 'occupied'
    WHEN b.status = 'maintenance' THEN 'maintenance'
    ELSE 'available'
  END,
  updated_at = now()
  WHERE b.room_id = p_room_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard stats RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hostel_dashboard_stats(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hostels int;
  v_rooms int;
  v_capacity int;
  v_occupied int;
  v_students int;
  v_male int;
  v_female int;
  v_collected numeric;
  v_outstanding numeric;
BEGIN
  IF NOT (
    public.is_platform_super_admin()
    OR p_school_id = public.get_user_school_id(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*)::int INTO v_hostels FROM public.hostel_blocks WHERE school_id = p_school_id AND status = 'active';
  SELECT COUNT(*)::int, coalesce(SUM(capacity), 0)::int, coalesce(SUM(occupied), 0)::int
  INTO v_rooms, v_capacity, v_occupied
  FROM public.hostel_rooms WHERE school_id = p_school_id;

  SELECT COUNT(*)::int INTO v_students
  FROM public.hostel_allocations
  WHERE school_id = p_school_id AND allocation_status IN ('active', 'pending');

  SELECT
    COUNT(*) FILTER (WHERE lower(coalesce(s.gender, '')) IN ('male', 'm', 'boy', 'boys')),
    COUNT(*) FILTER (WHERE lower(coalesce(s.gender, '')) IN ('female', 'f', 'girl', 'girls'))
  INTO v_male, v_female
  FROM public.hostel_allocations a
  JOIN public.students s ON s.id = a.student_id
  WHERE a.school_id = p_school_id AND a.allocation_status IN ('active', 'pending');

  SELECT coalesce(SUM(amount_paid), 0), coalesce(SUM(GREATEST(fee_amount - amount_paid, 0)), 0)
  INTO v_collected, v_outstanding
  FROM public.hostel_allocations
  WHERE school_id = p_school_id AND allocation_status IN ('active', 'pending', 'checked_out');

  RETURN jsonb_build_object(
    'total_hostels', v_hostels,
    'total_rooms', v_rooms,
    'total_bed_capacity', v_capacity,
    'occupied_beds', v_occupied,
    'available_beds', GREATEST(v_capacity - v_occupied, 0),
    'total_students', v_students,
    'male_students', coalesce(v_male, 0),
    'female_students', coalesce(v_female, 0),
    'fee_collected', v_collected,
    'outstanding_fees', v_outstanding,
    'occupancy_rate', CASE WHEN v_capacity > 0 THEN round((v_occupied::numeric / v_capacity) * 100, 1) ELSE 0 END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Upsert allocation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_hostel_allocation(
  p_student_id uuid,
  p_block_id uuid,
  p_room_id uuid,
  p_bed_id uuid DEFAULT NULL,
  p_check_in_date date DEFAULT CURRENT_DATE,
  p_expected_check_out_date date DEFAULT NULL,
  p_fee_amount numeric DEFAULT NULL,
  p_allocation_status text DEFAULT 'active',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_room public.hostel_rooms%ROWTYPE;
  v_fee numeric(12,2);
  v_id uuid;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student not found');
  END IF;

  IF NOT (
    public.is_platform_super_admin()
    OR (v_student.school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO v_room FROM public.hostel_rooms WHERE id = p_room_id AND school_id = v_student.school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Room not found');
  END IF;

  IF v_room.occupied >= v_room.capacity AND v_room.room_status = 'full' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Room is full');
  END IF;

  v_fee := coalesce(p_fee_amount, v_room.term_fee, v_room.monthly_fee, 0);

  INSERT INTO public.hostel_allocations (
    school_id, student_id, block_id, room_id, bed_id,
    check_in_date, expected_check_out_date, fee_amount,
    allocation_status, payment_status, notes, assigned_by
  ) VALUES (
    v_student.school_id, p_student_id, p_block_id, p_room_id, p_bed_id,
    p_check_in_date, p_expected_check_out_date, v_fee,
    p_allocation_status,
    CASE WHEN v_fee <= 0 THEN 'paid' ELSE 'unpaid' END,
    p_notes, auth.uid()
  )
  ON CONFLICT (student_id) WHERE (allocation_status IN ('active', 'pending'))
  DO UPDATE SET
    block_id = EXCLUDED.block_id,
    room_id = EXCLUDED.room_id,
    bed_id = EXCLUDED.bed_id,
    check_in_date = EXCLUDED.check_in_date,
    expected_check_out_date = EXCLUDED.expected_check_out_date,
    fee_amount = EXCLUDED.fee_amount,
    allocation_status = EXCLUDED.allocation_status,
    notes = EXCLUDED.notes,
    assigned_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.sync_hostel_room_occupancy(p_room_id);

  RETURN jsonb_build_object('ok', true, 'allocation_id', v_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Record payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_hostel_payment(
  p_allocation_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_receipt_number text DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a public.hostel_allocations%ROWTYPE;
  v_receipt text;
BEGIN
  SELECT * INTO v_a FROM public.hostel_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  IF NOT (
    public.is_platform_super_admin()
    OR (v_a.school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid amount');
  END IF;

  v_receipt := coalesce(nullif(trim(p_receipt_number), ''), 'HST-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.hostel_payments (
    school_id, allocation_id, student_id, amount, payment_date, payment_method, receipt_number, notes, recorded_by
  ) VALUES (
    v_a.school_id, p_allocation_id, v_a.student_id, p_amount, p_payment_date, p_payment_method, v_receipt, p_notes, auth.uid()
  );

  UPDATE public.hostel_allocations
  SET
    amount_paid = amount_paid + p_amount,
    payment_status = CASE
      WHEN amount_paid + p_amount >= fee_amount THEN 'paid'
      WHEN amount_paid + p_amount > 0 THEN 'partial'
      ELSE 'unpaid'
    END,
    updated_at = now()
  WHERE id = p_allocation_id;

  RETURN jsonb_build_object('ok', true, 'receipt_number', v_receipt);
END;
$$;

-- ---------------------------------------------------------------------------
-- Checkout / remove allocation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkout_hostel_allocation(p_allocation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a public.hostel_allocations%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.hostel_allocations WHERE id = p_allocation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Allocation not found');
  END IF;

  UPDATE public.hostel_allocations
  SET allocation_status = 'checked_out', actual_check_out_date = CURRENT_DATE, updated_at = now()
  WHERE id = p_allocation_id;

  PERFORM public.sync_hostel_room_occupancy(v_a.room_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hostel_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_hostel_allocation(uuid, uuid, uuid, uuid, date, date, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_hostel_payment(uuid, numeric, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_hostel_allocation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_hostel_room_occupancy(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
