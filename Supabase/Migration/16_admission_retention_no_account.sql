-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 16 — Admission retention/cache limits + no-account admission
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 25_admission_retention_cache_limits.sql
--   • 26_no_account_admission.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 25_admission_retention_cache_limits.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 25_admission_retention_cache_limits.sql
-- Run AFTER 24_admission_security_hardening.sql.  SAFE TO RE-RUN (idempotent).
--
-- ADMISSION FEATURE ONLY — protects the 500 MB Supabase free-plan database
-- from unbounded growth of the three tables migration 24 introduced / used:
--
--   • security_attempts        1–2 rows per register / login / track / reset
--                              call through the auth-gateway.  Grows forever
--                              without a retention job.        → trimmed daily
--   • inter_applicant_sessions one row per login (30-day expiry).  Logout
--                              deletes one row, but applicants that just
--                              close the tab leave theirs behind forever.
--                                                             → trimmed daily
--   • audit_log                append-only admin-action log whose trigger
--                              blocks DELETE for EVERYONE — even a cron job.
--                              This migration teaches the trigger to accept
--                              deletes from ONE authorised cleanup function.
--                                                             → trimmed daily
--
-- NOTHING IS HARDCODED: every retention window and the gateway flood limit
-- live in admission_settings (editable with a single UPDATE, or later from
-- the admin Admission Settings screen):
--
--   retention_attempts_days      default 30    security_attempts age (days)
--   retention_attempts_max_rows  default 100000 hard cap on the ledger —
--                                newest rows are kept even if the age window
--                                would keep more (bot-flood safety net)
--   retention_sessions_days      default 90    how long an EXPIRED applicant
--                                session row is kept (0 = keep forever)
--   retention_audit_days         default 365   audit_log age (0 = keep forever)
--   rate_gateway_per_ip_minute   default 90    auth-gateway per-IP requests
--                                per minute (in-memory brake in the function)
--
-- Applications, timelines, profiles and merit lists are the school's official
-- record and are NEVER touched by this cleanup.
-- ═══════════════════════════════════════════════════════════════════════

-- ===========================================================================
-- SECTION A — admission_settings: retention / gateway-limit columns
-- ===========================================================================
ALTER TABLE public.admission_settings
    ADD COLUMN IF NOT EXISTS retention_attempts_days      int NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS retention_attempts_max_rows  int NOT NULL DEFAULT 100000,
    ADD COLUMN IF NOT EXISTS retention_sessions_days      int NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS retention_audit_days         int NOT NULL DEFAULT 365,
    ADD COLUMN IF NOT EXISTS rate_gateway_per_ip_minute   int NOT NULL DEFAULT 90;

-- The settings row must always exist (same guarantee as migration 21).
INSERT INTO public.admission_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- ===========================================================================
-- SECTION B — audit_log append-only trigger: allow ONE authorised deleter
--
-- The trigger from migration 24 raises on every UPDATE/DELETE.  Retention
-- needs DELETE, so the trigger now checks a transaction-local flag
-- (ghss.admission_retention = 'on').  Only
-- public.admission_retention_cleanup() — SECURITY DEFINER, executable by
-- postgres / service_role only — sets that flag.  Everyone else still gets
-- the exception, so the table stays append-only in practice.
-- ===========================================================================
DO $mig$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE 'audit_log not found - run 24_admission_security_hardening.sql first; audit trigger step skipped';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.audit_log_block_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $f$
  BEGIN
      IF coalesce(current_setting('ghss.admission_retention', true), '') = 'on' THEN
          -- authorised retention run (public.admission_retention_cleanup only)
          IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END IF;
      RAISE EXCEPTION 'audit_log is append-only: UPDATE/DELETE not permitted';
  END;
  $f$;

  -- Re-attach (same names as migration 24, so a re-run stays consistent).
  DROP TRIGGER IF EXISTS trg_audit_log_block_update ON public.audit_log;
  DROP TRIGGER IF EXISTS trg_audit_log_block_delete ON public.audit_log;
  CREATE TRIGGER trg_audit_log_block_update BEFORE UPDATE ON public.audit_log
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();
  CREATE TRIGGER trg_audit_log_block_delete BEFORE DELETE ON public.audit_log
      FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();
END
$mig$;


