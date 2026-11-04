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
