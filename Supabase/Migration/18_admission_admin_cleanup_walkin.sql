-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 18 — Admin cleanup + walk-in applications
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 30_admission_admin_cleanup.sql
--   • 31_admin_walkin_applications.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 30_admission_admin_cleanup.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 30_admission_admin_cleanup.sql      SAFE TO RE-RUN
--   1. inter_admin_unlock_application : disabled (a paid / submitted
--      application is final — nobody re-opens it).
--   2. inter_admin_reset_all          : "Delete All" for the next session
--      (export Excel first). Needs the exact confirmation text.
--   3. inter_admin_merit_publish      : publishing a merit list now moves the
--      listed (fee-paid) applicants to "Merit Listed" automatically and
--      writes their timeline; unpublishing reverts them to "Under Review".
-- ═══════════════════════════════════════════════════════════════════════

-- 1 ─ Unlock is gone ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_unlock_application(
    p_application_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN jsonb_build_object('ok', false, 'error',
        'Unlocking is disabled. A submitted application is final.');
END;
$$;

-- 2 ─ Delete everything for the next admission session ────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_reset_all(p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_apps int; v_lists int;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF p_confirm IS DISTINCT FROM 'DELETE ALL' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Confirmation text did not match.');
    END IF;

    SELECT count(*) INTO v_apps  FROM public.inter_applications;
    SELECT count(*) INTO v_lists FROM public.inter_merit_lists;

    DELETE FROM public.inter_merit_list_entries;
    DELETE FROM public.inter_merit_lists;
    DELETE FROM public.inter_application_timeline;
    BEGIN
        DELETE FROM public.inter_payment_events;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    DELETE FROM public.inter_applications;
    DELETE FROM public.inter_applicant_sessions;
    DELETE FROM public.inter_personal_profiles;
    DELETE FROM public.inter_ssc_profiles;
    DELETE FROM public.inter_applicants;

    BEGIN
        PERFORM public.log_admin_action(
            'admission.reset_all', 'admission', 'all',
            'Deleted ' || v_apps || ' application(s) and ' || v_lists || ' merit list(s) for the next session.',
            NULL, NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('ok', true, 'applications', v_apps, 'merit_lists', v_lists);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_reset_all(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_reset_all(text) TO authenticated, service_role;

-- 3 ─ Publishing a merit list updates the applicants ──────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_merit_publish(
    p_merit_list_id uuid, p_published boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_title text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT title INTO v_title FROM public.inter_merit_lists WHERE id = p_merit_list_id;
    IF v_title IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Merit list not found.');
    END IF;

    UPDATE public.inter_merit_lists
       SET is_published = p_published,
           published_at = CASE WHEN p_published THEN now() ELSE NULL END
     WHERE id = p_merit_list_id;

    IF p_published THEN
        WITH moved AS (
            UPDATE public.inter_applications a
               SET status = 'merit_listed', updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.payment_status = 'paid'
               AND a.status::text IN ('submitted', 'fee_pending', 'fee_paid', 'under_review')
         RETURNING a.id
        )
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        SELECT id, 'Merit Listed', 'Included in the published merit list: ' || v_title FROM moved;
    ELSE
        WITH moved AS (
            UPDATE public.inter_applications a
               SET status = 'under_review', updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.status::text = 'merit_listed'
               AND NOT EXISTS (
                    SELECT 1 FROM public.inter_merit_list_entries e2
                    JOIN public.inter_merit_lists l2 ON l2.id = e2.merit_list_id
                    WHERE e2.application_id = a.id AND l2.is_published
                      AND l2.id <> p_merit_list_id)
         RETURNING a.id
        )
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        SELECT id, 'Removed from Merit List', 'The merit list was withdrawn: ' || v_title FROM moved;
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;
-- ▲▲▲ END original file: 30_admission_admin_cleanup.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 31_admin_walkin_applications.sql ▼▼▼
-- 31_admin_walkin_applications.sql
-- Admin-only entry of applications submitted BY HAND at the school office
-- (walk-in), one by one or in bulk (Excel / CSV import).  A walk-in becomes a
-- normal row in inter_applications, so it appears in Applications, can be
-- marked Paid and is ranked together with online applicants in the merit list.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.inter_admin_add_walkin(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_name    text;
    v_father  text;
    v_cnic    text;
    v_mobile  text;
    v_dob     date;
    v_uc      text;
    v_prog    public.inter_programs;
    v_pid     text;
    v_qtxt    text;
    v_q       public.inter_quota;
    v_obt     numeric;
    v_tot     numeric;
    v_hafiz   boolean;
    v_pct     numeric;
    v_year    int;
    v_cycle   text;
    v_fee     int;
    v_applicant public.inter_applicants;
    v_existing  text;
    v_app_id  uuid;
    v_tracking text;
    v_paid    boolean;
    v_method  text;
    v_ref     text;
    v_pay_res jsonb;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;

    -- ── identity ────────────────────────────────────────────────────────
    v_name   := nullif(trim(coalesce(p->>'full_name', '')), '');
    v_father := nullif(trim(coalesce(p->>'father_name', '')), '');
    IF v_name IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Student name is required.');
    END IF;
    IF v_father IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Father name is required.');
    END IF;

    v_cnic := regexp_replace(coalesce(p->>'cnic', ''), '\D', '', 'g');
    IF v_cnic !~ '^[0-9]{13}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'CNIC / Form-B must be exactly 13 digits.');
    END IF;

    v_mobile := regexp_replace(coalesce(p->>'mobile', ''), '\D', '', 'g');
    IF v_mobile ~ '^92[0-9]{10}$' THEN v_mobile := '0' || substr(v_mobile, 3); END IF;
    IF v_mobile ~ '^3[0-9]{9}$'   THEN v_mobile := '0' || v_mobile; END IF;   -- Excel drops the leading 0
    IF v_mobile !~ '^03[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Mobile number must look like 03XXXXXXXXX.');
    END IF;

    BEGIN
        v_dob := nullif(trim(coalesce(p->>'dob', '')), '')::date;
    EXCEPTION WHEN others THEN
        v_dob := NULL;
    END;
    v_dob := coalesce(v_dob, DATE '2000-01-01');   -- placeholder when the form had no date of birth

    v_uc := nullif(trim(coalesce(p->>'union_council', '')), '');
    IF v_uc IS NOT NULL THEN
        SELECT name INTO v_uc FROM public.inter_union_councils
         WHERE lower(trim(name)) = lower(v_uc) LIMIT 1;
        v_uc := coalesce(v_uc, nullif(trim(p->>'union_council'), ''));
    END IF;

    -- ── program + quota ─────────────────────────────────────────────────
    v_pid := nullif(trim(coalesce(p->>'program_id', '')), '');
    IF v_pid ~ '^[0-9]+$' THEN
        SELECT * INTO v_prog FROM public.inter_programs WHERE id = v_pid::int AND is_active;
    ELSE
        SELECT * INTO v_prog FROM public.inter_programs
         WHERE is_active
           AND regexp_replace(lower(name), '[^a-z0-9]', '', 'g')
             = regexp_replace(lower(coalesce(p->>'program', '')), '[^a-z0-9]', '', 'g')
         LIMIT 1;
    END IF;
    IF v_prog.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Program not found (or closed).');
    END IF;

    v_qtxt := trim(both '_' from lower(regexp_replace(coalesce(nullif(trim(p->>'quota'), ''), 'local_quota'), '[^A-Za-z]+', '_', 'g')));
    BEGIN
        v_q := v_qtxt::public.inter_quota;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Quota must be Open Merit, Local Quota, Sports, College Employees or Special Person.');
    END;

    -- ── marks ───────────────────────────────────────────────────────────
    IF coalesce(p->>'marks_obtained', '') !~ '^[0-9]+(\.[0-9]+)?$'
       OR coalesce(p->>'marks_total', '') !~ '^[0-9]+(\.[0-9]+)?$' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'SSC obtained and total marks must be numbers.');
    END IF;
    v_obt := (p->>'marks_obtained')::numeric;
    v_tot := (p->>'marks_total')::numeric;
    IF v_tot <= 0 OR v_obt < 0 OR v_obt > v_tot THEN
        RETURN jsonb_build_object('ok', false, 'error', 'SSC marks are invalid (obtained cannot exceed total).');
    END IF;
    v_pct   := round(v_obt / v_tot * 100, 2);
    v_hafiz := lower(trim(coalesce(p->>'hafiz', ''))) IN ('true', 't', 'yes', 'y', '1');
    v_year  := CASE WHEN coalesce(p->>'passing_year', '') ~ '^[0-9]{4}$'
                    THEN (p->>'passing_year')::int
                    ELSE extract(year FROM now())::int END;

    -- ── settings ────────────────────────────────────────────────────────
    SELECT session_year, coalesce(processing_fee, 100)
      INTO v_cycle, v_fee
      FROM public.admission_settings WHERE id = 1;
    v_cycle := coalesce(v_cycle, to_char(now(), 'YYYY'));
    v_fee   := coalesce(v_fee, 100);

    -- ── applicant (one row per CNIC) ────────────────────────────────────
    SELECT * INTO v_applicant FROM public.inter_applicants WHERE cnic_formb = v_cnic;
    IF v_applicant.id IS NOT NULL THEN
        SELECT tracking_id INTO v_existing
          FROM public.inter_applications
         WHERE applicant_id = v_applicant.id
           AND status::text NOT IN ('cancelled', 'rejected')
           AND cycle IS NOT DISTINCT FROM v_cycle
         LIMIT 1;
        IF v_existing IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false,
                'error', 'This CNIC / Form-B already has an application (' || v_existing || ').');
        END IF;
    ELSE
        INSERT INTO public.inter_applicants (cnic_formb, mobile_number, password_hash)
        VALUES (v_cnic, v_mobile, crypt(gen_random_uuid()::text, gen_salt('bf', 10)))
        RETURNING * INTO v_applicant;
    END IF;

    INSERT INTO public.inter_personal_profiles (
        applicant_id, full_name, father_name, date_of_birth, gender, mobile_number,
        religion, nationality, domicile_province, domicile_district, tehsil,
        union_council, mailing_address, father_cnic, father_mobile, mother_name,
        mother_cnic, hafiz_e_quran
    ) VALUES (
        v_applicant.id, v_name, v_father, v_dob, 'male', v_mobile,
        'Islam', 'Pakistani', 'Khyber Pakhtunkhwa', 'Mohmand', 'N/A',
        coalesce(v_uc, 'N/A'),
        coalesce(nullif(trim(p->>'address'), ''), 'N/A'),
        'N/A', v_mobile, 'N/A', 'N/A', v_hafiz
    )
    ON CONFLICT (applicant_id) DO UPDATE SET
        full_name = EXCLUDED.full_name, father_name = EXCLUDED.father_name,
        date_of_birth = EXCLUDED.date_of_birth, mobile_number = EXCLUDED.mobile_number,
        union_council = EXCLUDED.union_council, mailing_address = EXCLUDED.mailing_address,
        hafiz_e_quran = EXCLUDED.hafiz_e_quran, updated_at = now();

    INSERT INTO public.inter_ssc_profiles (
        applicant_id, exam_session, exam_board, passing_year, study_group, roll_number,
        marks_obtained, marks_total, marks_percentage, grade, hafiz_e_quran,
        institute_province, institute_district, institute_name
    ) VALUES (
        v_applicant.id, 'Annual',
        coalesce(nullif(trim(p->>'board'), ''), 'N/A'), v_year,
        coalesce(nullif(trim(p->>'study_group'), ''), 'N/A'),
        coalesce(nullif(trim(p->>'roll_number'), ''), 'N/A'),
        v_obt, v_tot, v_pct, public.inter_grade_for(v_pct), v_hafiz,
        'Khyber Pakhtunkhwa', 'Mohmand',
        coalesce(nullif(trim(p->>'institute'), ''), 'N/A')
    )
    ON CONFLICT (applicant_id) DO UPDATE SET
        exam_board = EXCLUDED.exam_board, passing_year = EXCLUDED.passing_year,
        study_group = EXCLUDED.study_group, roll_number = EXCLUDED.roll_number,
        marks_obtained = EXCLUDED.marks_obtained, marks_total = EXCLUDED.marks_total,
        marks_percentage = EXCLUDED.marks_percentage, grade = EXCLUDED.grade,
        hafiz_e_quran = EXCLUDED.hafiz_e_quran, institute_name = EXCLUDED.institute_name,
        updated_at = now();

    -- ── application ─────────────────────────────────────────────────────
    LOOP
        v_tracking := upper(to_char(now(), 'MON')) || to_char(now(), 'YYYY')
                      || '-' || public.inter_random_suffix(6);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.inter_applications WHERE tracking_id = v_tracking);
    END LOOP;

    BEGIN
        INSERT INTO public.inter_applications (
            applicant_id, program_id, program_name, study_level, quota,
            quota_criteria_uc, declaration, status, tracking_id,
            processing_fee, fee_deadline, admin_note, submitted_at, cycle
        ) VALUES (
            v_applicant.id, v_prog.id, v_prog.name, v_prog.study_level, v_q,
            v_uc, true, 'fee_pending', v_tracking,
            v_fee, now(), 'Walk-in application entered by the school office.', now(), v_cycle
        ) RETURNING id INTO v_app_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('ok', false,
            'error', 'This student already has an application for this program and quota.');
    END;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_app_id, 'Application Submitted',
            'Application submitted in person at Government Higher Secondary School Ghallanai for '
            || v_prog.name || ' (' || initcap(replace(v_q::text, '_', ' ')) || ').');

    -- ── fee (usually cash at the office) ────────────────────────────────
    v_paid := lower(trim(coalesce(p->>'paid', ''))) IN ('true', 't', 'yes', 'y', '1', 'paid');
    IF v_paid THEN
        v_method := coalesce(nullif(lower(trim(p->>'payment_method')), ''), 'cash');
        v_ref    := nullif(trim(coalesce(p->>'receipt', '')), '');
        v_pay_res := public.inter_admin_set_payment_full(v_app_id, 'paid', v_ref, v_method);
        IF coalesce((v_pay_res->>'ok')::boolean, false) = false THEN
            RETURN jsonb_build_object('ok', false,
                'error', 'Application saved (' || v_tracking || ') but the fee could not be marked paid: '
                         || coalesce(v_pay_res->>'error', 'unknown error'));
        END IF;
    END IF;

    RETURN jsonb_build_object('ok', true, 'application_id', v_app_id,
                              'tracking_id', v_tracking, 'name', v_name, 'paid', v_paid);
END;
$$;


-- Bulk import: p_rows is a JSON array, each element has the same keys as the
-- single entry above.  Every row is saved on its own: a bad row never blocks
-- the good ones, and the result lists what happened to each row.
CREATE OR REPLACE FUNCTION public.inter_admin_import_walkins(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_el   jsonb;
    v_n    int := 0;
    v_ok   int := 0;
    v_res  jsonb;
    v_out  jsonb := '[]'::jsonb;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No rows to import.');
    END IF;
    IF jsonb_array_length(p_rows) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Import at most 500 rows at a time.');
    END IF;

    FOR v_el IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
        v_n := v_n + 1;
        BEGIN
            v_res := public.inter_admin_add_walkin(v_el);
        EXCEPTION WHEN others THEN
            v_res := jsonb_build_object('ok', false, 'error', SQLERRM);
        END;
        IF coalesce((v_res->>'ok')::boolean, false) THEN v_ok := v_ok + 1; END IF;
        v_out := v_out || jsonb_build_array(
            jsonb_build_object('row', v_n, 'name', v_el->>'full_name') || v_res);
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'total', v_n, 'imported', v_ok,
                              'failed', v_n - v_ok, 'results', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.inter_admin_add_walkin(jsonb)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inter_admin_import_walkins(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inter_admin_add_walkin(jsonb)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_admin_import_walkins(jsonb) TO authenticated, service_role;
-- ▲▲▲ END original file: 31_admin_walkin_applications.sql ▲▲▲
