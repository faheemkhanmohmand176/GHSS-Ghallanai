-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 14 — Admission settings/lock, admin delete/export, Safepay payment
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 21 admission setting lock payment.sql
--   • 22_admission_admin_delete_export.sql
--   • 23_safepay_online_payment.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 21 admission setting lock payment.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 21_admission_settings_lock_payments.sql
-- Run AFTER 20_inter_admission_hed_mirror.sql. SAFE TO RE-RUN.
--
--  1. admission_settings: guarantee row id=1, add fee, payment accounts,
--     and make the date window (open_date .. last_date) authoritative.
--  2. inter_admission_open(): ONE source of truth for "is admission open".
--     Register, login, every applicant session RPC and submit are blocked
--     server-side when closed (not just hidden in the UI).
--  3. Payment: processing fee comes from settings (no hardcoded Rs 100),
--     the payment reference text no longer names JazzCash.
--  4. inter_track: always returns a result, matches Tracking ID or the
--     payment reference, ignores spaces / dashes / case.
--  5. Explicit EXECUTE grants so a re-run of 16_security_hardening.sql can
--     never lock anonymous applicants out of the admission RPCs.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. SETTINGS ───────────────────────────────────────────────────────────
ALTER TABLE public.admission_settings
    ADD COLUMN IF NOT EXISTS processing_fee int NOT NULL DEFAULT 100,
    ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb;

-- The admin "Save" used UPDATE ... WHERE id = 1. With no row it touched 0
-- rows and reported success. The row must always exist.
INSERT INTO public.admission_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. OPEN / CLOSED ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_admission_open()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce((
        SELECT s.is_open
           AND (s.open_date IS NULL OR (now() AT TIME ZONE 'Asia/Karachi')::date >= s.open_date)
           AND (s.last_date IS NULL OR (now() AT TIME ZONE 'Asia/Karachi')::date <= s.last_date)
        FROM public.admission_settings s WHERE s.id = 1
    ), false);
$$;

-- Every applicant-session RPC resolves the token through inter_auth, so
-- closing admissions invalidates all of them at once.
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
      AND public.inter_admission_open()
    LIMIT 1;
$$;

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
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
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


CREATE OR REPLACE FUNCTION public.inter_login(p_login_id text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants; v_token uuid;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
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
    v_fee int;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
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

    -- Subject group: mandatory when the program defines groups
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

    -- Fee deadline (verified twice): the JazzCash token must
    -- be paid by the ADMISSION CYCLE LAST DATE (GCMS: 05-Nov for a 01-Nov
    -- submission; GDC Wadpaga: same-day 01-Nov). Fall back to submission + 4
    -- days when the school has not set admission_settings.last_date.
    BEGIN
        IF to_regclass('public.admission_settings') IS NOT NULL THEN
            EXECUTE 'SELECT last_date FROM public.admission_settings WHERE id = 1' INTO v_last_date;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_last_date := NULL;
    END;
    v_deadline := CASE
        WHEN v_last_date IS NOT NULL
            THEN (v_last_date + interval '1 day' - interval '1 second')  -- 23:59:59
        ELSE (date_trunc('day', now()) + interval '4 days' + interval '23:59:00')
    END;

    -- Numbers: Tracking ID  = MON + YYYY + seq   (e.g. NOV2026394628-style)
    SELECT coalesce(processing_fee, 100) INTO v_fee FROM public.admission_settings WHERE id = 1;
    v_fee := coalesce(v_fee, 100);
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
        true, 'submitted', v_tracking, v_fee, v_deadline,
        false, now()
    ) RETURNING id INTO v_id;

    SELECT name INTO v_uc_name FROM public.inter_union_councils
        WHERE trim(lower(name)) = trim(lower(v_pp.union_council));

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_id, 'Application Submitted',
            'Application submitted to Government Higher Secondary School Ghallanai for '
            || v_prog.name || ' (' || initcap(replace(v_q::text, '_', ' ')) || '). Processing fee Rs. ' || v_fee || '.');

    RETURN jsonb_build_object('ok', true, 'application_id', v_id, 'tracking_id', v_tracking,
                              'program_name', v_prog.name, 'quota', v_q,
                              'fee_deadline', to_char(v_deadline, 'DD-Mon-YYYY'));
