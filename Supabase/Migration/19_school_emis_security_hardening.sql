-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 19 — School EMIS code + admission/results security hardening
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 32_school_emis_code.sql
--   • 33_security_hardening_inter_admission.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 32_school_emis_code.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════════
-- FILE 32 — School EMIS code + identity                                 (Nov 2026)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY:
--   GHSS Ghallanai's official Government of Khyber Pakhtunkhwa identifier
--   is EMIS code 60645 (Elementary & Secondary Education Department). It is
--   a UNIQUE, non-generic token for this specific institution, which makes
--   it one of the strongest relevance signals the site can emit: it lets a
--   search engine (and an AI reading the machine-readable feeds) attach this
--   website to the RIGHT school entity instead of to any generic "government
--   higher secondary school" in District Mohmand.
--
-- WHY A COLUMN AND NOT ONLY A HARDCODED CONSTANT:
--   The code is fixed, but it is school DATA in exactly the same way the
--   phone number, the address and the principal's name are — it belongs in
--   the single row the school office edits in the admin dashboard, so it can
--   never drift away from the rest of the school profile.
--
--   The build-time constant (scripts/site-routes.mjs → SCHOOL_EMIS_CODE)
--   stays the source of truth for the schema.org graph, because that graph
--   MUST be byte-identical across every layer (index.html, SiteSchema.tsx,
--   api/render.js, scripts/seo-page-content.mjs) even before this migration
--   has been applied to a given database. This column feeds the visible /
--   settings surfaces that read live data.
--
-- SAFE TO RE-RUN: yes (IF NOT EXISTS + idempotent UPDATE).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The column ──────────────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS emis_code text;

COMMENT ON COLUMN public.school_settings.emis_code IS
  'Official Government of Khyber Pakhtunkhwa EMIS code of the school (GHSS Ghallanai = 60645).';

-- ── 2. Seed the school's own row ──────────────────────────────────────────
-- Only row id = 1 is ever used by the site (single-school deployment), so
-- the code is written there and nowhere else. An existing non-empty value is
-- never overwritten — the school office stays in control.
UPDATE public.school_settings
   SET emis_code = '60645'
 WHERE id = 1
   AND (emis_code IS NULL OR btrim(emis_code) = '');

-- ── 3. Public read policy ─────────────────────────────────────────────────
-- The school profile row is already fully public (school_settings_public_read
-- / school_settings_read_all in migration 05) — it is rendered on every page.
-- The new column therefore needs no new policy of its own, but this guard
-- makes the file safe to run against a database where those older policies
-- were renamed or dropped: without a SELECT policy the column would simply
-- be invisible (never a leak, only a missing fact).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'school_settings'
       AND policyname IN ('school_settings_public_read', 'school_settings_read_all')
  ) THEN
    EXECUTE 'CREATE POLICY school_settings_public_read ON public.school_settings FOR SELECT USING (true)';
    RAISE NOTICE 'school_settings_public_read created (was missing)';
  ELSE
    RAISE NOTICE 'school_settings already has a public read policy — nothing to do';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK (run after):
