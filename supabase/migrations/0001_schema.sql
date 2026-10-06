-- ============================================================================
-- GHSS GHALANAI — DIGITAL CAMPUS · SUPABASE SCHEMA  (idempotent / safe rerun)
-- Master Plan §8.5 data model · §8.6 auth · §11.3 security hardening
--
-- THIS FILE IS SAFE TO RUN REPEATEDLY:
--   * `create extension if not exists` for pgcrypto (gen_random_uuid)
--   * Enums wrapped in DO blocks with existence checks
--   * `create table if not exists` everywhere; ALTERs use ADD COLUMN IF NOT EXISTS
--   * Functions are CREATE OR REPLACE
--   * Triggers are DROP TRIGGER IF EXISTS + CREATE
--   * Every primary/unique key added with DO blocks (IF NOT EXISTS)
--
-- Run order: 0001_schema.sql → 0002_rls.sql → seed.sql
-- ============================================================================

-- Required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUMS — single source of truth for every domain vocabulary
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher', 'admin');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'programme') then
    create type public.programme as enum ('ics', 'pre-medical', 'pre-engineering', 'arts');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'student_status') then
    create type public.student_status as enum ('active', 'graduated', 'withdrawn', 'suspended');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('p', 'a', 'l', 'leave');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'admission_status') then
    create type public.admission_status as enum (
      'received', 'review', 'shortlisted', 'offered', 'admitted', 'rejected'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notice_category') then
    create type public.notice_category as enum (
      'admission', 'exam', 'result', 'scholarship', 'holiday', 'general'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'news_category') then
    create type public.news_category as enum ('Achievement', 'Academic', 'Guidance', 'Institution');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type public.feedback_type as enum ('feedback', 'complaint', 'admission', 'result');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type public.feedback_status as enum ('new', 'acknowledged', 'resolved', 'closed');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'doc_type') then
    create type public.doc_type as enum (
      'photo', 'bform', 'matric_card', 'domicile', 'concession_proof',
      'character_certificate', 'affidavit', 'other'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'admission_year_part') then
    create type public.admission_year_part as enum ('first_year', 'second_year');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES — one row per authenticated human (§8.5)
-- Role gates every portal route; theme preference syncs across devices.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'student',
  phone text,
  whatsapp_opt_in boolean not null default true,
  theme_pref text check (theme_pref in ('bright', 'dark')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_profiles_role on public.profiles (role) where deleted_at is null;

-- Auto-provision a profile the moment a user signs up (§8.6)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'Unnamed'),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helper used by every policy below (SECURITY DEFINER keeps it callable
-- inside RLS without granting table access)
create or replace function public.ghss_current_role()
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- ---------------------------------------------------------------------------
-- CLASSES / SECTIONS — the teaching unit (§8.5)
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year in (1, 2)),               -- 1st / 2nd year
  programme public.programme not null,
  section_label text not null,                                -- A, B, C…
  class_teacher_id uuid references public.profiles (id),
  session_year text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, programme, section_label, session_year)
);

create index if not exists idx_classes_session on public.classes (session_year);

-- ---------------------------------------------------------------------------
-- STUDENTS — enrolled learners linked to profiles and sections
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id),
  admission_no text unique,
  roll_no text,
  class_id uuid references public.classes (id) on delete restrict,
  guardian_name text not null,
  guardian_phone text not null,
  media_consent boolean not null default false,                -- §11.4 consent flag
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_students_class on public.students (class_id) where deleted_at is null;
create index if not exists idx_students_profile on public.students (profile_id);
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'idx_students_roll'
  ) then
    create unique index idx_students_roll on public.students (roll_no, class_id)
      where deleted_at is null and roll_no is not null;
  end if;
end $$;

-- Map a signed-in identity to its student row (used by RLS everywhere)
create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.students
  where profile_id = auth.uid() and deleted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- SUBJECTS + TEACHER ASSIGNMENTS — the timetable's atoms
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text unique not null,
  programme public.programme,
  year smallint check (year in (1, 2)),
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id),
  subject_id uuid not null references public.subjects (id),
  class_id uuid not null references public.classes (id),
  session_year text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, class_id, session_year)
);

