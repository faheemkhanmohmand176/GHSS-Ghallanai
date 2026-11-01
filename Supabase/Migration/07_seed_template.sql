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
