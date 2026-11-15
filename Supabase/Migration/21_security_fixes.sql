-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 21 — Security fixes: closes the findings of the Nov 2026 security audit
-- ═══════════════════════════════════════════════════════════════════════════
-- Safe to run more than once (idempotent). Run the WHOLE file in:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Run this file LAST (after 01-20). Never re-run the older files 01 / 06 / 19
-- afterwards: they re-create the dangerous policies this file removes.
-- THIS file must stay the last word.
--
--   §1  Storage: no anonymous upload / delete (CRITICAL #1, #2)
--   §2  Helper functions is_admin() / is_teacher() (never trust user_metadata)
--   §3  profiles: JWT-metadata policies replaced; users can no longer promote
--       themselves to admin (CRITICAL #3 + extra finding)
--   §4  school_settings: only admins can write (CRITICAL #3 + extra finding)
--   §5  admission_settings: rate-limit / retention columns hidden from anon (#4)
--   §6  attendance public read removed (#8)
--   §7  contact_messages anonymous insert removed (#13)
--   §8  houses: only admins can change points (#16)
--   §9  search_path pinned on every SECURITY DEFINER function (#11)
--   §10 clean up the audit's test account
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- §2 (first, because policies below depend on it) — role helpers
-- ═══════════════════════════════════════════════════════════════════════════
-- Role comes ONLY from the profiles table (which users cannot edit — see §3),
-- never from auth.jwt() user_metadata (which every user can edit themselves).
-- SECURITY DEFINER lets a profiles policy call these without infinite
-- recursion.

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

-- (Execute permissions are deliberately left at their defaults: policies that
-- run for any role must be able to call these. They return false for anyone
-- who is not an admin / teacher, so this exposes nothing.)


-- ═══════════════════════════════════════════════════════════════════════════
-- §1 — STORAGE
-- ═══════════════════════════════════════════════════════════════════════════
-- Permissive policies are OR-ed: ONE "WITH CHECK (true)" policy defeats every
-- stricter policy next to it. Remove all of them, then add admin-gated ones.
-- Public READ policies are untouched (the buckets are meant to be public).

DROP POLICY IF EXISTS "allow all uploads"                ON storage.objects;
DROP POLICY IF EXISTS "gallery admin upload"             ON storage.objects;
DROP POLICY IF EXISTS "gallery admin delete"             ON storage.objects;
DROP POLICY IF EXISTS admissions_bucket_public_upload    ON storage.objects;
DROP POLICY IF EXISTS "Auth upload"                      ON storage.objects;
DROP POLICY IF EXISTS "Auth update"                      ON storage.objects;
DROP POLICY IF EXISTS "Auth delete"                      ON storage.objects;

-- Admin-only write access for the two public buckets the site uses.
DROP POLICY IF EXISTS gallery_admin_insert ON storage.objects;
CREATE POLICY gallery_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());

DROP POLICY IF EXISTS gallery_admin_update ON storage.objects;
CREATE POLICY gallery_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin())
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin());

DROP POLICY IF EXISTS gallery_admin_delete ON storage.objects;
CREATE POLICY gallery_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin());

DROP POLICY IF EXISTS school_assets_admin_insert ON storage.objects;
CREATE POLICY school_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-assets' AND public.is_admin());

DROP POLICY IF EXISTS school_assets_admin_update ON storage.objects;
CREATE POLICY school_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'school-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'school-assets' AND public.is_admin());

DROP POLICY IF EXISTS school_assets_admin_delete ON storage.objects;
CREATE POLICY school_assets_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'school-assets' AND public.is_admin());

-- The 'admissions' bucket keeps its existing admin-only management policy
-- (admissions_bucket_admin_manage, migration 02) and public read policy.
-- Anonymous upload to it is gone; the site does not upload through Supabase
-- Storage from the browser (verified in the source code).


-- ═══════════════════════════════════════════════════════════════════════════
-- §3 — PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS admin_all_profiles ON public.profiles;
CREATE POLICY admin_all_profiles ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS teacher_view_profiles ON public.profiles;
CREATE POLICY teacher_view_profiles ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_teacher());

-- Make sure the two blanket policies from migration 06 stay gone.
DROP POLICY IF EXISTS admin_read_all_profiles   ON public.profiles;
DROP POLICY IF EXISTS admin_update_all_profiles ON public.profiles;

-- EXTRA FINDING (not in the report): own_profile_update / own_profile_insert
-- let a signed-in user write ANY column of their own row — including
-- role = 'admin' and status = 'approved', which is exactly what is_admin()
-- trusts. This trigger makes those columns writable only by admins and by the
-- server (service role / SQL editor). Ordinary users can still edit their
-- name, phone, avatar, etc.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Server-side callers (service role, SQL editor, other triggers with no
  -- end-user JWT) are trusted.
  IF auth.role() IS DISTINCT FROM 'authenticated' AND auth.role() IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;

  -- Admins may change anything.
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role           := 'user';
    NEW.status         := 'pending';
    NEW.email_verified := false;
  ELSE
    NEW.role           := OLD.role;
    NEW.status         := OLD.status;
    NEW.email_verified := OLD.email_verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER aa_guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();


-- ═══════════════════════════════════════════════════════════════════════════
-- §4 — SCHOOL SETTINGS
-- ═══════════════════════════════════════════════════════════════════════════
-- EXTRA FINDING: school_settings_authenticated_write allowed ANY signed-in
-- user to rewrite the school's phone / email / WhatsApp. Public READ policies
-- are kept (the data is shown on every page).
DROP POLICY IF EXISTS school_settings_authenticated_write ON public.school_settings;
DROP POLICY IF EXISTS admin_update_school_settings        ON public.school_settings;
DROP POLICY IF EXISTS school_settings_admin_write         ON public.school_settings;

CREATE POLICY school_settings_admin_write ON public.school_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- §5 — ADMISSION SETTINGS: hide security configuration from anonymous users
-- ═══════════════════════════════════════════════════════════════════════════
-- anon keeps ONLY the public columns. `authenticated` (admin panel) and the
-- service role (gateway) are unchanged. The site code now selects these
-- columns explicitly instead of select("*").
REVOKE SELECT ON public.admission_settings FROM anon;
GRANT  SELECT (id, is_open, session_year, open_date, last_date, banner_message,
               notes, updated_at, processing_fee, payment_methods,
               online_payment_enabled)
  ON public.admission_settings TO anon;
-- NOTE: any column you add to admission_settings in future is private to
-- anon by default. Only GRANT it to anon if it is meant to be public.


-- ═══════════════════════════════════════════════════════════════════════════
-- §6 — ATTENDANCE: no public read
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Attendance readable by all" ON public.attendance;
-- "Attendance readable by authenticated" and the own-row policies remain.


-- ═══════════════════════════════════════════════════════════════════════════
-- §7 — CONTACT MESSAGES: no direct anonymous insert (the site uses the RPC)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS contact_messages_insert_anyone ON public.contact_messages;


-- ═══════════════════════════════════════════════════════════════════════════
-- §8 — HOUSES: only admins can change points
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated users can update house points" ON public.houses;
DROP POLICY IF EXISTS houses_admin_update ON public.houses;
CREATE POLICY houses_admin_update ON public.houses
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- §9 — Pin search_path on every SECURITY DEFINER function that lacks one
-- ═══════════════════════════════════════════════════════════════════════════
-- Skips functions that belong to extensions. Same technique as migration 11,
-- re-run to catch functions created after it.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.prosecdef
       AND NOT EXISTS (
             SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
              WHERE c LIKE 'search_path=%')
       AND NOT EXISTS (
             SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions',
                   r.proname, r.args);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '§9: search_path pinned on % function(s)', n;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §10 — Remove the audit's test account (it was unconfirmed and harmless)
-- ═══════════════════════════════════════════════════════════════════════════
DELETE FROM auth.users WHERE email = 'ghss.security.audit.7f3a@gmail.com';
-- The test FILE (school-assets/security-audit-test-anon-upload.txt) must be
-- deleted in Dashboard → Storage → school-assets (deleting the row from SQL
-- would leave the file itself behind).


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY (run these separately after applying; all should return 0 rows,
-- except the last, which should list only YOUR own admins)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) No policy on storage.objects that lets anon write:
--    SELECT policyname, cmd, roles FROM pg_policies
--     WHERE schemaname='storage' AND tablename='objects'
--       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
--       AND (roles = '{public}' OR 'anon' = ANY(roles));
--
-- 2) No policy anywhere still trusts user_metadata:
--    SELECT schemaname, tablename, policyname FROM pg_policies
--     WHERE coalesce(qual,'') ILIKE '%user_metadata%'
--        OR coalesce(with_check,'') ILIKE '%user_metadata%';
--
-- 3) Files anyone may have uploaded while the hole was open (review, delete junk):
--    SELECT bucket_id, name, created_at, owner FROM storage.objects
--     WHERE owner IS NULL ORDER BY created_at DESC;
--
-- 4) Accounts that signed up through the open signup (review, delete unknown):
--    SELECT id, email, created_at, raw_user_meta_data->>'role' AS claimed_role
--      FROM auth.users ORDER BY created_at DESC LIMIT 50;
--
-- 5) Your real admins only:
--    SELECT id, full_name, role, status FROM public.profiles WHERE role='admin';
