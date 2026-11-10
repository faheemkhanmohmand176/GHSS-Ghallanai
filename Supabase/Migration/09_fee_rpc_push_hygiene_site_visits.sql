-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 09 — Fee RPC/indexes, stop minute-loop, site_visits retention
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 11_fee_perf_indexes_rpc.sql
--   • 12_stop_minute_loop_push_hygiene.sql
--   • 13_site_visits_slim_retention.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 11_fee_perf_indexes_rpc.sql ▼▼▼
-- ─────────────────────────────────────────────────────────────────────────────
-- 11_fee_perf_indexes_rpc.sql — Fee module performance + correctness
--
-- WHAT THIS MIGRATION ADDS
-- ───────────────────────
-- 1. record_fee_payment(p_…) — ONE atomic RPC for recording a fee payment.
--
--    WHY: the client previously did a 3-step read-modify-write
--    (INSERT payment → SELECT voucher → UPDATE voucher). Besides the extra
--    round trips, two clerks recording payments on the SAME voucher
--    concurrently could both read paid_amount = X and both write
--    X + their own amount — silently losing the other payment. The RPC does
--    the insert + update inside a single transaction with a row lock
--    (SELECT … FOR UPDATE), so concurrent payments always accumulate
--    correctly.
--
--    The client (src/hooks/useFees.ts → useRecordPayment) calls this RPC
--    FIRST and transparently falls back to the old 3-step flow when the
--    function does not exist (error PGRST202) — so this migration is safe
--    to apply at any time; nothing breaks before or after.
--
-- 2. Indexes on the exact columns the Fees queries filter/aggregate on
--    (each one justified by a real query in src/hooks/useFees.ts):
--
--      fee_vouchers(status)              — useFeeDefaulters  (.in status)
--      fee_vouchers(year)                — useFeeCollectionReport / useClassCollectionSummary (.eq year)
--      fee_vouchers(class)               — vouchers-per-class lists + dashboard breakdown
--      fee_vouchers(student_id)          — useStudentVouchers / useAllVouchersForStudents (.eq/.in)
--      fee_payments(student_id, payment_date) — useFeeDefaulters "last payment date" (.in + ORDER BY payment_date DESC)
--      fee_payments(voucher_id)          — payment history per voucher
--
--    All are plain b-tree indexes; every one backs an existing WHERE /
--    ORDER BY / JOIN path. No unique constraints added, no column changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Atomic payment recording RPC ─────────────────────────────────────────
create or replace function public.record_fee_payment(
  p_voucher_id      uuid,
  p_student_id      uuid,
  p_amount          numeric,
  p_payment_method  text,
  p_receipt_number  text,
  p_payment_date    date,
  p_received_by     text default null,
  p_notes           text default null
)
returns public.fee_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment   public.fee_payments;
  v_total     numeric;
  v_late      numeric;
  v_paid      numeric;
  v_new_paid  numeric;
  v_status    text;
begin
  -- Amount sanity: refuse zero/negative payments outright.
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  -- Lock the voucher row so concurrent recordings serialise correctly.
  select total_amount, late_fee, paid_amount
    into v_total, v_late, v_paid
  from public.fee_vouchers
  where id = p_voucher_id
  for update;

  if v_total is null then
    raise exception 'Voucher % not found', p_voucher_id;
  end if;

  insert into public.fee_payments (
    voucher_id, student_id, amount, payment_method,
    receipt_number, payment_date, received_by, notes
  ) values (
    p_voucher_id, p_student_id, p_amount, p_payment_method,
    p_receipt_number, p_payment_date, p_received_by, p_notes
  )
  returning * into v_payment;

  v_new_paid := coalesce(v_paid, 0) + p_amount;
  v_status   := case when v_new_paid >= (coalesce(v_total, 0) + coalesce(v_late, 0))
                     then 'paid' else 'partial' end;

  update public.fee_vouchers
     set paid_amount = v_new_paid,
         status      = v_status
   where id = p_voucher_id;

  return v_payment;
end;
$$;



grant execute on function public.record_fee_payment to authenticated, anon;



-- ── 2. Query-path indexes ────────────────────────────────────────────────────
create index if not exists idx_fee_vouchers_status     on public.fee_vouchers (status);


create index if not exists idx_fee_vouchers_year       on public.fee_vouchers (year);


create index if not exists idx_fee_vouchers_class      on public.fee_vouchers (class);


create index if not exists idx_fee_vouchers_student_id on public.fee_vouchers (student_id);


create index if not exists idx_fee_payments_student_date on public.fee_payments (student_id, payment_date desc);


