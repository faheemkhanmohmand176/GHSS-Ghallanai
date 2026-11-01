-- ═══════════════════════════════════════════════════════════════════════
-- FILE 20 — Inter Admission System (HED KPK mirror) — Safe SQL
-- ═══════════════════════════════════════════════════════════════════════
-- Mirrors the official HED KPK Online Admission System Inter flow
-- (admission.hed.gkp.pk) 1:1 for GOVERNMENT HIGHER SECONDARY SCHOOL
-- GHALLANAI, District Mohmand — a general (college_type 0) institution
-- offering Intermediate (1st/2nd Year) ONLY, with four faculties:
--   • Pre-Medical     • Pre-Engineering     • ICS (Computer Sciences)
--   • Arts/Humanities
-- No BS / ADP / D.Com / DIT.
--
-- Captured live on 01-Nov-2026 by walking the REAL HED flow twice:
--   1) commerce college (GCMS Ghallanai, type 1) — Local Quota path
--   2) general college  (GDC Wadpaga Peshawar, type 0) — Open Merit path
--      with Subject Groups, F.A/F.Sc cycle, Pre-Medical application
--      submitted end-to-end (Tracking NOV2026394628, JazzCash token
--      261101280394629), public tracking + merit lists verified.
--
--   Register (CNIC/Form-B + mobile + password) → Login → Personal Profile
--   → Matric/SSC Profile (manual) → New Admission Request
--   (Level → Program → Subject Group → Quota → criteria → declaration)
--   → Confirm (Rs 100) → Pay Page → Proceed with Payment
--   → JazzCash token (deadline = admission last date) → Dashboard
--   → public Track Application → Merit Lists
--
-- SAFE SQL: purely ADDITIVE. No pre-existing table is altered, dropped or
-- renamed. The legacy `admissions` tables are left untouched; this new
-- `inter_*` schema is the accurate system that replaces their use.
-- Idempotent — safe to re-run (seeds upsert, columns use IF NOT EXISTS).
--
-- Run AFTER files 01-19.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE public.inter_quota AS ENUM
        ('open_merit', 'local_quota', 'sports', 'college_employees', 'special_person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.inter_payment_status AS ENUM ('pending', 'paid', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.inter_app_status AS ENUM
        ('submitted', 'fee_pending', 'fee_paid', 'under_review', 'merit_listed',
         'admitted', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. SEQUENCES  (tracking id + JazzCash token numbering)
-- ─────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.inter_application_seq START 100001;

-- ─────────────────────────────────────────────────────────────────────
-- 3. TABLES
-- ─────────────────────────────────────────────────────────────────────

-- Applicants = accounts created with CNIC/Form-B + mobile + password
-- (HED apply_step1.php). Mobile is immutable after registration.
CREATE TABLE IF NOT EXISTS public.inter_applicants (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cnic_formb    text NOT NULL UNIQUE,
    mobile_number text NOT NULL,
    nationality   text NOT NULL DEFAULT 'Pakistani'
                  CONSTRAINT inter_applicants_nationality_chk
                  CHECK (nationality IN ('Pakistani', 'Afghani')),
    password_hash text NOT NULL,
    status        text NOT NULL DEFAULT 'active'
                  CONSTRAINT inter_applicants_status_chk
                  CHECK (status IN ('active', 'disabled')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inter_applicants_cnic_chk CHECK (cnic_formb ~ '^[0-9]{13}$'),
    CONSTRAINT inter_applicants_mobile_chk CHECK (mobile_number ~ '^03[0-9]{9}$')
);

-- Lightweight session tokens (custom auth — Supabase Auth stays for staff)
CREATE TABLE IF NOT EXISTS public.inter_applicant_sessions (
    token        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id uuid NOT NULL REFERENCES public.inter_applicants(id) ON DELETE CASCADE,
    expires_at   timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inter_sessions_applicant ON public.inter_applicant_sessions(applicant_id);
CREATE INDEX IF NOT EXISTS idx_inter_sessions_expiry ON public.inter_applicant_sessions(expires_at);

-- Personal Information profile (HED student_personal_profile.php fields)
CREATE TABLE IF NOT EXISTS public.inter_personal_profiles (
    applicant_id     uuid PRIMARY KEY REFERENCES public.inter_applicants(id) ON DELETE CASCADE,
    full_name        text NOT NULL,
    father_name      text NOT NULL,
    date_of_birth    date NOT NULL,
    gender           text NOT NULL CONSTRAINT inter_pp_gender_chk
                     CHECK (gender IN ('male', 'female', 'other')),
    email_address    text,
    mobile_number    text NOT NULL,
    landline_number  text,
    religion         text NOT NULL
                     CONSTRAINT inter_pp_religion_chk
                     CHECK (religion IN ('Islam', 'Hinduism', 'Christianity', 'Sikhism', 'Other')),
    nationality      text NOT NULL DEFAULT 'Pakistani',
    domicile_province text NOT NULL DEFAULT 'Khyber Pakhtunkhwa',
    domicile_district text NOT NULL,
    tehsil           text NOT NULL,
    union_council    text NOT NULL,
    mailing_address  text NOT NULL,
    blood_group      text,
    father_cnic      text NOT NULL,
    father_mobile    text NOT NULL,
    mother_name      text NOT NULL,
    mother_cnic      text NOT NULL,
    photo_url        text,
    hafiz_e_quran    boolean NOT NULL DEFAULT false,
    updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Matric / SSC profile (HED student_academic_profile_entry.php, manual path)
CREATE TABLE IF NOT EXISTS public.inter_ssc_profiles (
    applicant_id        uuid PRIMARY KEY REFERENCES public.inter_applicants(id) ON DELETE CASCADE,
    exam_session        text NOT NULL DEFAULT 'Annual'
                        CONSTRAINT inter_ssc_session_chk
                        CHECK (exam_session IN ('Annual', 'Supplementary')),
    exam_board          text NOT NULL,
    passing_year        int  NOT NULL
                        CONSTRAINT inter_ssc_year_chk CHECK (passing_year BETWEEN 1990 AND 2100),
    study_group         text NOT NULL,
    roll_number         text NOT NULL,
    marks_obtained      numeric NOT NULL CHECK (marks_obtained >= 0),
    marks_total         numeric NOT NULL CHECK (marks_total > 0),
    marks_percentage    numeric NOT NULL DEFAULT 0,
    grade               text NOT NULL DEFAULT 'F',
    hafiz_e_quran       boolean NOT NULL DEFAULT false,
    sport_certificate   text,
    institute_province  text NOT NULL DEFAULT 'Khyber Pakhtunkhwa',
    institute_district  text NOT NULL,
    institute_name      text NOT NULL,
    board_record_verified boolean NOT NULL DEFAULT false,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT inter_ssc_marks_chk CHECK (marks_obtained <= marks_total)
);

-- Programs offered for Inter admission at the college
-- (GHSS Ghallanai faculties — HED general-college program names)
CREATE TABLE IF NOT EXISTS public.inter_programs (
    id             int PRIMARY KEY,
    name           text NOT NULL,
    study_level    text NOT NULL DEFAULT 'Intermediate/Diploma',
    seats          int NOT NULL DEFAULT 0,
    allowed_gender text NOT NULL DEFAULT 'both'
                   CONSTRAINT inter_prog_gender_chk
                   CHECK (allowed_gender IN ('male', 'female', 'both')),
    is_active      boolean NOT NULL DEFAULT true,
    display_order  int NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Subject groups per program (HED program_subject_group_id — captured live
-- from get_subjectgroups_by_program_id.php at GDC Wadpaga, a general college
-- with the same four faculties; each Inter group has 7 subjects)
CREATE TABLE IF NOT EXISTS public.inter_subject_groups (
    id            int PRIMARY KEY,
    program_id    int NOT NULL REFERENCES public.inter_programs(id) ON DELETE CASCADE,
    name          text NOT NULL,
    is_active     boolean NOT NULL DEFAULT true,
    display_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inter_groups_program ON public.inter_subject_groups(program_id);

-- Union councils in the college jurisdiction (Mohmand, HED ids preserved)
CREATE TABLE IF NOT EXISTS public.inter_union_councils (
    id   int PRIMARY KEY,
    name text NOT NULL
);

-- Applications (HED student_submit_application*.php + pay flow)
CREATE TABLE IF NOT EXISTS public.inter_applications (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    applicant_id           uuid NOT NULL REFERENCES public.inter_applicants(id) ON DELETE CASCADE,
    program_id             int NOT NULL REFERENCES public.inter_programs(id),
    program_name           text NOT NULL,
    subject_group          text,
    study_level            text NOT NULL DEFAULT 'Intermediate/Diploma',
    quota                  public.inter_quota NOT NULL,
    quota_criteria         text,
    quota_criteria_uc      text,
    sport_certificate      text,
    nature_of_disability   text,
    parent_department      text,
    parent_serving_district text,
    payslip_notice         boolean NOT NULL DEFAULT false,
    declaration            boolean NOT NULL DEFAULT false
                           CONSTRAINT inter_app_decl_chk CHECK (declaration = true),
    shift                  text NOT NULL DEFAULT 'Morning',
    status                 public.inter_app_status NOT NULL DEFAULT 'submitted',
    tracking_id            text NOT NULL UNIQUE,
    jazzcash_token         text,
    processing_fee         int NOT NULL DEFAULT 100,
    fee_deadline           timestamptz NOT NULL,
    payment_status         public.inter_payment_status NOT NULL DEFAULT 'pending',
    payment_reference      text,
    board_record_verified  boolean NOT NULL DEFAULT false,
    admin_note             text,
    submitted_at           timestamptz NOT NULL DEFAULT now(),
    confirmed_at           timestamptz,
    paid_at                timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
-- (re-run safe: column added in v2 of this migration)
ALTER TABLE public.inter_applications
    ADD COLUMN IF NOT EXISTS subject_group text;
CREATE INDEX IF NOT EXISTS idx_inter_apps_applicant ON public.inter_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_inter_apps_tracking  ON public.inter_applications(tracking_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_one_per_quota
    ON public.inter_applications (applicant_id, program_id, quota)
    WHERE (status <> 'cancelled');

-- Public-visible status timeline (HED "Application Detail": # | Title | Date | Details)
CREATE TABLE IF NOT EXISTS public.inter_application_timeline (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES public.inter_applications(id) ON DELETE CASCADE,
    title           text NOT NULL,
    details         text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inter_tl_app ON public.inter_application_timeline(application_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3b. MERIT LISTS (HED merit_list_view.php — public per program + quota)
-- Table: # | Tracking ID | Name | Father Name | Total | Obtained | Net
--       Marks | Percentage | Remarks  + Important Dates + Instructions
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inter_merit_lists (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id          int NOT NULL REFERENCES public.inter_programs(id),
    program_name        text NOT NULL,
    quota               public.inter_quota NOT NULL,
    list_no             int NOT NULL DEFAULT 1,
    title               text NOT NULL,
    admission_start_date date,
    admission_last_date  date,
    instructions        text,
    is_published        boolean NOT NULL DEFAULT false,
    published_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inter_ml_program ON public.inter_merit_lists(program_id, quota);

CREATE TABLE IF NOT EXISTS public.inter_merit_list_entries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merit_list_id   uuid NOT NULL REFERENCES public.inter_merit_lists(id) ON DELETE CASCADE,
    application_id  uuid NOT NULL REFERENCES public.inter_applications(id) ON DELETE CASCADE,
    position        int NOT NULL,
    tracking_id     text NOT NULL,
    name            text NOT NULL,
    father_name     text NOT NULL,
    total_marks     numeric NOT NULL,
    obtained_marks  numeric NOT NULL,
    net_marks       numeric NOT NULL,
    percentage      numeric NOT NULL,
    remarks         text
);
CREATE INDEX IF NOT EXISTS idx_inter_mle_list ON public.inter_merit_list_entries(merit_list_id);
CREATE INDEX IF NOT EXISTS idx_inter_mle_app  ON public.inter_merit_list_entries(application_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. SEED DATA (HED general-college capture 01-Nov-2026 — GHSS faculties)
-- Seats are the school's own sanctioned numbers (editable by the admin
-- via inter_admin_set_program). Subject groups captured verbatim from
-- HED get_subjectgroups_by_program_id.php (GDC Wadpaga — same faculties).
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.inter_programs (id, name, study_level, seats, allowed_gender, is_active, display_order)
VALUES
    (1, 'Pre-Medical',      'Intermediate/Diploma', 100, 'both', true, 1),
    (2, 'Pre-Engineering',  'Intermediate/Diploma',  50, 'both', true, 2),
    (3, 'ICS (Computer Sciences)', 'Intermediate/Diploma', 50, 'both', true, 3),
    (4, 'Arts/Humanities',  'Intermediate/Diploma', 100, 'both', true, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, study_level = EXCLUDED.study_level,
    seats = EXCLUDED.seats, display_order = EXCLUDED.display_order;
-- retire stray program rows from older runs (never touched if referenced)
DELETE FROM public.inter_programs p
 WHERE p.id NOT IN (1, 2, 3, 4)
   AND NOT EXISTS (SELECT 1 FROM public.inter_applications a WHERE a.program_id = p.id);

INSERT INTO public.inter_subject_groups (id, program_id, name, display_order) VALUES
    (1, 1, 'Botany,Chemistry,English,Islamic Edu,Mutalia-e-Quran,Physics,Urdu', 1),
    (2, 2, 'Chemistry,English,Islamic Edu,Maths,Mutalia-e-Quran,Physics,Urdu', 1),
    (3, 3, 'Computer Sc,English,Islamic Edu,Maths,Mutalia-e-Quran,Physics,Urdu', 1),
    (4, 4, 'Civics,English,HPE,Islamic Edu,Library Science,Mutalia-e-Quran,Urdu', 1),
    (5, 4, 'Civics,Economics,English,Geography,Islamic Edu,Mutalia-e-Quran,Urdu', 2)
ON CONFLICT (id) DO UPDATE SET
    program_id = EXCLUDED.program_id, name = EXCLUDED.name,
    display_order = EXCLUDED.display_order;

INSERT INTO public.inter_union_councils (id, name) VALUES
    (2808,'Khewezai'),          (2809,'Baizai-2'),         (2810,'Baizai-1'),
    (2811,'Khewezai-2'),        (2812,'Baizai-4'),         (2813,'Khewezai-1'),
    (2814,'Baizai-3'),          (2815,'Utmankhel-9'),      (2816,'Dawezai-2'),
    (2817,'Tarakzai-3'),        (2818,'Yaka Ghund'),       (2819,'Utmankhel-2'),
    (2820,'Issa Khel-1'),       (2821,'Laman Utman Khel-3'),(2822,'Prang Ghar'),
    (2823,'Laman Utman Khel-1'),(2824,'Laman Utman Khel-2'),(2825,'Utmankhel-4'),
    (2826,'Dawezai-1'),         (2827,'Issa Khel-4'),      (2828,'Burhan Khel-2'),
    (2829,'Tamanzi-1'),         (2830,'Tarakzai-4'),       (2831,'Tarakzai-2'),
    (2832,'Dawezai-3'),         (2833,'Burhan Khel-3'),    (2834,'Burhan Khel-1'),
    (2835,'Tarakzai-5'),        (2836,'Utmankhel-5'),      (2837,'Issa Khel-3'),
    (2838,'Utmankhel-1'),       (2839,'Utmankhel-3'),      (2840,'Tarakzai-1'),
    (2841,'Tamanzi-2'),         (2842,'Utmankhel-7'),      (2843,'Utmankhel-6'),
    (2844,'Burhan Khel-4'),     (2845,'Issa Khel-2'),      (2846,'Utmankhel-8'),
    (2847,'Tarakzai-7'),        (2848,'Tarakzai-6'),       (2849,'Kamali Halimzai-1'),
    (2850,'Masood-3'),          (2851,'Qandahari-3'),      (2852,'Lakarai'),
    (2853,'Kamali Halimzai-2'), (2854,'Gurbaz'),           (2855,'Qandahari-2'),
    (2856,'Sagi-2'),            (2857,'Sagi-1'),           (2858,'Ghallanai'),
    (2859,'Durba Khel-4'),      (2860,'Durba Khel-5'),     (2861,'Qandahari-1'),
    (2862,'Sheikh Baba'),       (2863,'Masood-2'),         (2864,'Masood-1'),
    (2865,'Kuz Kadi-2'),        (2866,'Bara Kadi Khel-2'), (2867,'Kuz Kadi Khel-1'),
    (2868,'Durba Khel-2'),      (2869,'Durba Khel-1'),     (2870,'Durba Khel-3'),
    (2871,'Bara Kadi Khel-1'),  (2872,'Chamarkand')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 5. ROW LEVEL SECURITY — deny all direct access; RPCs only
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.inter_applicants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_applicant_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_personal_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_ssc_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_programs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_subject_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_union_councils       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_application_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_merit_lists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inter_merit_list_entries   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'inter_applicants', 'inter_applicant_sessions', 'inter_personal_profiles',
        'inter_ssc_profiles', 'inter_programs', 'inter_subject_groups',
        'inter_union_councils', 'inter_applications', 'inter_application_timeline',
        'inter_merit_lists', 'inter_merit_list_entries'
    ] LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS inter_deny_all ON public.%I; CREATE POLICY inter_deny_all ON public.%I FOR ALL USING (false) WITH CHECK (false)',
            t, t);
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────

-- Resolve a session token → applicant row, or NULL (expired/invalid)
CREATE OR REPLACE FUNCTION public.inter_auth(p_token uuid)
RETURNS public.inter_applicants
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT a.* FROM public.inter_applicants a
    JOIN public.inter_applicant_sessions s ON s.applicant_id = a.id
    WHERE s.token = p_token
      AND s.expires_at > now()
      AND a.status = 'active'
    LIMIT 1;
$$;

-- Staff guard (Supabase Auth admin)
CREATE OR REPLACE FUNCTION public.inter_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- HED grade scale (A+ ≥ 80% as verified on the live system)
CREATE OR REPLACE FUNCTION public.inter_grade_for(p_percentage numeric)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_percentage >= 80 THEN 'A+'
        WHEN p_percentage >= 70 THEN 'A'
        WHEN p_percentage >= 60 THEN 'B'
        WHEN p_percentage >= 50 THEN 'C'
        WHEN p_percentage >= 40 THEN 'D'
        ELSE 'F'
    END;
$$;

-- Exact age (y/m/d) from DOB — mirrors HED get_age_against_cycle.php
-- (which returns PHP DateInterval {y, m, d})
CREATE OR REPLACE FUNCTION public.inter_age(p_dob date)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
    SELECT jsonb_build_object(
        'y', date_part('year',  age(current_date, p_dob))::int,
        'm', date_part('month', age(current_date, p_dob))::int,
        'd', date_part('day',   age(current_date, p_dob))::int
    );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. AUTH RPCs  (register / login / logout / session state)
-- ─────────────────────────────────────────────────────────────────────

-- HED apply_step1.php — Create Account
CREATE OR REPLACE FUNCTION public.inter_register(
    p_nationality text,
    p_cnic_formb  text,
    p_mobile      text,
    p_password    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_id uuid; v_token uuid;
BEGIN
    p_nationality := coalesce(p_nationality, 'Pakistani');
    IF p_nationality NOT IN ('Pakistani', 'Afghani') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid nationality.');
    END IF;
    p_cnic_formb := regexp_replace(coalesce(p_cnic_formb, ''), '[^0-9]', '', 'g');
    IF length(p_cnic_formb) <> 13 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'CNIC/Form-B Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000');
    END IF;
    p_mobile := regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g');
    IF p_mobile !~ '^03[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Make sure that your mobile number is correct and in 03451234567 format.');
    END IF;
    IF length(coalesce(p_password, '')) < 8 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Password should be at least 8 characters');
    END IF;
    IF EXISTS (SELECT 1 FROM public.inter_applicants WHERE cnic_formb = p_cnic_formb) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'An account with this CNIC/Form-B already exists. Please Login.');
    END IF;

    INSERT INTO public.inter_applicants (cnic_formb, mobile_number, nationality, password_hash)
    VALUES (p_cnic_formb, p_mobile, p_nationality, crypt(p_password, gen_salt('bf', 10)))
    RETURNING id INTO v_id;

    INSERT INTO public.inter_applicant_sessions (applicant_id, expires_at)
    VALUES (v_id, now() + interval '30 days')
    RETURNING token INTO v_token;

    RETURN jsonb_build_object('ok', true, 'token', v_token, 'applicant_id', v_id,
                              'cnic_formb', p_cnic_formb, 'mobile', p_mobile);
END;
$$;

-- HED student_login.php — login_id (CNIC) + password
CREATE OR REPLACE FUNCTION public.inter_login(p_login_id text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants; v_token uuid;
BEGIN
    p_login_id := regexp_replace(coalesce(p_login_id, ''), '[^0-9]', '', 'g');
    SELECT * INTO v_app FROM public.inter_applicants WHERE cnic_formb = p_login_id;
    IF v_app.id IS NULL OR crypt(coalesce(p_password, ''), v_app.password_hash) <> v_app.password_hash THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invalid CNIC/Form-B or password.');
    END IF;
    IF v_app.status <> 'active' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Your account has been disabled. Contact the college.');
    END IF;

    INSERT INTO public.inter_applicant_sessions (applicant_id, expires_at)
    VALUES (v_app.id, now() + interval '30 days')
    RETURNING token INTO v_token;

    RETURN jsonb_build_object('ok', true, 'token', v_token, 'cnic_formb', v_app.cnic_formb);
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_logout(p_token uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions
AS $$ DELETE FROM public.inter_applicant_sessions WHERE token = p_token; $$;

-- Everything the portal needs in one call (HED dashboard + menu state)
CREATE OR REPLACE FUNCTION public.inter_session_state(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants; v_personal public.inter_personal_profiles;
    v_ssc public.inter_ssc_profiles;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_personal FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_ssc FROM public.inter_ssc_profiles WHERE applicant_id = v_app.id;

    RETURN jsonb_build_object(
        'ok', true,
        'applicant', jsonb_build_object(
            'id', v_app.id, 'cnic_formb', v_app.cnic_formb,
            'mobile', v_app.mobile_number, 'nationality', v_app.nationality),
        'personal', CASE WHEN v_personal.applicant_id IS NULL THEN NULL ELSE
            to_jsonb(v_personal) - 'applicant_id' - 'updated_at' END,
        'ssc', CASE WHEN v_ssc.applicant_id IS NULL THEN NULL ELSE
            to_jsonb(v_ssc) - 'applicant_id' - 'updated_at' END,
        'applications', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', a.id, 'tracking_id', a.tracking_id,
                'program_name', a.program_name, 'subject_group', a.subject_group,
                'quota', a.quota,
                'quota_criteria', a.quota_criteria,
                'fee_deadline', to_char(a.fee_deadline, 'DD-Mon-YYYY HH12:MI PM'),
                'fee_deadline_iso', a.fee_deadline,
                'payment_status', a.payment_status, 'status', a.status,
                'jazzcash_token', a.jazzcash_token,
                'hafiz_e_quran', COALESCE(v_ssc.hafiz_e_quran, false),
                'submitted_at', to_char(a.submitted_at, 'YYYY-MM-DD'),
                'processing_fee', a.processing_fee
            ) ORDER BY a.submitted_at DESC), '[]'::jsonb)
            FROM public.inter_applications a WHERE a.applicant_id = v_app.id)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. PROFILE RPCs
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_save_personal(p_token uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_required text[] := ARRAY['full_name','father_name','date_of_birth','gender',
        'mobile_number','religion','domicile_district','tehsil','union_council',
        'mailing_address','father_cnic','father_mobile','mother_name','mother_cnic'];
    v_f text;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    FOREACH v_f IN ARRAY v_required LOOP
        IF nullif(trim(coalesce(p_data ->> v_f, '')), '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Field "' || v_f || '" is mandatory.');
        END IF;
    END LOOP;
    IF (p_data ->> 'gender') NOT IN ('male','female','other') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid gender.');
    END IF;
    IF (p_data ->> 'father_cnic') !~ '^[0-9]{13}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Father CNIC must be 13 digits without dashes.');
    END IF;
    IF (p_data ->> 'mother_cnic') !~ '^[0-9]{13}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Mother CNIC must be 13 digits without dashes.');
    END IF;
    IF (p_data ->> 'mobile_number') !~ '^03[0-9]{9}$' OR (p_data ->> 'father_mobile') !~ '^03[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Mobile numbers must be in 03451234567 format.');
    END IF;

    INSERT INTO public.inter_personal_profiles AS pp (
        applicant_id, full_name, father_name, date_of_birth, gender, email_address,
        mobile_number, landline_number, religion, nationality, domicile_province,
        domicile_district, tehsil, union_council, mailing_address, blood_group,
        father_cnic, father_mobile, mother_name, mother_cnic, photo_url, hafiz_e_quran, updated_at
    ) VALUES (
        v_app.id,
        p_data ->> 'full_name', p_data ->> 'father_name', (p_data ->> 'date_of_birth')::date,
        p_data ->> 'gender', nullif(p_data ->> 'email_address', ''),
        p_data ->> 'mobile_number', nullif(p_data ->> 'landline_number', ''),
        p_data ->> 'religion', coalesce(p_data ->> 'nationality', v_app.nationality),
        coalesce(p_data ->> 'domicile_province', 'Khyber Pakhtunkhwa'),
        p_data ->> 'domicile_district', p_data ->> 'tehsil', p_data ->> 'union_council',
        p_data ->> 'mailing_address', nullif(p_data ->> 'blood_group', ''),
        p_data ->> 'father_cnic', p_data ->> 'father_mobile',
        p_data ->> 'mother_name', p_data ->> 'mother_cnic',
        nullif(p_data ->> 'photo_url', ''), coalesce((p_data ->> 'hafiz_e_quran')::boolean, false),
        now()
    ) ON CONFLICT (applicant_id) DO UPDATE SET
        full_name = EXCLUDED.full_name, father_name = EXCLUDED.father_name,
        date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender,
        email_address = EXCLUDED.email_address, mobile_number = EXCLUDED.mobile_number,
        landline_number = EXCLUDED.landline_number, religion = EXCLUDED.religion,
        nationality = EXCLUDED.nationality, domicile_province = EXCLUDED.domicile_province,
        domicile_district = EXCLUDED.domicile_district, tehsil = EXCLUDED.tehsil,
        union_council = EXCLUDED.union_council, mailing_address = EXCLUDED.mailing_address,
        blood_group = EXCLUDED.blood_group, father_cnic = EXCLUDED.father_cnic,
        father_mobile = EXCLUDED.father_mobile, mother_name = EXCLUDED.mother_name,
        mother_cnic = EXCLUDED.mother_cnic, photo_url = EXCLUDED.photo_url,
        hafiz_e_quran = EXCLUDED.hafiz_e_quran, updated_at = now();

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Matric/SSC profile — manual entry (HED manual path), grade auto-computed,
-- hafiz +20 marks percentage rule applied verbatim.
CREATE OR REPLACE FUNCTION public.inter_save_ssc(p_token uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_obt numeric; v_total numeric; v_pct numeric;
    v_required text[] := ARRAY['exam_board','passing_year','study_group','roll_number',
        'marks_obtained','marks_total','institute_district','institute_name'];
    v_f text;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    FOREACH v_f IN ARRAY v_required LOOP
        IF nullif(trim(coalesce(p_data ->> v_f, '')), '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Field "' || v_f || '" is mandatory.');
        END IF;
    END LOOP;

    v_obt := (p_data ->> 'marks_obtained')::numeric;
    v_total := (p_data ->> 'marks_total')::numeric;
    IF v_total <= 0 OR v_obt < 0 OR v_obt > v_total THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Marks obtained cannot exceed total marks.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inter_personal_profiles WHERE applicant_id = v_app.id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please complete your Personal Information first.');
    END IF;

    -- HED: if hafiz then percentage = ((obtained + 20) / total) * 100
    v_pct := round(((v_obt + CASE WHEN coalesce((p_data ->> 'hafiz_e_quran')::boolean, false)
                                  THEN 20 ELSE 0 END) / v_total) * 100, 2);

    INSERT INTO public.inter_ssc_profiles AS s (
        applicant_id, exam_session, exam_board, passing_year, study_group, roll_number,
        marks_obtained, marks_total, marks_percentage, grade, hafiz_e_quran,
        sport_certificate, institute_province, institute_district, institute_name,
        board_record_verified, updated_at
    ) VALUES (
        v_app.id,
        coalesce(p_data ->> 'exam_session', 'Annual'),
        p_data ->> 'exam_board', (p_data ->> 'passing_year')::int,
        p_data ->> 'study_group', p_data ->> 'roll_number',
        v_obt, v_total, v_pct, public.inter_grade_for(v_pct),
        coalesce((p_data ->> 'hafiz_e_quran')::boolean, false),
        nullif(p_data ->> 'sport_certificate', ''),
        coalesce(p_data ->> 'institute_province', 'Khyber Pakhtunkhwa'),
        p_data ->> 'institute_district', p_data ->> 'institute_name',
        false, now()
    ) ON CONFLICT (applicant_id) DO UPDATE SET
        exam_session = EXCLUDED.exam_session, exam_board = EXCLUDED.exam_board,
        passing_year = EXCLUDED.passing_year, study_group = EXCLUDED.study_group,
        roll_number = EXCLUDED.roll_number, marks_obtained = EXCLUDED.marks_obtained,
        marks_total = EXCLUDED.marks_total, marks_percentage = EXCLUDED.marks_percentage,
        grade = EXCLUDED.grade, hafiz_e_quran = EXCLUDED.hafiz_e_quran,
        sport_certificate = EXCLUDED.sport_certificate,
        institute_province = EXCLUDED.institute_province,
        institute_district = EXCLUDED.institute_district,
        institute_name = EXCLUDED.institute_name,
        board_record_verified = false, updated_at = now();

    RETURN jsonb_build_object('ok', true, 'percentage', v_pct,
                              'grade', public.inter_grade_for(v_pct));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 9. APPLICATION RPCs (the cascade rules, verbatim HED messages)
-- ─────────────────────────────────────────────────────────────────────

-- Public: active Inter programs (with their subject groups — HED
-- get_subjectgroups_by_program_id.php behaviour folded into one call)
CREATE OR REPLACE FUNCTION public.inter_programs_list(p_include_inactive boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'study_level', p.study_level,
        'seats', p.seats, 'allowed_gender', p.allowed_gender,
        'is_active', p.is_active,
        'subject_groups', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', g.id, 'name', g.name) ORDER BY g.display_order, g.id), '[]'::jsonb)
            FROM public.inter_subject_groups g
            WHERE g.program_id = p.id AND g.is_active)
    ) ORDER BY p.display_order), '[]'::jsonb)
    FROM public.inter_programs p
    WHERE p.is_active OR p_include_inactive;
$$;

-- Public: subject groups only (flat) — for the Program Subject Groups select
CREATE OR REPLACE FUNCTION public.inter_subject_groups_list(p_program_id int DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'program_id', g.program_id, 'name', g.name
    ) ORDER BY g.display_order, g.id), '[]'::jsonb)
    FROM public.inter_subject_groups g
    WHERE g.is_active
      AND (p_program_id IS NULL OR g.program_id = p_program_id);
$$;

-- Public: college jurisdiction UCs (for Local Quota display)
CREATE OR REPLACE FUNCTION public.inter_ucs_list()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY id), '[]'::jsonb)
    FROM public.inter_union_councils;
$$;

-- Quota validation BEFORE submit (mirrors the live cascade checks)
-- Returns {ok, message?, needs?} exactly like the HED JS behaviours.
CREATE OR REPLACE FUNCTION public.inter_check_quota(
    p_token uuid,
    p_quota text,
    p_criteria jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_pp public.inter_personal_profiles;
    v_ssc public.inter_ssc_profiles;
    v_uc text; v_is_local boolean;
    v_age_y int;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_pp FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_ssc FROM public.inter_ssc_profiles WHERE applicant_id = v_app.id;
    IF v_pp.applicant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please complete your Personal Information before applying.');
    END IF;
    IF v_ssc.applicant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please Fill your Metric profile before applying to Intermediate Program.');
    END IF;

    -- Is the applicant's Union Council inside the college jurisdiction?
    v_is_local := EXISTS (
        SELECT 1 FROM public.inter_union_councils u
        WHERE trim(lower(u.name)) = trim(lower(v_pp.union_council)));

    IF p_quota = 'open_merit' AND v_is_local THEN
        -- Verified live: local applicants are blocked from Open Merit
        RETURN jsonb_build_object('ok', false, 'error',
            'Your domicile is local; therefore, apply on Local Quota.');
    END IF;

    v_age_y := (public.inter_age(v_pp.date_of_birth) ->> 'y')::int;

    IF p_quota = 'local_quota' THEN
        IF p_criteria IS NULL OR (p_criteria ->> 'criteria') IS NULL
           OR (p_criteria ->> 'criteria') NOT IN ('domicile_of_area', 'father_serve_area') THEN
            RETURN jsonb_build_object('ok', false, 'needs', 'criteria',
                'error', 'Please select Criteria for Local Quota.');
        END IF;
        IF (p_criteria ->> 'criteria') = 'domicile_of_area' THEN
            IF NOT v_is_local THEN
                RETURN jsonb_build_object('ok', false, 'error',
                    'Applicant Union Council Does not fall in College Union Councils.');
            END IF;
            IF trim(lower(v_pp.domicile_district)) <> 'mohmand' THEN
                RETURN jsonb_build_object('ok', false, 'error',
                    'Not eligible for District Local Quota based on your domicile');
            END IF;
        ELSE -- father_serve_area
            IF nullif(p_criteria ->> 'parent_department', '') IS NULL
               OR nullif(p_criteria ->> 'parent_serving_district', '') IS NULL THEN
                RETURN jsonb_build_object('ok', false, 'needs', 'parent_details',
                    'error', 'Name of Department and Serving District are required for this criteria.');
            END IF;
            IF trim(lower(p_criteria ->> 'parent_serving_district')) <> 'mohmand' THEN
                RETURN jsonb_build_object('ok', false, 'error',
                    'Not eligible for District Local Quota based on your Parent/Spouse Service');
            END IF;
            IF coalesce((p_criteria ->> 'payslip_notice')::boolean, false) <> true THEN
                RETURN jsonb_build_object('ok', false, 'needs', 'payslip_notice',
                    'error', 'Please attach/acknowledge the payslip notice to continue.');
            END IF;
        END IF;
    ELSIF p_quota = 'sports' THEN
        IF nullif(p_criteria ->> 'sport_certificate', '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'needs', 'sport_certificate',
                'error', 'Sports participation certificate is required for Sports quota.');
        END IF;
        IF v_age_y >= 19 THEN
            RETURN jsonb_build_object('ok', false, 'error',
                'You are overage and not eligible for the sports quota');
        END IF;
    ELSIF p_quota = 'college_employees' THEN
        IF nullif(p_criteria ->> 'parent_department', '') IS NULL
           OR nullif(p_criteria ->> 'parent_serving_district', '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'needs', 'parent_details',
                'error', 'Parent department and serving district are required for College Employees quota.');
        END IF;
        IF coalesce((p_criteria ->> 'payslip_notice')::boolean, false) <> true THEN
            RETURN jsonb_build_object('ok', false, 'needs', 'payslip_notice',
                'error', 'Please attach/acknowledge the payslip notice to continue.');
        END IF;
    ELSIF p_quota = 'special_person' THEN
        IF nullif(p_criteria ->> 'nature_of_disability', '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'needs', 'nature_of_disability',
                'error', 'Nature of disability is required for Special Person quota.');
        END IF;
    END IF;

    -- Non-blocking overage warning (verbatim HED message)
    IF v_age_y >= 19 THEN
        RETURN jsonb_build_object('ok', true, 'warning',
            'You are overage. An age relaxation certificate is required for Inter admission.');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Submit a new application (HED Submit Application → confirm page state)
-- p_subject_group mirrors HED program_subject_group_id (group NAME is
-- stored; required when the program defines subject groups).
CREATE OR REPLACE FUNCTION public.inter_submit_application(
    p_token uuid,
    p_program_id int,
    p_quota text,
    p_criteria jsonb DEFAULT NULL,
    p_subject_group text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_pp public.inter_personal_profiles;
    v_prog public.inter_programs;
    v_q public.inter_quota;
    v_check jsonb;
    v_seq int; v_tracking text; v_id uuid;
    v_criteria_final jsonb := coalesce(p_criteria, '{}'::jsonb);
    v_uc_name text;
    v_deadline timestamptz;
    v_last_date date;
    v_group_count int;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_pp FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_prog FROM public.inter_programs
        WHERE id = p_program_id AND is_active;
    IF v_prog.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid program.');
    END IF;

    -- Subject group: mandatory when the program defines groups (HED rule)
    SELECT count(*) INTO v_group_count FROM public.inter_subject_groups
        WHERE program_id = v_prog.id AND is_active;
    IF v_group_count > 0 THEN
        IF nullif(trim(coalesce(p_subject_group, '')), '') IS NULL THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Please select a Subject Group.');
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.inter_subject_groups
            WHERE program_id = v_prog.id AND is_active
              AND trim(name) = trim(p_subject_group)) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid Subject Group for this program.');
        END IF;
    END IF;

    BEGIN
        v_q := p_quota::public.inter_quota;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid category (quota).');
    END;

    -- Gender eligibility (allowed_gender on program)
    IF v_prog.allowed_gender <> 'both' AND v_prog.allowed_gender <> v_pp.gender THEN
        RETURN jsonb_build_object('ok', false, 'error',
            upper(v_pp.gender) || ' applicants are not eligible for this program');
    END IF;

    -- Duplicate rule (one application per program per quota in this college)
    -- Verbatim live-verified message (GDC Wadpaga, 01-Nov-2026)
    IF EXISTS (
        SELECT 1 FROM public.inter_applications
        WHERE applicant_id = v_app.id AND program_id = v_prog.id
          AND quota = v_q AND status <> 'cancelled') THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Error! You have already applied for this program in this college, please select a different program.');
    END IF;

    -- Full quota validation cascade
    v_check := public.inter_check_quota(p_token, p_quota, p_criteria);
    IF NOT (v_check ->> 'ok')::boolean THEN
        RETURN v_check;
    END IF;

    -- Declaration must be agreed
    IF coalesce((v_criteria_final ->> 'declaration')::boolean, false) <> true THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'You must agree to the declaration before submitting.');
    END IF;

    -- Fee deadline — HED behaviour (verified twice): the JazzCash token must
    -- be paid by the ADMISSION CYCLE LAST DATE (GCMS: 05-Nov for a 01-Nov
    -- submission; GDC Wadpaga: same-day 01-Nov). Fall back to submission + 4
    -- days when the school has not set admission_settings.last_date.
    SELECT last_date INTO v_last_date FROM public.admission_settings WHERE id = 1;
    v_deadline := CASE
        WHEN v_last_date IS NOT NULL
            THEN (v_last_date + interval '1 day' - interval '1 second')  -- 23:59:59
        ELSE (date_trunc('day', now()) + interval '4 days' + interval '23:59:00')
    END;

    -- Numbers: Tracking ID  = MON + YYYY + seq   (e.g. NOV2026394628-style)
    v_seq := nextval('public.inter_application_seq');
    v_tracking := upper(to_char(now(), 'MON')) || to_char(now(), 'YYYY') || v_seq::text;

    INSERT INTO public.inter_applications (
        applicant_id, program_id, program_name, subject_group, study_level, quota,
        quota_criteria, quota_criteria_uc, sport_certificate, nature_of_disability,
        parent_department, parent_serving_district, payslip_notice,
        declaration, status, tracking_id, processing_fee, fee_deadline,
        board_record_verified, submitted_at
    ) VALUES (
        v_app.id, v_prog.id, v_prog.name, nullif(trim(coalesce(p_subject_group, '')), ''),
        v_prog.study_level, v_q,
        CASE WHEN v_q = 'local_quota' THEN v_criteria_final ->> 'criteria'
             WHEN v_q = 'college_employees' THEN 'father_serve_area' ELSE NULL END,
        v_pp.union_council,
        nullif(v_criteria_final ->> 'sport_certificate', ''),
        CASE WHEN v_q = 'special_person' THEN v_criteria_final ->> 'nature_of_disability' ELSE NULL END,
        nullif(v_criteria_final ->> 'parent_department', ''),
        nullif(v_criteria_final ->> 'parent_serving_district', ''),
        coalesce((v_criteria_final ->> 'payslip_notice')::boolean, false),
        true, 'submitted', v_tracking, 100, v_deadline,
        false, now()
    ) RETURNING id INTO v_id;

    SELECT name INTO v_uc_name FROM public.inter_union_councils
        WHERE trim(lower(name)) = trim(lower(v_pp.union_council));

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_id, 'Application Submitted',
            'Application submitted to Government Higher Secondary School Ghallanai — '
            || v_prog.name || ' (' || v_q || '). Processing fee Rs. 100/-.');

    RETURN jsonb_build_object('ok', true, 'application_id', v_id, 'tracking_id', v_tracking,
                              'program_name', v_prog.name, 'quota', v_q,
                              'fee_deadline', to_char(v_deadline, 'DD-Mon-YYYY'));
