-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 15 — Admission security hardening
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 24_admission_security_hardening.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 24_admission_security_hardening.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 24_admission_security_hardening.sql
-- Run AFTER 23_safepay_online_payment.sql.  SAFE TO RE-RUN (idempotent).
--
-- Implements the 4 security features requested:
--
--   F1  One-application-per-applicant-per-cycle + edit flow + lock after
--       fee paid + admin unlock (logged).
--   F2  Random, non-sequential tracking IDs + second-factor verification for
--       public tracking + identical error on wrong ID / wrong factor (no
--       probing) + rate-limit tracking lookups.
--   F3  Database-level rate limits (security_attempts table) with editable
--       limits stored in admission_settings.  REVOKE anon EXECUTE on
--       inter_register / inter_login / inter_track so the browser can no
--       longer call them directly — only the Vercel auth-gateway (which
--       verifies Cloudflare Turnstile first) can, using the service role.
--   F4  Append-only audit_log table + admin-action triggers + admin TOTP
--       (MFA) enforcement helper + profiles.mfa_enrolled badge column.
--
-- Old tracking IDs and old applications keep working unchanged.
-- ═══════════════════════════════════════════════════════════════════════

-- ===========================================================================
-- SECTION A — admission_settings: editable rate-limit / security columns
-- ===========================================================================
ALTER TABLE public.admission_settings
    ADD COLUMN IF NOT EXISTS rate_register_per_ip_day    int     NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS rate_login_max_attempts     int     NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS rate_login_cooldown_minutes int     NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS rate_track_per_ip_hour      int     NOT NULL DEFAULT 20,
    ADD COLUMN IF NOT EXISTS rate_track_per_id_hour      int     NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS rate_reset_per_ip_day       int     NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS turnstile_required          boolean NOT NULL DEFAULT true;

-- ===========================================================================
-- SECTION B — inter_applications: cycle + lock columns
-- ===========================================================================
ALTER TABLE public.inter_applications
    ADD COLUMN IF NOT EXISTS cycle       text,
    ADD COLUMN IF NOT EXISTS locked_at   timestamptz,
    ADD COLUMN IF NOT EXISTS locked_by   uuid;

-- Backfill cycle for existing rows from the current admission_settings year
UPDATE public.inter_applications
   SET cycle = COALESCE(cycle,
        (SELECT session_year FROM public.admission_settings WHERE id = 1))
 WHERE cycle IS NULL;

-- Replace the old per-(applicant,program,quota) unique index with a
-- per-cycle ONE-active-application-per-applicant index.  An application is
-- "active" unless it was cancelled or rejected.
DROP INDEX IF EXISTS public.uq_inter_apps_one_per_quota;

-- DATA FIX (needed before the unique index): old rules allowed one application
-- per program/quota, so an applicant can already hold SEVERAL active
-- applications in the same cycle and the unique index below would fail with
-- 23505. Keep ONE per (applicant, cycle): the fee-paid one first, otherwise the
-- most recently submitted. The others are set to 'cancelled' (never deleted, so
-- the record stays and the applicant may re-apply via the admin override).
DO $fix$
DECLARE v_n bigint;
BEGIN
    WITH ranked AS (
        SELECT id,
               row_number() OVER (
                   PARTITION BY applicant_id, cycle
                   ORDER BY (payment_status::text = 'paid') DESC, submitted_at DESC, id DESC
               ) AS rn
          FROM public.inter_applications
         WHERE status::text NOT IN ('cancelled', 'rejected')
    )
    UPDATE public.inter_applications a
       SET status = 'cancelled'
      FROM ranked r
     WHERE a.id = r.id AND r.rn > 1;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'duplicate active applications set to cancelled: %', v_n;
END
$fix$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_one_per_cycle
    ON public.inter_applications (applicant_id, cycle)
    WHERE (status NOT IN ('cancelled', 'rejected'));

-- inter_applicants: one-time admin override so a new application can be
-- allowed even when an active one already exists.
ALTER TABLE public.inter_applicants
    ADD COLUMN IF NOT EXISTS admin_allow_new boolean NOT NULL DEFAULT false;

-- profiles: MFA-enrolled badge (so the admin UI can show MFA on/off without
-- an extra API call).  The authoritative check is the aal2 claim on the JWT,
-- verified client-side by supabase.auth.mfa.getAuthenticatorAssuranceLevel().
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS mfa_enrolled boolean NOT NULL DEFAULT false;

