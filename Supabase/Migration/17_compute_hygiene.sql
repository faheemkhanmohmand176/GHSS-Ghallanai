-- ═══════════════════════════════════════════════════════════════════════
-- FILE 17 — Compute hygiene for the Nano instance
-- Safe to run more than once. Deletes only log/queue rows, never school data.
-- Every cron / pg_net statement first checks the schema exists, so the file
-- also runs clean on hosts without pg_cron / pg_net (Supabase has both).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Remove the OLD every-minute jobs if they are still scheduled
--    (file 12 replaced them with the single 5-minute 'ghss-tick').
DO $mig$
DECLARE j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - old-job cleanup skipped (fine on Supabase)';
    RETURN;
  END IF;
  FOR j IN SELECT jobid, jobname FROM cron.job
           WHERE jobname IN ('ghss-push-dispatch', 'ghss-auto-publish')
  LOOP
    PERFORM cron.unschedule(j.jobid);
    RAISE NOTICE 'Unscheduled old job %', j.jobname;
  END LOOP;
END $mig$;



-- 2. Keep the two biggest junk tables small: cron run history and pg_net
--    responses (together ~8 MB, more than all student records).
--    Runs daily at 03:23 server time; keeps 1 day.
--    cron.schedule raises on a duplicate job name, so 'ghss-log-trim'
--    is unscheduled first — the statement is re-runnable.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - log-trim job not scheduled (fine on Supabase)';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ghss-log-trim';
  PERFORM cron.schedule(
    'ghss-log-trim', '23 3 * * *',
    $$delete from cron.job_run_details where end_time < now() - interval '1 day';
      delete from net._http_response    where created  < now() - interval '1 day';$$
  );
  RAISE NOTICE 'cron job registered: ghss-log-trim';
END $mig$;



-- 3. One-time cleanup now (each table only if its schema exists).
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '1 day';
  ELSE
    RAISE NOTICE 'pg_cron not installed - cron history cleanup skipped';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    DELETE FROM net._http_response WHERE created < now() - interval '1 day';
  ELSE
    RAISE NOTICE 'pg_net not installed - http response cleanup skipped';
  END IF;
END $mig$;



-- 4. CHECK ONLY (read-only): which tables Realtime scans for changes.
--    Anything in this list that does NOT need live updates should be dropped:
--      alter publication supabase_realtime drop table public.<table_name>;
--    Tables the app really subscribes to: profiles, fee_vouchers,
--    fee_structures, fee_payments, exam_attendance.
SELECT schemaname, tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' ORDER BY tablename;



-- 5. CHECK ONLY: the cron jobs that should remain.
DO $mig$
DECLARE j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - nothing to list';
    RETURN;
  END IF;
  FOR j IN SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname
  LOOP
    RAISE NOTICE 'cron job: % | % | active=%', j.jobname, j.schedule, j.active;
  END LOOP;
END $mig$;
