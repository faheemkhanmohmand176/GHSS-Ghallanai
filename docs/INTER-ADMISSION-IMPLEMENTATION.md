# Inter Admission System — Implementation Guide

A 1:1 mirror of the **HED KPK Online College Admission System** Inter flow
(admission.hed.gkp.pk — captured live twice on 01-Nov-2026; see
`docs/HED-INTER-ADMISSION-CAPTURE.md` for the full field-level capture),
scoped to **GHSS Ghallanai, District Mohmand — Intermediate (1st/2nd Year)
only, exactly four faculties: Pre-Medical · Pre-Engineering · ICS (Computer
Sciences) · Arts/Humanities. No BS / ADP / D.Com / DIT.**

## What was built

### Database — `Supabase/Migration/20_inter_admission_hed_mirror.sql`
Purely **additive Safe SQL** (no existing table touched; validated with the
real PostgreSQL parser — 72 statements, idempotent, safe to re-run):
- `inter_applicants` — accounts keyed by CNIC/Form-B (13 digits), immutable
  mobile, nationality, bcrypt password hash (`pgcrypto`)
- `inter_applicant_sessions` — 30-day session tokens (custom applicant auth;
  staff keep using Supabase Auth)
- `inter_personal_profiles` — every HED personal-profile field
- `inter_ssc_profiles` — matric details with auto percentage/grade
  (A+ ≥ 80%; Hafiz e Quran = +20 marks, verbatim HED formula)
- `inter_programs` — seeded with the school's four Inter faculties:
  Pre-Medical (100), Pre-Engineering (50), ICS (Computer Sciences) (50),
  Arts/Humanities (100); stray rows from older runs are retired by the seed
- `inter_subject_groups` — one group per faculty (two for Arts), captured
  verbatim from HED `get_subjectgroups_by_program_id.php` (7 subjects each,
  incl. English, Islamic Edu, Mutalia-e-Quran, Urdu)
- `inter_union_councils` — the 65 Mohmand UCs with HED ids (2808–2872)
- `inter_applications` — tracking id (`NOV2026…` = MON+YYYY+seq), JazzCash
  token (`YYMMDD`+9 digits), Rs 100 fee, deadline = admission-cycle last date
  (fallback: submission + 4 days 23:59), one live application per (program,
  quota) enforced by a partial unique index, subject group stored
- `inter_application_timeline` — the public "# | Title | Date | Detials" feed
- `inter_merit_lists` / `inter_merit_list_entries` — HED-style merit lists
  per program+quota (net marks = SSC obtained + 20 if Hafiz, ordered
  descending; title format "1st Provisional Merit list for session 2026 …")
- RPCs (all `SECURITY DEFINER`, `search_path = public, extensions`):
  `inter_register`, `inter_login`, `inter_logout`, `inter_session_state`,
  `inter_save_personal`, `inter_save_ssc`, `inter_programs_list`
  (optional `p_include_inactive` for admins), `inter_subject_groups_list`,
  `inter_ucs_list`, `inter_check_quota`, `inter_submit_application`
  (subject-group validation), `inter_proceed_payment`,
  `inter_application_detail`, `inter_track` (public),
  `inter_merit_lists_public` + `inter_merit_list_view` (public), and
  admin-guarded `inter_admin_list`, `inter_admin_set_payment`,
  `inter_admin_set_status`, `inter_admin_set_program`,
  `inter_admin_merit_generate`, `inter_admin_merit_lists`,
  `inter_admin_merit_publish`, `inter_admin_merit_delete`,
  `inter_admin_merit_entry_remark`
- RLS: deny-all policies on every table — data flows only through the RPCs

### HED business rules replicated (verbatim messages)
- Local-UC applicant picks Open Merit → **"Your domicile is local;
  therefore, apply on Local Quota."** and the quota resets (verified live)
- Local Quota criteria: `Having Domicile of the Local Area` (UC ∈ college
  jurisdiction AND domicile = Mohmand) / `Parent / Spouse Posting as Govt.
  Servant in District` (department + serving district + payslip notice)
- Duplicate: **"Error! You have already applied for this program in this
  college, please select a different program."** — shown inline above the
  form (HED alert-danger), form not submitted
- Subject Group required when the program defines groups; resets when the
  program changes (HED cascade)
- Sports quota: certificate + under-19 age; College Employees: parent
  department + payslip; Special Person: nature of disability
- Overage (Inter ≥ 19y): warning shown, sports blocked
- "Applications submitted on all quotas except AFGHAN shall be considered in
  Open Merit." · Shift: Morning · Board Record: Not Verified (manual marks)

