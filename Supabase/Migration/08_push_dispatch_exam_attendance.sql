-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 08 — Instant push dispatch + exam attendance hardening
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 09_push_instant_dispatch.sql
--   • 10_exam_attendance_hardening.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 09_push_instant_dispatch.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 09 — Instant + guaranteed Web Push dispatch (pg_net + pg_cron)
-- ═══════════════════════════════════════════════════════════════════════
-- WHY: /api/push?action=dispatch used to run ONLY when a visitor opened the
-- site (throttled) or an admin had the panel open, and vercel.json has no
-- cron. So pushes were late or never sent. This file makes the DATABASE call
-- the dispatcher:
--   • instantly, the moment a notice / news / merit list / roll slip /
--     result / date sheet row / admission status is written (statement-level
--     triggers, one call per statement even for bulk imports), and
--   • every minute as a safety net (pg_cron) — this also runs the scheduled
--     result auto-publisher, so countdown results go live on time and push.
--
-- SETUP (once):
--   1. Vercel → Settings → Environment Variables → add CRON_SECRET = any long
--      random string → Redeploy.
--   2. Run this whole file in the Supabase SQL editor.
--   3. Run (use YOUR secret and site URL):
--        select public.push_configure('https://ghssghallanai.dpdns.org', 'PASTE_THE_SAME_CRON_SECRET');
--   4. Check:  select public.push_ping();   then
--        select status_code, content from net._http_response order by created desc limit 3;
--      (status_code 200 = working)
-- ═══════════════════════════════════════════════════════════════════════

-- Supabase ships pg_net / pg_cron; on other hosts these DO blocks degrade to a
-- NOTICE instead of a hard failure, and the cron sections in files 12/17 skip themselves.
DO $mig$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available on this host (fine on Supabase)';
END $mig$;




DO $mig$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available on this host (fine on Supabase)';
END $mig$;