END;
$$;


-- 3. PAYMENT ────────────────────────────────────────────────────────────
-- The generated number is a PAYMENT REFERENCE the applicant quotes when
-- paying into the school account shown on the challan.
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
        RETURN jsonb_build_object('ok', false, 'error',
            CASE WHEN public.inter_admission_open()
                 THEN 'Session expired. Please login again.'
                 ELSE 'Admissions are currently closed.' END);
    END IF;
    SELECT * INTO v_approw FROM public.inter_applications
        WHERE id = p_application_id AND applicant_id = v_app.id FOR UPDATE;
    IF v_approw.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    IF v_approw.jazzcash_token IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'token', v_approw.jazzcash_token,
            'tracking_id', v_approw.tracking_id,
            'deadline', to_char(v_approw.fee_deadline, 'DD Mon YYYY'));
    END IF;

    v_token := to_char(now(), 'YYMMDD') || lpad(nextval('public.inter_application_seq')::text, 9, '0');

    UPDATE public.inter_applications
        SET jazzcash_token = v_token, confirmed_at = now(),
            status = 'fee_pending', updated_at = now()
        WHERE id = v_approw.id;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_approw.id, 'Payment Reference Generated',
            'Payment reference ' || v_token || ' generated. Pay Rs. ' || v_approw.processing_fee
            || ' to the school account on the challan on or before '
            || to_char(v_approw.fee_deadline, 'DD Mon YYYY') || '.');

    RETURN jsonb_build_object('ok', true, 'token', v_token,
        'tracking_id', v_approw.tracking_id,
        'deadline', to_char(v_approw.fee_deadline, 'DD Mon YYYY'));
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
                 THEN 'Payment of Rs. ' || v_row.processing_fee || ' confirmed'
                      || CASE WHEN nullif(p_reference, '') IS NOT NULL THEN ' (Ref: ' || p_reference || ')' ELSE '' END
                 ELSE 'Fee payment marked ' || p_payment_status END);
    RETURN jsonb_build_object('ok', true);
END;
$$;


-- 4. TRACK ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_track(p_tracking_id text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key text;
    a public.inter_applications;
BEGIN
    v_key := upper(regexp_replace(coalesce(p_tracking_id, ''), '[^A-Za-z0-9]', '', 'g'));
    IF v_key = '' THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    SELECT * INTO a FROM public.inter_applications x
     WHERE upper(regexp_replace(x.tracking_id, '[^A-Za-z0-9]', '', 'g')) = v_key
        OR regexp_replace(coalesce(x.jazzcash_token, ''), '[^0-9]', '', 'g') = v_key
     ORDER BY x.submitted_at DESC
     LIMIT 1;

    IF a.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'tracking_id', a.tracking_id,
        'college', 'Government Higher Secondary School Ghallanai',
        'program', a.program_name,
        'subject_group', a.subject_group,
        'quota', a.quota::text,
        'payment_status', initcap(a.payment_status::text),
        'status', a.status::text,
        'processing_fee', a.processing_fee,
        'payment_reference', a.jazzcash_token,
        'application_date', to_char(a.submitted_at, 'DD Mon YYYY'),
        'fee_deadline', to_char(a.fee_deadline, 'DD Mon YYYY'),
        'timeline', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'title', t.title, 'details', t.details,
                'date', to_char(t.created_at, 'DD Mon YYYY HH12:MI AM'))
                ORDER BY t.created_at), '[]'::jsonb)
            FROM public.inter_application_timeline t
            WHERE t.application_id = a.id)
    );
END;
$$;

-- 5. GRANTS ─────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'inter\_%'
  LOOP
    IF r.proname LIKE 'inter\_admin\_%' OR r.proname = 'inter_is_admin' THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role', r.proname, r.args);
    END IF;
  END LOOP;
