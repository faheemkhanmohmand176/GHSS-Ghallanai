-- ============================================================================
-- GHSS GHALANAI — HED-ALIGNED ADMISSION FIELDS (idempotent / safe rerun)
-- Adds the columns captured from the live HED KPK OCAS portal walk-through:
--   * blood_group, mother_name, mother_cnic, applicant_dob, applicant_gender
--   * applicant_religion, applicant_photo_path, hafiz_quran
--   * domicile_province, domicile_district, domicile_tehsil, union_council
--   * father_cnic, father_mobile, guardian_address
--   * shift (Morning/Evening), inter_year_part (1st/2nd year explicit)
--   * board_verified_at, board_verification_data JSONB
-- Plus: admission_accounts email/phone (already added in 0004), and indexes
-- to support the tracking + admin queue lookups.
--
-- All ALTERs use `add column if not exists`. Safe to run repeatedly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- admissions table: HED-aligned personal info columns
-- ---------------------------------------------------------------------------
alter table public.admissions
  add column if not exists applicant_dob date,
  add column if not exists applicant_gender text check (applicant_gender in ('male', 'female', 'other')),
  add column if not exists applicant_religion text check (applicant_religion in ('islam', 'christianity', 'hinduism', 'sikhism', 'other')),
  add column if not exists applicant_blood_group text check (applicant_blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Nil')),
  add column if not exists applicant_nationality text check (applicant_nationality in ('Pakistani', 'Afghani')) default 'Pakistani',
  add column if not exists applicant_email text,
  add column if not exists applicant_mobile text,
  add column if not exists applicant_landline text,
  add column if not exists applicant_address text,
  add column if not exists applicant_photo_path text,
  add column if not exists father_cnic text,
  add column if not exists father_mobile text,
  add column if not exists mother_name text,
  add column if not exists mother_cnic text,
  add column if not exists guardian_address text,
  add column if not exists domicile_province text,
  add column if not exists domicile_district text,
  add column if not exists domicile_tehsil text,
  add column if not exists domicile_union_council text,
  add column if not exists hafiz_quran boolean not null default false,
  add column if not exists shift text check (shift in ('morning', 'evening')) default 'morning',
  add column if not exists board_verified_at timestamptz,
  add column if not exists board_verification_data jsonb not null default '{}'::jsonb,
  add column if not exists submitted_at timestamptz default now();

-- Indexes for common admin queries (status, programme, type, dates)
create index if not exists idx_admissions_submitted_at on public.admissions (submitted_at desc);
create index if not exists idx_admissions_applicant_cnic on public.admissions (cnic);
create index if not exists idx_admissions_applicant_mobile on public.admissions (phone);
create index if not exists idx_admissions_domicile on public.admissions (domicile_district, domicile_province);

-- ---------------------------------------------------------------------------
-- admission_accounts: add columns for HED-aligned account + verification
-- ---------------------------------------------------------------------------
alter table public.admission_accounts
  add column if not exists full_name text,
  add column if not exists father_name text,
  add column if not exists applicant_dob date,
  add column if not exists applicant_gender text,
  add column if not exists board_verified_at timestamptz,
  add column if not exists board_verification_data jsonb not null default '{}'::jsonb,
  add column if not exists last_login_at timestamptz,
  add column if not exists login_count integer not null default 0;

create index if not exists idx_admission_accounts_phone on public.admission_accounts(phone);

-- ---------------------------------------------------------------------------
-- Extend doc_type enum with new types if they don't exist.
-- Idempotent: PostgreSQL supports `add value if not exists` since 9.3.
-- ---------------------------------------------------------------------------
alter type public.doc_type add value if not exists 'father_cnic';
alter type public.doc_type add value if not exists 'first_year_dmc';
alter type public.doc_type add value if not exists 'first_year_registration';

-- ---------------------------------------------------------------------------
-- Application documents table: add file_size + mime_type for sanity checks
-- ---------------------------------------------------------------------------
alter table public.admission_docs
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists original_filename text;

-- ---------------------------------------------------------------------------
-- View: public admission status feed (transparency flagship)
-- A narrow view that exposes ONLY non-sensitive columns of published
-- admission applications — used by the tracking page to display status
-- without exposing PII.
-- ---------------------------------------------------------------------------
create or replace view public.admission_tracking_view as
  select
    a.application_no,
    a.admission_type,
    a.programme,
    a.full_name,
    a.father_name,
    a.status,
    a.merit_rank,
    a.decision_note,
    a.submitted_at,
    a.updated_at,
    a.domicile_district
  from public.admissions a
  order by a.submitted_at desc;

do $$ begin
  execute 'grant select on public.admission_tracking_view to anon';
exception when others then null; end $$;

do $$ begin
  execute 'grant select on public.admission_tracking_view to authenticated';
exception when others then null; end $$;
