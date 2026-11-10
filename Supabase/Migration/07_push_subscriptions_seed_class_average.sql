-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 07 — Push subscriptions, seed data, class-average RPC
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 06_push_notifications.sql
--   • 07_seed_template.sql
--   • 08_class_average_rpc.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 06_push_notifications.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 06 — Push Notification Subscriptions (optional)
-- ═══════════════════════════════════════════════════════════════════════
-- Web Push storage. RLS is enabled with NO policies on purpose: only the
-- server (service-role key, used by /api/push) can read or write these
-- tables. Anonymous browser clients can NEVER read another visitor's push
-- endpoint.
--
-- Run AFTER files 00-05. Skippable if your deployment does not use web push
-- notifications.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  topics        text[] NOT NULL DEFAULT '{results,merit,rollslip,admission,notices,news,datesheet,calendar}',
  admission_ref text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now()
);



CREATE INDEX IF NOT EXISTS push_subscriptions_topics_idx        ON public.push_subscriptions USING gin (topics);


CREATE INDEX IF NOT EXISTS push_subscriptions_admission_ref_idx ON public.push_subscriptions (admission_ref) WHERE admission_ref IS NOT NULL;



CREATE TABLE IF NOT EXISTS public.push_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);



ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.push_state         ENABLE ROW LEVEL SECURITY;
-- ▲▲▲ END original file: 06_push_notifications.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 07_seed_template.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- SEED — Starter data for the GHSS Ghallanai deployment
-- ═══════════════════════════════════════════════════════════════════════
-- Run AFTER files 00-06 (the schema must exist first).
--
-- Seeds ONE row in `school_settings` so the website can boot and render its
-- first page immediately (the React app reads school_settings before any
-- admin has logged in). Every value below is valid SQL as-is — the file runs
-- without any editing. Fields the school has not supplied yet are left NULL;
-- the site handles NULLs gracefully and the admin fills them in later from
-- Admin Dashboard → School Settings (phone, email, principal, photos, exact
-- map pin, established year, student/teacher counts, etc.).
--
-- The map pin below is the centre of Ghallanai town (District Mohmand) —
-- replace it with the exact school location from Admin → School Settings.
--
-- Re-runnable: uses ON CONFLICT DO NOTHING, so this is safe to apply to a
-- database that already has school_settings populated.
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO public.school_settings (
    id, school_name, tagline, description, logo_url, banner_url,
    address, phone, email, established_year,
    total_students, total_teachers, pass_percentage,
    about_text, location_lat, location_lng,
    principal_name, principal_message, principal_photo_url, board_results
) VALUES (
    1,
    'GHSS Ghallanai',                                                    -- school_name
    'Excellence in Education',                                           -- tagline
    'Government Higher Secondary School Ghallanai, District Mohmand is committed to providing quality education to 1st Year and 2nd Year students and nurturing the future leaders of Pakistan.',  -- description
    NULL,                                                                -- logo_url    (admin uploads via dashboard)
    NULL,                                                                -- banner_url  (admin uploads via dashboard)
    'Ghallanai, District Mohmand, KPK, Pakistan',                        -- address
    NULL,                                                                -- phone       (admin sets via dashboard)
    NULL,                                                                -- email       (admin sets via dashboard)
    NULL,                                                                -- established_year (admin sets via dashboard)
    0,                                                                   -- total_students (admin will update)
    0,                                                                   -- total_teachers (admin will update)
    0,                                                                   -- pass_percentage (admin will update)
    'Government Higher Secondary School Ghallanai, District Mohmand, is committed to providing quality education and building strong character among its 1st Year and 2nd Year students. The school aims to promote learning, discipline, and a bright future for the youth of the area.',  -- about_text
    34.32417,                                                            -- location_lat (Ghallanai town centre — adjust in dashboard)
    71.39833,                                                            -- location_lng (Ghallanai town centre — adjust in dashboard)
    NULL,                                                                -- principal_name (admin sets via dashboard)
    NULL,                                                                -- principal_message (admin sets via dashboard)
    NULL,                                                                -- principal_photo_url (admin uploads)
    'A+'                                                                 -- board_results
)
ON CONFLICT (id) DO NOTHING;