--   select id, school_name, emis_code from public.school_settings;
--   → expect: 1 | GHSS Ghallanai | 60645
-- ═══════════════════════════════════════════════════════════════════════════
-- ▲▲▲ END original file: 32_school_emis_code.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 33_security_hardening_inter_admission.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════════
-- FILE 33 — Admission & results security hardening                   (Nov 2026)
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration closes three verified, live vulnerabilities:
--
--   §A/§B  THE PAYMENT BYPASS — `inter_safepay_apply` and
--          `inter_payment_context` were executable by the ANONYMOUS role.
--          Migration 23 deliberately revoked them and granted only
--          service_role, but migration 27's bulk "re-grant" loop then gave
--          EXECUTE to anon for EVERY `inter_*` function except a short
--          exclusion list that did not contain them. Because migration 27
--          ran AFTER 23, the deliberate revoke was silently undone.
--          The same loop also re-opened `inter_apply`, which is supposed to
--          be reachable ONLY through the Turnstile-gated auth-gateway —
--          a bot could submit applications without ever passing the
--          captcha.
--
--          ROOT CAUSE (the part that matters): an explicit
--          `REVOKE EXECUTE ON FUNCTION public.f(a,b)` only revokes THAT
--          EXACT signature. A function declared with a DEFAULT argument
--          exists in pg_proc TWICE (one row per call-arity), and only one
--          of the two rows is covered by such a statement. That is exactly
--          how `inter_track(text,text,text DEFAULT NULL)` kept a public
--          EXECUTE grant through a revoke that named its 3-argument form.
--          → This file therefore revokes and grants by ITERATING pg_proc,
--            so EVERY overload of every function is covered.
--
--   §C/§D  THE ADMISSION TRACKER — `inter_track_by_id` is the public
--          "track my application" lookup. It had NO rate limiting of any
--          kind: 130 consecutive anonymous calls were measured against the
--          live database with 0 rejections, because the browser talks to
--          the Supabase origin directly and never passes through the Vercel
--          middleware. The function also STATED its answer differently for
--          "no such reference" vs "found", making it a reliable oracle.
--          → Now rate-limited per client IP AND per reference, inside the
--            database, where it actually applies.
--
--   §F/§H  LEGACY TABLE RLS — migration 05 left blanket SELECT policies
--          (`USING (true)`) on `results`, `students`, `fee_vouchers`,
--          `admissions` and `admission_documents`, plus blanket
--          read/update policies on `profiles` for ANY logged-in user.
--          Those are all tightened here.
--
-- SAFE TO RE-RUN: yes (every statement is idempotent).
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §A — inter_* functions: DEFAULT DENY, then an explicit allow-list
-- ═══════════════════════════════════════════════════════════════════════════
-- Step 1 — deny everything to PUBLIC / anon / authenticated, for EVERY
--           overload of EVERY inter_* function.
--
--           PUBLIC is included on purpose: a fresh PostgreSQL function
--           gets EXECUTE from PUBLIC by default, so revoking only from
--           "anon" leaves the function callable by any role that PUBLIC
--           covers. Revoking from PUBLIC is what actually closes it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'inter\_%'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§A: revoked EXECUTE on every inter_* function (all overloads) from PUBLIC/anon/authenticated';
END $$;

-- Step 2 — the PUBLIC allow-list: the functions the browser genuinely needs
--           without an account.
--
--           • the applicant portal (session-token authenticated, NOT a
--             Supabase Auth account — see migration 26 "no account
--             admission"): session_state / logout / save_personal /
--             save_ssc / check_quota / draft_check_quota /
--             submit_application / edit_application / proceed_payment /
--             application_detail
--           • the public catalogue: programs_list / ucs_list /
--             merit_lists_public / merit_list_view / subject_groups_list /
--             admission_open
--           • the public tracker: track_by_id  (now rate-limited in §D)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
         -- applicant portal (session-token auth)
         'inter_session_state','inter_logout','inter_save_personal',
         'inter_save_ssc','inter_check_quota','inter_draft_check_quota',
         'inter_submit_application','inter_edit_application',
         'inter_proceed_payment','inter_application_detail',
         -- public catalogue
         'inter_programs_list','inter_ucs_list','inter_merit_lists_public',
         'inter_merit_list_view','inter_subject_groups_list',
         'inter_admission_open',
         -- public tracker
         'inter_track_by_id'
       ])
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§A: granted the public allow-list (all overloads)';
END $$;

-- Step 3 — the ADMIN surface: inter_admin_* + inter_is_admin are available
--           to a SIGNED-IN Supabase Auth user. The role check lives INSIDE
--           each function (inter_is_admin()), so granting EXECUTE to
--           `authenticated` is safe — an ordinary student account can call
--           them but every one of them refuses a non-admin.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname LIKE 'inter\_admin\_%' OR p.proname = 'inter_is_admin')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§A: granted the admin surface to authenticated + service_role';
END $$;

