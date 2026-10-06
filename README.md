# GHSS Ghallanai — Digital Campus

The complete website + PWA for **Government Higher Secondary School Ghallanai**, Mohmand District, Khyber Pakhtunkhwa, Pakistan — built exactly to the Digital Campus Master Plan (docs/GHSS_Ghallanai_Website_PWA_Master_Plan.pdf): Green & Gold design system, four programme microsites, online admissions, results transparency, student/teacher/admin portals, installable PWA, and a hardened Supabase schema with row-level security.

**Scope note:** the Alumni Network and Campus Life (gallery/societies/events) modules were removed at the school's request. Everything else follows the plan.

---

## Quick start (2 minutes, no accounts needed)

```bash
bun install        # or: npm install
bun run dev        # or: npm run dev
```

Open http://localhost:3000. The site runs in **DEMO MODE** — real pages, real interactions, SAMPLE data. Everything works out of the box: apply form, result lookup, notices, portals.

**Try it:** open `/login` → click *Admin dashboard* → publish a notice → check the home ticker. Open `/results/lookup` → roll number `GH-12-101` → year 2026 → Pre-Medical.

## Go LIVE with Supabase (the safe path)

1. **Create a free project** at [supabase.com](https://supabase.com) (free tier: 500MB DB, 50K monthly active users — far beyond a school's scale).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_schema.sql` — 20 tables, enums, triggers, audit machinery. **Idempotent** — safe to re-run.
   - `supabase/migrations/0002_rls.sql` — **row-level security on every table** + storage policies. **Idempotent** — uses `drop policy if exists` before every create, so safe to re-run.
   - `supabase/migrations/0003_admission_tracking.sql` — applicant accounts and status history. **Idempotent**.
   - `supabase/migrations/0004_admission_completion.sql` — registration contact fields and document types used by the first-/second-year upload flow. **Idempotent**.
   - `supabase/seed/seed.sql` — notices, news, faculty, FAQs, results, merit list. **Idempotent** — uses deterministic UUIDs and `on conflict do nothing`, so safe to re-run.

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
5. Sign in at `/login` — you now have the live admin dashboard.

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
| About | `/about`, `/about/principal`, `/about/faculty` | Timeline, vision/mission, Urdu message, printable directory |
| Academics | `/academics` + 4 microsites | ICS, Pre-Medical, Pre-Engineering, Arts — subjects, eligibility, careers |
| Admissions | `/admissions/*` | Journey, dates, eligibility, fees, 21-question FAQ, **6-step apply form** (1st & 2nd year) with draft autosave · mirrors HED KPK OCAS structure |
| Results | `/results/*` | **Roll-number lookup**, merit lists, toppers wall, 5-year trend |
| Notices | `/notices` | Lean notice board (replaces Campus Life fluff) |
| Urdu | `/ur/*` | 5 key pages in Nastaliq (RTL) |
| Student portal | `/portal/student` | Timetable, assignments, attendance, results, library |
| Teacher portal | `/portal/teacher` | One-tap attendance, assignment creation, gradebook + CSV |
| Admin | `/admin` | Notices, admissions queue, results pipeline, users & roles |
| PWA | manifest + `/sw.js` + `/offline` | Installable, offline shell, stale-while-revalidate, push-ready |

### Performance (built for Mohmand's networks)

- Public pages are **server-rendered static** — almost no client JavaScript (budget: <120KB gzipped, §11.1).
- Self-hosted variable fonts: **86KB total** for the entire English site (Nastaliq's 238KB loads only on `/ur` pages).
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
    (public)/          # marketing site — 20 routes + /ur + /offline
    portal/            # student & teacher workspaces (guarded)
    admin/             # SaaS control room (guarded)
    login/             # Supabase auth + demo entry
    api/               # 3 rate-limited public endpoints
    manifest.ts sitemap.ts robots.ts
  components/site/     # design-system components (header, hero, forms…)
  components/ui/       # shadcn/ui primitives (Green & Gold tokens)
  content/             # all editorial content + demo data
  fonts/               # self-hosted variable fonts
  lib/                 # data layer, supabase clients, theme, fonts
supabase/
  migrations/          # 0001_schema.sql · 0002_rls.sql
  seed/seed.sql
```

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Supabase (Postgres + Auth + Storage + RLS) · hand-rolled service worker · zero paid dependencies at launch scale.

---

Built for the Digital Campus Programme, October 2026. The full research, design-system and engineering specification lives in the Master Plan PDF.