END;
$$;

-- "Submit & Pay Application Processing Fee" → Proceed with Payment →
-- generates the JazzCash token + deadline (HED student_pay_application_fee_response.php)
CREATE OR REPLACE FUNCTION public.inter_proceed_payment(p_token uuid, p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_approw public.inter_applications;
    v_token text;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_approw FROM public.inter_applications
        WHERE id = p_application_id AND applicant_id = v_app.id FOR UPDATE;
    IF v_approw.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    IF v_approw.jazzcash_token IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'token', v_approw.jazzcash_token,
            'tracking_id', v_approw.tracking_id,
            'deadline', to_char(v_approw.fee_deadline, 'DD-Mon-YYYY'));
    END IF;

    -- JazzCash token = YYMMDD + 9-digit sequence (15 digits, HED format)
    v_token := to_char(now(), 'YYMMDD') || lpad(nextval('public.inter_application_seq')::text, 9, '0');

    UPDATE public.inter_applications
        SET jazzcash_token = v_token, confirmed_at = now(),
            status = 'fee_pending', updated_at = now()
        WHERE id = v_approw.id;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_approw.id, 'Processing Fee Token Generated',
            'JazzCash Token ' || v_token ||
            ' generated. Pay Rs. 100/- at any JAZZ CASH or through JAZZ CASH APP on or before '
            || to_char(v_approw.fee_deadline, 'DD-Mon-YYYY') || '.');

    RETURN jsonb_build_object('ok', true, 'token', v_token,
        'tracking_id', v_approw.tracking_id,
        'deadline', to_char(v_approw.fee_deadline, 'DD-Mon-YYYY'));