-- Step 4 — service_role keeps EVERYTHING. The Vercel functions call these
--           RPCs with the service-role key (auth-gateway → inter_apply,
--           api/safepay.js → inter_payment_context + inter_safepay_apply),
--           and service_role still has to hold EXECUTE on a function even
--           though it bypasses RLS.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§A: granted EXECUTE on every public function to service_role';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §B — the functions that must be SERVER-ONLY (explicit, documented)
-- ═══════════════════════════════════════════════════════════════════════════
-- Everything below is reachable ONLY with the service-role key, i.e. only
-- from the Vercel functions. The browser must never call them directly:
--
--   inter_apply             — creates an applicant. MUST go through the
--                              auth-gateway, which verifies the Cloudflare
--                              Turnstile token, applies the per-IP daily
--                              limit and runs the whole thing in one
--                              transaction. Calling it directly bypasses
--                              the captcha entirely.
--   inter_safepay_apply     — marks an application as PAID. Its only
--                              internal guard is "was this tracker issued by
--                              us for this application". The tracker is
--                              handed to the browser inside the Safepay
--                              checkout URL, so an anonymous caller could
--                              complete the payment state machine without
--                              paying a rupee — bypassing the webhook's
--                              HMAC-SHA512 signature check entirely.
--   inter_payment_context   — returns the amount/order for an application.
--                              Server-side only.
--   inter_register / inter_login — the old account system, retired in
--                              migration 26 and already revoked there.
--   inter_access_grant / inter_quota_eligibility / inter_purge_abandoned_accounts
--                           — internal helpers, server-side only.
--   inter_random_suffix     — the entropy source for a tracking id.
--
-- §A already revoked these from PUBLIC/anon/authenticated; this block is
-- the explicit, readable statement of intent, and it re-asserts the grant.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
         'inter_apply','inter_safepay_apply','inter_payment_context',
         'inter_register','inter_login','inter_access_grant',
         'inter_quota_eligibility','inter_purge_abandoned_accounts',
         'inter_random_suffix','inter_auth','inter_age','inter_grade_for',
         'inter_profile_lock_guard'
       ])
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.args);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§B: server-only functions confirmed (service_role only)';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §C — drop the legacy tracker (inter_track)
-- ═══════════════════════════════════════════════════════════════════════════
-- inter_track() was the original 2-factor tracker. It is superseded by
-- inter_track_by_id() and is referenced NOWHERE in the app code (verified by
-- grep over src/ and api/).
--
-- It is also broken: it was declared STABLE but performs an INSERT into
-- security_attempts, and PostgreSQL rejects that at runtime —
--   "INSERT is not allowed in a non-volatile function"
-- — so its internal rate limiter could never record an attempt and the
-- function could never succeed. It was anon-reachable through its
-- 2-argument overload (a DEFAULT argument creates a second pg_proc row
-- that the explicit REVOKE never covered).
--
-- All three arities are dropped here.
--
-- Wrapped in a DO block with an exception handler: if some object still
-- depends on one of them, the drop is skipped with a NOTICE instead of
-- aborting the whole migration (Postgres runs a migration file as one
-- transaction — one failed statement would roll back everything).
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.inter_track(text, text, text)',
    'public.inter_track(text, text)',
    'public.inter_track(text)'
  ] LOOP
    BEGIN
      EXECUTE format('DROP FUNCTION IF EXISTS %s', s);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '§C: could not drop % (%) — left in place (it is revoked from anon either way)', s, SQLERRM;
    END;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §D — inter_track_by_id: rate-limited public tracker
