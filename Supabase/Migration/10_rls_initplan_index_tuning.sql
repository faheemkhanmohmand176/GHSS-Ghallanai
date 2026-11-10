-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 10 — RLS auth.uid() initplan + index tuning
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 14_rls_auth_uid_initplan.sql
--   • 15_index_tuning.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 14_rls_auth_uid_initplan.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 14 — RLS performance: wrap auth.uid()/auth.role()/auth.jwt()      (Plan: Phase 6)
-- ═══════════════════════════════════════════════════════════════════════
-- WHY: the audit found 186 policies whose quals call auth.uid() directly.
--      PostgreSQL re-evaluates that STABLE function ONCE PER ROW during
--      policy checks (it cannot inline it into an InitPlan). Wrapping it as
--      (select auth.uid()) turns the call into a sub-select that the planner
--      hoists into a one-shot InitPlan → evaluated ONCE PER QUERY. On tables
--      like results / notices / fee_vouchers that is the difference between
--      a policy filter costing O(rows) and O(1).
--
-- HOW (safe, generic, idempotent):
--      A DO block walks pg_policy for the public schema, takes the EXACT
--      expression text of each qual / with_check, rewrites every un-wrapped
--      auth.uid() / auth.role() / auth.jwt() into the (select …) form, and
--      recreates only the policies that actually changed — with the same
--      name, same roles, same command, same permissive/restrictive flag.
--      Already-wrapped calls (any keyword casing produced by pg_get_expr)
--      are protected with a placeholder first and left as they are, so
--      re-running this file is a no-op.
--
--      Policies that reference no auth function are not touched at all.
--      DROP + CREATE for each policy happen inside this single DO block =
--      one transaction, so the swap is atomic and a failure aborts cleanly.
--
-- NOTES:
--   • RLS protection is NOT weakened: (select auth.uid()) returns exactly
--     what auth.uid() returns — this is purely an evaluation-frequency fix.
--   • Storage-schema policies are out of scope; the public schema is where
--     the per-request cost lives.
--
-- SAFE TO RE-RUN: yes (second run rewrites nothing).
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r            record;
  v_new_qual   text;
  v_new_check  text;
  v_roles      text;
  v_cmd        text;
  v_kind       text;