### Frontend
| Route | Component | Mirrors |
|---|---|---|
| `/admission` | `src/pages/Admission.tsx` | public home + **Track Application** (tracking-id only, `application_status.php`) + **Admission Merit Lists** (published lists + full HED entry table in a dialog) + how-to-apply + programs & seats (4 faculties) + quotas + EN/UR instructions + helpline (school settings + HED helpdesk) |
| `/admission/register` | `src/pages/admission/AdmissionAuth.tsx` | `apply_step1.php` Create Account (nationality, CNIC/Form-B, mobile, password ≥ 8, math captcha, 4-step wizard) |
| `/admission/login` | same component | `student_login.php` (Login ID "Enter CNIC", math captcha) |
| `/admission/portal` | `AdmissionPortal.tsx` | `student_dashboard.php` All Applications table: `# / Tracking ID / Program / Quota / Hafiz e Quran / Fee Submission Deadline / Action (Pay Application Fee)` + menu + Alerts |
| `/admission/profile` | `PersonalProfileForm.tsx` | `student_personal_profile.php` (DOB via 3 selects, gender radios, domicile district/tehsil, UC as a district-dependent select of the 65 college UCs; mobile locked) |
| `/admission/ssc` | `SscProfileForm.tsx` | `student_academic_profile_entry.php` manual path (32 boards, study groups, live grade preview with Hafiz +20) |
| `/admission/apply` | `ApplyFlow.tsx` | 4-step journey: `student_submit_application.php` (program → quota → conditional criteria → **subject group** → declaration; inline duplicate error) → **Confirm Admission Request** (full review incl. subject group, Rs 100) → **Pay Application Processing Fee** (`student_pay_application_fee.php`: applicant + payment details, Proceed with Payment / Cancel) → JazzCash token + deadline + print |
| `/admission/application/:id` | `ApplicationView.tsx` | `student_view_application.php` — fee status, token, timeline (`?pay=1` opens the pay card), **Print Application** and **Print Fee Challan** (print-only JazzCash payment slip: token box, amount in words, deadline, signature strip) |
| Admin → Admissions → Applications | `src/pages/admin/tabs/AdminAdmissions.tsx` | list/search, mark fee paid/rejected with reference, update status (feeds public timeline), admissions open/close switch |
| Admin → Admissions → Merit Lists | `src/pages/admin/tabs/AdminMeritLists.tsx` | generate from fee-paid applications (program+quota+list#+dates+instructions), publish/unpublish to the public page, delete drafts, preview published lists, edit per-entry remarks |
| Admin → Admissions → Programs & Seats | `src/pages/admin/tabs/AdminAdmissionPrograms.tsx` | edit sanctioned seats + open/close each of the four faculties (list itself is fixed) |
| Home | `src/pages/Home.tsx` §15 | admission CTA at the reserved slot (between Thought of the Day and About Preview) |
| — | `src/lib/interAdmission.ts` | types, HED constants (4 faculties, subject groups, quotas, 146 districts, 32 boards, verbatim messages), RPC client, formatters, math captcha |
| — | `src/hooks/useInterAdmission.ts` | shared session hook (react-query + auto-logout on expiry) |

Old inaccurate system removed: `src/components/admissions/*` (7 files),
`src/lib/admissionDocs.ts`, the old form/OTP/interview/challan flow in
`Admission.tsx` and `AdminAdmissions.tsx`. `useAdmission.ts` now only keeps
the `admission_settings` toggle used by the NewsTicker. SEO content
(`scripts/seo-page-content.mjs`) and the crawler API (`api/render.js`) were
updated to describe the accurate flow.

## Deploy
1. Run `Supabase/Migration/20_inter_admission_hed_mirror.sql` in the
   Supabase SQL editor (idempotent — safe to re-run).
2. Deploy the frontend (Vercel) as usual.
3. In the admin panel → Admissions → Settings, set **Admissions Open** and
   the session year to display the homepage pill.
4. Merit lists: admin → Admissions → Merit Lists → Generate (fee-paid
   applications only) → review → Publish. Published lists appear at
   `/admission#merit-lists`.

## Notes
- The legacy `admissions*` tables remain in the database untouched (Safe
  SQL); the new system lives entirely in `inter_*`.
- Applicant passwords are bcrypt-hashed server-side; sessions expire after
  30 days and are revoked on logout.
- The public tracker exposes only: tracking id, college, program, payment
  status, application date and the timeline — no PII.
- Quality gates: `tsc -b` clean, ESLint 0 errors, vitest 13/13, production
  build + prerender 12/12 pages, migration parsed by pglast (72 statements).
