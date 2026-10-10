# GHSS Ghallanai — Digital Campus

The complete website + PWA for **Government Higher Secondary School Ghallanai**, Mohmand District, Khyber Pakhtunkhwa, Pakistan — built exactly to the Digital Campus Master Plan (docs/GHSS_Ghallanai_Website_PWA_Master_Plan.pdf): Green & Gold design system, four programme microsites, online admissions, results transparency, admin dashboard, installable PWA, and a hardened Supabase schema with row-level security.

**Scope note:** the Alumni Network and Campus Life (gallery/societies/events) modules were removed at the school's request. Everything else follows the plan.

**October 2026 update (round 4) — full Babi Khel feature port (admin console + homepage):**
- **Secure admin console with 14 sections** at `/admin` (sign-in at `/admin/login`, gated by Supabase Auth + `profiles.role = 'admin'` + RLS):
  *Overview · College Setting · Site Analytics · Admission · Manage Results · Fee Management · Merit List · Manage Teachers · TimeTable · Event Calendar · Announcements · Library · Gallery · Manage Users*.
- **Safe SQL**: migrations `0006_admin_console_tables.sql` + `0007_admin_console_rls.sql` add 15 new tables (school_settings, teachers, timetables + overrides, school_events, fee_structures/vouchers/payments, library_files, gallery_albums/photos, achievements, site_visits, notifications, poll_votes, admission_status_history) with one-policy-per-(table, command, role) RLS, `SECURITY DEFINER` RPCs with REVOKE/GRANT hygiene (`cast_poll_vote`, `record_fee_payment`, `update_admission_status`, `admin_delete_user`, `get_site_analytics`, `increment_download_count`, `mark_overdue_vouchers`), notification triggers, and audit logging.
- **Edge security proxy** (`proxy.ts`): attack-tool UA blocking (403), tiered rate limiting, admin cookie gate, security headers on every response.
- **Homepage — every GHS Babi Khel feature except Roll No. Slips**: typewriter hero, seamless news ticker, settings-driven statistics band, subjects marquee, campus banner, Word of the Day (`/api/word-of-day`, PKT-date-seeded dataset + live dictionary lookup), Latest Notices with Listen (text-to-speech) and **polls** (RPC-voted, one vote per device), Latest News, Meet Our Teachers, Achievements, Thought of the Day, About preview, and a settings-driven admission CTA.
- **Header "theme bar"**: ⌘K command palette with site-wide search + quick actions, notification bell (audience-scoped broadcasts), theme toggle, **Sign In** (gold pill) and an admin shield when signed in — plus a gold results countdown strip when a publish is scheduled, hide-on-scroll, and a gold hairline.
- **Floating AI assistant** (`/api/ai-chat`, SSE streaming, Z.AI GLM — set `ZAI_API_KEY` to enable), double-click definition popup, scroll-to-top, page tracker feeding Site Analytics.
- **New public pages**: `/gallery`, `/library` (category filters + download counters), `/calendar` (events + `.ics` download) — all linked from the header mega-menus and footer.

**October 2026 update (round 3) — English-only, portal-free, mobile-first:**
- **Urdu version removed completely** — the site is now English-only. All `/ur` pages, the Nastaliq font (−238KB), Urdu translations, and Urdu microcopy were deleted.
- **Student & Teacher portals removed** — `/portal/*` and the shared `/login` page are gone. The **admin dashboard remains at `/admin`** for the school office.
- **Mobile experience upgraded** — app-style bottom navigation bar on phones, animated slide-in menu, press-feedback on every button, ≥44px touch targets, full-width mobile CTAs, and safe-area (notch) support.

**October 2026 update:** The admission form (`/admissions/apply`) has been rewritten to **mirror the HED KPK Online College Admission System (OCAS)** at `admission.hed.gkp.pk`. The new six-step flow captures every field that the HED portal collects: admission type & shift, matric academic record (board verification style with study group, session, passing year, marks), HED-aligned personal details (DOB year/month/day cascade, blood group, mother's name & CNIC, full domicile cascade: province → district → tehsil → union council, photo upload, Hafiz-e-Quran flag), programme selection, document upload (per admission type), and a review step with declaration + information-lock acknowledgement (mirroring HED's "information cannot be changed after submit" warning). See `src/content/hed-data.ts` for the captured HED dropdown options and `supabase/migrations/0005_hed_aligned_fields.sql` for the new schema columns.

