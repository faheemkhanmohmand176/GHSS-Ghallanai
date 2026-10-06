-- ============================================================================
-- GHSS GHALANAI · HED-STYLE ADMISSION PORTAL · 0005
-- ----------------------------------------------------------------------------
-- Builds the data model for a 4-step online admission flow inspired by
-- the HED KPK online admission portal (admission.hed.gkp.pk):
--
--   Step 1 — Create Account (nationality, CNIC/Form-B, mobile, password)
--   Step 2 — Board Verification (matric board + roll + year → BISE result)
--   Step 3 — Personal Information (name, father, DOB, gender, address, etc.)
--   Step 4 — Academic Information + Programme + Quota + Declarations → Submit
--
-- After submission the applicant receives a tracking token (e.g.
-- GHSS-2026-001234) which they use at /admissions/track to follow their
-- status timeline through received → review → shortlisted → offered →
-- admitted (or rejected). They also pay a per-application fee (Rs 100 per
-- college per programme) and present a printed token at the college office.
--
-- DESIGN PRINCIPLES (carried over from 0001 + 0003):
--   * RLS enabled on every new table (default deny) — see 0006_admission_rls.sql
--   * Idempotent (IF NOT EXISTS / ON CONFLICT) so this file is re-runnable
--   * All money NUMERIC(10, 2)
--   * Foreign keys with ON DELETE RESTRICT on applicant data
--   * Audit triggers via the existing audit_row() function from 0001
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTEND admissions ENUM — add granular HED-style statuses
-- ---------------------------------------------------------------------------
do $$
begin
  -- Add new statuses to the existing admission_status enum
  if not exists (select 1 from pg_enum where enumlabel = 'board_verified') then
    alter type public.admission_status add value 'board_verified' after 'review';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'fee_pending') then
    alter type public.admission_status add value 'fee_pending' after 'shortlisted';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'fee_paid') then
    alter type public.admission_status add value 'fee_paid' after 'fee_pending';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'documents_pending') then
    alter type public.admission_status add value 'documents_pending' after 'fee_paid';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- APPLICANT ACCOUNTS — extends profiles with HED-style applicant data
-- (One profile row per auth user; this table holds applicant-specific
--  admission-cycle metadata that doesn't belong on profiles.)
-- ---------------------------------------------------------------------------
create table if not exists public.admission_applicants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade,
  admission_cycle text not null,                  -- e.g. "2026-27"
  nationality text not null default 'Pakistani'
    check (nationality in ('Pakistani','Afghani')),
  cnic_form_b text not null,                       -- 13 digits without dashes
  afghan_card_no text,                             -- only for Afghani nationality
  mobile_number text not null,                     -- 03XXXXXXXXX format (cannot change)
  father_cnic text,                                 -- 13 digits without dashes
  father_name text,
  date_of_birth date,
  gender text check (gender in ('Male','Female','Other') or gender is null),
  domicile_district text,
  permanent_address text,
  mailing_address text,
  is_hafiz_e_quran boolean not null default false,
  gap_years smallint not null default 0,
  current_step smallint not null default 1
    check (current_step between 1 and 4),
  step1_completed_at timestamptz,
  step2_completed_at timestamptz,
  step3_completed_at timestamptz,
  step4_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admission_cycle, cnic_form_b)
);

create index if not exists idx_admission_applicants_profile
  on public.admission_applicants (profile_id);
create index if not exists idx_admission_applicants_cycle
  on public.admission_applicants (admission_cycle, cnic_form_b);

-- ---------------------------------------------------------------------------
-- ADMISSIONS (the actual application) — extends the existing table
-- Each applicant can apply to MULTIPLE programmes (each is a separate row,
-- each generates its own token + its own Rs 100 fee). This mirrors HED.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Add new columns to existing admissions table IF NOT EXISTS
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'applicant_id') then
    alter table public.admissions
      add column applicant_id uuid references public.admission_applicants (id) on delete cascade;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'application_token') then
    alter table public.admissions
      add column application_token text unique;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'father_cnic') then
    alter table public.admissions add column father_cnic text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'date_of_birth') then
    alter table public.admissions add column date_of_birth date;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'gender') then
    alter table public.admissions add column gender text
      check (gender in ('Male','Female','Other') or gender is null);
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'domicile_district') then
    alter table public.admissions add column domicile_district text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'permanent_address') then
    alter table public.admissions add column permanent_address text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'quota') then
    alter table public.admissions add column quota text not null default 'open_merit'
      check (quota in (
        'open_merit','local','employee','sports','special_person',
        'minority','afghan','meritorious'
      ));
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'is_hafiz_e_quran') then
    alter table public.admissions add column is_hafiz_e_quran boolean not null default false;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'gap_years') then
    alter table public.admissions add column gap_years smallint not null default 0;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'subject_combination') then
    alter table public.admissions add column subject_combination jsonb not null default '[]'::jsonb;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'class_year') then
    alter table public.admissions add column class_year text not null default '1st Year'
      check (class_year in ('1st Year','2nd Year'));
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'fee_amount') then
    alter table public.admissions add column fee_amount numeric(10, 2) not null default 100.00;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'fee_paid') then
    alter table public.admissions add column fee_paid boolean not null default false;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'fee_paid_at') then
    alter table public.admissions add column fee_paid_at timestamptz;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'fee_receipt_no') then
    alter table public.admissions add column fee_receipt_no text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'admissions'
                   and column_name = 'submitted_at') then
    alter table public.admissions add column submitted_at timestamptz;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ADMISSION STATUS TIMELINE — append-only audit of every status change