-- ===========================================================================
-- SECTION C — the ONE cleanup entry point
--
-- admission_retention_cleanup()  (SECURITY DEFINER, service-role only)
--   1. security_attempts   : delete rows older than retention_attempts_days,
--                            then enforce the retention_attempts_max_rows cap
--                            (newest rows win).
--   2. inter_applicant_sessions : delete sessions that expired more than
--                            retention_sessions_days ago (0 = keep forever).
--   3. audit_log           : delete rows older than retention_audit_days
--                            (0 = keep forever), behind the GUC flag above.
--
-- Returns a small jsonb report {ok, ...counts} so the cron history shows what
-- happened.  Safe to run any time, any number of times.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admission_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_attempts_days int;
    v_attempts_max  int;
    v_sessions_days int;
    v_audit_days    int;
    v_del_attempts  bigint := 0;
    v_del_capped    bigint := 0;
    v_del_sessions  bigint := 0;
    v_del_audit     bigint := 0;
BEGIN
    SELECT s.retention_attempts_days, s.retention_attempts_max_rows,
           s.retention_sessions_days, s.retention_audit_days
      INTO v_attempts_days, v_attempts_max, v_sessions_days, v_audit_days
      FROM public.admission_settings s WHERE s.id = 1;

    v_attempts_days := greatest(coalesce(v_attempts_days, 30), 1);   -- min 1 day
    v_attempts_max  := greatest(coalesce(v_attempts_max, 100000), 1000);
    v_sessions_days := greatest(coalesce(v_sessions_days, 90), 0);   -- 0 = keep
    v_audit_days    := greatest(coalesce(v_audit_days, 365), 0);     -- 0 = keep

    -- 1a. security_attempts — age window ------------------------------------
    IF to_regclass('public.security_attempts') IS NOT NULL THEN
        DELETE FROM public.security_attempts
         WHERE created_at < now() - (v_attempts_days || ' days')::interval;
        GET DIAGNOSTICS v_del_attempts = ROW_COUNT;

        -- 1b. hard cap — keep only the newest N rows no matter their age
        DELETE FROM public.security_attempts
         WHERE id IN (
             SELECT id FROM public.security_attempts
              ORDER BY created_at DESC
              OFFSET v_attempts_max
         );
        GET DIAGNOSTICS v_del_capped = ROW_COUNT;
    END IF;

    -- 2. long-expired applicant sessions ------------------------------------
    IF to_regclass('public.inter_applicant_sessions') IS NOT NULL
       AND v_sessions_days > 0 THEN
        DELETE FROM public.inter_applicant_sessions
         WHERE expires_at < now() - (v_sessions_days || ' days')::interval;
        GET DIAGNOSTICS v_del_sessions = ROW_COUNT;
    END IF;

    -- 3. audit_log — age window behind the authorised-delete flag -----------
    IF to_regclass('public.audit_log') IS NOT NULL AND v_audit_days > 0 THEN
        PERFORM set_config('ghss.admission_retention', 'on', true);
        DELETE FROM public.audit_log
         WHERE created_at < now() - (v_audit_days || ' days')::interval;
        GET DIAGNOSTICS v_del_audit = ROW_COUNT;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'security_attempts_deleted', v_del_attempts,
        'security_attempts_capped',  v_del_capped,
        'sessions_deleted',          v_del_sessions,
        'audit_log_deleted',         v_del_audit,
        'ran_at', now()
    );
END;
$$;

-- Only the server may run it (cron owner / service role).  Never anon.
REVOKE EXECUTE ON FUNCTION public.admission_retention_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE  ON FUNCTION public.admission_retention_cleanup() TO service_role;


-- ===========================================================================
-- SECTION D — nightly pg_cron job (same pattern as migrations 13 / 17)
--   03:37 Asia/Karachi-ish server time; does not clash with the existing
--   03:17 / 03:23 / 03:41 jobs.
-- ===========================================================================
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - admission retention job skipped (fine on Supabase, which ships pg_cron)';
    RETURN;
  END IF;
  PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'ghss-admission-retention';
  PERFORM cron.schedule('ghss-admission-retention', '37 3 * * *',
    $$select public.admission_retention_cleanup();$$);
  RAISE NOTICE 'cron job registered: ghss-admission-retention';
END $mig$;

-- One-time immediate cleanup right now (also covers hosts without pg_cron).
SELECT public.admission_retention_cleanup();