**October 2026 update (round 2):** Added the **BISE board verification "FETCH DATA" feature** — exactly mirrors the HED OCAS behaviour where the applicant enters their matric roll number and the system auto-fills their marks, name, father's name, DOB, school name, and domicile from the BISE board record. This is implemented as:
- New API route: `src/app/api/admissions/verify-board/route.ts` — proxies to HED's `fetch_board_exam_result.php` endpoint (captured live from admission.hed.gkp.pk on 2026-10-06) when `HED_PROXY_ENABLED=true`, otherwise returns realistic demo data.
- Updated `apply-form.tsx` Step 1 (matric academic record) — adds a "FETCH DATA" button next to the roll number field that calls the verify-board endpoint and auto-fills the form.
- See `docs/bise_api_findings.md` for the full reverse-engineering report (HED's PHP proxy endpoint spec, BISE Peshawar's public cloud.bisep.edu.pk endpoint, all 32+ board IDs captured, etc.).

---

## Quick start (2 minutes, no accounts needed)

```bash
bun install        # or: npm install
bun run dev        # or: npm run dev
```

Open http://localhost:3000. The site runs in **DEMO MODE** — real pages, real interactions, SAMPLE data. Everything works out of the box: apply form, result lookup, notices, admin dashboard.

**Try it:** open `/admin` → publish a notice → check the home ticker. Open `/results/lookup` → roll number `GH-12-101` → year 2026 → Pre-Medical.

## Go LIVE with Supabase (the safe path)