create index if not exists idx_assignments_teacher on public.teacher_assignments (teacher_id);
create index if not exists idx_assignments_class on public.teacher_assignments (class_id);

-- Teacher's assigned classes (RLS helper)
create or replace function public.is_teacher_of(p_class uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.teacher_assignments
    where teacher_id = auth.uid() and class_id = p_class
  );
$$;

-- ---------------------------------------------------------------------------
-- ATTENDANCE — composite-indexed on (class, date) (§8.5)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  date date not null,
  status public.attendance_status not null,
  marked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (class_id, student_id, date)
);

create index if not exists idx_attendance_class_date on public.attendance (class_id, date desc);
create index if not exists idx_attendance_student on public.attendance (student_id, date desc);

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS + SUBMISSIONS — LMS core (§7.3)
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id),
  subject_id uuid not null references public.subjects (id),
  teacher_id uuid not null references public.profiles (id),
  title text not null,
  brief text,
  attachment_url text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_class on public.assignments (class_id, due_at desc);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  file_url text,
  submitted_at timestamptz not null default now(),
  grade smallint,
  remarks text,
  graded_by uuid references public.profiles (id),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create index if not exists idx_submissions_student on public.submissions (student_id);

-- ---------------------------------------------------------------------------
-- MARKS (internal) + BOARD RESULTS — one schema, two sources (§7.2/§7.3)
-- ---------------------------------------------------------------------------
create table if not exists public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  subject_id uuid not null references public.subjects (id),
  test_name text not null,
  total smallint not null check (total > 0),
  obtained smallint not null check (obtained >= 0),
  entered_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (student_id, subject_id, test_name)
);

create index if not exists idx_marks_student on public.marks (student_id);

create table if not exists public.board_results (
  id uuid primary key default gen_random_uuid(),
  roll_no text not null,
  year smallint not null,
  programme public.programme not null,
  student_name text not null,
  father_name text,
  subjects_json jsonb not null,          -- [{subject,total,obtained,grade}]
  total smallint not null,
  obtained smallint not null,
  percentage numeric(5, 2) not null,
  grade text not null,
  position text,
  published boolean not null default false,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roll_no, year, programme)
);

create index if not exists idx_board_results_lookup on public.board_results (roll_no, year, programme)
  where published = true;

-- ---------------------------------------------------------------------------
-- ADMISSIONS — the status machine + documents (§7.1)
-- Adds: admission_type (first_year/second_year), meta JSONB for HED-aligned
-- fields (email, dob, gender, religion, domicile_district, address,
-- guardian_name, guardian_cnic, first-year academic records, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  application_no text unique not null,
  admission_type public.admission_year_part not null default 'first_year',
  programme public.programme not null,
  full_name text not null,
  father_name text not null,
  cnic text not null,
  phone text not null,
  whatsapp_opt_in boolean not null default true,
  matric_board text not null,
  matric_roll text not null,
  matric_obtained smallint not null,
  matric_total smallint not null,
  matric_year text not null,
  matric_group text,
  previous_school text not null,
  -- HED-aligned extra fields stored as JSONB (no schema migration headache):
  -- { email, dob, gender, religion, domicile_district, address,
  --   guardian_name, guardian_cnic, shift, category, first_year_* }
  meta jsonb not null default '{}'::jsonb,
  status public.admission_status not null default 'received',
  merit_rank smallint,
  decision_note text,
  interview_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Back-fill admission_type + meta columns for projects that ran an earlier
-- version of the schema (idempotent — only adds if missing)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admissions' and column_name = 'admission_type'
  ) then
    alter table public.admissions
      add column admission_type public.admission_year_part not null default 'first_year';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'admissions' and column_name = 'meta'
  ) then
    alter table public.admissions
      add column meta jsonb not null default '{}'::jsonb;
  end if;