-- ─── First admin user (created via Supabase Auth → then linked here) ───
-- The auth.users row is created when the school owner signs up via the
-- website. After they confirm their email, run the following from the
-- Supabase SQL editor to grant them admin privileges (replace the UUID and
-- the name/email with the real values — found in Auth → Users):
--
--   INSERT INTO public.profiles (id, full_name, role, status, email_verified)
--   VALUES (
--     '00000000-0000-0000-0000-000000000000',  -- ← replace with real user id
--     'School Owner Full Name',
--     'admin',
--     'approved',
--     true
--   )
--   ON CONFLICT (id) DO UPDATE
--     SET role = 'admin', status = 'approved', email_verified = true;
-- ▲▲▲ END original file: 07_seed_template.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 08_class_average_rpc.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- 08 · Class average for the public Results → Compare feature
--
-- Returns ONLY aggregates (student count, average %, pass rate and
-- per-subject averages) for one class + exam_type + year.
--
-- • It counts EVERY student's result in that class/exam — including the
--   "top 3 hidden" rows that are still is_published = false — so hiding
--   toppers in Admin → Manage Results never changes the average.
-- • No individual marks, names or highest/lowest scores are returned,
--   so hidden toppers stay hidden.
-- • Returns NULL until at least one result of that class/exam is
--   published, and when fewer than 3 students exist (too small to be an
--   anonymous aggregate).
-- Run once in the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_class_exam_average(
  p_class     text,
  p_exam_type text,
  p_year      integer
) RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb;
BEGIN
  -- Never expose an exam that has not been published at all.
  IF NOT EXISTS (
    SELECT 1 FROM public.results
     WHERE class = p_class AND exam_type = p_exam_type
       AND year = p_year AND is_published = true
  ) THEN
    RETURN NULL;
  END IF;

  WITH best AS (
    -- One row per student (highest percentage), same rule the rank code uses.
    SELECT DISTINCT ON (COALESCE(student_id::text, id::text))
           percentage, is_pass, subject_marks
      FROM public.results
     WHERE class = p_class AND exam_type = p_exam_type
       AND year = p_year AND percentage IS NOT NULL
     ORDER BY COALESCE(student_id::text, id::text), percentage DESC
  ),
  subj AS (
    SELECT lower(btrim(e.k)) AS key,
           min(e.k)          AS name,
           round(avg((e.v->>'obtained')::numeric), 2) AS ob,
           round(avg((e.v->>'total')::numeric), 2)    AS max
      FROM best b
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(b.subject_marks) = 'object'
             THEN b.subject_marks ELSE '{}'::jsonb END
      ) AS e(k, v)
     WHERE jsonb_typeof(e.v) = 'object'
       AND (e.v->>'obtained') ~ '^[0-9]+(\.[0-9]+)?$'
       AND (e.v->>'total')    ~ '^[0-9]+(\.[0-9]+)?$'
       AND NOT ((e.v->>'obtained')::numeric = 0 AND (e.v->>'total')::numeric = 0)
     GROUP BY lower(btrim(e.k))
  ),
  agg AS (
    SELECT count(*)                                   AS n,
           round(avg(percentage), 2)                  AS pct,
           round(100.0 * count(*) FILTER (WHERE is_pass IS TRUE) / NULLIF(count(*), 0), 1) AS pass_rate
      FROM best
  )
  SELECT CASE WHEN agg.n < 3 THEN NULL ELSE jsonb_build_object(
           'n', agg.n,
           'pct', agg.pct,
           'pass_rate', agg.pass_rate,
           'subjects', COALESCE(
             (SELECT jsonb_object_agg(s.key, jsonb_build_object('name', s.name, 'ob', s.ob, 'max', s.max)) FROM subj s),
             '{}'::jsonb)
         ) END
    INTO v_out
    FROM agg;

  RETURN v_out;
END;
$$;



REVOKE ALL ON FUNCTION public.get_class_exam_average(text, text, integer) FROM PUBLIC;


GRANT EXECUTE ON FUNCTION public.get_class_exam_average(text, text, integer) TO anon, authenticated;
-- ▲▲▲ END original file: 08_class_average_rpc.sql ▲▲▲
