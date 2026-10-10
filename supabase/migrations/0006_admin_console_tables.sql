-- ============================================================================
-- GHSS GHALANAI — ADMIN CONSOLE TABLES  (idempotent / safe rerun)
-- Ported from the GHS Babi Khel platform, adapted for a higher-secondary
-- school (1st Year / 2nd Year × Arts, Pre-Engineering, Pre-Medical, ICS).
--
-- SAFE SQL RULES OF THIS FILE:
--   * `create table if not exists` everywhere; ALTERs use ADD COLUMN IF NOT EXISTS
--   * Enums/CHECKs wrapped in DO blocks with existence checks
--   * No dynamic SQL, no string interpolation, no SECURITY DEFINER here
--     (functions live in 0007 with explicit REVOKE/GRANT hygiene)
--   * Every table carries defaults so partial inserts can never corrupt data
--
-- Run order: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → seed.sql
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- CANONICAL CLASS LABELS — 1st/2nd Year × four programmes.
-- A single CHECK-validated text column keeps the admin UI, fee engine and
-- timetable grid in sync without requiring `classes` rows to exist first.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'valid_class_label'
      and conrelid = 'public.class_labels'::regclass
  ) then
    create table public.class_labels (label text primary key);
    alter table public.class_labels add constraint valid_class_label
      check (label in (
        '1st Year — Arts', '1st Year — Pre-Engineering',
        '1st Year — Pre-Medical', '1st Year — ICS',
        '2nd Year — Arts', '2nd Year — Pre-Engineering',
        '2nd Year — Pre-Medical', '2nd Year — ICS'
      ));
    insert into public.class_labels (label) values
      ('1st Year — Arts'), ('1st Year — Pre-Engineering'),
      ('1st Year — Pre-Medical'), ('1st Year — ICS'),
      ('2nd Year — Arts'), ('2nd Year — Pre-Engineering'),
      ('2nd Year — Pre-Medical'), ('2nd Year — ICS')
    on conflict (label) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- SCHOOL SETTINGS ("College Setting") — one structured row (id = 1).
-- Public read; admin write (policies in 0007). The homepage, header, footer
-- and public pages read this row and fall back to static content when empty.
-- ---------------------------------------------------------------------------
create table if not exists public.school_settings (
  id integer primary key default 1 check (id = 1),
  school_name text not null default 'Government Higher Secondary School Ghallanai',
  tagline text not null default 'Knowledge, Character, Service',
  description text,
  about_text text,
  emis_code text,
  address text,
  phone text,
  email text,
  established_year smallint,
  total_students integer,
  total_teachers integer,
  pass_percentage numeric(5,2),
  board_results text,
  logo_url text,
  banner_url text,
  location_lat double precision,
  location_lng double precision,
  principal_name text,
  principal_message text,
  principal_photo_url text,
  -- Admission window (drives the homepage CTA + apply gate)
  admission_open boolean not null default true,
  admission_session text not null default '2026-27',
  admission_deadline date,
  admission_banner text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- TEACHERS — public faculty directory, fully managed from the admin panel.
-- ---------------------------------------------------------------------------
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  subject text not null,
  qualification text,
  experience text,
  phone text,
  email text,
  bio text,
  photo_url text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teachers_display_order on public.teachers (display_order);
create index if not exists idx_teachers_active on public.teachers (is_active);

-- ---------------------------------------------------------------------------
-- TIMETABLES — weekly grid per class label (Mon-Sat × 8 periods).
-- UNIQUE(class_label, day, period_number) prevents double-booked cells.
-- ---------------------------------------------------------------------------
create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  class_label text not null references public.class_labels (label) on update cascade,
  day text not null check (day in
    ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period_number smallint not null check (period_number between 1 and 8),
  subject text not null,
  teacher text,
  start_time text,
  end_time text,
  room text,
  meet_link text,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_timetables_cell'
  ) then
    create unique index idx_timetables_cell on public.timetables (class_label, day, period_number);
  end if;
end $$;

create index if not exists idx_timetables_class on public.timetables (class_label);

-- Daily substitution slips (teacher absent → substitute assigned)
create table if not exists public.timetable_overrides (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null default current_date,
  class_label text not null references public.class_labels (label) on update cascade,
  day text not null,
  period_number smallint not null check (period_number between 1 and 8),
  subject text not null,
  original_teacher text,
  substitute_teacher text not null,
  reason text,
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_tt_overrides_slot'
  ) then
    create unique index idx_tt_overrides_slot on public.timetable_overrides
      (effective_date, class_label, period_number);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- EVENT CALENDAR
-- ---------------------------------------------------------------------------
create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'general' check (event_type in
    ('exam','holiday','ptm','sports','results','general')),
  start_date date not null,
  end_date date,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_events_start on public.school_events (start_date);
create index if not exists idx_school_events_published on public.school_events (is_published, start_date);

-- ---------------------------------------------------------------------------
-- FEE MANAGEMENT — structures (what a class owes) → vouchers (what a student
-- owes) → payments (what was received). All money math stays numeric(12,2).
-- ---------------------------------------------------------------------------
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  class_label text not null references public.class_labels (label) on update cascade,
  fee_type text not null check (fee_type in
    ('tuition','lab','library','transport','exam','admission','migration','board','other')),
  label text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  is_optional boolean not null default false,
  is_recurring boolean not null default true,
  frequency text not null default 'monthly' check (frequency in
    ('monthly','quarterly','annual','one_time')),
  is_active boolean not null default true,
  payment_methods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_label, fee_type)
);