create index if not exists idx_fee_payments_voucher_id   on public.fee_payments (voucher_id);
-- ▲▲▲ END original file: 11_fee_perf_indexes_rpc.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 12_stop_minute_loop_push_hygiene.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 12 — Stop the every-minute cron loop + push hygiene   (Plan: Phase 1 + 3.1)
-- ═══════════════════════════════════════════════════════════════════════
-- WHY: migration 09 scheduled TWO jobs every minute (push_ping + push_auto_publish). Each one
--      woke a Vercel function that read 6 tables and wrote push_state, 1,440x/day each,
--      even when nothing had changed. That loop (cron history, pg_net responses, push_state
--      WAL scanned by Realtime) is what drains the Disk IO budget.
--
-- WHAT THIS FILE DOES (nothing is deleted, no data touched):
--   1. push_signature()  — tiny RPC: hash of everything the dispatcher watches. The Vercel code
--                          (api/_lib/push-core.js) uses it to exit early when nothing changed.
--   2. push_tick()       — ONE job instead of two. Pure SQL: sends the auto-publish HTTP call
--                          ONLY when a scheduled result is really due; sends the push safety-net
--                          ping only about every 15 minutes.
--   3. Schedules: 'ghss-tick' every 5 min (staggered, minutes 2,7,12…), 'ghss-cron-cleanup' daily.
--   4. Removes the two old every-minute jobs.
--   5. push_state fillfactor (room for in-place updates).
--
-- UNCHANGED ON PURPOSE: the push_ping_ins / push_ping_upd triggers (instant push on any change),
-- the 'ghss-net-cleanup' job, push_configure(), the browser trigger for exact-second publishing.
--
-- RUN ORDER: 1) run this whole file  2) deploy the code  3) run the VACUUM line at the bottom
-- (VACUUM cannot run inside the same transaction, so run it as its own statement).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Change signature (read by api/_lib/push-core.js) ────────────────
CREATE OR REPLACE FUNCTION public.push_signature()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'cur', md5(concat_ws('|',
      -- notices (same set the dispatcher reads: published, newest 200)
      (SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.created_at DESC, x.id), ''))
         FROM (SELECT id, created_at FROM public.notices WHERE is_published IS TRUE
               ORDER BY created_at DESC, id LIMIT 200) x),
      -- merit lists (published, up to 500)
      (SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.id), ''))
         FROM (SELECT id FROM public.merit_lists WHERE is_published IS TRUE
               ORDER BY id LIMIT 500) x),
      -- roll number slip sessions (published, newest 200)
      (SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.created_at DESC, x.id), ''))
         FROM (SELECT id, created_at FROM public.exam_roll_sessions WHERE is_published IS TRUE
               ORDER BY created_at DESC, id LIMIT 200) x),
      -- results: one entry per published class|exam|year
      (SELECT md5(coalesce(string_agg(x.k, ',' ORDER BY x.k), ''))
         FROM (SELECT DISTINCT (class || '|' || exam_type || '|' || year::text) AS k
               FROM public.results WHERE is_published IS TRUE) x),
      -- date sheet rows
      (SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.id), ''))
         FROM (SELECT id FROM public.exam_schedule ORDER BY id LIMIT 3000) x),
      -- admission status of every applicant that has a push subscription
      (SELECT md5(coalesce(string_agg(a.reference_no || ':' || a.status::text, ',' ORDER BY a.reference_no), ''))
         FROM public.admissions a
        WHERE a.reference_no IN (SELECT s.admission_ref FROM public.push_subscriptions s
                                  WHERE s.admission_ref IS NOT NULL))
    )),
    'prev',  (SELECT value->>'_sig' FROM public.push_state WHERE key = 'seen'),
    'retry', coalesce((SELECT coalesce(value->'_tries', '{}'::jsonb) <> '{}'::jsonb
                         FROM public.push_state WHERE key = 'seen'), false)
  );
$$;


-- Server-only: the Vercel function calls it with the service-role key.
REVOKE ALL ON FUNCTION public.push_signature() FROM PUBLIC, anon, authenticated;


GRANT EXECUTE ON FUNCTION public.push_signature() TO service_role;



-- ── 2. Small partial index so the "is a result due?" check is instant ──
-- Only rows that are scheduled-but-unpublished are in it (usually zero rows).
CREATE INDEX IF NOT EXISTS idx_results_scheduled_due
  ON public.results (publish_at)
  WHERE is_published = false AND publish_at IS NOT NULL;



-- ── 3. The single gated tick ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.push_tick()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.results
              WHERE is_published = false AND publish_at IS NOT NULL AND publish_at <= now()) THEN
    -- A scheduled result is due and nobody's browser has published it yet.
    -- (The endpoint also runs the push dispatcher right after publishing.)
    PERFORM public.push_auto_publish();
  ELSIF (extract(minute FROM now())::int % 15) < 5 THEN
    -- Safety net, about every 15 minutes (ticks run at :02 :07 :12 … → fires at :02 :17 :32 :47).
    -- DB triggers already push instantly on every change; this only catches a missed call.
    PERFORM public.push_ping();
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;  -- a cron tick must never raise
END $$;


REVOKE ALL ON FUNCTION public.push_tick() FROM PUBLIC, anon, authenticated;