-- ===========================================================================
-- SECTION E — CHECK ONLY: list the cron jobs that should now exist.
--   To disable the admission retention job manually:
--     select cron.unschedule(jobid) from cron.job where jobname = 'ghss-admission-retention';
--   To change a retention window (example — keep attempts 14 days):
--     update public.admission_settings set retention_attempts_days = 14 where id = 1;
-- ===========================================================================
DO $check$
DECLARE j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - nothing to list';
    RETURN;
  END IF;
  FOR j IN SELECT jobname, schedule, active FROM cron.job ORDER BY jobname LOOP
    RAISE NOTICE 'cron job: % | % | active=%', j.jobname, j.schedule, j.active;
  END LOOP;
END $check$;
-- ▲▲▲ END original file: 25_admission_retention_cache_limits.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 26_no_account_admission.sql ▼▼▼
-- ===========================================================================
-- 26_no_account_admission.sql
--
-- NO-ACCOUNT ADMISSION  (single-school model)
--
--   Before : an applicant had to "Create Account" (CNIC + mobile + password)
--            and "Login" before anything could be saved.  Anyone could create
--            unlimited accounts, each one a permanent row in the database.
--
--   Now    : there is NO account and NO login.  The applicant fills Personal
--            Information, Matric (SSC) profile and the application on their
--            own device.  NOTHING is written to the database until the final
--            "Submit" (after the Turnstile captcha), when ONE atomic call
--            (inter_apply) stores the applicant, both profiles and the
--            application together - or nothing at all.  Abandoned drafts cost
--            the database zero rows.
--
--   After submitting, the applicant gets a private session on that device
--   (payment, edit while unpaid, view).  On any other device they use
--   "Track Application" (Tracking ID + mobile / last 4 of CNIC + captcha),
--   which can open the same session (inter_access_grant).
--
--   Safe to re-run.  Existing applicants / applications are untouched.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A. ONE copy of the quota-eligibility rules, shared by the session-based
--    check (existing) and the new draft check (no database rows yet).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inter_quota_eligibility(
    p_union_council     text,
    p_dob               date,
    p_domicile_district text,
    p_quota             text,
    p_criteria          jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_is_local boolean;
    v_age_y    int;
BEGIN
    -- Is the applicant's Union Council inside the college jurisdiction?
    v_is_local := EXISTS (
        SELECT 1 FROM public.inter_union_councils u
        WHERE trim(lower(u.name)) = trim(lower(p_union_council)));

    IF p_quota = 'open_merit' AND v_is_local THEN
        -- Verified live: local applicants are blocked from Open Merit
        RETURN jsonb_build_object('ok', false, 'error',
            'Your domicile is local; therefore, apply on Local Quota.');
    END IF;

    v_age_y := (public.inter_age(p_dob) ->> 'y')::int;

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
            IF trim(lower(p_domicile_district)) <> 'mohmand' THEN
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

    -- Non-blocking overage warning
    IF v_age_y >= 19 THEN
        RETURN jsonb_build_object('ok', true, 'warning',
            'You are overage. An age relaxation certificate is required for Inter admission.');
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

-- The session-based check keeps its signature and behaviour; it now delegates.
CREATE OR REPLACE FUNCTION public.inter_check_quota(
    p_token    uuid,
    p_quota    text,
    p_criteria jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_pp  public.inter_personal_profiles;
    v_ssc public.inter_ssc_profiles;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please open your application again.');
    END IF;
    SELECT * INTO v_pp  FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_ssc FROM public.inter_ssc_profiles      WHERE applicant_id = v_app.id;
    IF v_pp.applicant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please complete your Personal Information before applying.');
    END IF;
    IF v_ssc.applicant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please Fill your Metric profile before applying to Intermediate Program.');
    END IF;
    RETURN public.inter_quota_eligibility(
        v_pp.union_council, v_pp.date_of_birth, v_pp.domicile_district, p_quota, p_criteria);
END;
$$;

-- Draft check: same rules, driven by the applicant's on-device draft.
-- Read-only (writes nothing), so it is safe for anon.
CREATE OR REPLACE FUNCTION public.inter_draft_check_quota(
    p_personal jsonb,
    p_quota    text,
    p_criteria jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_dob date;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
    IF p_personal IS NULL
       OR nullif(trim(coalesce(p_personal ->> 'union_council', '')), '') IS NULL
       OR nullif(trim(coalesce(p_personal ->> 'domicile_district', '')), '') IS NULL
       OR nullif(trim(coalesce(p_personal ->> 'date_of_birth', '')), '') IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please complete your Personal Information before applying.');
    END IF;
    BEGIN
        v_dob := (p_personal ->> 'date_of_birth')::date;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please enter a valid Date of Birth.');
    END;
    RETURN public.inter_quota_eligibility(
        p_personal ->> 'union_council', v_dob, p_personal ->> 'domicile_district',
        p_quota, p_criteria);
END;
$$;

-- ---------------------------------------------------------------------------
-- B. inter_apply - the ONE atomic write.  Called only by the Vercel
--    auth-gateway (service role) AFTER the Turnstile captcha is verified.
--    It re-uses the existing validated RPCs (save_personal / save_ssc /
--    submit_application) inside a sub-transaction, so every rule is enforced
--    exactly once, in one place.  Any failure rolls back EVERYTHING.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inter_apply(
    p_nationality   text,
    p_cnic_formb    text,
    p_personal      jsonb,
    p_ssc           jsonb,
    p_program_id    int,
    p_quota         text,
    p_criteria      jsonb DEFAULT NULL,
    p_subject_group text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_cnic     text;
    v_mobile   text;
    v_existing public.inter_applicants;
    v_id       uuid;
    v_token    uuid;
    v_cycle    text;
    v_res      jsonb;
    v_fail     jsonb;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;

    p_nationality := coalesce(nullif(trim(p_nationality), ''), 'Pakistani');
    IF p_nationality NOT IN ('Pakistani', 'Afghani') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid nationality.');
    END IF;
    v_cnic := regexp_replace(coalesce(p_cnic_formb, ''), '[^0-9]', '', 'g');
    IF length(v_cnic) <> 13 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'CNIC/Form-B Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000');
    END IF;
    IF p_personal IS NULL OR p_ssc IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Please complete your Personal Information and Matric Profile before applying.');
    END IF;
    v_mobile := regexp_replace(coalesce(p_personal ->> 'mobile_number', ''), '[^0-9]', '', 'g');
    IF v_mobile !~ '^03[0-9]{9}$' THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Make sure that your mobile number is correct and in 03451234567 format.');
    END IF;

    SELECT session_year INTO v_cycle FROM public.admission_settings WHERE id = 1;
    v_cycle := coalesce(v_cycle, to_char(now(), 'YYYY'));

    -- Serialise concurrent submissions for the same CNIC.
    PERFORM pg_advisory_xact_lock(hashtext('inter_apply:' || v_cnic));

    BEGIN
        SELECT * INTO v_existing FROM public.inter_applicants WHERE cnic_formb = v_cnic;

        IF v_existing.id IS NOT NULL THEN
            IF v_existing.status <> 'active' THEN
                v_fail := jsonb_build_object('ok', false, 'error',
                    'This application has been disabled. Please contact the college.');
                RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
            END IF;
            IF EXISTS (SELECT 1 FROM public.inter_applications x
                        WHERE x.applicant_id = v_existing.id AND x.cycle = v_cycle
                          AND x.status NOT IN ('cancelled', 'rejected'))
               AND coalesce(v_existing.admin_allow_new, false) = false THEN
                v_fail := jsonb_build_object('ok', false, 'error',
                    'An application with this CNIC/Form-B has already been submitted. ' ||
                    'Use "Track Application" with your Tracking ID to view, edit or pay it.');
                RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
            END IF;
            v_id := v_existing.id;   -- earlier record with no live application: reuse it
        ELSE
            IF EXISTS (SELECT 1 FROM public.inter_applicants WHERE mobile_number = v_mobile) THEN
                v_fail := jsonb_build_object('ok', false, 'error',
                    'This mobile number is already used by another applicant. ' ||
                    'If you already applied, use "Track Application" to open your application.');
                RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
            END IF;
            -- No password exists any more; store an unusable random hash so the
            -- legacy NOT NULL column stays satisfied.
            INSERT INTO public.inter_applicants (cnic_formb, mobile_number, nationality, password_hash)
            VALUES (v_cnic, v_mobile, p_nationality, crypt(gen_random_uuid()::text, gen_salt('bf', 4)))
            RETURNING id INTO v_id;
        END IF;

        INSERT INTO public.inter_applicant_sessions (applicant_id, expires_at)
        VALUES (v_id, now() + interval '30 days')
        RETURNING token INTO v_token;

        v_res := public.inter_save_personal(
            v_token, coalesce(p_personal, '{}'::jsonb) || jsonb_build_object('nationality', p_nationality));
        IF NOT coalesce((v_res ->> 'ok')::boolean, false) THEN
            v_fail := v_res; RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
        END IF;

        v_res := public.inter_save_ssc(v_token, p_ssc);
        IF NOT coalesce((v_res ->> 'ok')::boolean, false) THEN
            v_fail := v_res; RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
        END IF;

        v_res := public.inter_submit_application(
            v_token, p_program_id, p_quota, coalesce(p_criteria, '{}'::jsonb), p_subject_group);
        IF NOT coalesce((v_res ->> 'ok')::boolean, false) THEN
            v_fail := v_res; RAISE EXCEPTION 'apply_rejected' USING ERRCODE = 'P0001';
        END IF;

        RETURN v_res || jsonb_build_object('token', v_token, 'applicant_id', v_id);

    EXCEPTION
        WHEN SQLSTATE 'P0001' THEN
            RETURN coalesce(v_fail, jsonb_build_object('ok', false,
                'error', 'Could not submit your application. Please check your details.'));
        WHEN unique_violation THEN
            RETURN jsonb_build_object('ok', false, 'error',
                'An application with this CNIC/Form-B or mobile number already exists. ' ||
                'Use "Track Application" to open it.');
        WHEN OTHERS THEN
            RAISE WARNING 'inter_apply failed: %', SQLERRM;
            RETURN jsonb_build_object('ok', false, 'error',
                'Could not submit your application. Please check your details and try again.');
    END;
END;
$$;

-- ---------------------------------------------------------------------------
-- C. inter_access_grant - open a private session for an existing application.
--    The gateway calls this ONLY after inter_track has verified the Tracking
--    ID + second factor (and the captcha), so it re-checks nothing.
--    Service role only.  Session lasts 7 days.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inter_access_grant(p_tracking_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key   text;
    v_app   public.inter_applications;
    v_token uuid;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false);
    END IF;
    v_key := upper(regexp_replace(coalesce(p_tracking_id, ''), '[^A-Za-z0-9]', '', 'g'));
    IF v_key = '' THEN RETURN jsonb_build_object('ok', false); END IF;

    SELECT x.* INTO v_app FROM public.inter_applications x
     WHERE upper(regexp_replace(x.tracking_id, '[^A-Za-z0-9]', '', 'g')) = v_key
        OR regexp_replace(coalesce(x.jazzcash_token, ''), '[^0-9]', '', 'g') = v_key
     ORDER BY x.submitted_at DESC LIMIT 1;
    IF v_app.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

    INSERT INTO public.inter_applicant_sessions (applicant_id, expires_at)
    VALUES (v_app.applicant_id, now() + interval '7 days')
    RETURNING token INTO v_token;

    RETURN jsonb_build_object('ok', true, 'token', v_token, 'application_id', v_app.id);
END;
$$;

-- ---------------------------------------------------------------------------
-- D. Close the old door: no more self-registration or password login.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.inter_register(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.inter_login(text, text)                FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- E. Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.inter_apply(text, text, jsonb, jsonb, int, text, jsonb, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_apply(text, text, jsonb, jsonb, int, text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.inter_access_grant(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_access_grant(text) TO service_role;

REVOKE ALL ON FUNCTION public.inter_quota_eligibility(text, date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_quota_eligibility(text, date, text, text, jsonb) TO service_role;

GRANT EXECUTE ON FUNCTION public.inter_draft_check_quota(jsonb, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_check_quota(uuid, text, jsonb)        TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- F. Rate limit: the "register" bucket now counts SUBMISSIONS per IP per day.
--    Raised from 5 to 100 because many applicants share one school / internet
--    cafe / mobile-carrier IP.  Still adjustable in admission_settings.
-- ---------------------------------------------------------------------------
ALTER TABLE public.admission_settings
    ALTER COLUMN rate_register_per_ip_day SET DEFAULT 100;
UPDATE public.admission_settings SET rate_register_per_ip_day = 100
 WHERE id = 1 AND rate_register_per_ip_day = 5;

-- ---------------------------------------------------------------------------
-- G. One-off / scheduled cleanup of OLD abandoned accounts (created through
--    the removed "Create Account" page and never used to submit anything).
--    Run manually:   SELECT public.inter_purge_abandoned_accounts(30);
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inter_purge_abandoned_accounts(p_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_n int;
BEGIN
    DELETE FROM public.inter_applicants a
     WHERE a.created_at < now() - make_interval(days => GREATEST(p_days, 1))
       AND NOT EXISTS (SELECT 1 FROM public.inter_applications x WHERE x.applicant_id = a.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.inter_purge_abandoned_accounts(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_purge_abandoned_accounts(int) TO service_role;
-- ▲▲▲ END original file: 26_no_account_admission.sql ▲▲▲