-- ═══════════════════════════════════════════════════════════════════════════
-- The tracker is a PUBLIC page ("check my application status"), so it must
-- stay callable by an anonymous visitor. What it must NOT be is an
-- unlimited, un-throttled oracle over the reference space.
--
-- Two independent limits, both enforced IN THE DATABASE (the browser talks
-- to the Supabase origin directly, so the Vercel middleware rate limiter
-- never sees these calls):
--
--   • per client IP  — counts FAILED lookups only. A real applicant who
--     mistypes their reference a couple of times is unaffected; a sweep
--     over the reference space is throttled to a crawl.
--   • per reference  — stops one reference from being probed repeatedly.
--
-- Only failures are recorded, so the table stays small: the IP bucket can
-- only grow by the number of failed attempts the limit allows.
--
-- The function is declared VOLATILE because it writes (the previous
-- STABLE declaration is what made the old tracker's own limiter fail).
CREATE OR REPLACE FUNCTION public.inter_track_by_id(p_tracking_id text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key      text;
  a          public.inter_applications;
  v_ip       text := '';
  v_ip_key   text;
  v_id_key   text;
  v_fail_ip  int := 0;
  v_fail_id  int := 0;
  v_max_ip   int;
  v_max_id   int;
BEGIN
  v_key := upper(regexp_replace(coalesce(p_tracking_id, ''), '[^A-Za-z0-9]', '', 'g'));
  IF v_key = '' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- ── client IP ──────────────────────────────────────────────────────────
  -- PostgREST exposes the request headers in the `request.headers` GUC.
  -- Reading it can fail (a direct SQL call has no such setting) — the
  -- EXCEPTION handler keeps that from breaking the lookup.
  BEGIN
    v_ip := coalesce(
      (coalesce(current_setting('request.headers', true), '{}')::jsonb ->> 'x-forwarded-for'),
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := '';
  END;
  v_ip := btrim(split_part(coalesce(v_ip, ''), ',', 1));
  IF v_ip = '' THEN v_ip := 'unknown'; END IF;

  -- Hash both keys: a raw IP or a raw reference must never be stored.
  v_ip_key := 'ip:' || substr(md5(v_ip), 1, 16);
  v_id_key := 'id:' || substr(md5(v_key), 1, 16);

  -- ── limits (admin-tunable in Admission Settings) ───────────────────────
  SELECT coalesce(rate_track_per_ip_hour, 60) INTO v_max_ip
    FROM public.admission_settings WHERE id = 1;
  SELECT coalesce(rate_track_per_id_hour, 5) INTO v_max_id
    FROM public.admission_settings WHERE id = 1;
  v_max_ip := greatest(coalesce(v_max_ip, 60), 10);   -- never below 10/hour
  v_max_id := greatest(coalesce(v_max_id, 5), 3);      -- never below 3/hour

  -- ── per-IP limit (failed lookups in the last hour) ─────────────────────
  SELECT count(*) INTO v_fail_ip
    FROM public.security_attempts
   WHERE bucket = 'track_ip' AND key = v_ip_key
     AND success = false
     AND created_at > now() - interval '1 hour';
  IF v_fail_ip >= v_max_ip THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Too many lookups from this network. Please wait a while and try again.');
  END IF;

  -- ── per-reference limit (failed lookups in the last hour) ──────────────
  SELECT count(*) INTO v_fail_id
    FROM public.security_attempts
   WHERE bucket = 'track_id' AND key = v_id_key
     AND success = false
     AND created_at > now() - interval '1 hour';
  IF v_fail_id >= v_max_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Too many attempts for this reference. Please check the number and try again.');
  END IF;

  -- ── the lookup ─────────────────────────────────────────────────────────
  SELECT x.* INTO a
    FROM public.inter_applications x
   WHERE upper(regexp_replace(x.tracking_id, '[^A-Za-z0-9]', '', 'g')) = v_key
   ORDER BY x.submitted_at DESC
   LIMIT 1;

  IF a.id IS NULL THEN
    -- Record the failure against both buckets.
    INSERT INTO public.security_attempts (bucket, key, success)
         VALUES ('track_ip', v_ip_key, false), ('track_id', v_id_key, false);
    RETURN jsonb_build_object('ok', false);
  END IF;

  -- Found: no attempt is recorded, so a legitimate applicant is never
  -- throttled by their own successful lookups.
  RETURN jsonb_build_object(
      'ok', true,
      'tracking_id', a.tracking_id,
      'college', 'Government Higher Secondary School Ghallanai',
      'program', a.program_name,
      'subject_group', a.subject_group,
      'quota', a.quota::text,
      'payment_status', initcap(a.payment_status::text),
      'payment_method', a.payment_method,
      'payment_reference', a.jazzcash_token,
      'payment_receipt', a.payment_reference,
      'status', a.status::text,
      'processing_fee', a.processing_fee,
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

REVOKE ALL ON FUNCTION public.inter_track_by_id(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.inter_track_by_id(text) TO anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- §E — tracking-id entropy floor
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Raise the random-suffix floor from 6 to 8 characters.
--    The tracking id format is MONYYYY-XXXXXX (6 chars from a 30-char
--    alphabet = 30^6 ≈ 729 million combinations). With the §D rate limit in
--    place that is already safe, but 8 characters (30^8 ≈ 656 billion) makes
--    brute force pointless even with a large botnet. The suffix length is
--    the ONLY thing that changes; the format stays human-readable.
CREATE OR REPLACE FUNCTION public.inter_random_suffix(p_len int DEFAULT 6)
RETURNS text
LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT string_agg(
        substr('ABCDEFGHJKMNPQRSTVWXYZ23456789',
               1 + mod(get_byte(gen_random_bytes(1), 0), 30), 1),
        ''
    )
    FROM generate_series(1, GREATEST(8, p_len));
$$;
-- The revoke is done by ITERATING pg_proc, not by naming one signature.
-- inter_random_suffix(p_len int DEFAULT 6) has a DEFAULT argument, so
-- pg_proc holds TWO rows for it — (int) and () — and an explicit
-- "REVOKE ... ON FUNCTION inter_random_suffix(int)" would leave the
-- zero-argument overload executable by anon. That is the same trap that
-- kept inter_track reachable in §C.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'inter_random_suffix'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§E: inter_random_suffix revoked from anon for every overload';
END $$;

-- 2) A CHECK constraint so a future migration can never quietly restore a
--    SEQUENTIAL reference. The pattern accepts the current 6-character form
--    (so nothing breaks) and the new 8-character form.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'inter_applications_tracking_id_format'
       AND conrelid = 'public.inter_applications'::regclass
  ) THEN
    -- NOT VALID: the constraint is enforced for every NEW row (so a future
    -- migration can never quietly restore a sequential reference) but it does
    -- not re-check the rows that already exist, so it can never abort the
    -- migration on historical data.
    ALTER TABLE public.inter_applications
      ADD CONSTRAINT inter_applications_tracking_id_format
      CHECK (tracking_id ~ '^[A-Z]{3}[0-9]{4}-[A-Z0-9]{6,8}$') NOT VALID;
    RAISE NOTICE '§E: tracking_id format constraint added (NOT VALID — new rows enforced)';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §F — results: the public may only read PUBLISHED results
-- ═══════════════════════════════════════════════════════════════════════════
-- The blanket `results_public_read ... USING (true)` policy exposed EVERY
-- result row — including the ones the school deliberately holds back
-- (is_published = false) before the scheduled publish, and including the
-- "hide the top 3" rows. The admin dashboard's whole publish workflow
-- depends on those rows being invisible until the moment they are released.
--
-- The public may read published results. The admin may read everything
-- (results_admin_all, role-gated).
DROP POLICY IF EXISTS results_public_read ON public.results;
DROP POLICY IF EXISTS "No anonymous access" ON public.results;

CREATE POLICY results_published_public ON public.results
  FOR SELECT USING (is_published = true);

-- The scheduled-publish schedule (class / exam / year / publish_at) is
-- PUBLIC INFORMATION — it is what the countdown on every page is built
-- from — but it must not drag the marks along with it. This function is
-- the only way an anonymous client may see an unpublished row, and it
-- returns those four columns and nothing else.
CREATE OR REPLACE FUNCTION public.result_schedule(p_scope text)
RETURNS TABLE(class text, exam_type text, year integer, publish_at timestamptz)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT r.class::text, r.exam_type::text, r.year::integer, r.publish_at
      FROM public.results r
     WHERE r.is_published = false
       AND r.publish_at IS NOT NULL
       AND CASE WHEN p_scope = 'due'
                THEN r.publish_at <= now()
                ELSE r.publish_at > now() END
     ORDER BY r.publish_at ASC
     LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.result_schedule(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.result_schedule(text) TO anon, authenticated, service_role;

-- The public read of a student now probes `results`, so index the join key.
CREATE INDEX IF NOT EXISTS idx_results_student_id ON public.results (student_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- §G — students: data minimisation + a scoped public read
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Remove the two columns that hold a minor's national ID and phone
--    number. Verified by grep over the whole app: NEITHER column is ever
--    read or written by the site — the admission forms keep the father's
--    CNIC in inter_personal_profiles, which is a separate table with its
--    own deny-all RLS. These two columns were dead weight carrying PII.
ALTER TABLE public.students DROP COLUMN IF EXISTS father_cnic;
ALTER TABLE public.students DROP COLUMN IF EXISTS contact_number;

-- 2) The blanket `students_public_read ... USING (true)` let anyone
--    download the entire school roll. It is now limited to students who
--    actually appear in a PUBLISHED result — exactly the set the public
--    results page needs to render, and no more.
DROP POLICY IF EXISTS students_public_read ON public.students;
CREATE POLICY students_public_read ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.results r
       WHERE r.student_id = students.id
         AND r.is_published = true
    )
  );

-- 3) "Any authenticated user may read the whole student table" is the same
--    hole one role up. The admin policy (role-gated) is what the dashboard
--    actually needs.
DROP POLICY IF EXISTS students_auth_read ON public.students;


-- ═══════════════════════════════════════════════════════════════════════════
-- §H — the other legacy tables
-- ═══════════════════════════════════════════════════════════════════════════
-- fee_vouchers — the browser never reads this table (verified: 0 usages in
-- src/); the admission flow uses inter_payment_events, which already has a
-- deny-all policy. The blanket anon/authenticated reads are removed; the
-- role-gated admin policy and the student-scoped ones stay.
DROP POLICY IF EXISTS fv_anon_tracker_read    ON public.fee_vouchers;
DROP POLICY IF EXISTS fv_anon_admission_read ON public.fee_vouchers;
DROP POLICY IF EXISTS fv_any_user_read       ON public.fee_vouchers;

-- admissions — the legacy table. The live admission flow writes to
-- inter_applications; only the admin dashboard still counts rows here.
-- "Anyone may insert" and "anyone may read every application" are removed.
DROP POLICY IF EXISTS admissions_public_insert     ON public.admissions;
DROP POLICY IF EXISTS admissions_public_select     ON public.admissions;
DROP POLICY IF EXISTS admissions_public_select_own ON public.admissions;
DROP POLICY IF EXISTS admissions_self_select       ON public.admissions;

-- admission_documents — never read by the browser; only the admin touches it.
DROP POLICY IF EXISTS admission_docs_public_insert ON public.admission_documents;
DROP POLICY IF EXISTS admission_docs_public_select ON public.admission_documents;

-- profiles — `admin_read_all_profiles` / `admin_update_all_profiles` were
-- granted to AUTHENTICATED (any signed-in user, including a student
-- account) with USING (true) / WITH CHECK (true). They also defeated the
-- role-gated `admin_all_profiles` policy, because permissive policies are
-- OR-ed together — a USING (true) policy cannot be narrowed by a stricter
-- one beside it. Those two blanket policies are removed; the role-gated
-- admin_all_profiles remains and still covers SELECT + UPDATE for admins.
DROP POLICY IF EXISTS admin_read_all_profiles   ON public.profiles;
DROP POLICY IF EXISTS admin_update_all_profiles ON public.profiles;

-- Re-assert the admin policies in case an earlier run removed them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'profiles'
       AND policyname = 'admin_all_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY admin_all_profiles ON public.profiles
             USING (((auth.jwt() ->> ''user_role'') = ''admin'')
                OR ((auth.jwt() -> ''user_metadata'') ->> ''role'') = ''admin'')
                OR ((auth.jwt() -> ''app_metadata'') ->> ''role'') = ''admin''))
             WITH CHECK (((auth.jwt() ->> ''user_role'') = ''admin'')
                OR ((auth.jwt() -> ''user_metadata'') ->> ''role'') = ''admin'')
                OR ((auth.jwt() -> ''app_metadata'') ->> ''role'') = ''admin''))';
    RAISE NOTICE '§H: admin_all_profiles recreated';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §I — the PUBLIC non-inter function surface (re-asserted, documented)
