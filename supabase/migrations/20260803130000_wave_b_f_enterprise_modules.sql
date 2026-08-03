-- Wave B–F: Administration, Domestics, Health, Finance extras, Shop, Laboratory

-- ========== B: Departments ==========
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  head_name text,
  head_staff_id uuid,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX IF NOT EXISTS idx_departments_school ON public.departments(school_id);

-- ========== B: Staff employees ==========
CREATE TABLE IF NOT EXISTS public.staff_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id text NOT NULL,
  full_name text NOT NULL,
  gender text,
  date_of_birth date,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position text,
  qualification text,
  experience_years numeric(5,1),
  employment_type text DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern', 'volunteer')),
  salary numeric(14,2),
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  documents_url text,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employment_status text NOT NULL DEFAULT 'active'
    CHECK (employment_status IN ('active', 'on_leave', 'suspended', 'terminated', 'retired', 'inactive', 'archived')),
  hire_date date,
  termination_date date,
  contract_end_date date,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_employees_school ON public.staff_employees(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_employees_dept ON public.staff_employees(department_id);

-- ========== B: Academic calendar events ==========
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'event'
    CHECK (event_type IN (
      'holiday', 'public_holiday', 'exam', 'mid_semester', 'event',
      'admission', 'registration', 'fee_deadline', 'graduation',
      'vacation', 'semester_start', 'semester_end', 'other'
    )),
  academic_year text,
  semester text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT true,
  description text,
  location text,
  is_published boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_school ON public.calendar_events(school_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON public.calendar_events(school_id, start_at);

-- ========== C: Behavior reports ==========
CREATE TABLE IF NOT EXISTS public.behavior_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'negative'
    CHECK (report_type IN ('positive', 'negative', 'warning', 'disciplinary', 'merit', 'demerit', 'incident')),
  title text NOT NULL,
  description text,
  teacher_remark text,
  behavior_score integer,
  merits integer NOT NULL DEFAULT 0,
  demerits integer NOT NULL DEFAULT 0,
  action_taken text,
  follow_up text,
  attachment_url text,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  reported_by_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'closed', 'archived')),
  parent_notified boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_behavior_reports_school ON public.behavior_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_behavior_reports_student ON public.behavior_reports(student_id);

-- ========== C: Exeats ==========
CREATE TABLE IF NOT EXISTS public.exeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exeat_type text NOT NULL DEFAULT 'day'
    CHECK (exeat_type IN ('day', 'weekend', 'medical', 'emergency')),
  reason text NOT NULL,
  destination text,
  departure_at timestamptz NOT NULL,
  return_at timestamptz,
  actual_checkout_at timestamptz,
  actual_checkin_at timestamptz,
  guardian_approved boolean NOT NULL DEFAULT false,
  parent_approved boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  qr_code text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exeats_school ON public.exeats(school_id);
CREATE INDEX IF NOT EXISTS idx_exeats_student ON public.exeats(student_id);

-- ========== D: Health ==========
CREATE TABLE IF NOT EXISTS public.student_health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  blood_group text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_relationship text,
  medical_conditions text,
  allergies text,
  current_medication text,
  disabilities text,
  doctor_name text,
  hospital text,
  insurance text,
  vaccination_history text,
  height_cm numeric(6,2),
  weight_kg numeric(6,2),
  vision text,
  hearing text,
  medical_notes text,
  health_status text NOT NULL DEFAULT 'clear'
    CHECK (health_status IN ('clear', 'monitor', 'critical', 'cleared_for_sports', 'restricted')),
  health_clearance boolean NOT NULL DEFAULT true,
  critical_alert boolean NOT NULL DEFAULT false,
  documents_url text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_student_health_school ON public.student_health_profiles(school_id);

CREATE TABLE IF NOT EXISTS public.student_health_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  health_profile_id uuid NOT NULL REFERENCES public.student_health_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visit_type text NOT NULL DEFAULT 'clinic'
    CHECK (visit_type IN ('clinic', 'first_aid', 'appointment', 'emergency', 'follow_up')),
  complaint text,
  treatment text,
  outcome text,
  recorded_by_name text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_health_visits_profile ON public.student_health_visits(health_profile_id);

-- ========== E: Finance extras ==========
CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  supplier text,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  receipt_url text,
  department text,
  is_recurring boolean NOT NULL DEFAULT false,
  budget_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'archived')),
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_school ON public.finance_expenses(school_id);

CREATE TABLE IF NOT EXISTS public.finance_other_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  income_type text NOT NULL DEFAULT 'miscellaneous'
    CHECK (income_type IN (
      'donation', 'fundraising', 'rental', 'event', 'shop_sales',
      'interest', 'miscellaneous'
    )),
  title text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  income_date date NOT NULL DEFAULT CURRENT_DATE,
  source_name text,
  attachment_url text,
  notes text,
  status text NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'verified', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_other_income_school ON public.finance_other_income(school_id);

CREATE TABLE IF NOT EXISTS public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  department text,
  academic_year text,
  planned_amount numeric(14,2) NOT NULL DEFAULT 0,
  spent_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'closed', 'archived')),
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_budgets_school ON public.finance_budgets(school_id);

-- ========== F: School shop ==========
CREATE TABLE IF NOT EXISTS public.shop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.shop_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  product_type text NOT NULL DEFAULT 'general'
    CHECK (product_type IN (
      'uniform', 'book', 'stationery', 'sports', 'accessory', 'digital', 'general'
    )),
  description text,
  price numeric(14,2) NOT NULL DEFAULT 0,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  stock_qty integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 5,
  image_url text,
  is_digital boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_products_school ON public.shop_products(school_id);

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  fulfillment_status text NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'processing', 'ready', 'picked_up', 'shipped', 'delivered', 'cancelled', 'returned')),
  fulfillment_method text NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_method IN ('pickup', 'shipping')),
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, order_number)
);
CREATE INDEX IF NOT EXISTS idx_shop_orders_school ON public.shop_orders(school_id);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON public.shop_order_items(order_id);

-- ========== F: Laboratory ==========
CREATE TABLE IF NOT EXISTS public.lab_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  lab_type text NOT NULL DEFAULT 'science'
    CHECK (lab_type IN ('science', 'computer', 'language', 'other')),
  location text,
  capacity integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive', 'archived')),
  safety_notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_facilities_school ON public.lab_facilities(school_id);

CREATE TABLE IF NOT EXISTS public.lab_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES public.lab_facilities(id) ON DELETE SET NULL,
  name text NOT NULL,
  asset_tag text,
  quantity integer NOT NULL DEFAULT 1,
  condition text NOT NULL DEFAULT 'good'
    CHECK (condition IN ('good', 'fair', 'poor', 'damaged', 'retired')),
  is_consumable boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'checked_out', 'maintenance', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_school ON public.lab_equipment(school_id);

CREATE TABLE IF NOT EXISTS public.lab_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.lab_facilities(id) ON DELETE CASCADE,
  title text NOT NULL,
  booked_by_name text,
  class_name text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  purpose text,
  attendance_count integer,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'archived')),
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_bookings_school ON public.lab_bookings(school_id);

-- ========== RLS ==========
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments', 'staff_employees', 'calendar_events',
    'behavior_reports', 'exeats',
    'student_health_profiles', 'student_health_visits',
    'finance_expenses', 'finance_other_income', 'finance_budgets',
    'shop_categories', 'shop_products', 'shop_orders', 'shop_order_items',
    'lab_facilities', 'lab_equipment', 'lab_bookings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
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