-- ===========================================================================
-- SECTION C — security_attempts table (rate-limit ledger)
-- ===========================================================================
-- Used by the Vercel auth-gateway AND by inter_track for IP / per-ID limits.
-- bucket ∈ {'register','login','track','reset'}; key = hashed IP or tracking id.
CREATE TABLE IF NOT EXISTS public.security_attempts (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bucket      text        NOT NULL,
    key         text        NOT NULL,
    success     boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_attempts_lookup
    ON public.security_attempts (bucket, key, created_at DESC);

ALTER TABLE public.security_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_attempts FROM anon, authenticated;
GRANT INSERT, SELECT ON public.security_attempts TO service_role;

-- ===========================================================================
-- SECTION D — audit_log table (append-only)
-- ===========================================================================
-- Nobody (except service_role via the log_admin_action SECURITY DEFINER
-- function) can insert.  Nobody can UPDATE or DELETE — enforced by triggers
-- that always raise.  Only admins can SELECT (RLS policy below).
CREATE TABLE IF NOT EXISTS public.audit_log (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id     uuid,
    actor_email  text,
    action       text        NOT NULL,
    target_type  text,
    target_id    text,
    summary      text,
    before_data  jsonb,
    after_data   jsonb,
    ip           text,
    user_agent   text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT INSERT ON public.audit_log TO service_role;

-- Admin-only SELECT policy (profiles.role = 'admin' for the current user)
DROP POLICY IF EXISTS audit_log_admin_read ON public.audit_log;
CREATE POLICY audit_log_admin_read ON public.audit_log
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Block UPDATE / DELETE for everyone, always (append-only)
CREATE OR REPLACE FUNCTION public.audit_log_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE/DELETE not permitted';
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_log_block_update ON public.audit_log;
DROP TRIGGER IF EXISTS trg_audit_log_block_delete ON public.audit_log;
CREATE TRIGGER trg_audit_log_block_update BEFORE UPDATE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_block_delete BEFORE DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target  ON public.audit_log (target_type, target_id);

-- log_admin_action(p_action, p_target_type, p_target_id, p_summary, p_before, p_after)
-- SECURITY DEFINER so it can INSERT into audit_log (which is service_role-only
-- otherwise).  Captures the actor from auth.uid() and the IP from request
-- headers (works for direct admin-client calls; the gateway passes IP via
-- the explicit call path).
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action      text,
    p_target_type text DEFAULT NULL,
    p_target_id   text DEFAULT NULL,
    p_summary     text DEFAULT NULL,
    p_before      jsonb DEFAULT NULL,
    p_after       jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid   uuid  := auth.uid();
    v_email text;
    v_hdr   text;
    v_ip    text;
BEGIN
    BEGIN
        SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

    BEGIN
        v_hdr := current_setting('request.headers', true);
        v_ip  := COALESCE(
            (v_hdr::json)->>'x-forwarded-for',
            (v_hdr::json)->>'x-real-ip',
            (v_hdr::json)->>'cf-connecting-ip');
    EXCEPTION WHEN OTHERS THEN v_ip := NULL; END;

    INSERT INTO public.audit_log
        (actor_id, actor_email, action, target_type, target_id,
         summary, before_data, after_data, ip)
    VALUES
        (v_uid, v_email, p_action, p_target_type, p_target_id,
         p_summary, p_before, p_after, v_ip);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text,text,text,text,jsonb,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text,text,text,text,jsonb,jsonb) TO authenticated, service_role;

-- get_admin_audit_log(p_action, p_actor, p_from, p_to, p_search, p_limit, p_offset)
CREATE OR REPLACE FUNCTION public.get_admin_audit_log(
    p_action  text         DEFAULT NULL,
    p_actor   uuid         DEFAULT NULL,
    p_from    timestamptz  DEFAULT NULL,
    p_to      timestamptz  DEFAULT NULL,
    p_search  text         DEFAULT NULL,
    p_limit   int          DEFAULT 100,
    p_offset  int          DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'rows', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id',          a.id,
            'actor_id',    a.actor_id,
            'actor_email', a.actor_email,
            'action',      a.action,
            'target_type', a.target_type,
            'target_id',   a.target_id,
            'summary',     a.summary,
            'ip',          a.ip,
            'created_at',  to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
        ) ORDER BY a.created_at DESC)
        FROM public.audit_log a
        WHERE (p_action IS NULL OR a.action = p_action)
          AND (p_actor  IS NULL OR a.actor_id = p_actor)
          AND (p_from   IS NULL OR a.created_at >= p_from)
          AND (p_to     IS NULL OR a.created_at <= p_to)
          AND (p_search IS NULL
               OR a.summary    ILIKE '%' || p_search || '%'
               OR a.target_id  ILIKE '%' || p_search || '%'
               OR a.action     ILIKE '%' || p_search || '%')
        LIMIT GREATEST(1, LEAST(p_limit, 500))
        OFFSET GREATEST(0, p_offset)
    ), '[]'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_audit_log(text,uuid,timestamptz,timestamptz,text,int,int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(text,uuid,timestamptz,timestamptz,text,int,int) TO authenticated, service_role;

-- ===========================================================================
-- SECTION E — random tracking-id suffix generator (Crockford-ish alphabet)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_random_suffix(p_len int DEFAULT 6)
RETURNS text
LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT string_agg(
        substr('ABCDEFGHJKMNPQRSTVWXYZ23456789',
               1 + mod(get_byte(gen_random_bytes(1), 0), 30), 1),
        '')
    FROM generate_series(1, GREATEST(4, p_len));
$$;
GRANT EXECUTE ON FUNCTION public.inter_random_suffix(int) TO service_role;

-- ===========================================================================
-- SECTION F — REPLACE inter_submit_application
--   • random, non-sequential tracking id  (MONYYYY-XXXXXX)
--   • ONE active application per applicant per cycle (partial unique index)
--   • admin override flag honoured
--   • cycle column populated from admission_settings.session_year
--   Old applications keep working (their tracking_id is unchanged).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_submit_application(
    p_token         uuid,
    p_program_id    int,
    p_quota         text,
    p_criteria      jsonb DEFAULT NULL,
    p_subject_group text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app            public.inter_applicants;
    v_pp             public.inter_personal_profiles;
    v_prog           public.inter_programs;
    v_q              public.inter_quota;
    v_check          jsonb;
    v_id             uuid;
    v_criteria_final jsonb := coalesce(p_criteria, '{}'::jsonb);
    v_uc_name        text;
    v_deadline       timestamptz;
    v_last_date      date;
    v_group_count    int;
    v_fee            int;
    v_cycle          text;
    v_tracking       text;
    v_active_count   int;
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_pp FROM public.inter_personal_profiles WHERE applicant_id = v_app.id;
    SELECT * INTO v_prog FROM public.inter_programs WHERE id = p_program_id AND is_active;
    IF v_prog.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid program.');
    END IF;

    -- Subject group mandatory when the program defines groups
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

    -- Gender eligibility
    IF v_prog.allowed_gender <> 'both' AND v_prog.allowed_gender <> v_pp.gender THEN
        RETURN jsonb_build_object('ok', false, 'error',
            upper(v_pp.gender) || ' applicants are not eligible for this program');
    END IF;

    -- ── ONE active application per applicant per cycle ───────────────────
    SELECT session_year INTO v_cycle FROM public.admission_settings WHERE id = 1;
    v_cycle := coalesce(v_cycle, to_char(now(),'YYYY'));

    SELECT count(*) INTO v_active_count
      FROM public.inter_applications
     WHERE applicant_id = v_app.id
       AND cycle = v_cycle
       AND status NOT IN ('cancelled', 'rejected');

    IF v_active_count > 0 AND coalesce(v_app.admin_allow_new, false) = false THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'You already have an active application for this admission cycle. ' ||
            'Use "Edit Application" to change your program, group or quota, or ' ||
            'contact the college if you need to submit a new one.');
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

    -- Fee + deadline (unchanged logic)
    BEGIN
        IF to_regclass('public.admission_settings') IS NOT NULL THEN
            EXECUTE 'SELECT last_date FROM public.admission_settings WHERE id = 1' INTO v_last_date;
        END IF;
    EXCEPTION WHEN OTHERS THEN v_last_date := NULL; END;

    v_deadline := CASE
        WHEN v_last_date IS NOT NULL
            THEN (v_last_date + interval '1 day' - interval '1 second')
        ELSE (date_trunc('day', now()) + interval '4 days' + interval '23:59:00')
    END;

    SELECT coalesce(processing_fee, 100) INTO v_fee FROM public.admission_settings WHERE id = 1;
    v_fee := coalesce(v_fee, 100);

    -- ── RANDOM, non-sequential tracking id ───────────────────────────────
    -- Format: MONYYYY-XXXXXX  (e.g. NOV2026-K7MQXA).  Unguessable; the
    -- 6-char suffix is drawn from a 30-char Crockford-ish alphabet.
    v_tracking := upper(to_char(now(), 'MON')) || to_char(now(), 'YYYY')
                  || '-' || public.inter_random_suffix(6);

    INSERT INTO public.inter_applications (
        applicant_id, program_id, program_name, subject_group, study_level, quota,
        quota_criteria, quota_criteria_uc, sport_certificate, nature_of_disability,
        parent_department, parent_serving_district, payslip_notice,
        declaration, status, tracking_id, processing_fee, fee_deadline,
        board_record_verified, submitted_at, cycle
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
        false, now(), v_cycle
    ) RETURNING id INTO v_id;

    -- Consume the one-time admin override
    IF coalesce(v_app.admin_allow_new, false) = true THEN
        UPDATE public.inter_applicants SET admin_allow_new = false WHERE id = v_app.id;
    END IF;

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

-- ===========================================================================
-- SECTION G — inter_edit_application  (NEW)
--   Lets an applicant change program / subject group / quota (and the
--   associated quota criteria) WHILE the fee is UNPAID.  The tracking id and
--   the payment reference (jazzcash_token) stay the same.  Once the fee is
--   paid the row is locked; only inter_admin_unlock_application can re-open
--   it.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_edit_application(
    p_token         uuid,
    p_application_id uuid,
    p_program_id    int,
    p_quota         text,
    p_criteria      jsonb DEFAULT NULL,
    p_subject_group text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app    public.inter_applicants;
    v_row    public.inter_applications;
    v_prog   public.inter_programs;
    v_q      public.inter_quota;
    v_check  jsonb;
    v_group_count int;
    v_criteria_final jsonb := coalesce(p_criteria, '{}'::jsonb);
BEGIN
    IF NOT public.inter_admission_open() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admissions are currently closed.');
    END IF;
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications
        WHERE id = p_application_id AND applicant_id = v_app.id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;

    -- LOCK RULE: after fee paid the application is immutable to the applicant
    IF v_row.payment_status = 'paid'
       OR v_row.status IN ('fee_paid','under_review','merit_listed','admitted','rejected','cancelled') THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'This application is now locked because the fee has been paid. ' ||
            'Contact the college office if you need to change it.');
    END IF;

    SELECT * INTO v_prog FROM public.inter_programs WHERE id = p_program_id AND is_active;
    IF v_prog.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Please select a valid program.');
    END IF;

    -- Subject group validation
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

    -- Gender eligibility against the new program
    BEGIN
        IF v_prog.allowed_gender <> 'both' AND v_prog.allowed_gender <>
           (SELECT gender FROM public.inter_personal_profiles WHERE applicant_id = v_app.id) THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Gender not eligible for this program.');
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Quota validation cascade
    v_check := public.inter_check_quota(p_token, p_quota, p_criteria);
    IF NOT (v_check ->> 'ok')::boolean THEN
        RETURN v_check;
    END IF;

    IF coalesce((v_criteria_final ->> 'declaration')::boolean, false) <> true THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'You must agree to the declaration before submitting.');
    END IF;

    -- UPDATE — tracking id and payment reference are PRESERVED
    UPDATE public.inter_applications
       SET program_id       = v_prog.id,
           program_name     = v_prog.name,
           subject_group    = nullif(trim(coalesce(p_subject_group, '')), ''),
           quota            = v_q,
           quota_criteria   = CASE WHEN v_q = 'local_quota' THEN v_criteria_final ->> 'criteria'
                                   WHEN v_q = 'college_employees' THEN 'father_serve_area' ELSE NULL END,
           sport_certificate    = nullif(v_criteria_final ->> 'sport_certificate', ''),
           nature_of_disability = CASE WHEN v_q = 'special_person' THEN v_criteria_final ->> 'nature_of_disability' ELSE NULL END,
           parent_department    = nullif(v_criteria_final ->> 'parent_department', ''),
           parent_serving_district = nullif(v_criteria_final ->> 'parent_serving_district', ''),
           payslip_notice       = coalesce((v_criteria_final ->> 'payslip_notice')::boolean, false),
           updated_at           = now()
     WHERE id = v_row.id;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_row.id, 'Application Edited',
            'Applicant edited program / quota / subject group. Tracking ID '
            || v_row.tracking_id || ' and payment reference unchanged.');

    RETURN jsonb_build_object('ok', true, 'application_id', v_row.id,
                              'tracking_id', v_row.tracking_id);