-- Config lives in push_state (RLS on, no policies → invisible to anon/authenticated).
CREATE OR REPLACE FUNCTION public.push_configure(p_site text, p_secret text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(p_site,'') !~ '^https://' OR coalesce(p_secret,'') = '' THEN
    RAISE EXCEPTION 'Usage: select public.push_configure(''https://your-site'', ''CRON_SECRET'')';
  END IF;
  INSERT INTO public.push_state(key, value, updated_at)
  VALUES ('cfg', jsonb_build_object('site', rtrim(p_site,'/'), 'secret', p_secret), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN 'push dispatcher configured for ' || rtrim(p_site,'/');
END $$;


REVOKE ALL ON FUNCTION public.push_configure(text,text) FROM PUBLIC, anon, authenticated;



-- Fire-and-forget call to the dispatcher. NEVER raises: a push problem must not block a publish.
CREATE OR REPLACE FUNCTION public.push_ping()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v jsonb; req bigint;
BEGIN
  SELECT value INTO v FROM public.push_state WHERE key = 'cfg';
  IF v IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := (v->>'site') || '/api/push?action=dispatch&src=db',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (v->>'secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO req;
  RETURN req;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;


REVOKE ALL ON FUNCTION public.push_ping() FROM PUBLIC, anon, authenticated;



CREATE OR REPLACE FUNCTION public.push_auto_publish()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v jsonb; req bigint;
BEGIN
  SELECT value INTO v FROM public.push_state WHERE key = 'cfg';
  IF v IS NULL THEN RETURN NULL; END IF;
  SELECT net.http_post(
    url := (v->>'site') || '/api/auto-publish-results',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (v->>'secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO req;
  RETURN req;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;


REVOKE ALL ON FUNCTION public.push_auto_publish() FROM PUBLIC, anon, authenticated;



CREATE OR REPLACE FUNCTION public.push_ping_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_ping();
  RETURN NULL;
END $$;



-- Statement-level: ONE ping per INSERT/UPDATE statement (bulk imports don't flood the API).
-- pg_net sends the request only after the transaction commits, so the dispatcher always sees the new data.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notices','news','merit_lists','exam_roll_sessions','results','exam_schedule'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS push_ping_ins ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS push_ping_upd ON public.%I', t);
    EXECUTE format('CREATE TRIGGER push_ping_ins AFTER INSERT ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.push_ping_trigger()', t);
    EXECUTE format('CREATE TRIGGER push_ping_upd AFTER UPDATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.push_ping_trigger()', t);
  END LOOP;
  -- Admissions: only status changes matter (new applications are not announced).
  DROP TRIGGER IF EXISTS push_ping_upd ON public.admissions;
  CREATE TRIGGER push_ping_upd AFTER UPDATE ON public.admissions FOR EACH STATEMENT EXECUTE FUNCTION public.push_ping_trigger();
END $$;



-- Safety net + scheduled-results publisher: every minute.
-- pg_cron raises on a duplicate job name, so each name is unscheduled first
-- (file 12 later replaces ghss-push-dispatch / ghss-auto-publish with one
-- 'ghss-tick' job) — re-running this file is safe. Skipped (NOTICE) without pg_cron.
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - push jobs skipped (fine on Supabase, which ships pg_cron)';
    RETURN;
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('ghss-push-dispatch', 'ghss-auto-publish', 'ghss-net-cleanup');
  PERFORM cron.schedule('ghss-push-dispatch', '* * * * *', $$select public.push_ping();$$);
  PERFORM cron.schedule('ghss-auto-publish',  '* * * * *', $$select public.push_auto_publish();$$);

  -- Keep pg_net's response log from growing forever.
  PERFORM cron.schedule('ghss-net-cleanup', '17 3 * * *', $$delete from net._http_response where created < now() - interval '2 days';$$);
  RAISE NOTICE 'cron jobs registered: ghss-push-dispatch, ghss-auto-publish, ghss-net-cleanup';
END $mig$;
-- ▲▲▲ END original file: 09_push_instant_dispatch.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 10_exam_attendance_hardening.sql ▼▼▼
-- 10_exam_attendance_hardening.sql   (OPTIONAL but recommended)
-- ---------------------------------------------------------------------------
-- Why: the current policies on public.exam_attendance let ANY logged-in user
-- (for example a student or parent account) INSERT / UPDATE / DELETE rows,
-- because they are `TO authenticated ... WITH CHECK (true)`.
-- After this migration only users whose profiles.role = 'admin' can change
-- exam attendance. Teachers who take attendance must therefore have the
-- 'admin' role (that is how your admin panel already works).
--
-- READ ACCESS IS NOT CHANGED.
--
-- BEFORE RUNNING — check that every teacher/invigilator is an admin:
--   select role, count(*) from public.profiles group by role;
--
-- ROLLBACK (restores the old, open policies) is at the bottom.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin and teachers can insert exam attendance" ON public.exam_attendance;


DROP POLICY IF EXISTS "Admin and teachers can update exam attendance" ON public.exam_attendance;


DROP POLICY IF EXISTS "Admin can delete exam attendance"              ON public.exam_attendance;

DROP POLICY IF EXISTS "Admins can insert exam attendance" ON public.exam_attendance;


CREATE POLICY "Admins can insert exam attendance" ON public.exam_attendance
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update exam attendance" ON public.exam_attendance;


CREATE POLICY "Admins can update exam attendance" ON public.exam_attendance
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete exam attendance" ON public.exam_attendance;


CREATE POLICY "Admins can delete exam attendance" ON public.exam_attendance
  FOR DELETE TO authenticated USING (public.is_admin());



-- ---------------------------------------------------------------------------
-- ROLLBACK
-- DROP POLICY IF EXISTS "Admins can insert exam attendance" ON public.exam_attendance;
-- DROP POLICY IF EXISTS "Admins can update exam attendance" ON public.exam_attendance;
-- DROP POLICY IF EXISTS "Admins can delete exam attendance" ON public.exam_attendance;
-- CREATE POLICY "Admin and teachers can insert exam attendance" ON public.exam_attendance FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Admin and teachers can update exam attendance" ON public.exam_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Admin can delete exam attendance" ON public.exam_attendance FOR DELETE TO authenticated USING (true);
-- ▲▲▲ END original file: 10_exam_attendance_hardening.sql ▲▲▲
