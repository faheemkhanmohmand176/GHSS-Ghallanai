-- ============================================================================
-- GHSS GHALANAI · ADMIN EXTENSION SCHEMA · 0003
-- ----------------------------------------------------------------------------
-- Adds the tables required for the new admin dashboard surface:
--   * Achievements (announcements sub-tab)
--   * Fee structures / vouchers / payments
--   * Exam roll sessions + exam roll numbers (1st year & 2nd year)
--   * Timetables + per-class period grid + overrides
--   * Merit list publications (snapshot-style JSONB, school + BISE)
--   * Attendance daily stats (cached aggregates) + thresholds
--   * Site visits (analytics)
--   * Notifications (realtime bell)
--   * Exam seating (rooms, assignments) — optional, schema only
--
-- DESIGN PRINCIPLES (carried over from 0001_schema.sql):
--   * Every table here gets RLS enabled in 0004_admin_rls.sql.
--   * Foreign keys use ON DELETE RESTRICT on student data.
--   * All money is NUMERIC(10, 2) — no floats.
--   * All audit-relevant mutations are covered by audit_row triggers.
--   * Idempotent: every CREATE uses IF NOT EXISTS so this file is re-runnable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ACHIEVEMENTS — announcements sub-tab (Academic / Sports / Art / Science / Other)
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  student_name text not null,
  class text,                                   -- "1st Year" | "2nd Year" | "Faculty" | "School"
  year smallint not null default extract(year from now())::int,
  image_url text,
  category text not null default 'Academic'
    check (category in ('Academic','Sports','Art','Science','Other')),
  is_published boolean not null default true,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_achievements_feed
  on public.achievements (is_published, is_pinned desc, year desc, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- FEE STRUCTURES — per-class+fee_type catalog
-- ---------------------------------------------------------------------------
create table if not exists public.fee_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,                   -- tuition, lab, library, transport, exam, admission, migration, bise, other
  category text not null default 'fee'
    check (category in ('fee','fine','other')),
  default_amount numeric(10, 2) not null default 0,
  is_recurring boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  class_label text not null,                   -- "1st Year" | "2nd Year" (GHSS Ghallanai is 11th & 12th only)
  programme public.programme,                  -- ICS / Pre-Medical / Pre-Engineering / Arts (nullable: applies to all programmes)
  fee_type text not null references public.fee_types(name) on delete restrict,
  label text not null,                          -- human-readable label
  amount numeric(10, 2) not null check (amount >= 0),
  is_optional boolean not null default false,
  is_recurring boolean not null default false,
  frequency text not null default 'one_time'
    check (frequency in ('monthly','quarterly','annual','one_time')),
  is_active boolean not null default true,
  payment_methods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_label, programme, fee_type)
);

create index if not exists idx_fee_structures_class on public.fee_structures (class_label, is_active);

-- ---------------------------------------------------------------------------
-- FEE VOUCHERS — generated bills per student per month/quarter/one-off
-- ---------------------------------------------------------------------------
create table if not exists public.fee_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_number text unique not null,
  student_id uuid not null references public.students (id) on delete restrict,
  class_label text not null,                    -- denormalised snapshot
  programme public.programme,                  -- denormalised snapshot
  month smallint check (month is null or (month between 1 and 12)),
  year smallint not null,
  fee_period text not null default 'one_time'
    check (fee_period in ('monthly','quarterly','one_off')),
  fee_items jsonb not null default '[]'::jsonb, -- [{fee_type, label, amount}]
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  due_date date not null,
  bank_details jsonb not null default '{}'::jsonb,
  status text not null default 'unpaid'
    check (status in ('unpaid','partial','paid','overdue','waived')),
  late_fee numeric(10, 2) not null default 0,
  paid_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fee_vouchers_student on public.fee_vouchers (student_id, year desc, month desc);
create index if not exists idx_fee_vouchers_status on public.fee_vouchers (status, due_date);
create index if not exists idx_fee_vouchers_class on public.fee_vouchers (class_label, year, month);

