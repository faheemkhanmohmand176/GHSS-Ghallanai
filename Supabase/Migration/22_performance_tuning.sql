-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 22 — Performance tuning (from the Nov 2026 read-only Supabase audit)
-- ═══════════════════════════════════════════════════════════════════════════
-- Run in: Supabase Dashboard → SQL Editor → paste the WHOLE file → Run.
-- Safe to run more than once. Deletes NO data. Run AFTER 21_security_fixes.sql.
--
--   §1  audit_log RLS policy: per-row auth call → evaluated once (advisor warning)
--   §2  Missing foreign-key indexes (advisor: 40) — only where useful
--   §3  Exact DUPLICATE indexes removed (never "unused" ones — see notes)
--   §4  Daily database-size history (real days-to-500-MB estimate + alarm data)
--   §5  Fresh planner statistics (ANALYZE)
--
-- DELIBERATELY NOT DONE (and why):
--   • The audit's results / exam_roll_sessions / notices / teachers indexes:
--     idx_results_scheduled_due already exists (migration 09) and the other
--     tables hold a handful of rows — Postgres would ignore a new index and
--     only pay to maintain it.
--   • Dropping the "112 unused indexes": idx_scan = 0 on a quiet site proves
--     nothing; results day and admission season are what those indexes are for.
--   • Changing the 5-minute push_tick cron: it costs ~14 ms per run
--     (≈ 4 seconds of CPU per DAY in total).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §1 — audit_log: evaluate auth.*() once per query, not once per row
-- ═══════════════════════════════════════════════════════════════════════════
-- Rewrites only the TEXT of the existing policy (same rule, same roles):
--   auth.uid()  →  (select auth.uid())      (also role / jwt / email /
--   current_setting(...)). Already-wrapped calls are left alone, so a second
--   run changes nothing.
DO $$
DECLARE
  p record; q text; w text; n int := 0;
  re_auth text := '(?<!SELECT )(auth\.(uid|role|jwt|email)\(\))';
  re_cset text := '(?<!SELECT )(current_setting\([^()]*\))';
BEGIN
  FOR p IN SELECT policyname, qual, with_check FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'audit_log'
  LOOP
    q := p.qual;
    w := p.with_check;
    IF q IS NOT NULL THEN
      q := regexp_replace(regexp_replace(q, re_auth, '(select \1)', 'gi'), re_cset, '(select \1)', 'gi');
    END IF;
    IF w IS NOT NULL THEN
      w := regexp_replace(regexp_replace(w, re_auth, '(select \1)', 'gi'), re_cset, '(select \1)', 'gi');
    END IF;
    IF q IS DISTINCT FROM p.qual OR w IS DISTINCT FROM p.with_check THEN
      EXECUTE format('ALTER POLICY %I ON public.audit_log%s%s',
        p.policyname,
        CASE WHEN q IS NOT NULL THEN format(' USING (%s)', q) ELSE '' END,
        CASE WHEN w IS NOT NULL THEN format(' WITH CHECK (%s)', w) ELSE '' END);
      n := n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE '§1: % audit_log policy/policies rewritten', n;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2 — Foreign-key indexes (child-side lookups, joins, cascading deletes)