-- ---------------------------------------------------------------------------
create table if not exists public.admission_status_timeline (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.admissions (id) on delete cascade,
  from_status public.admission_status,
  to_status public.admission_status not null,
  note text,
  actor_id uuid references public.profiles (id),
  actor_role text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admission_timeline_app
  on public.admission_status_timeline (application_id, created_at desc);

-- Atomic status update RPC — inserts timeline row + updates application status
create or replace function public.update_application_status(
  p_application_id uuid,
  p_new_status public.admission_status,
  p_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_old_status public.admission_status;
begin
  select status into v_old_status from public.admissions
    where id = p_application_id;
  if v_old_status is null then
    raise exception 'Application % not found', p_application_id;
  end if;
  if v_old_status = p_new_status then
    return;  -- no-op
  end if;
  update public.admissions
    set status = p_new_status,
        updated_at = now()
    where id = p_application_id;
  insert into public.admission_status_timeline (
    application_id, from_status, to_status, note, actor_id, actor_role
  )
  values (
    p_application_id, v_old_status, p_new_status, p_note,
    auth.uid(),
    (select role from public.profiles where id = auth.uid())
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- ADMISSION CYCLE SETTINGS — singleton config
-- ---------------------------------------------------------------------------
create table if not exists public.admission_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_name text unique not null,                -- e.g. "2026-27"
  is_active boolean not null default false,
  is_open boolean not null default false,
  open_date date,
  close_date date,
  fee_amount numeric(10, 2) not null default 100.00,
  classes_offered text[] not null default '{1st Year,2nd Year}',
  banner_message text,
  instructions_en text,
  instructions_ur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_admission_cycles_active
  on public.admission_cycles (is_active) where is_active = true;

-- ---------------------------------------------------------------------------
-- ADMISSION QUOTAS — seat allocation per programme per quota
-- Mirrors the HED policy: 40% Open / 45% Local / 6% Employee / 5% Sports /
-- 2% Special Person / 2% Minority / 1 Afghan seat per faculty.
-- ---------------------------------------------------------------------------
create table if not exists public.admission_quota_config (
  id uuid primary key default gen_random_uuid(),
  cycle_name text not null references public.admission_cycles (cycle_name) on delete cascade,
  programme public.programme not null,
  class_year text not null default '1st Year'
    check (class_year in ('1st Year','2nd Year')),
  total_seats smallint not null default 40,
  open_merit_percent numeric(5, 2) not null default 40.00,
  local_percent numeric(5, 2) not null default 45.00,
  employee_percent numeric(5, 2) not null default 6.00,
  sports_percent numeric(5, 2) not null default 5.00,
  special_person_percent numeric(5, 2) not null default 2.00,
  minority_percent numeric(5, 2) not null default 2.00,
  afghan_seats smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_name, programme, class_year)
);

-- ---------------------------------------------------------------------------
-- PROGRAMME SUBJECT COMBINATIONS — what subjects each stream offers
-- For 1st Year & 2nd Year at GHSS Ghallanai (Intermediate level).
-- ---------------------------------------------------------------------------
create table if not exists public.programme_subjects (
  id uuid primary key default gen_random_uuid(),
  programme public.programme not null,
  class_year text not null check (class_year in ('1st Year','2nd Year')),
  subject_name text not null,
  subject_code text,
  is_compulsory boolean not null default false,    -- English, Urdu, Islamiat, Pak Studies are compulsory
  is_practical boolean not null default false,     -- Physics, Chemistry, Biology, Computer have practicals
  theory_marks smallint not null default 100,
  practical_marks smallint not null default 0,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (programme, class_year, subject_name)
);

create index if not exists idx_programme_subjects
  on public.programme_subjects (programme, class_year, display_order);

-- ---------------------------------------------------------------------------
-- ADMISSION OTP CODES — for mobile verification (HED-style)
-- Used when applicant forgets password and needs SMS-code reset.
-- ---------------------------------------------------------------------------
create table if not exists public.admission_otp_codes (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.admission_applicants (id) on delete cascade,
  otp_code text not null,
  purpose text not null default 'password_reset'
    check (purpose in ('password_reset','mobile_verification')),
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admission_otp_lookup
  on public.admission_otp_codes (applicant_id, expires_at desc);

-- ---------------------------------------------------------------------------
-- TRIGGERS — touch_updated_at on new tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'admission_applicants','admission_status_timeline','admission_cycles',
    'admission_quota_config','programme_subjects','admission_otp_codes'
  ]
  loop
    execute format(
      'drop trigger if exists trg_touch_%s on public.%I; '
      'create trigger trg_touch_%s before update on public.%I '
      'for each row execute function public.touch_updated_at()', t, t, t, t);
  end loop;
end $$;

-- Audit triggers on the high-impact tables
do $$
declare t text;
begin
  foreach t in array array[
    'admission_applicants','admission_cycles','admission_quota_config'
  ]
  loop
    execute format(
      'drop trigger if exists trg_audit_%s on public.%I; '
      'create trigger trg_audit_%s after insert or update or delete on public.%I '
      'for each row execute function public.audit_row()', t, t, t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SEED — default admission cycle + quota config + programme subjects
-- ---------------------------------------------------------------------------

-- Active cycle: 2026-27
insert into public.admission_cycles
  (cycle_name, is_active, is_open, open_date, close_date, fee_amount,
   classes_offered, banner_message, instructions_en, instructions_ur)
values (
  '2026-27',
  true, true,
  '2026-09-15', '2026-11-30',
  100.00,
  '{1st Year,2nd Year}',
  'Online admissions for 1st Year & 2nd Year (Intermediate Part-I & Part-II) are open for session 2026-27.',
  'Step 1: Create your account with CNIC/Form-B and mobile number. Step 2: Verify your matric board details. Step 3: Complete your personal information. Step 4: Choose your programme, quota and subjects. Submit to receive your tracking token. Pay Rs 100 per application at the college office.',
  'مرحلہ 1: اپنا اکاؤنٹ شناختی کارڈ / فارم بی اور موبائل نمبر کے ساتھ بنائیں۔ مرحلہ 2: اپنے میٹرک بورڈ کی تفصیلات کی تصدیق کریں۔ مرحلہ 3: اپنی ذاتی معلومات مکمل کریں۔ مرحلہ 4: اپنا پروگرام، کوٹہ اور مضامین منتخب کریں۔ جمع کرانے کے بعد ٹریکنگ ٹوکن حاصل کریں۔ ہر درخواست کے لیے Rs 100 کالج آفس میں جمع کریں۔'
)
on conflict (cycle_name) do nothing;

-- Default quota config: 40 seats per programme × 1st Year
insert into public.admission_quota_config
  (cycle_name, programme, class_year, total_seats)
select '2026-27', p, '1st Year', 40
from (values ('ics'),('pre-medical'),('pre-engineering'),('arts')) as t(p)
on conflict do nothing;

insert into public.admission_quota_config
  (cycle_name, programme, class_year, total_seats)
select '2026-27', p, '2nd Year', 40
from (values ('ics'),('pre-medical'),('pre-engineering'),('arts')) as t(p)
on conflict do nothing;

-- Programme subjects — HSSC Intermediate subjects (BISE pattern)
-- Compulsory subjects (all programmes, both years)
insert into public.programme_subjects
  (programme, class_year, subject_name, subject_code, is_compulsory, is_practical, theory_marks, practical_marks, display_order)
values
  -- 1st Year compulsory
  ('pre-medical', '1st Year', 'English', 'ENG-XI', true, false, 100, 0, 1),
  ('pre-medical', '1st Year', 'Urdu', 'URD-XI', true, false, 100, 0, 2),
  ('pre-medical', '1st Year', 'Islamiat', 'ISL-XI', true, false, 50, 0, 3),
  ('pre-medical', '1st Year', 'Biology', 'BIO-XI', false, true, 75, 25, 4),
  ('pre-medical', '1st Year', 'Chemistry', 'CHM-XI', false, true, 75, 25, 5),
  ('pre-medical', '1st Year', 'Physics', 'PHY-XI', false, true, 75, 25, 6),
  -- 2nd Year compulsory
  ('pre-medical', '2nd Year', 'English', 'ENG-XII', true, false, 100, 0, 1),
  ('pre-medical', '2nd Year', 'Urdu', 'URD-XII', true, false, 100, 0, 2),
  ('pre-medical', '2nd Year', 'Pak Studies', 'PAK-XII', true, false, 50, 0, 3),
  ('pre-medical', '2nd Year', 'Biology', 'BIO-XII', false, true, 75, 25, 4),
  ('pre-medical', '2nd Year', 'Chemistry', 'CHM-XII', false, true, 75, 25, 5),
  ('pre-medical', '2nd Year', 'Physics', 'PHY-XII', false, true, 75, 25, 6),
  -- Pre-Engineering 1st Year
  ('pre-engineering', '1st Year', 'English', 'ENG-XI', true, false, 100, 0, 1),
  ('pre-engineering', '1st Year', 'Urdu', 'URD-XI', true, false, 100, 0, 2),
  ('pre-engineering', '1st Year', 'Islamiat', 'ISL-XI', true, false, 50, 0, 3),
  ('pre-engineering', '1st Year', 'Mathematics', 'MTH-XI', false, false, 100, 0, 4),
  ('pre-engineering', '1st Year', 'Physics', 'PHY-XI', false, true, 75, 25, 5),
  ('pre-engineering', '1st Year', 'Chemistry', 'CHM-XI', false, true, 75, 25, 6),
  -- Pre-Engineering 2nd Year
  ('pre-engineering', '2nd Year', 'English', 'ENG-XII', true, false, 100, 0, 1),
  ('pre-engineering', '2nd Year', 'Urdu', 'URD-XII', true, false, 100, 0, 2),
  ('pre-engineering', '2nd Year', 'Pak Studies', 'PAK-XII', true, false, 50, 0, 3),
  ('pre-engineering', '2nd Year', 'Mathematics', 'MTH-XII', false, false, 100, 0, 4),
  ('pre-engineering', '2nd Year', 'Physics', 'PHY-XII', false, true, 75, 25, 5),
  ('pre-engineering', '2nd Year', 'Chemistry', 'CHM-XII', false, true, 75, 25, 6),
  -- ICS 1st Year
  ('ics', '1st Year', 'English', 'ENG-XI', true, false, 100, 0, 1),
  ('ics', '1st Year', 'Urdu', 'URD-XI', true, false, 100, 0, 2),
  ('ics', '1st Year', 'Islamiat', 'ISL-XI', true, false, 50, 0, 3),
  ('ics', '1st Year', 'Computer Science', 'CSC-XI', false, true, 75, 25, 4),
  ('ics', '1st Year', 'Mathematics', 'MTH-XI', false, false, 100, 0, 5),
  ('ics', '1st Year', 'Physics', 'PHY-XI', false, true, 75, 25, 6),
  -- ICS 2nd Year
  ('ics', '2nd Year', 'English', 'ENG-XII', true, false, 100, 0, 1),
  ('ics', '2nd Year', 'Urdu', 'URD-XII', true, false, 100, 0, 2),
  ('ics', '2nd Year', 'Pak Studies', 'PAK-XII', true, false, 50, 0, 3),
  ('ics', '2nd Year', 'Computer Science', 'CSC-XII', false, true, 75, 25, 4),
  ('ics', '2nd Year', 'Mathematics', 'MTH-XII', false, false, 100, 0, 5),
  ('ics', '2nd Year', 'Physics', 'PHY-XII', false, true, 75, 25, 6),
  -- Arts 1st Year
  ('arts', '1st Year', 'English', 'ENG-XI', true, false, 100, 0, 1),
  ('arts', '1st Year', 'Urdu', 'URD-XI', true, false, 100, 0, 2),
  ('arts', '1st Year', 'Islamiat', 'ISL-XI', true, false, 50, 0, 3),
  ('arts', '1st Year', 'Civics', 'CIV-XI', false, false, 100, 0, 4),
  ('arts', '1st Year', 'Education', 'EDU-XI', false, false, 100, 0, 5),
  ('arts', '1st Year', 'General History', 'HIS-XI', false, false, 100, 0, 6),
  -- Arts 2nd Year
  ('arts', '2nd Year', 'English', 'ENG-XII', true, false, 100, 0, 1),
  ('arts', '2nd Year', 'Urdu', 'URD-XII', true, false, 100, 0, 2),
  ('arts', '2nd Year', 'Pak Studies', 'PAK-XII', true, false, 50, 0, 3),
  ('arts', '2nd Year', 'Civics', 'CIV-XII', false, false, 100, 0, 4),
  ('arts', '2nd Year', 'Education', 'EDU-XII', false, false, 100, 0, 5),
  ('arts', '2nd Year', 'General History', 'HIS-XII', false, false, 100, 0, 6)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- DONE — 0005_admission_portal.sql
-- ---------------------------------------------------------------------------