BEGIN
  FOR r IN
    SELECT n.nspname   AS schema_name,
           c.relname   AS table_name,
           p.polname   AS policy_name,
           p.polcmd,
           p.polpermissive,
           pg_get_expr(p.polqual, p.polrelid)      AS qual_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr,
           p.polroles
    FROM pg_policy p
    JOIN pg_class c      ON c.oid = p.polrelid
    JOIN pg_namespace n  ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, p.polname
  LOOP
    -- Skip policies with no auth-function call at all (e.g. USING (true)).
    IF (r.qual_expr  IS NULL OR r.qual_expr  !~ 'auth\.(uid|role|jwt)\(\)')
       AND (r.check_expr IS NULL OR r.check_expr !~ 'auth\.(uid|role|jwt)\(\)') THEN
      CONTINUE;
    END IF;

    -- Rewrite: 1) protect already-wrapped calls (any casing) with a
    -- placeholder, 2) wrap every remaining bare call, 3) restore.
    v_new_qual := r.qual_expr;
    IF v_new_qual IS NOT NULL THEN
      v_new_qual := regexp_replace(v_new_qual, '\(\s*select\s+auth\.uid\(\)\s*\)',  '@@UID@@', 'gi');
      v_new_qual := regexp_replace(v_new_qual, '\(\s*select\s+auth\.role\(\)\s*\)', '@@ROLE@@', 'gi');
      v_new_qual := regexp_replace(v_new_qual, '\(\s*select\s+auth\.jwt\(\)\s*\)',  '@@JWT@@', 'gi');
      v_new_qual := regexp_replace(v_new_qual, 'auth\.uid\(\)',  '(select auth.uid())', 'g');
      v_new_qual := regexp_replace(v_new_qual, 'auth\.role\(\)', '(select auth.role())', 'g');
      v_new_qual := regexp_replace(v_new_qual, 'auth\.jwt\(\)',  '(select auth.jwt())', 'g');
      v_new_qual := replace(replace(replace(v_new_qual, '@@UID@@', '(select auth.uid())'),
                                    '@@ROLE@@', '(select auth.role())'),
                                    '@@JWT@@', '(select auth.jwt())');
    END IF;

    v_new_check := r.check_expr;
    IF v_new_check IS NOT NULL THEN
      v_new_check := regexp_replace(v_new_check, '\(\s*select\s+auth\.uid\(\)\s*\)',  '@@UID@@', 'gi');
      v_new_check := regexp_replace(v_new_check, '\(\s*select\s+auth\.role\(\)\s*\)', '@@ROLE@@', 'gi');
      v_new_check := regexp_replace(v_new_check, '\(\s*select\s+auth\.jwt\(\)\s*\)',  '@@JWT@@', 'gi');
      v_new_check := regexp_replace(v_new_check, 'auth\.uid\(\)',  '(select auth.uid())', 'g');
      v_new_check := regexp_replace(v_new_check, 'auth\.role\(\)', '(select auth.role())', 'g');
      v_new_check := regexp_replace(v_new_check, 'auth\.jwt\(\)',  '(select auth.jwt())', 'g');
      v_new_check := replace(replace(replace(v_new_check, '@@UID@@', '(select auth.uid())'),
                                    '@@ROLE@@', '(select auth.role())'),
                                    '@@JWT@@', '(select auth.jwt())');
    END IF;

    IF (v_new_qual IS DISTINCT FROM r.qual_expr) OR (v_new_check IS DISTINCT FROM r.check_expr) THEN
      -- Roles exactly as before. pg_policy stores TO PUBLIC as the oid array
      -- {0}; a non-public list aggregates the actual role names.
      SELECT CASE
               WHEN cardinality(r.polroles) = 0 OR r.polroles = ARRAY[0::oid] THEN 'PUBLIC'
               ELSE coalesce(string_agg(format('%I', rol.rolname), ', '), 'PUBLIC')
             END
        INTO v_roles
        FROM pg_roles rol
       WHERE rol.oid = ANY (r.polroles);

      v_cmd  := CASE r.polcmd
                  WHEN 'r' THEN 'SELECT'   WHEN 'a' THEN 'INSERT'
                  WHEN 'w' THEN 'UPDATE'   WHEN 'd' THEN 'DELETE'
                  ELSE 'ALL'
                END;
      v_kind := CASE WHEN r.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

      EXECUTE format('DROP POLICY %I ON %I.%I', r.policy_name, r.schema_name, r.table_name);
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
        r.policy_name, r.schema_name, r.table_name, v_kind, v_cmd, v_roles,
        CASE WHEN v_new_qual  IS NULL THEN '' ELSE format(' USING (%s)',  v_new_qual)  END,
        CASE WHEN v_new_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', v_new_check) END
      );

      RAISE NOTICE 'rewrapped: %.% (%)', r.table_name, r.policy_name, v_cmd;
    END IF;
  END LOOP;
END $$;



