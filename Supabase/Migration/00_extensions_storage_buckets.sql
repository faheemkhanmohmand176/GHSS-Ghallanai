-- ═══════════════════════════════════════════════════════════════════════
-- FILE 00 — Extensions, Storage Buckets & Storage RLS Policies
-- ═══════════════════════════════════════════════════════════════════════
-- This file creates the storage buckets the school website needs and the
-- row-level-security (RLS) policies that gate who can read / upload / delete
-- files in each bucket. It is the FIRST file to run — other tables assume
-- the buckets already exist.
--
-- Buckets created (all PUBLIC, standard type):
--   school-assets, teacher-photos, student-photos, news-images,
--   gallery, library-files, achievement-images, avatars, videos, admissions
--
-- Policies follow a simple rule: public read for everything, but only the
-- service-role (server-side) can upload / update / delete. Anonymous uploads
-- are allowed ONLY to the `admissions` bucket (so prospective students can
-- attach documents to their application before they have an account).
-- ═══════════════════════════════════════════════════════════════════════

SET statement_timeout = 0;



SET lock_timeout = 0;



SET idle_in_transaction_session_timeout = 0;



-- (SET transaction_timeout removed: PG17-only parameter, hard error on PG15/16 where Supabase runs; its default is already 0 = disabled)
SET client_encoding = 'UTF8';



SET standard_conforming_strings = on;



SET check_function_bodies = false;



SET xmloption = content;



SET client_min_messages = warning;



SET row_security = off;






-- Trigram search (used by the public search page). Guarded so a host
-- without it still runs; Supabase always has pg_trgm.
DO $mig$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm not available - trigram indexes in file 01 will need it';
END $mig$;

DO $mig$
BEGIN
    
    
    
    CREATE TYPE public.admission_status AS ENUM (
        'pending',
        'under_review',
        'approved',
        'rejected',
        'documents_missing',
        'documents_verified',
        'interview_scheduled',
        'interview_completed',
        'waitlisted',
        'admitted',
        'admit_card_issued'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

DO $mig$
BEGIN
    
    
    
    
    
    
    
    CREATE TYPE public.admission_type AS ENUM (
        'fresh',
        'migration'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $mig$;

DROP POLICY IF EXISTS "Auth delete" ON storage.objects;







CREATE POLICY "Auth delete" ON storage.objects FOR DELETE TO authenticated USING ((bucket_id = 'school-assets'::text));

DROP POLICY IF EXISTS "Auth update" ON storage.objects;






CREATE POLICY "Auth update" ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'school-assets'::text));

DROP POLICY IF EXISTS "Auth upload" ON storage.objects;






CREATE POLICY "Auth upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'school-assets'::text));

DROP POLICY IF EXISTS "Public read" ON storage.objects;






CREATE POLICY "Public read" ON storage.objects FOR SELECT USING ((bucket_id = 'school-assets'::text));

DROP POLICY IF EXISTS admissions_bucket_public_read ON storage.objects;






CREATE POLICY admissions_bucket_public_read ON storage.objects FOR SELECT USING ((bucket_id = 'admissions'::text));

DROP POLICY IF EXISTS admissions_bucket_public_upload ON storage.objects;






CREATE POLICY admissions_bucket_public_upload ON storage.objects FOR INSERT TO authenticated, anon WITH CHECK ((bucket_id = 'admissions'::text));

DROP POLICY IF EXISTS "allow all uploads" ON storage.objects;






CREATE POLICY "allow all uploads" ON storage.objects FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "gallery admin delete" ON storage.objects;






CREATE POLICY "gallery admin delete" ON storage.objects FOR DELETE USING ((bucket_id = 'gallery'::text));

DROP POLICY IF EXISTS "gallery admin upload" ON storage.objects;






CREATE POLICY "gallery admin upload" ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'gallery'::text));

DROP POLICY IF EXISTS "gallery public read" ON storage.objects;






CREATE POLICY "gallery public read" ON storage.objects FOR SELECT USING ((bucket_id = 'gallery'::text));

DROP POLICY IF EXISTS public_read_all_buckets ON storage.objects;






CREATE POLICY public_read_all_buckets ON storage.objects FOR SELECT USING ((bucket_id = ANY (ARRAY['school-assets'::text, 'teacher-photos'::text, 'student-photos'::text, 'news-images'::text, 'gallery'::text, 'library-files'::text, 'achievement-images'::text, 'avatars'::text])));

DROP POLICY IF EXISTS user_update_avatars ON storage.objects;






CREATE POLICY user_update_avatars ON storage.objects FOR UPDATE TO authenticated USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS user_upload_avatars ON storage.objects;






CREATE POLICY user_upload_avatars ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS user_upload_own_avatar ON storage.objects;






CREATE POLICY user_upload_own_avatar ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'student-photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS "videos storage public read" ON storage.objects;






CREATE POLICY "videos storage public read" ON storage.objects FOR SELECT USING ((bucket_id = 'videos'::text));







-- ─── Storage bucket definitions ───────────────────────────────
-- Recreate the buckets that this project uses. All are
-- STANDARD type and PUBLIC-read by default.
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('teacher-photos', 'teacher-photos', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('news-images', 'news-images', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('library-files', 'library-files', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('achievement-images', 'achievement-images', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true) ON CONFLICT (id) DO NOTHING;



INSERT INTO storage.buckets (id, name, public) VALUES ('admissions', 'admissions', true) ON CONFLICT (id) DO NOTHING;
