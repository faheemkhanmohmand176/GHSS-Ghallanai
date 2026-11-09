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