END;
$$;

-- Full application detail (view/print page)
CREATE OR REPLACE FUNCTION public.inter_application_detail(p_token uuid, p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_row public.inter_applications; v_pp public.inter_personal_profiles;
    v_ssc public.inter_ssc_profiles;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications
        WHERE id = p_application_id AND applicant_id = v_app.id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    SELECT * INTO v_pp FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_ssc FROM public.inter_ssc_profiles WHERE applicant_id = v_app.id;

    RETURN jsonb_build_object(
        'ok', true,
        'application', to_jsonb(v_row),
        'personal', to_jsonb(v_pp) - 'applicant_id',
        'ssc', to_jsonb(v_ssc) - 'applicant_id',
        'applicant_cnic', v_app.cnic_formb,
        'timeline', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'title', t.title, 'details', t.details,
                'date', to_char(t.created_at, 'DD-Mon-YYYY HH12:MI AM'))
                ORDER BY t.created_at), '[]'::jsonb)
            FROM public.inter_application_timeline t
            WHERE t.application_id = v_row.id)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 10. PUBLIC TRACK (HED application_status.php — tracking id only)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_track(p_tracking_id text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT CASE WHEN a.id IS NULL THEN jsonb_build_object('ok', false)
        ELSE jsonb_build_object(
            'ok', true,
            'tracking_id', a.tracking_id,
            'college', 'Government Higher Secondary School Ghallanai',
            'program', a.program_name,
            'subject_group', a.subject_group,
            'payment_status', initcap(a.payment_status::text),
            'application_date', to_char(a.submitted_at, 'YYYY-MM-DD'),
            'status', a.status::text,
            'timeline', (
                SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'title', t.title, 'details', t.details,
                    'date', to_char(t.created_at, 'DD-Mon-YYYY HH12:MI AM'))
                    ORDER BY t.created_at), '[]'::jsonb)
                FROM public.inter_application_timeline t
                WHERE t.application_id = a.id)
        ) END
    FROM public.inter_applications a
    WHERE upper(trim(a.tracking_id)) = upper(trim(p_tracking_id))
    LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 11. ADMIN RPCs (staff, guarded by Supabase Auth admin role)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_list(p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'applications', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', a.id, 'tracking_id', a.tracking_id,
            'applicant_cnic', ap.cnic_formb, 'applicant_mobile', ap.mobile_number,
            'name', pp.full_name, 'father_name', pp.father_name,
            'program', a.program_name, 'subject_group', a.subject_group,
            'quota', a.quota::text,
            'quota_criteria', a.quota_criteria,
            'payment_status', a.payment_status::text, 'status', a.status::text,
            'jazzcash_token', a.jazzcash_token,
            'fee_deadline', to_char(a.fee_deadline, 'DD-Mon-YYYY'),
            'marks', (s.marks_obtained || '/' || s.marks_total),
            'grade', s.grade, 'percentage', s.marks_percentage,
            'submitted_at', to_char(a.submitted_at, 'DD-Mon-YYYY'),
            'domicile', pp.domicile_district, 'uc', pp.union_council
        ) ORDER BY a.submitted_at DESC), '[]'::jsonb)
        FROM public.inter_applications a
        JOIN public.inter_applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
        LEFT JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
        WHERE p_search IS NULL
           OR a.tracking_id ILIKE '%' || p_search || '%'
           OR pp.full_name ILIKE '%' || p_search || '%'
           OR ap.cnic_formb LIKE '%' || regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g') || '%')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_set_payment(
    p_application_id uuid, p_payment_status text, p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_applications;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    UPDATE public.inter_applications
        SET payment_status = p_payment_status::public.inter_payment_status,
            payment_reference = p_reference,
            paid_at = CASE WHEN p_payment_status = 'paid' THEN now() ELSE NULL END,
            status = CASE WHEN p_payment_status = 'paid' THEN 'fee_paid' ELSE status END,
            updated_at = now()
        WHERE id = p_application_id;
    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (p_application_id,
            CASE WHEN p_payment_status = 'paid' THEN 'Processing Fee Received'
                 ELSE 'Processing Fee ' || initcap(p_payment_status) END,
            CASE WHEN p_payment_status = 'paid'
                 THEN 'Payment of Rs. 100/- confirmed'
                      || CASE WHEN nullif(p_reference, '') IS NOT NULL THEN ' (Ref: ' || p_reference || ')' ELSE '' END
                 ELSE 'Fee payment marked ' || p_payment_status END);
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_set_status(
    p_application_id uuid, p_status text, p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inter_applications WHERE id = p_application_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    UPDATE public.inter_applications
        SET status = p_status::public.inter_app_status,
            admin_note = coalesce(p_note, admin_note), updated_at = now()
        WHERE id = p_application_id;
    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (p_application_id, 'Status Updated: ' || initcap(replace(p_status, '_', ' ')),
            coalesce(p_note, 'Application status updated by the college.'));
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Admin: manage program seats / active flag (sanctioned seats are the
-- school's own numbers and may change; everything else is HED-fixed)
CREATE OR REPLACE FUNCTION public.inter_admin_set_program(
    p_program_id int, p_seats int DEFAULT NULL, p_is_active boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_programs;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_programs WHERE id = p_program_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Program not found.');
    END IF;
    IF p_seats IS NOT NULL AND (p_seats < 0 OR p_seats > 10000) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Seats must be between 0 and 10000.');
    END IF;
    UPDATE public.inter_programs
       SET seats = coalesce(p_seats, seats),
           is_active = coalesce(p_is_active, is_active)
     WHERE id = p_program_id
     RETURNING name INTO v_row.name;
    RETURN jsonb_build_object('ok', true, 'name', v_row.name);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 12. MERIT LIST RPCs (HED merit_list_view.php, structure captured live)
-- Public list of published merit lists + admin generation & management
-- ─────────────────────────────────────────────────────────────────────

-- Public: published merit lists (college-page "Recent Merit Lists" cards:
-- College | Level | Program | Quota | No. of Applicants | Published on)
CREATE OR REPLACE FUNCTION public.inter_merit_lists_public()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'college', 'Government Higher Secondary School Ghallanai',
        'level', 'Intermediate/Diploma',
        'program', m.program_name,
        'quota', initcap(replace(m.quota::text, '_', ' ')),
        'list_no', m.list_no,
        'title', m.title,
        'no_of_applicants', (
            SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id),
        'published_on', to_char(m.published_at, 'Day DD Mon, YYYY'),
        'admission_start_date', to_char(m.admission_start_date, 'DD-Mon-YYYY'),
        'admission_last_date', to_char(m.admission_last_date, 'DD-Mon-YYYY')
    ) ORDER BY m.published_at DESC NULLS LAST, m.created_at DESC), '[]'::jsonb)
    FROM public.inter_merit_lists m
    WHERE m.is_published;