-- ═══════════════════════════════════════════════════════════════════════════
-- These are the public helpers the browser calls outside the inter_* family.
-- Re-asserted here so this migration is the single, readable statement of
-- the complete public function surface.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY (ARRAY[
         'submit_admission_public','track_admission',
         'book_interview_slot','cancel_interview_booking',
         'increment_download_count','increment_chapter_views',
         'cast_poll_vote','get_my_poll_vote',
         'notify_admin_contact','get_class_exam_average',
         'get_result_ranks','search_result_card'
       ])
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role',
      r.proname, r.args);
  END LOOP;
  RAISE NOTICE '§I: public non-inter function surface re-asserted';
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §J — VERIFICATION (run these after applying)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Anon must NOT be able to execute the payment/apply functions any more.
--    Expected: ZERO rows.
--    select p.proname
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname = any (array['inter_apply','inter_safepay_apply',
--                                  'inter_payment_context','inter_track',
--                                  'inter_register','inter_login'])
--       and has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- 2) Anon MUST be able to execute the public surface. Expected: one row per
--    overload of each name in the §A allow-list.
--    select p.proname, pg_get_function_identity_arguments(p.oid)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname = any (array['inter_track_by_id','inter_programs_list',
--                                  'inter_session_state','inter_submit_application'])
--       and has_function_privilege('anon', p.oid, 'EXECUTE')
--     order by 1;
--
-- 3) The blanket policies must be gone. Expected: ZERO rows for each.
--    select policyname from pg_policies where tablename = 'results'
--      and policyname = 'results_public_read';
--    select policyname from pg_policies where tablename = 'students'
--      and policyname in ('students_public_read','students_auth_read');
--    select policyname from pg_policies where tablename = 'fee_vouchers'
--      and policyname in ('fv_anon_tracker_read','fv_anon_admission_read','fv_any_user_read');
--    select policyname from pg_policies where tablename = 'admissions'
--      and policyname like 'admissions_public%';
--    select policyname from pg_policies where tablename = 'profiles'
--      and policyname in ('admin_read_all_profiles','admin_update_all_profiles');
--
-- 4) The PII columns must be gone. Expected: two "does not exist" errors.
--    select father_cnic, contact_number from public.students limit 1;
--
-- 5) The schedule RPC must work for an anonymous caller.
--    select * from public.result_schedule('upcoming');
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (only if a deployment must be reverted)
--   The §A default-deny can be undone with the reverse of §A step 2/3, but
--   re-opening inter_safepay_apply to anon re-opens the payment bypass —
--   do NOT roll back §B. The §F/§G/§H policy drops are safe to leave in
--   place; the admin dashboards read through the role-gated policies.
-- ═══════════════════════════════════════════════════════════════════════════
-- ▲▲▲ END original file: 33_security_hardening_inter_admission.sql ▲▲▲