-- ---------------------------------------------------------------------------
-- FEE PAYMENTS — recorded transactions
-- ---------------------------------------------------------------------------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.fee_vouchers (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash','bank','online','cheque')),
  receipt_number text,
  payment_date date not null default current_date,
  received_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_payments_voucher on public.fee_payments (voucher_id);
create index if not exists idx_fee_payments_student on public.fee_payments (student_id, payment_date desc);

-- Atomic counter for voucher state — recomputes paid_amount and status
create or replace function public.recompute_voucher_state(p_voucher uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_total numeric(10, 2);
  v_paid numeric(10, 2);
  v_due date;
begin
  select total_amount, due_date into v_total, v_due
    from public.fee_vouchers where id = p_voucher;
  select coalesce(sum(amount), 0) into v_paid
    from public.fee_payments where voucher_id = p_voucher;

  update public.fee_vouchers
    set paid_amount = v_paid,
        status = case
          when v_paid = 0 and v_due < current_date then 'overdue'
          when v_paid = 0 then 'unpaid'
          when v_paid < v_total then 'partial'
          else 'paid'
        end
    where id = p_voucher;
end;
$$;

-- Trigger: any insert/update/delete on fee_payments recomputes voucher state
create or replace function public.tg_recompute_voucher()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.recompute_voucher_state(
    coalesce(new.voucher_id, old.voucher_id)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_fee_payments_recompute on public.fee_payments;
create trigger trg_fee_payments_recompute
  after insert or update or delete on public.fee_payments
  for each row execute function public.tg_recompute_voucher();

-- Cron-friendly function: mark overdue vouchers
create or replace function public.mark_overdue_vouchers()
returns void
language sql
security definer set search_path = public
as $$
  update public.fee_vouchers
    set status = 'overdue'
    where status = 'unpaid' and due_date < current_date;
$$;

-- ---------------------------------------------------------------------------
-- TIMETABLES — per-class period grid (Mon-Sat × 8 periods)
-- ---------------------------------------------------------------------------
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  class_label text not null,                   -- "1st Year" | "2nd Year"
  programme public.programme,
  day text not null check (day in ('Mon','Tue','Wed','Thu','Fri','Sat')),
  period_number smallint not null check (period_number between 1 and 8),
  subject text not null,
  teacher_id uuid references public.profiles (id),
  teacher_name text,
  start_time time not null,
  end_time time not null,
  room text,
  meet_link text,
  updated_at timestamptz not null default now(),
  unique (class_label, programme, day, period_number)
);

create index if not exists idx_timetables_class on public.timetables (class_label, programme, day);

create table if not exists public.timetable_overrides (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null,
  class_label text not null,
  programme public.programme,
  day text not null,
  period_number smallint not null check (period_number between 1 and 8),
  subject text,
  original_teacher text,
  substitute_teacher text,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_timetable_overrides_date on public.timetable_overrides (effective_date, class_label);

-- ---------------------------------------------------------------------------
-- EXAM ROLL SESSIONS + EXAM ROLL NUMBERS
-- ---------------------------------------------------------------------------
create table if not exists public.exam_roll_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,                         -- e.g. "Annual Examination 2026"
  exam_year smallint not null,
  exam_term text not null default 'Annual-I'
    check (exam_term in ('Annual-I','Annual-II','Supply')),
  classes text[] not null default '{1st Year,2nd Year}',
  class_order text[] not null default '{1st Year,2nd Year}',
  starting_number integer not null default 100000,
  is_published boolean not null default false,
  publish_at timestamptz,
  countdown_label text not null default 'Exam Roll Numbers will be published in',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_exam_roll_sessions_year on public.exam_roll_sessions (exam_year, exam_term);

create table if not exists public.exam_roll_numbers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_roll_sessions (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  student_name text not null,
  father_name text,
  class_label text not null,                   -- "1st Year" | "2nd Year"
  programme public.programme,
  class_roll_no text,
  exam_roll_no text not null,
  serial_number integer not null,
  created_at timestamptz not null default now(),
  unique (session_id, exam_roll_no),
  unique (session_id, student_id)
);

create index if not exists idx_exam_roll_numbers_session on public.exam_roll_numbers (session_id);
create index if not exists idx_exam_roll_numbers_lookup on public.exam_roll_numbers (exam_roll_no, session_id);

-- ---------------------------------------------------------------------------
-- MERIT LIST PUBLICATIONS — JSONB snapshot for school + BISE
-- (separate from existing `merit_lists` row-per-student table)
-- ---------------------------------------------------------------------------
create table if not exists public.merit_list_publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  class_label text,                             -- "1st Year" | "2nd Year" | "School" | "School-BISE"
  programme public.programme,
  exam_type text not null default 'Annual',
  year smallint not null,
  scope text not null default 'class'
    check (scope in ('class','school','school-bise')),
  is_published boolean not null default false,
  published_at timestamptz,
  publish_at timestamptz,                       -- for scheduled countdown
  theme text not null default 'gold'
    check (theme in ('gold','royal','emerald','rose','violet')),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entries jsonb not null default '[]'::jsonb,   -- snapshot of MeritEntry[]
  total_students integer not null default 0,
  passing_count integer not null default 0,
  highest_percentage numeric(5, 2) not null default 0,
  average_percentage numeric(5, 2) not null default 0,
  schema_version text not null default 'v1.0'
);

create index if not exists idx_merit_publications on public.merit_list_publications
  (is_published, scope, year desc, created_at desc);

-- ---------------------------------------------------------------------------
-- ATTENDANCE DAILY STATS — cached aggregate (refreshed by trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_daily_stats (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  class_label text not null,
  date date not null,
  total_students integer not null default 0,
  present_count integer not null default 0,
  absent_count integer not null default 0,
  late_count integer not null default 0,
  leave_count integer not null default 0,
  attendance_rate numeric(5, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (class_id, date)
);

create index if not exists idx_attendance_stats_class on public.attendance_daily_stats (class_id, date desc);

create table if not exists public.attendance_thresholds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  minimum_percentage numeric(5, 2) not null default 75.00,
  warning_threshold numeric(5, 2) not null default 80.00,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SITE VISITS — analytics (anyone can insert, only authed can read)
-- ---------------------------------------------------------------------------
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  path text not null,
  referrer text,
  user_agent text,
  device text,                                  -- mobile / tablet / desktop
  country text,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_visits_created on public.site_visits (created_at desc);
create index if not exists idx_site_visits_path on public.site_visits (path, created_at desc);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — realtime bell + push queue
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all'
    check (audience in ('all','students','teachers','admins','class')),
  target_class text,
  type text not null,                           -- news, notice, result, fee, attendance, achievement
  title text not null,
  body text,
  link text,
  actor_id uuid references public.profiles (id),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recent on public.notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- EXAM SEATING — optional schema (rooms, assignments) for future expansion
-- ---------------------------------------------------------------------------
create table if not exists public.exam_seating_plans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_roll_sessions (id) on delete cascade,
  title text not null,
  paper_subject text,
  exam_date date,
  classes text[] not null default '{1st Year,2nd Year}',
  status text not null default 'draft'
    check (status in ('draft','generated','published','archived')),
  total_students integer not null default 0,
  total_seated integer not null default 0,
  generated_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_seating_rooms (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.exam_seating_plans (id) on delete cascade,
  name text not null,
  capacity integer not null default 30,
  rows smallint not null default 6,
  cols smallint not null default 5,
  block_layout jsonb not null default '[]'::jsonb,
  invigilator text,
  invigilators text[] not null default '{}',
  notes text
);

create table if not exists public.exam_seating_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.exam_seating_plans (id) on delete cascade,
  room_id uuid not null references public.exam_seating_rooms (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  student_name text not null,
  class_label text not null,
  class_roll_no text,
  exam_roll_no text not null,
  row_idx smallint not null,
  col_idx smallint not null,
  seat_label text not null,
  qr_token text unique,
  assigned_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ADDITIONAL TRIGGERS — touch_updated_at for new mutable tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'achievements','fee_types','fee_structures','fee_vouchers','fee_payments',
    'timetables','timetable_overrides','exam_roll_sessions','exam_roll_numbers',
    'merit_list_publications','attendance_thresholds','notifications',
    'exam_seating_plans','exam_seating_rooms'
  ]
  loop
    execute format(
      'drop trigger if exists trg_touch_%s on public.%I; '
      'create trigger trg_touch_%s before update on public.%I '
      'for each row execute function public.touch_updated_at()', t, t, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AUDIT TRIGGERS — extend audit_row() coverage
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'achievements','fee_types','fee_structures','fee_vouchers','fee_payments',
    'timetables','exam_roll_sessions','exam_roll_numbers',
    'merit_list_publications','notifications','exam_seating_plans'
  ]
  loop
    execute format(
      'drop trigger if exists trg_audit_%s on public.%I; '
      'create trigger trg_audit_%s after insert or update or delete on public.%I '
      'for each row execute function public.audit_row()', t, t, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- HELPERS — class_label normalisation
-- ---------------------------------------------------------------------------
create or replace function public.class_label_for(p_year smallint)
returns text
language sql
immutable
as $$
  select case when p_year = 1 then '1st Year' when p_year = 2 then '2nd Year' else null end;
$$;

-- ---------------------------------------------------------------------------
-- SEED — default fee types (if not already present)
-- ---------------------------------------------------------------------------
insert into public.fee_types (name, category, default_amount, is_recurring) values
  ('tuition',     'fee', 1500.00, true),
  ('lab',         'fee',  500.00, true),
  ('library',     'fee',  200.00, true),
  ('transport',   'fee',  800.00, true),
  ('exam',        'fee',  300.00, true),
  ('admission',   'fee', 2000.00, false),
  ('migration',   'fee', 1000.00, false),
  ('bise',        'fee',  600.00, true),
  ('late_fine',   'fine',  50.00, false),
  ('absence_fine','fine',  20.00, false),
  ('library_fine','fine',  30.00, false),
  ('other',       'other',  0.00, false)
on conflict (name) do nothing;

-- Default attendance threshold
insert into public.attendance_thresholds (name, minimum_percentage, warning_threshold, description)
values ('Default', 75.00, 80.00, 'Standard 75% minimum attendance required for exam eligibility.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- DONE — 0003_admin_extension.sql
-- ---------------------------------------------------------------------------