$$;

-- Public: one merit list with entries (HED table:
-- # | Tracking ID | Name | Father Name | Total | Obtained | Net Marks |
-- Percentage | Remarks  + Important Dates + Instructions)
CREATE OR REPLACE FUNCTION public.inter_merit_list_view(p_merit_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_merit_lists;
BEGIN
    SELECT * INTO v_row FROM public.inter_merit_lists
     WHERE id = p_merit_list_id AND is_published;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'list', jsonb_build_object(
            'id', v_row.id, 'title', v_row.title,
            'program', v_row.program_name,
            'quota', initcap(replace(v_row.quota::text, '_', ' ')),
            'list_no', v_row.list_no,
            'admission_start_date', to_char(v_row.admission_start_date, 'DD-Mon-YYYY'),
            'admission_last_date', to_char(v_row.admission_last_date, 'DD-Mon-YYYY'),
            'instructions', v_row.instructions,
            'published_on', to_char(v_row.published_at, 'Day DD Mon, YYYY')),
        'entries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id,
                'position', e.position, 'tracking_id', e.tracking_id,
                'name', e.name, 'father_name', e.father_name,
                'total_marks', e.total_marks, 'obtained_marks', e.obtained_marks,
                'net_marks', e.net_marks, 'percentage', e.percentage,
                'remarks', e.remarks)
                ORDER BY e.position), '[]'::jsonb)
            FROM public.inter_merit_list_entries e
            WHERE e.merit_list_id = v_row.id));