end $$;

create index if not exists idx_admissions_status on public.admissions (status, created_at desc);
create index if not exists idx_admissions_programme on public.admissions (programme, status);
create index if not exists idx_admissions_type on public.admissions (admission_type, status);

-- Retention: unsuccessful applications kept exactly two sessions (§11.4)
comment on table public.admissions is
  'Admission applications. Unsuccessful records are purged after two sessions per the privacy policy; the purge runs as a scheduled job.';

create table if not exists public.admission_docs (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions (id) on delete cascade,
  doc_type public.doc_type not null,
  storage_path text not null,             -- Supabase Storage object path
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_admission_docs on public.admission_docs (admission_id);

-- ---------------------------------------------------------------------------
-- MERIT LISTS — published, versioned (§7.1)
-- ---------------------------------------------------------------------------
create table if not exists public.merit_lists (
  id uuid primary key default gen_random_uuid(),
  session_year text not null,
  programme public.programme not null,
  merit_no smallint not null,
  application_no text not null,
  name text not null,
  matric_percent text not null,
  test_score text,
  status text not null default 'Admitted',
  version text not null default 'v1.0',
  published boolean not null default true,
  published_at timestamptz default now(),
  unique (session_year, programme, merit_no, version)
);

create index if not exists idx_merit_published on public.merit_lists (session_year, published);

-- ---------------------------------------------------------------------------
-- NOTICES + NEWS — the publishing engine (§7.5)
-- ---------------------------------------------------------------------------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category public.notice_category not null default 'general',
  date date not null default current_date,
  pinned boolean not null default false,
  published boolean not null default true,
  published_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_notices_feed on public.notices (published, pinned desc, date desc)
  where deleted_at is null;

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null,
  body text not null,
  category public.news_category not null default 'Institution',
  cover_url text,
  date date not null default current_date,
  reading_minutes smallint default 3,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_news_feed on public.news_posts (published, date desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- FACULTY + FAQS — public reference content
-- ---------------------------------------------------------------------------
create table if not exists public.faculty (
  id text primary key,
  name text not null,
  designation text not null,
  qualification text not null,
  subjects text[] not null default '{}',
  department text not null,
  years smallint not null default 1,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FEEDBACK — the complaint channel (§6.7)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  name text not null,
  phone text,
  type public.feedback_type not null,
  message text not null,
  status public.feedback_status not null default 'new',
  resolved_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feedback_status on public.feedback (status, created_at desc);

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS — PWA web push (§9.3)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text unique not null,
  keys_json jsonb not null,
  topics text[] not null default '{results,admissions,notices}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SETTINGS — key/value for admission status etc.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AUDIT LOG — immutable administrative trail (§11.3)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id),
  action text not null,           -- e.g. 'notice.published', 'admission.status_changed'
  target text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_target on public.audit_log (target, created_at desc);
create index if not exists idx_audit_action on public.audit_log (action, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance trigger (all mutable tables)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'classes', 'students', 'assignments', 'board_results',
    'admissions', 'notices', 'news_posts', 'faculty', 'feedback', 'settings'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%s on public.%I', t, t);
    execute format('create trigger trg_touch_%s before update on public.%I
      for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- AUDIT TRIGGERS — administrative mutations write immutable rows (§11.3)
-- ---------------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_log (actor, action, target, meta)
  values (
    auth.uid(),
    lower(tg_table_name) || '.' || lower(tg_op),
    coalesce(
      case tg_op when 'DELETE' then old.id::text else new.id::text end,
      'unknown'
    ),
    coalesce(
      case tg_op when 'DELETE' then to_jsonb(old) else to_jsonb(new) end,
      '{}'::jsonb
    )
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'admissions', 'notices', 'news_posts', 'board_results', 'merit_lists',
    'profiles', 'students', 'faculty'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format(
      'create trigger trg_audit_%s after insert or update or delete on public.%I
       for each row execute function public.audit_row()', t, t);
  end loop;
end $$;