-- ═══════════════════════════════════════════════════════════════════════════
-- Creates an index for every foreign key in `public` that has NO index starting
-- with the same columns. Skipped on purpose (they only matter when an admin
-- account is deleted, and each extra index slows every write):
--   • FKs pointing at auth.users
--   • "who did it" columns: created_by, updated_by, reviewed_by, approved_by ...
-- The tables are small, so plain CREATE INDEX takes milliseconds.
DO $$
DECLARE r record; n int := 0; idx_name text;
BEGIN
  FOR r IN
    SELECT c.conrelid, c.conrelid::regclass AS tbl, cl.relname,
           (SELECT string_agg(a.attname, '_' ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS colnames,
           (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
              FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS collist
      FROM pg_constraint c
      JOIN pg_class cl     ON cl.oid = c.conrelid AND cl.relkind = 'r'
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
     WHERE c.contype = 'f'
       AND c.confrelid <> to_regclass('auth.users')
       AND NOT EXISTS (
             SELECT 1 FROM pg_index i
              WHERE i.indrelid = c.conrelid
                AND i.indisvalid
                AND i.indpred IS NULL
                AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(c.conkey, 1)] = c.conkey)
  LOOP
    CONTINUE WHEN r.colnames ~ '(^|_)(created|updated|deleted|reviewed|approved|verified|published|uploaded|assigned)_by$';
    idx_name := left('idx_fk_' || r.relname || '_' || r.colnames, 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%s)', idx_name, r.tbl, r.collist);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '§2: % foreign-key index(es) created', n;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §3 — Remove exact duplicate (non-unique) indexes
-- ═══════════════════════════════════════════════════════════════════════════
-- Two indexes with identical columns / opclass / predicate on the same table
-- are pure write overhead. The oldest one is kept. Unique, primary-key and
-- constraint-backing indexes are never touched.
DO $$
DECLARE r record; d oid; n int := 0;
BEGIN
  FOR r IN
    SELECT array_agg(i.indexrelid ORDER BY i.indexrelid) AS ids
      FROM pg_index i
      JOIN pg_class c      ON c.oid = i.indexrelid
      JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
     WHERE NOT i.indisunique AND NOT i.indisprimary AND NOT i.indisexclusion
       AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)
     GROUP BY i.indrelid, i.indkey::text, i.indclass::text, i.indcollation::text,
              i.indoption::text, coalesce(i.indexprs::text, ''), coalesce(i.indpred::text, '')
    HAVING count(*) > 1
  LOOP
    FOREACH d IN ARRAY r.ids[2:array_length(r.ids, 1)] LOOP
      EXECUTE format('DROP INDEX IF EXISTS %s', d::regclass);
      n := n + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE '§3: % duplicate index(es) dropped', n;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §4 — Daily database-size history
-- ═══════════════════════════════════════════════════════════════════════════
-- One tiny row per day (≈ 1 KB/day, auto-pruned after 400 days). After a week
-- you can read the real growth rate:
--   SELECT captured_at, pg_size_pretty(db_bytes) FROM public.db_size_history
--    ORDER BY captured_at DESC LIMIT 30;
CREATE TABLE IF NOT EXISTS public.db_size_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at timestamptz NOT NULL DEFAULT now(),
  db_bytes    bigint      NOT NULL,
  top_tables  jsonb
);
CREATE INDEX IF NOT EXISTS idx_db_size_history_captured_at ON public.db_size_history (captured_at DESC);

ALTER TABLE public.db_size_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.db_size_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.db_size_history TO authenticated;

DROP POLICY IF EXISTS db_size_history_admin_read ON public.db_size_history;
CREATE POLICY db_size_history_admin_read ON public.db_size_history
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_db_size() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.db_size_history (db_bytes, top_tables)
  SELECT pg_database_size(current_database()),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('table', t.name, 'bytes', t.bytes)), '[]'::jsonb)
            FROM (SELECT relid::regclass::text AS name, pg_total_relation_size(relid) AS bytes
                    FROM pg_catalog.pg_statio_user_tables
                   ORDER BY pg_total_relation_size(relid) DESC LIMIT 10) t);
  DELETE FROM public.db_size_history WHERE captured_at < now() - interval '400 days';
END $$;

REVOKE ALL ON FUNCTION public.record_db_size() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_db_size() TO service_role;

DO $mig$
DECLARE j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - daily size snapshot skipped';
    RETURN;
  END IF;
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'ghss-db-size-daily' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
  -- 03:17 UTC = 08:17 Pakistan time: the quietest hour of the day.
  PERFORM cron.schedule('ghss-db-size-daily', '17 3 * * *', $$select public.record_db_size();$$);
END $mig$;

-- first data point right now
SELECT public.record_db_size();


-- ═══════════════════════════════════════════════════════════════════════════
-- §5 — Fresh planner statistics for the public tables (cheap, no locks)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT format('%I.%I', schemaname, tablename) AS q FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ANALYZE ' || t.q;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY (run separately afterwards)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) audit_log policy now uses the "( SELECT auth...)" form:
--    SELECT policyname, qual FROM pg_policies WHERE tablename = 'audit_log';
-- 2) Re-run Supabase Dashboard → Advisors → Performance: the audit_log warning
--    and most "unindexed foreign key" items should be gone.
-- 3) First size snapshot:
--    SELECT captured_at, pg_size_pretty(db_bytes) FROM public.db_size_history;
-- 4) Daily job is registered:
--    SELECT jobname, schedule FROM cron.job WHERE jobname = 'ghss-db-size-daily';