END;
$$;

-- Admin: generate a merit list for one program + quota from the
-- FEE-PAID applications, sorted by net marks (HED merit order).
-- Net marks = SSC obtained + 20 if Hafiz e Quran (HED merit rule);
-- percentage = round(net / total * 100, 2) — both verified on live lists.
CREATE OR REPLACE FUNCTION public.inter_admin_merit_generate(
    p_program_id int,
    p_quota text,
    p_list_no int DEFAULT 1,
    p_admission_start_date date DEFAULT NULL,
    p_admission_last_date date DEFAULT NULL,
    p_instructions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_admin boolean := public.inter_is_admin();
    v_prog public.inter_programs;
    v_q public.inter_quota;
    v_id uuid;
    v_count int;
    v_ord text;
    v_suffix text;
BEGIN
    IF NOT v_admin THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_prog FROM public.inter_programs WHERE id = p_program_id AND is_active;
    IF v_prog.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Program not found.');
    END IF;
    BEGIN
        v_q := p_quota::public.inter_quota;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid quota.');
    END;

    -- No paid applications → nothing to list (HED lists only fee-cleared apps)
    SELECT count(*) INTO v_count
      FROM public.inter_applications a
      JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
      JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
     WHERE a.program_id = p_program_id AND a.quota = v_q
       AND a.payment_status = 'paid' AND a.status NOT IN ('cancelled', 'rejected');
    IF v_count = 0 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No fee-paid applications for this program and quota yet.');
    END IF;

    -- HED title format: "1st Provisional Merit list for session 2026 [College] Program (Quota)"
    v_ord := CASE p_list_no % 100
        WHEN 11 THEN p_list_no::text || 'th'
        WHEN 12 THEN p_list_no::text || 'th'
        WHEN 13 THEN p_list_no::text || 'th'
        ELSE CASE p_list_no % 10
            WHEN 1 THEN p_list_no::text || 'st'
            WHEN 2 THEN p_list_no::text || 'nd'
            WHEN 3 THEN p_list_no::text || 'rd'
            ELSE p_list_no::text || 'th' END
    END;
    v_suffix := CASE WHEN p_list_no = 1 THEN 'Provisional ' ELSE '' END;

    INSERT INTO public.inter_merit_lists (
        program_id, program_name, quota, list_no, title,
        admission_start_date, admission_last_date, instructions
    ) VALUES (
        p_program_id, v_prog.name, v_q, p_list_no,
        v_ord || ' ' || v_suffix || 'Merit list for session ' || to_char(now(), 'YYYY')
            || ' [Government Higher Secondary School Ghallanai] '
            || v_prog.name || ' (' || initcap(replace(v_q::text, '_', ' ')) || ')',
        p_admission_start_date, p_admission_last_date,
        coalesce(p_instructions,
            'Printed copy of online admission form;' || chr(10) ||
            '03 copies of SSC (Matric) DMC and domicile;' || chr(10) ||
            '04 passport size photos with white background;' || chr(10) ||
            'Copies of Parent and student CNICs/Form-B;' || chr(10) ||
            'All documents shall be attested;' || chr(10) ||
            'All original documents including Parent / student CNICs;' || chr(10) ||
            'Affidavit (students who passed SSC before the current year must submit an affidavit undertaking that they have not taken admission in any institute during this period).')
    ) RETURNING id INTO v_id;

    -- Entries: net = obtained + (hafiz ? 20 : 0), ranked desc, percentage = net/total
    INSERT INTO public.inter_merit_list_entries (
        merit_list_id, application_id, position, tracking_id, name, father_name,
        total_marks, obtained_marks, net_marks, percentage, remarks
    )
    SELECT v_id, a.id,
           row_number() OVER (ORDER BY
               (s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END) DESC,
               a.submitted_at ASC),
           a.tracking_id,
           COALESCE(pp.full_name, '—'), COALESCE(pp.father_name, '—'),
           s.marks_total, s.marks_obtained,
           (s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END),
           round(((s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END)
                  / s.marks_total) * 100, 2),
           NULL
      FROM public.inter_applications a
      JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
      JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
     WHERE a.program_id = p_program_id AND a.quota = v_q
       AND a.payment_status = 'paid' AND a.status NOT IN ('cancelled', 'rejected');

    -- Mark the listed applications + timeline entry
    UPDATE public.inter_applications
       SET status = 'merit_listed', updated_at = now()
     WHERE program_id = p_program_id AND quota = v_q
       AND payment_status = 'paid' AND status NOT IN ('cancelled', 'rejected');
    INSERT INTO public.inter_application_timeline (application_id, title, details)
    SELECT a.id, 'Included in Merit List',
           'Included in the ' || v_ord || ' merit list for ' || v_prog.name
               || ' (' || initcap(replace(v_q::text, '_', ' ')) || ').'
      FROM public.inter_applications a
     WHERE a.program_id = p_program_id AND a.quota = v_q
       AND a.payment_status = 'paid' AND a.status NOT IN ('cancelled', 'rejected');

    RETURN jsonb_build_object('ok', true, 'merit_list_id', v_id,
        'entries', (SELECT count(*) FROM public.inter_merit_list_entries WHERE merit_list_id = v_id));
END;
$$;

-- Admin: all merit lists (published + drafts) with entry counts
CREATE OR REPLACE FUNCTION public.inter_admin_merit_lists()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'lists', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id, 'program', m.program_name,
            'quota', initcap(replace(m.quota::text, '_', ' ')),
            'list_no', m.list_no, 'title', m.title,
            'is_published', m.is_published,
            'published_at', to_char(m.published_at, 'DD-Mon-YYYY'),
            'created_at', to_char(m.created_at, 'DD-Mon-YYYY'),
            'admission_start_date', to_char(m.admission_start_date, 'DD-Mon-YYYY'),
            'admission_last_date', to_char(m.admission_last_date, 'DD-Mon-YYYY'),
            'no_of_applicants', (
                SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id)
        ) ORDER BY m.created_at DESC), '[]'::jsonb)
        FROM public.inter_merit_lists m));