END $$;
-- ▲▲▲ END original file: 21 admission setting lock payment.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 22_admission_admin_delete_export.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 22_admission_admin_delete_export.sql
-- Run AFTER 21. SAFE TO RE-RUN.
--  1. inter_admin_delete_application : admin deletes one application
--  2. inter_admin_export             : every applicant field, for Excel
--  3. inter_admin_merit_view         : admin can open DRAFT merit lists
--  4. inter_admin_set_payment        : marking paid no longer pushes a
--                                      merit-listed / admitted application
--                                      back to "Fee Paid"
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inter_admin_delete_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_track text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT tracking_id INTO v_track FROM public.inter_applications WHERE id = p_application_id;
    IF v_track IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.inter_merit_list_entries e
        JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
        WHERE e.application_id = p_application_id AND l.is_published
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'This application is in a published merit list. Unpublish that list first.');
    END IF;
    -- timeline and draft merit entries are removed by ON DELETE CASCADE
    DELETE FROM public.inter_applications WHERE id = p_application_id;
    RETURN jsonb_build_object('ok', true, 'tracking_id', v_track);
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_export()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'rows', (
        SELECT coalesce(jsonb_agg(
            jsonb_build_object(
                'tracking_id', a.tracking_id, 'program', a.program_name,
                'subject_group', a.subject_group, 'quota', a.quota::text,
                'quota_criteria', a.quota_criteria, 'quota_uc', a.quota_criteria_uc,
                'sport_certificate', coalesce(a.sport_certificate, s.sport_certificate),
                'nature_of_disability', a.nature_of_disability,
                'parent_department', a.parent_department,
                'parent_serving_district', a.parent_serving_district,
                'shift', a.shift, 'status', a.status::text,
                'payment_status', a.payment_status::text,
                'payment_reference', a.payment_reference,
                'fee_reference', a.jazzcash_token, 'processing_fee', a.processing_fee,
                'fee_deadline', to_char(a.fee_deadline AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD'),
                'submitted_at', to_char(a.submitted_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI'),
                'paid_at', to_char(a.paid_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI'),
                'admin_note', a.admin_note
            ) || jsonb_build_object(
                'cnic', ap.cnic_formb, 'applicant_mobile', ap.mobile_number,
                'nationality', pp.nationality, 'full_name', pp.full_name,
                'father_name', pp.father_name,
                'dob', to_char(pp.date_of_birth, 'YYYY-MM-DD'), 'gender', pp.gender,
                'email', pp.email_address, 'landline', pp.landline_number,
                'religion', pp.religion, 'province', pp.domicile_province,
                'district', pp.domicile_district, 'tehsil', pp.tehsil,
                'union_council', pp.union_council, 'address', pp.mailing_address,
                'blood_group', pp.blood_group, 'father_cnic', pp.father_cnic,
                'father_mobile', pp.father_mobile, 'mother_name', pp.mother_name,
                'mother_cnic', pp.mother_cnic, 'hafiz', pp.hafiz_e_quran
            ) || jsonb_build_object(
                'ssc_session', s.exam_session, 'ssc_board', s.exam_board,
                'ssc_year', s.passing_year, 'ssc_group', s.study_group,
                'ssc_roll', s.roll_number, 'ssc_obtained', s.marks_obtained,
                'ssc_total', s.marks_total, 'ssc_percentage', s.marks_percentage,
                'ssc_grade', s.grade, 'inst_province', s.institute_province,
                'inst_district', s.institute_district, 'inst_name', s.institute_name,
                'board_verified', s.board_record_verified
            )
            ORDER BY a.submitted_at DESC), '[]'::jsonb)
        FROM public.inter_applications a
        JOIN public.inter_applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
        LEFT JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
    ));
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_merit_view(p_merit_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_merit_lists;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_merit_lists WHERE id = p_merit_list_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'list', jsonb_build_object('id', v_row.id, 'title', v_row.title,
            'instructions', v_row.instructions, 'is_published', v_row.is_published),
        'entries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id, 'position', e.position, 'tracking_id', e.tracking_id,
                'name', e.name, 'father_name', e.father_name,
                'total_marks', e.total_marks, 'obtained_marks', e.obtained_marks,
                'net_marks', e.net_marks, 'percentage', e.percentage,
                'remarks', e.remarks) ORDER BY e.position), '[]'::jsonb)
            FROM public.inter_merit_list_entries e
            WHERE e.merit_list_id = v_row.id));
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
    IF p_payment_status NOT IN ('pending', 'paid', 'rejected') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invalid payment status.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    UPDATE public.inter_applications
        SET payment_status = p_payment_status::public.inter_payment_status,
            payment_reference = p_reference,
            paid_at = CASE WHEN p_payment_status = 'paid' THEN now() ELSE NULL END,
            status = CASE WHEN p_payment_status = 'paid' AND status IN ('submitted', 'fee_pending')
                          THEN 'fee_paid'::public.inter_app_status ELSE status END,
            updated_at = now()
        WHERE id = p_application_id;
    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (p_application_id,
            CASE WHEN p_payment_status = 'paid' THEN 'Processing Fee Received'
                 ELSE 'Processing Fee ' || initcap(p_payment_status) END,
            CASE WHEN p_payment_status = 'paid'
                 THEN 'Payment of Rs. ' || v_row.processing_fee || ' confirmed'
                      || CASE WHEN nullif(p_reference, '') IS NOT NULL THEN ' (Ref: ' || p_reference || ')' ELSE '' END
                 ELSE 'Fee payment marked ' || p_payment_status END);
    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inter_admin_delete_application(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inter_admin_export() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inter_admin_merit_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inter_admin_delete_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_admin_export() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_admin_merit_view(uuid) TO authenticated, service_role;
-- ▲▲▲ END original file: 22_admission_admin_delete_export.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 23_safepay_online_payment.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════════
-- 23 · Safepay online payment (Easypaisa / JazzCash wallets, cards)
--
--  Adds automatic, per-applicant fee collection through Safepay.
--  • orderId sent to Safepay  = inter_applications.tracking_id
--    (already UNIQUE + indexed → webhook lookup is a single index hit).
--  • All money-state changes happen ONLY inside SECURITY DEFINER functions
--    that are executable by the service role (the Vercel function) — never by
--    the browser. The webhook signature is verified before they are called.
--  • Idempotent: Safepay may deliver the same event many times.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · New columns on applications -------------------------------------------------
ALTER TABLE public.inter_applications
    ADD COLUMN IF NOT EXISTS safepay_tracker         text,
    ADD COLUMN IF NOT EXISTS safepay_transaction_id  text,
    ADD COLUMN IF NOT EXISTS payment_method          text,
    ADD COLUMN IF NOT EXISTS payment_provider        text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_safepay_tracker
    ON public.inter_applications (safepay_tracker) WHERE safepay_tracker IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_safepay_txn
    ON public.inter_applications (safepay_transaction_id) WHERE safepay_transaction_id IS NOT NULL;
-- tracking_id (the Safepay orderId) is UNIQUE already; make the lookup index explicit.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_tracking_lookup
    ON public.inter_applications (tracking_id);

-- 2 · Admin switch (no hardcoded behaviour) --------------------------------------
ALTER TABLE public.admission_settings
    ADD COLUMN IF NOT EXISTS online_payment_enabled boolean NOT NULL DEFAULT true;

-- 3 · Payment event ledger (audit + replay protection) ---------------------------
CREATE TABLE IF NOT EXISTS public.inter_payment_events (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider     text        NOT NULL DEFAULT 'safepay',
    kind         text        NOT NULL CHECK (kind IN ('checkout_created', 'webhook')),
    tracking_id  text,
    tracker      text,
    state        text,
    event_key    text,
    amount       numeric,
    currency     text,
    outcome      text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_payment_events_key
    ON public.inter_payment_events (provider, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inter_payment_events_track
    ON public.inter_payment_events (tracking_id, created_at DESC);

ALTER TABLE public.inter_payment_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server) can read or write it.
REVOKE ALL ON public.inter_payment_events FROM anon, authenticated;

-- 4 · Context for creating a checkout (verifies the applicant session) -----------
CREATE OR REPLACE FUNCTION public.inter_payment_context(p_token uuid, p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_row public.inter_applications;
    v_online boolean;
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
    SELECT coalesce(online_payment_enabled, true) INTO v_online
        FROM public.admission_settings WHERE id = 1;

    RETURN jsonb_build_object(
        'ok', true,
        'application_id', v_row.id,
        'tracking_id', v_row.tracking_id,
        'processing_fee', v_row.processing_fee,
        'payment_status', v_row.payment_status,
        'status', v_row.status,
        'deadline_passed', v_row.fee_deadline < now(),
        'online_enabled', coalesce(v_online, true)
    );
END;
$$;

-- 5 · Apply a verified Safepay event -------------------------------------------
-- p_state: 'paid' | 'failed'. Idempotent. Validates tracker + amount + currency.
CREATE OR REPLACE FUNCTION public.inter_safepay_apply(
    p_tracking_id text,
    p_tracker     text,
    p_state       text,
    p_txn_id      text,
    p_amount      numeric,
    p_currency    text,
    p_method      text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row public.inter_applications;
BEGIN
    SELECT * INTO v_row FROM public.inter_applications
        WHERE tracking_id = p_tracking_id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'unknown_order');
    END IF;

    -- The tracker must be one WE issued for this exact application.
    IF NOT EXISTS (
        SELECT 1 FROM public.inter_payment_events
         WHERE kind = 'checkout_created' AND tracking_id = p_tracking_id AND tracker = p_tracker
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'tracker_mismatch');
    END IF;

    IF p_state = 'paid' THEN
        IF v_row.payment_status = 'paid' THEN
            RETURN jsonb_build_object('ok', true, 'code', 'already_paid');
        END IF;
        IF upper(coalesce(p_currency, 'PKR')) <> 'PKR'
           OR p_amount IS NULL OR p_amount < v_row.processing_fee THEN
            RETURN jsonb_build_object('ok', false, 'code', 'amount_mismatch');
        END IF;

        UPDATE public.inter_applications
           SET payment_status        = 'paid',
               paid_at               = now(),
               safepay_tracker       = p_tracker,
               safepay_transaction_id= nullif(p_txn_id, ''),
               payment_method        = coalesce(nullif(p_method, ''), 'safepay'),
               payment_provider      = 'safepay',
               payment_reference     = coalesce(nullif(p_txn_id, ''), p_tracker),
               confirmed_at          = coalesce(confirmed_at, now()),
               status = CASE WHEN status IN ('submitted', 'fee_pending')
                             THEN 'fee_paid'::public.inter_app_status ELSE status END,
               updated_at            = now()
         WHERE id = v_row.id;

        INSERT INTO public.inter_application_timeline (application_id, title, details)
        VALUES (v_row.id, 'Processing Fee Received',
                'Online payment of Rs. ' || v_row.processing_fee || ' received and verified automatically.');
        RETURN jsonb_build_object('ok', true, 'code', 'paid');
    END IF;

    -- Failed / cancelled attempt: keep the application payable (status stays pending)
    -- so the applicant can simply try again; the attempt is logged on the timeline.
    IF v_row.payment_status <> 'paid' THEN
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        VALUES (v_row.id, 'Online Payment Not Completed',
                'The online payment attempt did not complete. You can try again at any time before the deadline.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', 'failed_logged');
END;
$$;

-- 6 · Lock the functions down: server (service_role) only ---------------------
REVOKE ALL ON FUNCTION public.inter_payment_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inter_safepay_apply(text, text, text, text, numeric, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_payment_context(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.inter_safepay_apply(text, text, text, text, numeric, text, text) TO service_role;
GRANT ALL ON public.inter_payment_events TO service_role;
-- ▲▲▲ END original file: 23_safepay_online_payment.sql ▲▲▲