1. **Create a free project** at [supabase.com](https://supabase.com) (free tier: 500MB DB, 50K monthly active users — far beyond a school's scale).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_schema.sql` — 20 tables, enums, triggers, audit machinery. **Idempotent** — safe to re-run.
   - `supabase/migrations/0002_rls.sql` — **row-level security on every table** + storage policies. **Idempotent** — uses `drop policy if exists` before every create, so safe to re-run. (October 2026 rewrite: tightened `admissions_anon_insert` to validate programme/admission_type enums and 2nd-year meta; fixed over-permissive `audit_log` INSERT policy that let any authenticated user fabricate audit entries; tightened `admission_docs_anon_insert` to require valid path structure and doc_type enum; prefixed storage policy names with `ghss_` to avoid Supabase collisions; made `grant select on admission_status` idempotent via DO blocks.)
   - `supabase/migrations/0003_admission_tracking.sql` — applicant accounts and status history. **Idempotent**.
   - `supabase/migrations/0004_admission_completion.sql` — registration contact fields and document types used by the first-/second-year upload flow. **Idempotent**.
   - `supabase/migrations/0005_hed_aligned_fields.sql` — HED-aligned columns on `admissions` and `admission_accounts` tables (DOB, gender, blood group, mother info, father CNIC/mobile, domicile tehsil + union council, hafiz_quran, shift, board_verification_data, etc.) plus the `admission_tracking_view` for the public tracking page. **Idempotent** — uses `add column if not exists`.
   - `supabase/migrations/0006_admin_console_tables.sql` — **NEW (round 4)**: the admin-console tables — `school_settings`, `teachers`, `timetables`, `timetable_overrides`, `school_events`, `fee_structures`, `fee_vouchers`, `fee_payments`, `library_files`, `gallery_albums`, `gallery_photos`, `achievements`, `site_visits`, `notifications`, `poll_votes`, `admission_status_history` — plus poll/urgency columns on `notices` and `publish_at` on `board_results`. **Idempotent**.
   - `supabase/migrations/0007_admin_console_rls.sql` — **NEW (round 4)**: RLS for every new table (one policy per table/command/role — admin writes via `is_admin()`, public reads gated on `is_published`/`is_active`, money never public, `site_visits` append-only), `SECURITY DEFINER` RPCs with REVOKE/GRANT hygiene, notification triggers, `updated_at` + audit triggers. **Idempotent** — `drop policy if exists` before every create.
   - `supabase/seed/seed.sql` — notices, news, faculty, FAQs, results, merit list, school settings, teachers, events, fee structures, achievements, gallery, library. **Idempotent** — uses deterministic UUIDs and `on conflict do nothing`, so safe to re-run.

   > All migration and seed SQL files are safe to run repeatedly — no "already exists" errors.
3. Copy `.env.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   The site automatically switches from demo content to live database content.
4. Create the first admin: in Supabase → Authentication → Add user (email + password), then in SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where id = (
     select id from auth.users where email = 'your@email.com'
   );
   ```
5. Open `/admin` — in LIVE mode the admin layout verifies the session and its `profiles.role === 'admin'` row on every request and redirects anything less to `/admin/login`. The `proxy.ts` edge layer additionally bounces visitors without an auth cookie, and RLS re-checks `is_admin()` on every database write — three independent gates.

Optional environment variables (round 4): `ZAI_API_KEY` (floating AI assistant, GLM via `/api/ai-chat`), `ZAI_MODEL` (default `glm-4.5-flash`), `NEXT_PUBLIC_SITE_URL` (canonical URL for sitemap/SEO).

**The service-role key is optional** and only needed if you want the API routes to write with elevated rights; by default they use the anon key + RLS policies exactly as designed (§11.3 defence in depth).

## Deploy to Vercel (free)

```bash
npm run build        # verify locally first
```

1. Push this folder to a GitHub repository.
2. Vercel → Import Project → Framework auto-detected (Next.js 16).
3. Add the environment variables from `.env.local` (plus `NEXT_PUBLIC_SITE_URL=https://yourdomain`).
4. Deploy. Pakistani audiences are served from Vercel's edge CDN; free hobby tier is ample.

---

## What's inside

| Area | Routes | Notes |
|---|---|---|
| Home | `/` | Hero, notice ticker, odometer stats, programmes, voices, CTA (ISR 60s) |
| About | `/about`, `/about/principal`, `/about/faculty` | Timeline, vision/mission, principal's message, printable directory |
| Academics | `/academics` + 4 microsites | ICS, Pre-Medical, Pre-Engineering, Arts — subjects, eligibility, careers |
| Admissions | `/admissions/*` | Journey, dates, eligibility, fees, 21-question FAQ, **6-step apply form** (1st & 2nd year) with draft autosave · mirrors HED KPK OCAS structure |
| Results | `/results/*` | **Roll-number lookup**, merit lists, toppers wall, 5-year trend |
| Notices | `/notices` | Lean notice board (replaces Campus Life fluff) |
| Admin | `/admin` | Notices, admissions queue, results pipeline, users & roles |
| PWA | manifest + `/sw.js` + `/offline` | Installable, offline shell, stale-while-revalidate, push-ready |
| Mobile UX | bottom nav + slide-in menu | App-style thumb navigation on phones, 48px targets, safe-area support |

### Performance (built for Mohmand's networks)

- Public pages are **server-rendered static** — almost no client JavaScript (budget: <120KB gzipped, §11.1).
- Self-hosted variable fonts: **86KB total** (Inter + Playfair) for the entire site.
- No hero video, no third-party scripts, no analytics by default — poster-first hero in pure CSS/SVG.
- Service worker: app shell precached, pages stale-while-revalidate with 4s timeout, images cache-first 30 days.
- Every interactive element ≥44px touch target; dark theme saves OLED battery; `prefers-reduced-motion` honoured everywhere.

### Security (§11.3)

- **RLS on every table** — anonymous visitors read only *published* content; students only their own rows; teachers only their assigned classes; admins explicit and audit-logged.
- Zod validation + per-IP rate limiting on all three public endpoints (`/api/admissions/apply`, `/api/results/lookup`, `/api/feedback`).
- Security headers (CSP, frame-ancestors, nosniff, referrer policy) in `next.config.ts`.
- Immutable `audit_log` written by trigger on administrative mutations.
- Guardian media-consent flag honoured by design (`students.media_consent`).

## Replace the SAMPLE content

Everything marked **SAMPLE** (stats, faculty, timeline, toppers, demo results, WhatsApp number) is placeholder data. Change it in two places:

1. **Without Supabase:** edit `src/content/*.ts` (one file per domain — `site.ts` holds contacts and the WhatsApp number).
2. **With Supabase:** edit through the admin dashboard or the seed SQL — the site prefers database records automatically.

## Project structure

```
src/
  app/
    (public)/          # marketing site — 20 routes + /offline
    admin/             # office control room (notices, admissions, results, users)
    api/               # 3 rate-limited public endpoints
    manifest.ts sitemap.ts robots.ts
  components/site/     # design-system components (header, hero, forms, mobile-nav…)
  components/ui/       # shadcn/ui primitives (Green & Gold tokens)
  content/             # all editorial content + demo data
  fonts/               # self-hosted variable fonts (Inter + Playfair)
  lib/                 # data layer, supabase clients, theme, fonts
supabase/
  migrations/          # 0001_schema.sql · 0002_rls.sql
  seed/seed.sql
```

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres + Auth + Storage + RLS) · hand-rolled service worker · zero paid dependencies at launch scale.

---

Built for the Digital Campus Programme, October 2026. The full research, design-system and engineering specification lives in the Master Plan PDF.