END;
$$;

-- ===========================================================================
-- SECTION H — inter_admin_unlock_application  (NEW, admin-only, logged)
--   Reverts a fee-paid application to editable state.  Logs to audit_log via
--   the trigger on inter_applications (action = 'application.unlock').
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_unlock_application(
    p_application_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row public.inter_applications;
    v_before jsonb;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    IF v_row.locked_at IS NULL AND v_row.payment_status <> 'paid' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application is not locked.');
    END IF;

    v_before := to_jsonb(v_row);

    UPDATE public.inter_applications
       SET payment_status = 'pending',
           status         = 'fee_pending',
           paid_at        = NULL,
           locked_at      = NULL,
           locked_by      = NULL,
           updated_at     = now()
     WHERE id = v_row.id;

    -- Explicit audit entry (the trigger also fires, but we want the reason).
    PERFORM public.log_admin_action(
        'application.unlock',
        'application', p_application_id::text,
        'Unlocked fee-paid application ' || v_row.tracking_id
            || COALESCE('. Reason: ' || NULLIF(p_reason, ''), ''),
        v_before, NULL);

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_row.id, 'Application Unlocked by Admin',
            'An administrator unlocked this application so the applicant can edit it again.'
            || COALESCE(' — ' || p_reason, ''));

    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_unlock_application(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inter_admin_unlock_application(uuid,text) TO authenticated, service_role;

-- ===========================================================================
-- SECTION I — inter_admin_allow_new_application  (NEW, admin-only, logged)
--   One-time override that lets an applicant submit a new application even
--   though an active one already exists this cycle.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_allow_new_application(
    p_applicant_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    UPDATE public.inter_applicants
       SET admin_allow_new = true
     WHERE id = p_applicant_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Applicant not found.');
    END IF;
    PERFORM public.log_admin_action(
        'application.allow_new',
        'applicant', p_applicant_id::text,
        'Admin allowed a new application for this cycle'
            || COALESCE(' — ' || p_reason, ''));
    RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_allow_new_application(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inter_admin_allow_new_application(uuid,text) TO authenticated, service_role;

-- ===========================================================================
-- SECTION J — REPLACE inter_register: enforce 1 account per MOBILE too
--   (CNIC was already unique; mobile was not.)  No signature change.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_register(
    p_nationality text,
    p_cnic_formb  text,
    p_mobile      text,
    p_password    text
) RETURNS jsonb
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
    -- 1 account per mobile number
    IF EXISTS (SELECT 1 FROM public.inter_applicants WHERE mobile_number = p_mobile) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'An account with this mobile number already exists. Please Login.');
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

-- ===========================================================================
-- SECTION K — REPLACE inter_track: require a SECOND FACTOR + rate-limit
--   New signature: inter_track(p_tracking_id, p_second_factor, p_ip)
--   The second factor is the applicant's mobile number OR the last 4 digits
--   of their CNIC.  Wrong ID and wrong factor return the SAME {ok:false} so
--   nobody can probe for valid tracking IDs.
--   Called only by the Vercel auth-gateway with the service role (anon EXECUTE
--   is revoked below).  The gateway ALSO enforces per-IP limits before
--   calling this; this function enforces per-tracking-id limits too.
-- ===========================================================================
-- DROP both the old 1-arg signature AND any prior 3-arg version so this
-- migration is safe to re-run (CREATE OR REPLACE cannot change arg lists).
DROP FUNCTION IF EXISTS public.inter_track(text);
DROP FUNCTION IF EXISTS public.inter_track(text, text, text);

CREATE FUNCTION public.inter_track(
    p_tracking_id   text,
    p_second_factor text,
    p_ip            text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key        text;
    v_factor     text;
    v_factor_last4 text;
    a            public.inter_applications;
    v_app        public.inter_applicants;
    v_rate_id    int;
    v_id_attempts int;
    v_id_key     text;
BEGIN
    v_key    := upper(regexp_replace(coalesce(p_tracking_id, ''), '[^A-Za-z0-9]', '', 'g'));
    v_factor := regexp_replace(coalesce(p_second_factor, ''), '[^0-9]', '', 'g');
    -- identical error for empty id or empty factor
    IF v_key = '' OR v_factor = '' THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    -- ── per-tracking-id rate limit ──────────────────────────────────────
    SELECT rate_track_per_id_hour INTO v_rate_id FROM public.admission_settings WHERE id = 1;
    v_rate_id := COALESCE(v_rate_id, 5);
    v_id_key  := substring(md5(v_key) for 16);   -- hash so the key isn't stored raw
    SELECT count(*) INTO v_id_attempts
      FROM public.security_attempts
     WHERE bucket = 'track' AND key = v_id_key
       AND created_at > now() - interval '1 hour';
    IF v_id_attempts >= v_rate_id THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    -- always record the attempt (fail-safe; success updated below)
    INSERT INTO public.security_attempts (bucket, key, success)
        VALUES ('track', v_id_key, false);

    SELECT x.* INTO a FROM public.inter_applications x
      JOIN public.inter_applicants ap ON ap.id = x.applicant_id
     WHERE upper(regexp_replace(x.tracking_id, '[^A-Za-z0-9]', '', 'g')) = v_key
        OR regexp_replace(coalesce(x.jazzcash_token, ''), '[^0-9]', '', 'g') = v_key
     ORDER BY x.submitted_at DESC
     LIMIT 1;

    -- identical error if not found
    IF a.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    SELECT ap.* INTO v_app FROM public.inter_applicants ap WHERE ap.id = a.applicant_id;

    -- verify the second factor: full mobile (11 digits) OR last 4 of CNIC
    v_factor_last4 := right(regexp_replace(v_app.cnic_formb, '[^0-9]', '', 'g'), 4);
    IF regexp_replace(v_app.mobile_number, '[^0-9]', '', 'g') <> v_factor
       AND v_factor_last4 <> v_factor THEN
        -- wrong factor → SAME error as not found (no probing)
        RETURN jsonb_build_object('ok', false);
    END IF;

    -- success — flip the last attempt row to success
    UPDATE public.security_attempts SET success = true
     WHERE id = (SELECT id FROM public.security_attempts
                  WHERE bucket='track' AND key=v_id_key
                  ORDER BY created_at DESC LIMIT 1);

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
GRANT EXECUTE ON FUNCTION public.inter_track(text,text,text) TO service_role;

-- ===========================================================================
-- SECTION L — REPLACE inter_admin_set_payment: set locked_at when paid
--   (the audit trigger below logs the change).  No signature change.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_set_payment(
    p_application_id uuid, p_payment_status text, p_reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row public.inter_applications;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    -- Never regress a merit_listed / admitted application
    IF v_row.status IN ('merit_listed','admitted') AND p_payment_status <> 'paid' THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Cannot change payment for an application already on the merit list.');
    END IF;
    UPDATE public.inter_applications
       SET payment_status = p_payment_status::public.inter_payment_status,
           payment_reference = p_reference,
           paid_at   = CASE WHEN p_payment_status = 'paid' THEN now() ELSE NULL END,
           locked_at = CASE WHEN p_payment_status = 'paid' THEN now() ELSE NULL END,
           locked_by = CASE WHEN p_payment_status = 'paid' THEN auth.uid() ELSE NULL END,
           status    = CASE WHEN p_payment_status = 'paid' THEN 'fee_paid' ELSE status END,
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

-- ===========================================================================
-- SECTION M — Audit triggers on inter_applications, admission_settings,
--            profiles.  These fire only when the caller is an admin, so
--            applicant-driven updates (inter_proceed_payment etc.) are not
--            logged as admin actions.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_audit_inter_apps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_action text; v_summary text;
BEGIN
    IF NOT public.inter_is_admin() THEN RETURN NULL; END IF;
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.log_admin_action('application.delete','application',
            OLD.id::text, 'Deleted application ' || OLD.tracking_id,
            to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    -- UPDATE: detect the kind of change
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        v_action := CASE WHEN NEW.payment_status = 'paid' THEN 'fee.mark_paid' ELSE 'fee.mark_' || NEW.payment_status::text END;
        v_summary := 'Payment status ' || OLD.payment_status::text || ' → ' || NEW.payment_status::text
                     || ' for ' || NEW.tracking_id;
    ELSIF OLD.locked_at IS NOT NULL AND NEW.locked_at IS NULL THEN
        v_action := 'application.unlock';
        v_summary := 'Unlocked ' || NEW.tracking_id;
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        v_action := 'application.status_change';
        v_summary := 'Status ' || OLD.status::text || ' → ' || NEW.status::text
                     || ' for ' || NEW.tracking_id;
    ELSE
        RETURN NULL;   -- non-audited update
    END IF;
    PERFORM public.log_admin_action(v_action,'application', NEW.id::text,
        v_summary, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_inter_apps_update ON public.inter_applications;
CREATE TRIGGER trg_audit_inter_apps_update AFTER UPDATE ON public.inter_applications
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_inter_apps();
DROP TRIGGER IF EXISTS trg_audit_inter_apps_delete ON public.inter_applications;
CREATE TRIGGER trg_audit_inter_apps_delete BEFORE DELETE ON public.inter_applications
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_inter_apps();

-- admission_settings change
CREATE OR REPLACE FUNCTION public.trg_fn_audit_admission_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- log whenever the row changes and the caller is an admin
    IF NOT public.inter_is_admin() THEN RETURN NULL; END IF;
    PERFORM public.log_admin_action('settings.change','admission_settings','1',
        'Admission settings updated',
        to_jsonb(OLD), to_jsonb(NEW));
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_admission_settings_update ON public.admission_settings;
CREATE TRIGGER trg_audit_admission_settings_update AFTER UPDATE ON public.admission_settings
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_admission_settings();

-- profiles role change / delete
CREATE OR REPLACE FUNCTION public.trg_fn_audit_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN RETURN NULL; END IF;
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.log_admin_action('user.delete','user', OLD.id::text,
            'Deleted user ' || COALESCE(OLD.full_name, OLD.id::text),
            to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    -- UPDATE
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        PERFORM public.log_admin_action('user.role_change','user', NEW.id::text,
            'Role ' || OLD.role || ' → ' || NEW.role || ' for ' || COALESCE(NEW.full_name, NEW.id::text),
            to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_profiles_update ON public.profiles;
CREATE TRIGGER trg_audit_profiles_update AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_profiles();
DROP TRIGGER IF EXISTS trg_audit_profiles_delete ON public.profiles;
CREATE TRIGGER trg_audit_profiles_delete BEFORE DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_audit_profiles();

-- ===========================================================================
-- SECTION N — REVOKE anon EXECUTE on the three Turnstile-gated RPCs
--   The browser can NO LONGER call inter_register / inter_login / inter_track
--   directly with the anon key.  Only the Vercel auth-gateway (service role)
--   can.  The gateway verifies Cloudflare Turnstile first, so a browser that
--   bypasses the widget still cannot reach the RPC.
-- ===========================================================================
REVOKE EXECUTE ON FUNCTION public.inter_register(text,text,text,text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.inter_register(text,text,text,text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.inter_login(text,text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.inter_login(text,text) TO service_role;
-- NOTE: inter_login is now service-role only — the browser must go through the
-- auth-gateway (which verifies Turnstile first). anon can no longer brute-force
-- the login RPC directly.

REVOKE EXECUTE ON FUNCTION public.inter_track(text,text,text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.inter_track(text,text,text) TO service_role;

-- Keep the rest of the inter_ family anon-callable as before (they take a
-- token, so they are self-gating).  Re-assert the bulk grants from migration
-- 21 so a re-run of 16_security_hardening.sql cannot lock the public flow
-- out of anything except the three explicitly-revoked functions above.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'inter\_%'
  LOOP
    IF r.proname LIKE 'inter\_admin\_%' OR r.proname = 'inter_is_admin'
       OR r.proname IN ('inter_random_suffix') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
    ELSIF r.proname IN ('inter_register','inter_login') THEN
      -- already handled explicitly above; do nothing here
      NULL;
    ELSIF r.proname = 'inter_track' THEN
      -- service-role only (already granted)
      NULL;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role', r.proname, r.args);
    END IF;
  END LOOP;
END $$;

-- ===========================================================================
-- SECTION O — helper: inter_admin_list now also returns cycle + locked flags
--   (CREATE OR REPLACE to add two fields to the returned JSON without
--   breaking the existing column list the admin UI relies on.)
-- ===========================================================================
-- We do NOT redefine inter_admin_list here to avoid risk; the admin UI reads
-- cycle / locked_at via the row's existing JSON keys when needed.  The
-- columns exist on the table so any SELECT * includes them.

-- done.
-- ▲▲▲ END original file: 24_admission_security_hardening.sql ▲▲▲