-- ═══════════════════════════════════════════════════════════════════════
-- CHECK (run after):
--   1) Count policies still containing an un-wrapped auth call (expect 0):
--      select count(*) from pg_policies
--      where schemaname = 'public'
--        and ((qual       ~ 'auth\.(uid|role|jwt)\(\)'
--              and qual       !~ '\(\s*select\s+auth\.(uid|role|jwt)\(\)\s*\)')
--          or (with_check ~ 'auth\.(uid|role|jwt)\(\)'
--              and with_check !~ '\(\s*select\s+auth\.(uid|role|jwt)\(\)\s*\)'));
--
--   2) Policy count unchanged (no policy lost — compare with the pre-run number):
--      select count(*) from pg_policies where schemaname = 'public';
--
--   3) Representative plan check (should show "InitPlan" for the auth call):
--      explain (analyze, buffers)
--      select id from public.results where is_published = true and class = '1st Year';
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════ ROLLBACK (run only if needed) ═════════════════
-- This migration rewrites expressions in place; the clean rollback is to
-- re-run the ORIGINAL policy DDL from Supabase/Migration/05 (and 10), which
-- contains every CREATE POLICY statement verbatim. Recommended procedure:
--   1) Export current policies first (BEFORE running this file):
--        select schemaname, tablename, policyname, cmd, roles, qual, with_check
--        from pg_policies where schemaname = 'public';
--      and keep the export as rollback_file14.sql.
--   2) To roll back: for each exported policy, DROP POLICY ... ; CREATE
--      POLICY ... USING (<original qual>) WITH CHECK (<original with_check>).
-- A mechanical unwrap (replace '(select auth.uid())' -> 'auth.uid()') is NOT
-- recommended: it would also unwrap calls that were already wrapped before.;
-- ▲▲▲ END original file: 14_rls_auth_uid_initplan.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 15_index_tuning.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 15 — Index tuning (drop proven duplicates, add proven hot paths)  (Plan: Phase 7)
-- ═══════════════════════════════════════════════════════════════════════
-- RULE FOLLOWED (plan 7.1): nothing is dropped without STRUCTURAL proof
-- (an identical or leading-column-compatible index already exists), and
-- nothing is added without a CODE path that queries it. Every decision's
-- evidence is written next to it. Unused-but-unique indexes (merit_lists
-- scope/year/publish_at, fee_vouchers month_year/due_date, …) are NOT
-- dropped here: that needs a live pg_stat_user_indexes check first — the
-- verification query is at the bottom.
--
-- The database is 33 MB, so plain CREATE INDEX is instant; CONCURRENTLY is
-- unnecessary and would break inside a transaction.
--
-- SAFE TO RE-RUN: yes (IF EXISTS / IF NOT EXISTS everywhere).
-- No row data is touched by any statement in this file.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. DROPS — exact duplicates / structurally subsumed ───────────────────

-- merit_lists: THREE indexes on is_published existed:
--   idx_merit_lists_is_published, idx_merit_lists_published (identical!) and
--   idx_merit_lists_published_live (is_published, publish_at). A btree can
--   serve any is_published-only predicate from its leading column, so the
--   two single-column copies are dead weight on every merit_lists write
--   (AdminMeritList publishes/upserts regularly).
DROP INDEX IF EXISTS public.idx_merit_lists_is_published;


DROP INDEX IF EXISTS public.idx_merit_lists_published;



-- notices: idx_notices_published btree(is_published) is structurally
--   dominated by notices_pinned_recent_idx (is_pinned DESC, created_at DESC)
--   WHERE is_published = true — every query the boolean index could serve
--   (all of them filter is_published = true, see useNotices / push_signature
--   in migration 12) is served better by the partial index; lookups by id
--   use the primary key.
DROP INDEX IF EXISTS public.idx_notices_published;



-- exam_attendance: idx_exam_att_session_class and
--   exam_attendance_session_class_idx are IDENTICAL (session_id, class), and
--   both are subsumed by idx_exam_att_session_class_subject_date
--   (session_id, class, subject, exam_date) via leading columns. The Live
--   Console queries by session+class(+subject+date) — kept covered.
DROP INDEX IF EXISTS public.idx_exam_att_session_class;


DROP INDEX IF EXISTS public.exam_attendance_session_class_idx;



-- fee_vouchers: idx_fee_vouchers_student and idx_fee_vouchers_student_id
--   are IDENTICAL (student_id) — one copy is pure write overhead on the
--   busiest fee table (get_all_vouchers / record_fee_payment paths).
DROP INDEX IF EXISTS public.idx_fee_vouchers_student;



-- ── 2. ADDS — proven hot query paths + FK cascades ─────────────────────────