END;
$$;

-- Admin: publish / unpublish a merit list
CREATE OR REPLACE FUNCTION public.inter_admin_merit_publish(
    p_merit_list_id uuid, p_published boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inter_merit_lists WHERE id = p_merit_list_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Merit list not found.');
    END IF;
    UPDATE public.inter_merit_lists
       SET is_published = p_published,
           published_at = CASE WHEN p_published THEN now() ELSE NULL END
     WHERE id = p_merit_list_id;
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Admin: delete an unpublished merit list (published lists must be
-- unpublished first — mirrors HED's one-way publication history)
CREATE OR REPLACE FUNCTION public.inter_admin_merit_delete(p_merit_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF EXISTS (SELECT 1 FROM public.inter_merit_lists
                WHERE id = p_merit_list_id AND is_published) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Unpublish the merit list before deleting it.');
    END IF;
    DELETE FROM public.inter_merit_lists WHERE id = p_merit_list_id;
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- Admin: edit one entry's remarks (e.g. "2 Session(s) Missed")
CREATE OR REPLACE FUNCTION public.inter_admin_merit_entry_remark(
    p_entry_id uuid, p_remarks text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inter_merit_list_entries WHERE id = p_entry_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Entry not found.');
    END IF;
    UPDATE public.inter_merit_list_entries
       SET remarks = nullif(trim(p_remarks), '')
     WHERE id = p_entry_id;
    RETURN jsonb_build_object('ok', true);
END;
$$;