create index if not exists idx_fee_structures_class on public.fee_structures (class_label, is_active);

create table if not exists public.fee_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_number text not null unique,
  student_id uuid references public.students (id) on delete set null,
  student_name text not null,
  roll_no text,
  class_label text not null references public.class_labels (label) on update cascade,
  month smallint not null default extract(month from current_date) check (month between 1 and 12),
  year smallint not null default extract(year from current_date),
  fee_period text not null default 'monthly' check (fee_period in ('monthly','one_off')),
  fee_items jsonb not null default '[]'::jsonb,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  late_fee numeric(12,2) not null default 0 check (late_fee >= 0),
  due_date date not null default current_date + 14,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','overdue','waived')),
  bank_details jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fee_vouchers_status on public.fee_vouchers (status, due_date);
create index if not exists idx_fee_vouchers_class on public.fee_vouchers (class_label, year, month);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.fee_vouchers (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in
    ('cash','bank','online','cheque','jazzcash','easypaisa')),
  receipt_number text,
  payment_date date not null default current_date,
  received_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fee_payments_voucher on public.fee_payments (voucher_id);
create index if not exists idx_fee_payments_date on public.fee_payments (payment_date desc);

-- ---------------------------------------------------------------------------
-- DIGITAL LIBRARY — past papers, books, notes, assignments (link or upload).
-- ---------------------------------------------------------------------------
create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Other' check (category in
    ('Past Papers','Books','Notes','Assignments','Admission','Other')),
  class_label text not null default 'All' check (class_label = 'All' or class_label in
    (select label from public.class_labels)),
  subject text,
  file_url text not null,
  file_type text not null default 'LINK',
  file_size text,
  cover_url text,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_library_files_category on public.library_files (category, created_at desc);

-- ---------------------------------------------------------------------------
-- PHOTO GALLERY — albums + photos/videos.
-- ---------------------------------------------------------------------------
create table if not exists public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums (id) on delete cascade,
  photo_url text not null,
  caption text,
  media_type text not null default 'image' check (media_type in ('image','video')),
  created_at timestamptz not null default now()
);

create index if not exists idx_gallery_photos_album on public.gallery_photos (album_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ACHIEVEMENTS — the "Our Pride" homepage section.
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  student_name text,
  class_label text,
  year smallint,
  category text not null default 'Academic' check (category in
    ('Academic','Sports','Art','Science','Other')),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_achievements_recent on public.achievements (created_at desc);

-- ---------------------------------------------------------------------------
-- SITE ANALYTICS — append-only visit log (anyone inserts, nobody mutates).
-- ---------------------------------------------------------------------------
create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  page text not null default '/',
  referrer text,
  user_agent text,
  device_type text not null default 'unknown' check (device_type in
    ('desktop','mobile','tablet','unknown')),
  session_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_visits_created on public.site_visits (created_at desc);
create index if not exists idx_site_visits_page on public.site_visits (page);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — the header bell. audience-scoped broadcasts.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null default 'all' check (audience in ('all','admin','students')),
  type text not null default 'default',
  title text not null,
  body text,
  link text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recent on public.notifications (created_at desc);

-- ---------------------------------------------------------------------------
-- NOTICES — add urgency + embedded polls (Babi Khel pattern).
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name = 'is_urgent'
  ) then
    alter table public.notices add column is_urgent boolean not null default false;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name = 'is_poll'
  ) then
    alter table public.notices add column is_poll boolean not null default false;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name = 'poll_options'
  ) then
    alter table public.notices add column poll_options jsonb not null default '[]'::jsonb;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notices' and column_name = 'poll_closes_at'
  ) then
    alter table public.notices add column poll_closes_at timestamptz;
  end if;
end $$;

-- One vote per (notice, anonymous device token); rows are only ever written
-- by the cast_poll_vote RPC (no direct-insert policy → default deny).
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices (id) on delete cascade,
  option_id text not null,
  voter_token text not null,
  created_at timestamptz not null default now(),
  unique (notice_id, voter_token)
);

-- ---------------------------------------------------------------------------
-- BOARD RESULTS — scheduled publishing (countdown strip on the homepage).
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'board_results' and column_name = 'publish_at'
  ) then
    alter table public.board_results add column publish_at timestamptz;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ADMISSION STATUS HISTORY — audit trail for every decision (Babi Khel
-- update_admission_status RPC writes here).
-- ---------------------------------------------------------------------------
create table if not exists public.admission_status_history (
  id bigint generated always as identity primary key,
  admission_id uuid not null references public.admissions (id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admission_history on public.admission_status_history (admission_id, created_at desc);