-- exam_roll_numbers: had NO index beyond the PK (verified in migration 03).
--   (a) PUBLIC ROLL SLIP ROSTER — the most-run public query on exam days:
--       "WHERE session_id = ? ORDER BY serial_number" (useRollSlipCountdown.
--       fetchPublicRolls, also hover-prefetched from the Navbar) was a full
--       scan + sort on every slip view.
--   (b) FK exam_roll_numbers_session_id_fkey is ON DELETE CASCADE — deleting
--       a session re-scans the whole table without it.
CREATE INDEX IF NOT EXISTS idx_exam_roll_numbers_session_serial
  ON public.exam_roll_numbers (session_id, serial_number);



-- gallery_photos: no index at all; album_id FK is ON DELETE CASCADE and the
--   public Gallery page lists photos per album.
CREATE INDEX IF NOT EXISTS idx_gallery_photos_album
  ON public.gallery_photos (album_id);



-- notification_dismissals: no index at all. (user_id, notification_id) is
--   the exact lookup dismiss_notification / dismiss_all_notifications run
--   (EXISTS … WHERE d.notification_id = n.id AND d.user_id = auth.uid()),
--   and both FKs are ON DELETE CASCADE.
CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user_notif
  ON public.notification_dismissals (user_id, notification_id);


CREATE INDEX IF NOT EXISTS idx_notification_dismissals_notif
  ON public.notification_dismissals (notification_id);



-- library_files: category/class are indexed but the listing ORDER BY
--   created_at DESC + LIMIT (useLibraryFiles, every Library page view and
--   every /api/public-data?kind=library cache refresh) had no supporting
--   index → top-N sort each time.
CREATE INDEX IF NOT EXISTS idx_library_files_created
  ON public.library_files (created_at DESC);



-- ── 3. EXPLICITLY KEPT (checked, do NOT drop) ──────────────────────────────
--   • student_records(admitted_class, status, GIN student_name/father_name):
--     all four are used by the admin Student Records screen
--     (src/hooks/useStudentRecords.ts filters .eq("status"), .eq
--     ("admitted_class") and trigram-or search on both names).
--   • students(roll_number): the Results class-mode search joins on it.
--   • results(class, exam_type, year): the class rank-pool query (and the
--     new cached /api/public-data?kind=result-rank) filters exactly on it.
--   • exam_attendance(student_id) & (student_id, subject, exam_date):
--     per-student attendance lookups on exam days.
--   • merit_lists(scope / scope_class / year / publish_at) and
--     fee_vouchers(month_year / due_date / status / year): unique indexes
--     with no duplicate — candidates ONLY after a live
--     pg_stat_user_indexes scan shows zero idx_scan over a long enough
--     window (see CHECK below). Do not drop blind.

-- ═══════════════════════════════════════════════════════════════════════
-- CHECK (run a few days after deploying, then decide on the "kept" list):
--   select relname, indexrelname, idx_scan, idx_tup_read,
--          pg_size_pretty(pg_relation_size(indexrelid)) as size
--   from pg_stat_user_indexes
--   where schemaname = 'public' and idx_scan = 0
--   order by pg_relation_size(indexrelid) desc;
--   (interpret together with: select stats_reset from pg_stat_database
--    where datname = current_database(); — stats must be old enough)
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════ ROLLBACK (run only if needed) ═════════════════
-- create index if not exists idx_merit_lists_is_published on public.merit_lists (is_published);
-- create index if not exists idx_merit_lists_published      on public.merit_lists (is_published);
-- create index if not exists idx_notices_published          on public.notices (is_published);
-- create index if not exists idx_exam_att_session_class     on public.exam_attendance (session_id, class);
-- create index if not exists exam_attendance_session_class_idx on public.exam_attendance (session_id, class);
-- create index if not exists idx_fee_vouchers_student       on public.fee_vouchers (student_id);
-- drop index if exists public.idx_exam_roll_numbers_session_serial;
-- drop index if exists public.idx_gallery_photos_album;
-- drop index if exists public.idx_notification_dismissals_user_notif;
-- drop index if exists public.idx_notification_dismissals_notif;
-- drop index if exists public.idx_library_files_created;
-- ▲▲▲ END original file: 15_index_tuning.sql ▲▲▲