-- ── 4. Replace the two every-minute jobs ───────────────────────────────
-- (unschedule by name via the jobs table so a missing job never raises)
DO $mig$
DECLARE j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - cron jobs skipped (fine on Supabase, which ships pg_cron)';
    RETURN;
  END IF;
  -- pg_cron raises on a duplicate job name, so all names are unscheduled first.
  FOR j IN SELECT jobid FROM cron.job
           WHERE jobname IN ('ghss-push-dispatch', 'ghss-auto-publish',
                             'ghss-tick', 'ghss-cron-cleanup')
  LOOP
    PERFORM cron.unschedule(j.jobid);
    RAISE NOTICE 'Unscheduled job %', j.jobid;
  END LOOP;

  -- Staggered: minutes 2,7,12,…,57 → never starts at :00 where other jobs start.
  PERFORM cron.schedule('ghss-tick', '2-59/5 * * * *', $$select public.push_tick();$$);

  -- cron's own run history: keep 2 days only (it used to grow by ~2,900 rows/day).
  PERFORM cron.schedule('ghss-cron-cleanup', '23 3 * * *',
    $$delete from cron.job_run_details where end_time < now() - interval '2 days';$$);
  RAISE NOTICE 'cron jobs registered: ghss-tick, ghss-cron-cleanup';
END $mig$;


-- 'ghss-net-cleanup' (from file 09) stays as it is.

-- ── 5. push_state: leave free space in each page so updates stay in place (HOT) ──
ALTER TABLE public.push_state SET (fillfactor = 70);



-- ═══════════════════════════════════════════════════════════════════════
-- RUN AS A SEPARATE STATEMENT AFTER THE ABOVE (VACUUM cannot run in a transaction block):
--   vacuum (analyze) public.push_state;
--
-- CHECK:
--   select jobname, schedule, active from cron.job order by 1;
--   (expect: ghss-tick, ghss-cron-cleanup, ghss-net-cleanup — and NO ghss-push-dispatch / ghss-auto-publish)
--   select public.push_signature();          -- run in SQL editor as postgres; returns {cur, prev, retry}
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════ ROLLBACK (run only if needed) ═════════════
-- select cron.unschedule(jobid) from cron.job where jobname in ('ghss-tick','ghss-cron-cleanup');
-- select cron.schedule('ghss-push-dispatch', '* * * * *', $$select public.push_ping();$$);
-- select cron.schedule('ghss-auto-publish',  '* * * * *', $$select public.push_auto_publish();$$);
-- drop function if exists public.push_tick();
-- drop function if exists public.push_signature();   -- (old code ignores it; new code falls back to full runs)
-- drop index if exists public.idx_results_scheduled_due;
-- alter table public.push_state reset (fillfactor);
-- ▲▲▲ END original file: 12_stop_minute_loop_push_hygiene.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 13_site_visits_slim_retention.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 13 — Slim down site_visits (Plan: Phase 4.2)
-- ═══════════════════════════════════════════════════════════════════════
-- WHY: site_visits is the most write-heavy table (one row per page view). It carried 6 indexes
--      and every insert had to update all of them, while the Site Analytics screen only ever
--      filters/sorts on created_at (verified in src/hooks/useSiteAnalytics.ts: .gte/.lt/.order on
--      created_at, nothing else; no other code reads this table).
--
-- WHAT THIS FILE DOES:
--   • Drops 3 indexes nobody scans: device_type, page, session_id.
--   • KEEPS: primary key, idx_site_visits_created_at (used by Site Analytics) and the PARTIAL
--     idx_site_visits_user_id (only logged-in rows; it makes the ON DELETE SET NULL foreign key
--     to auth.users cheap when a user is deleted).
--   • Nightly retention: rows older than 120 days are deleted. The Site Analytics screen only
--     looks back 30 days + 30 days for comparison = 60 days, so nothing visible is lost.
--
-- Safe to re-run. No row is touched by the index drops.
-- ═══════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS public.idx_site_visits_device_type;


DROP INDEX IF EXISTS public.idx_site_visits_page;


DROP INDEX IF EXISTS public.idx_site_visits_session_id;



-- Runs as the cron owner (bypasses RLS, so the "no one can delete" policy does not block it).
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RAISE NOTICE 'pg_cron not installed - retention job skipped (fine on Supabase, which ships pg_cron)';
    RETURN;
  END IF;
  -- unschedule first so re-running never raises 'job already exists'
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ghss-site-visits-retention';
  PERFORM cron.schedule('ghss-site-visits-retention', '41 3 * * *',
    $$delete from public.site_visits where created_at < now() - interval '120 days';$$);
  RAISE NOTICE 'cron job registered: ghss-site-visits-retention';
END $mig$;



-- ═══════════════════════════ ROLLBACK (run only if needed) ═════════════
-- select cron.unschedule(jobid) from cron.job where jobname = 'ghss-site-visits-retention';
-- create index if not exists idx_site_visits_device_type ON public.site_visits USING btree (device_type);
-- create index if not exists idx_site_visits_page        ON public.site_visits USING btree (page);
-- create index if not exists idx_site_visits_session_id  ON public.site_visits USING btree (session_id);
-- ▲▲▲ END original file: 13_site_visits_slim_retention.sql ▲▲▲
