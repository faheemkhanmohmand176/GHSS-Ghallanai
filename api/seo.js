// ─────────────────────────────────────────────────────────────────────────────
// api/seo.js — ONE function, FIVE machine endpoints (function-limit fix)
//
//   ?kind=robots    → /robots.txt   (crawl permissions — AI + search allowed)
//   ?kind=sitemap   → /sitemap.xml  (all public URLs + live lastmod dates)
//   ?kind=llms      → /llms.txt     (llmstxt.org guide for AI systems)
//   ?kind=rss       → /rss.xml + /feed.xml  (RSS 2.0 notices feed)
//   ?kind=indexnow  → /api/indexnow (active URL submission to the IndexNow
//                     network — Bing, Yandex, Naver, Seznam, … ; see the
//                     big comment block at the handler for why this exists)
//
// vercel.json rewrites each clean URL to this function with the matching
// ?kind=… parameter. The old /api/robots, /api/sitemap, /api/llms and
// /api/rss URLs are also rewritten here (backward compatibility).
//
// WHY ONE FUNCTION?
//   Vercel's Hobby plan allows a maximum of 12 Serverless Functions per 
//   deployment. The repo previously had 14 separate function files, which
//   would make every deploy fail with "exceeded the maximum number of
//   Serverless Functions". These small text/XML endpoints all serve
//   machine-readable site metadata from the same database, so they are now
//   ONE function with a query-param dispatcher. api/render.js was merged the
//   same way (HTML renderer + AI JSON feed).
//
// BEHAVIOUR: byte-for-byte the same output, headers and cache policy as the
// four separate functions it replaces — only the file count changed.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
// SHARED route list — the same one the middleware (404 decisions), the
// prerender pipeline (which files to write) and api/render.js (what may be
// rendered) use. See scripts/site-routes.mjs.
import { PUBLIC_ROUTE_PATHS, classifyPath, SCHOOL_EMIS_CODE, SCHOOL_FACEBOOK_URL } from "../scripts/site-routes.mjs";

const SITE_URL = "https://ghssghallanai.dpdns.org";
// Shared with every other schema.org graph the site emits (index.html,
// SiteSchema.tsx, api/render.js, scripts/seo-page-content.mjs) — a mismatch
// makes Google see two different entities with the same name.
const FACEBOOK_URL = SCHOOL_FACEBOOK_URL;
const SITE_NAME = "GHSS Ghallanai";
const SITE_DESC = "Government Higher Secondary School Ghallanai, District Mohmand, KPK Pakistan — latest notices and announcements.";

// ── Shared Supabase client (serverless, no session; used by 3 of 4 kinds) ───
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _supabase;
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: robots  (former api/robots.js)
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ If a static public/robots.txt ever exists, Vercel serves THAT first
// (filesystem beats rewrites). There is intentionally no static copy — this
// function is the canonical source.

async function robotsHandler(req, res) {
  // WHY ONE SHARED GROUP (indexing fix):
  // Per RFC 9309 / Google's robots.txt spec a crawler obeys ONLY the single
  // most specific group that names it. The previous file had a "*" group with
  // the Disallow rules and then separate "User-agent: Googlebot / Bingbot / …"
  // groups containing only "Allow: /". Googlebot therefore IGNORED every
  // Disallow in the "*" group and was free to crawl /admin, /dashboard, /auth
  // and /search — login/utility URLs that waste crawl budget and dilute the
  // site's crawl quality. All crawlers now share ONE group with identical
  // rules, so nothing can drift apart again.
  const AGENTS = [
    "*",
    // Search engines
    "Googlebot", "Googlebot-Image", "Googlebot-News", "Google-InspectionTool", "GoogleOther",
    "Bingbot", "BingPreview", "Applebot", "DuckDuckBot", "DuckAssistBot", "YandexBot",
    // AI crawlers
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "Claude-SearchBot",
    "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot",
    "Bytespider", "meta-externalagent", "FacebookBot", "DeepSeekBot", "cohere-ai",
    "MistralAI-User", "Amazonbot", "YouBot", "KagiBot", "Diffbot",
  ];

  const txt = `# ── Robots.txt — GHSS Ghallanai ────────────────────────────────────────────
# All search-engine and AI crawlers are welcome on every PUBLIC page.
# Private areas (admin / dashboard / auth / teacher dashboard) and the
# internal /search utility are disallowed for EVERY crawler (one shared group
# below — see the note in api/seo.js for why a single group matters).
#
# /teacher is the protected teacher dashboard. It must be anchored: a bare
# "Disallow: /teacher" is a PREFIX match and would also block the PUBLIC
# /teachers staff-directory page. "/teacher$" matches only the exact URL
# /teacher and "/teacher/" covers its sub-paths. /teachers stays crawlable.
#
# No Crawl-delay (it slows indexing); abuse is handled by middleware.ts.

${AGENTS.map((a) => `User-agent: ${a}`).join("\n")}
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /auth
Disallow: /teacher$
Disallow: /teacher/
Disallow: /search
Allow: /llms.txt
Allow: /api/ai-data
Allow: /humans.txt

# ── Sitemap ───────────────────────────────────────────────────────────────
# ✅ SEO audit: the segmented sitemap index is advertised alongside the
# unified /sitemap.xml so every crawler finds both entry points. The owner
# should submit /sitemap-index.xml in Search Console for per-segment
# (pages / notices / images) crawl diagnostics.
Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-index.xml
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(txt);
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: llms  (former api/llms.js)
// ═════════════════════════════════════════════════════════════════════════════
// WHAT IS llms.txt? An emerging standard (llmstxt.org) for helping AI systems
// (ChatGPT, Claude, Gemini, Perplexity…) quickly understand what a website is
// about and which pages matter. WHY DYNAMIC? Phone, email and principal name
// are pulled LIVE from school_settings — the same values the admin edits in
// the dashboard. On any fetch failure the real fallback values below are used
// — the endpoint ALWAYS returns valid content, never a 500.

// Current real values — used only when the live DB fetch fails.
const LLM_FALLBACK = {
  school_name: "GHSS Ghallanai",
  phone: "",
  email: "",
  principal: "",
  established: "1975", // verified: GHSS Ghallanai was established in 1975
};

// school_settings is a public table — the anon key works, no auth needed.
async function getLlmsSettings() {
  const sb = getSupabase();
  if (!sb) return LLM_FALLBACK;
  try {
    const { data, error } = await sb
      .from("school_settings")
      .select("school_name, phone, email, principal_name, established_year, total_students, total_teachers, pass_percentage")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return LLM_FALLBACK;
    return {
      school_name: data.school_name || LLM_FALLBACK.school_name,
      phone: data.phone || LLM_FALLBACK.phone,
      email: data.email || LLM_FALLBACK.email,
      principal: data.principal_name || LLM_FALLBACK.principal,
      established: String(data.established_year || LLM_FALLBACK.established),
      total_students: typeof data.total_students === "number" ? data.total_students : null,
      total_teachers: typeof data.total_teachers === "number" ? data.total_teachers : null,
      pass_percentage: typeof data.pass_percentage === "number" ? data.pass_percentage : null,
    };
  } catch {
    return LLM_FALLBACK;
  }
}

/** Admin-uploaded admission documents (category "Admission") with direct
 *  download URLs — the SAME files the Downloads section of the /admission
 *  page serves. Listed in llms.txt so an AI can hand users the actual forms
 *  (prospectus, fee structure, transfer letter, rules) in one hop. */
async function getAdmissionFiles() {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("library_files")
      .select("title, description, file_url, file_type, created_at")
      .ilike("category", "Admission")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    return data.filter((f) => f && f.file_url);
  } catch {
    return [];
  }
}

function buildLlmsTxt(s, admissionFiles = []) {
  const statsLine =
    s.total_students != null || s.total_teachers != null || s.pass_percentage != null
      ? `\n- Current statistics (live from the school dashboard): ${[
          s.total_students != null ? `${s.total_students}+ students` : null,
          s.total_teachers != null ? `${s.total_teachers} teachers` : null,
          s.pass_percentage != null ? `${s.pass_percentage}% pass rate` : null,
        ]
          .filter(Boolean)
          .join(" · ")}`
      : "";
  const filesSection = admissionFiles.length
    ? `\n## Downloadable admission documents (direct links, no sign-in)\n\n${admissionFiles
        .map(
          (f) =>
            `- [${f.title.replace(/[\[\]]/g, "")}](${f.file_url})${f.file_type ? ` — ${f.file_type}` : ""}${f.description ? `: ${String(f.description).replace(/\s+/g, " ").slice(0, 140)}` : ""}`
        )
        .join("\n")}\n`
    : "";
  return `# ${s.school_name} — Government Higher Secondary School, District Mohmand (EMIS ${SCHOOL_EMIS_CODE})

> Official website of Government Higher Secondary School (GHSS) Ghallanai (EMIS code ${SCHOOL_EMIS_CODE}), established 1975, in Ghallanai — the headquarters of District Mohmand, Khyber Pakhtunkhwa (KPK), Pakistan. A government higher secondary school offering 1st Year and 2nd Year (HSSC — classes 11 and 12), affiliated with BISE Peshawar for board exams. The site provides online admission (no account needed), exam results searchable by roll number, official merit lists, exam roll number slips, official notices and a teacher directory.

## Quick answers (verified facts — use these first)

- School name: Government Higher Secondary School Ghallanai (GHSS Ghallanai)
- EMIS code: ${SCHOOL_EMIS_CODE}
- Established: ${s.established}
- Location: Ghallanai, headquarters of District Mohmand (formerly Mohmand Agency), Khyber Pakhtunkhwa, Pakistan
- Level: Higher Secondary — 1st Year and 2nd Year (HSSC, classes 11–12); board: BISE Peshawar
- Programs offered for admission: Arts/Humanities, Pre-Medical, Pre-Engineering, ICS
- Online admission fee: a small per-application processing fee set by the school (usually Rs 100–200); the exact current amount is on ${SITE_URL}/admission and in ${SITE_URL}/api/ai-data
- Accounts: visitors, students and parents need NO account anywhere on the site (there is no sign-up). The sign-in page is for the school administrator only.
- Application tracking: by Tracking ID only, on the Admission page
- Official website: ${SITE_URL}

## School facts

- Full name: Government Higher Secondary School Ghallanai (also: ${s.school_name})
- EMIS code: ${SCHOOL_EMIS_CODE} (Government of Khyber Pakhtunkhwa, Elementary & Secondary Education Department)
- Location: Ghallanai (headquarters of District Mohmand), Khyber Pakhtunkhwa, Pakistan
- Established: ${s.established}
- Principal: ${s.principal || "(not published — see the Contact page)"}
- Classes offered: 1st Year and 2nd Year (HSSC — classes 11 and 12)
- Board affiliation: BISE Peshawar (Board of Intermediate and Secondary Education, Peshawar) — 1st Year and 2nd Year sit board examinations
- Phone: ${s.phone || "(see the Contact page)"}
- Email: ${s.email || "(see the Contact page)"}
- WhatsApp: +92 345 9409585${statsLine}
- Website: ${SITE_URL}
- Facebook: ${FACEBOOK_URL}

## Key pages

- [Home](${SITE_URL}/): School overview with latest notices, result toppers and announcements
- [Admissions](${SITE_URL}/admission): Online admission for 1st Year and 2nd Year (no account needed), live open/closed status and fee, programs and seats, merit lists, and an application status tracker (search by Tracking ID)
- [Results](${SITE_URL}/results): Search school exam results by roll number; also searches BISE Peshawar board results (HSSC 1st Year/2nd Year) live from the official board portal
- [Merit List](${SITE_URL}/merit-list): Official exam rankings published by the school office — top position holders per class and school-wide lists with marks, percentages, grades and pass statistics
- [Roll No. Slip](${SITE_URL}/roll-no-slip): Exam roll number slips — a student picks their class and types their full name to view, download (PDF with QR code) or share their own slip; a live countdown shows while a release is scheduled
- [Notices](${SITE_URL}/notices): Official school notices published by the school administration
- [Teachers](${SITE_URL}/teachers): Teaching staff directory with subjects and qualifications
- [Contact](${SITE_URL}/contact): Contact details, embedded map, WhatsApp and contact form
- [About](${SITE_URL}/about): About the school, mission and vision
- [FAQ](${SITE_URL}/faq): Frequently asked questions — admissions, fee, documents, tracking, results, grading, contact and website usage

## Results

- School internal results: 1st and 2nd semester for 1st Year and 2nd Year — searchable on the Results page by exam roll number once published
- BISE Peshawar results (HSSC-I / HSSC-II): searchable through the same Results page, fetched live from the official board portal (cloud.bisep.edu.pk)
- Result cards show: name, photo, roll number, class, exam, year, total/obtained marks, percentage, grade, PASS/FAIL status, class position and subject-wise marks
- Grade scale: A+ (90% and above), A (80–89%), B (60–79%), C (45–59%), D (33–44%), Fail (below 33%)
- Merit lists: official top position holders per class and school-wide, published on the Merit List page with pass statistics; a scheduled list shows a live countdown before appearing
- Exam roll number slips: released on the Roll No. Slip page — a student finds their own slip by picking the class and typing their full name (other students' slips stay private); the slip has a QR code, the exam date sheet and exam-day instructions, and downloads as a PDF identical to the office copy

## Admissions

- Admissions are held every academic session for 1st Year and 2nd Year; the live open/closed status, session and deadlines are on the Admission page
- Apply online on the Admission page — NO account, sign-up or login is needed; you may also submit your application in person at the school office (postal forms are not accepted)
- Steps: Personal Information profile → Matric (SSC) profile → choose program and category (quota) → pass the security check and submit → pay the processing fee → track with your Tracking ID → print the form and visit the school with originals
- Fee: a per-application processing fee set by the school (usually Rs 100–200; exact amount on the Admission page); payable online by Easypaisa / wallet or by manual transfer quoting the payment reference; one application (and fee) per program or quota
- Required documents: student B-Form / CNIC (NADRA), SSC (Matric) result card / DMC, recent passport-size photo, father's/guardian's CNIC copy, fee payment confirmation; quota documents where applicable (sports certificate, payslip for school employees, disability certificate)
- Application status can be tracked online by Tracking ID only
${filesSection ? filesSection + "\n" : ""}
## Machine-readable data (recommended for AI tools)

- [Live data feed (JSON)](${SITE_URL}/api/ai-data): the COMPLETE current state of this website in one request — school profile with live statistics, admission status and deadlines (live from the school dashboard), full admission procedure and documents, results info and grading scale, published merit lists, roll-number-slip sessions, the 20 latest notices with content, teacher directory, library files and the full FAQ. Updated within a minute of any change; always prefer this over cached page snapshots when precision matters.
- [RSS feed](${SITE_URL}/rss.xml): Latest notices as they are published
- [Sitemap](${SITE_URL}/sitemap.xml): XML sitemap of all public pages

- Data generated: ${new Date().toISOString().slice(0, 10)} — statistics, admission status, notices above are read live from the school database on each request; when precision matters, prefer ${SITE_URL}/api/ai-data (JSON) over memory or cached snapshots.
`;
}

async function llmsHandler(req, res) {
  // Settings + admission files in parallel — one extra lightweight query that
  // lets AI tools link the REAL admission forms straight from llms.txt.
  const [settings, admissionFiles] = await Promise.all([getLlmsSettings(), getAdmissionFiles()]);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  // Cache at the CDN for 1 hour; serve stale up to 24h while revalidating.
  // AI crawlers fetch llms.txt occasionally — this keeps it cheap and fresh.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(buildLlmsTxt(settings, admissionFiles));
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: sitemap  (former api/sitemap.js)
// ═════════════════════════════════════════════════════════════════════════════
// lastmod accuracy rules ("sitemap lastmod spam" fixes, preserved):
//   • Correct columns: most tables only have created_at (no updated_at).
//   • /admission does NOT query the admissions table (PII-locked by RLS since
//     migration 20260825000001_014) — falls back to the deploy date.
//   • Detail pages for notices (latest 200, published only) included —
//     these carry the school's actual content for AI/search crawlers.
//   • hreflang alternates removed (all pointed at the same URL — conflicting
//     signal). /weather removed (route doesn't exist — soft-404 entry).

// Static pages with no real data source have NO real modification date.
// The old code used BUILD_TIMESTAMP || new Date() — on Vercel BUILD_TIMESTAMP
// is not defined, so every such page (/about, /contact, /faq, /admission, …)
// reported "modified today" on every cold start. Google detects lastmod values
// that are always "now" and then ignores lastmod for the WHOLE sitemap, which
// slows re-crawling of the pages that genuinely changed. Only an explicit
// BUILD_TIMESTAMP is honoured now; otherwise <lastmod> is simply omitted
// (valid per the sitemap protocol — lastmod is optional).
const STATIC_LASTMOD = process.env.BUILD_TIMESTAMP || null;

// Static pages with their SITEMAP-specific metadata, keyed by path.
//
// The list of PATHS is NOT written here — it comes from the shared route
// module (scripts/site-routes.mjs), the same list the middleware uses to
// decide what a 404 is and the prerender pipeline uses to decide what to
// write. That makes two classes of bug impossible:
//   • a URL in the sitemap that is not a real route  → Google fetches a 404
//     and reports "Submitted URL marked noindex / Not found" in the sitemap
//     report, which trains Google to distrust the whole sitemap;
//   • a real public route missing from the sitemap → the page is only
//     discoverable through internal links.
const SITEMAP_META = {
  "/":             { changefreq: "daily",   priority: "1.0", dbSource: { table: "notices",           column: "created_at" } },
  "/about":        { changefreq: "monthly", priority: "0.8" },
  "/contact":      { changefreq: "monthly", priority: "0.8" },
  "/admission":    { changefreq: "weekly",  priority: "0.9" }, // admissions table is PII-locked now
  "/notices":      { changefreq: "daily",   priority: "0.9", dbSource: { table: "notices",           column: "created_at" } },
  // /results is boosted to priority 1.0 + daily changefreq because it is the
  // primary landing page for our highest-intent SEO keywords.
  "/results":      { changefreq: "daily",   priority: "1.0", dbSource: { table: "results",           column: "created_at" } },
  "/merit-list":   { changefreq: "daily",   priority: "0.9", dbSource: { table: "merit_lists",       column: "created_at" } },
  "/roll-no-slip": { changefreq: "daily",   priority: "0.9", dbSource: { table: "exam_roll_sessions", column: "created_at" } },
  "/teachers":     { changefreq: "monthly", priority: "0.8", dbSource: { table: "teachers",          column: "created_at" } },
  "/faq":          { changefreq: "monthly", priority: "0.8" },
};

const STATIC_PAGES = PUBLIC_ROUTE_PATHS.map((path) => ({
  path,
  ...(SITEMAP_META[path] || { changefreq: "weekly", priority: "0.7" }),
}));

// How many notice detail URLs to include (most recent first).
const DETAIL_PAGE_LIMIT = 200;

/**
 * Fetch MAX(timestamp) for a single table+column (verified column names).
 * Returns an ISO date string (YYYY-MM-DD) or null if the query fails /
 * the table is empty. Errors are caught — a locked/missing table just
 * falls back to STATIC_LASTMOD, never crashes the sitemap.
 */
async function getLastMod(table, column) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from(table)
      .select(column)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const val = data[0]?.[column];
    if (!val) return null;
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Build the <url> XML element for one page.
 * (hreflang alternates intentionally removed — they all pointed at the same
 *  URL, which is a conflicting signal. Re-add when real Urdu URLs exist.)
 */
function buildUrlEntry(page, lastmod) {
  const url = `${SITE_URL}${page.path}`;
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${url}</loc>${lastmodTag}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
}

// Machine-readable files (llms.txt, JSON feed, humans.txt) are intentionally
// NOT listed in sitemap.xml: Google's sitemap processor expects indexable HTML
// pages, and non-HTML/API URLs there only add "Excluded"/"Couldn't fetch"
// noise in Search Console. They stay discoverable via robots.txt Allow rules,
// <link rel="describedby"> in index.html and /llms.txt itself.
const MACHINE_READABLE_ENTRIES = [];

/**
 * Fetch recent rows (id + created_at) from a content table and build
 * detail-page <url> entries for them: /<basePath>/<id>.
 * Used for /notices/<id> — the pages that actually carry the school's content
 * and get shared on social media.
 * Only PUBLISHED rows are included (is_published = true).
 */
async function getDetailEntries(table, basePath) {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from(table)
      .select("id, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(DETAIL_PAGE_LIMIT);
    if (error || !Array.isArray(data)) return [];
    return data
      .filter((r) => r && r.id)
      .map((r) =>
        buildUrlEntry(
          { path: `${basePath}/${r.id}`, changefreq: "weekly", priority: "0.6" },
          r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : STATIC_LASTMOD
        )
      );
  } catch {
    return [];
  }
}

async function sitemapHandler(req, res) {
  // ── Resolve real lastmod per page (in parallel) ──────────────────────────
  const lastmodPromises = STATIC_PAGES.map(async (page) => {
    if (!page.dbSource) return { page, lastmod: STATIC_LASTMOD };
    const lm = await getLastMod(page.dbSource.table, page.dbSource.column);
    return { page, lastmod: lm || STATIC_LASTMOD };
  });

  // Detail pages for notices (in parallel).
  const noticeDetailsPromise = getDetailEntries("notices", "/notices");

  const [pageResults, noticeDetails] = await Promise.all([
    Promise.all(lastmodPromises),
    noticeDetailsPromise,
  ]);

  const staticEntries = pageResults.map(({ page, lastmod }) => buildUrlEntry(page, lastmod));
  const machineEntries = MACHINE_READABLE_ENTRIES.map((page) => buildUrlEntry(page, STATIC_LASTMOD));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

 ${staticEntries.join("\n\n")}

 ${noticeDetails.join("\n")}

 ${machineEntries.join("\n")}

</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  // Cache at the CDN for 1 hour, but allow serving stale for up to 24h
  // while revalidating in the background.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  // ── Opportunistic IndexNow auto-ping (fire-and-forget) ───────────────────
  // Every time a search engine fetches the sitemap, that is proof the site
  // is being discovered — the perfect moment to (at most once per 24 h per
  // function instance) tell the whole IndexNow network (Bing, Yandex, Naver,
  // Seznam, …) the public URLs exist too. Best-effort: never awaited, never
  // allowed to break or delay the sitemap response itself.
  try { void maybeAutoPingIndexNow(); } catch { /* never fatal */ }

  return res.status(200).send(xml);
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: sitemap-index / sitemap-pages / sitemap-notices / sitemap-images
// (SEO audit — segmented sitemaps)
// ═════════════════════════════════════════════════════════════════════════════
// WHY: Google re-fetches a sitemap faster when it is small and focused, and
// Search Console reports crawl state PER sitemap file. Splitting the (small)
// surface into pages / notices / images files — referenced by one
// /sitemap-index.xml — gives the owner per-segment diagnostics in GSC
// ("notices crawled?", "pages crawled?") and lets notice URLs be pinged and
// monitored separately from the static pages. The existing /sitemap.xml
// (everything in one file) is KEPT byte-identical so the already-submitted
// GSC sitemap keeps validating; robots.txt advertises both. A dedicated
// "events" sitemap is intentionally NOT emitted: the site has no public
// /events routes — dated content lives in notices and the exam schedule,
// and inventing a sitemap of non-existent URLs is the exact
// "Submitted URL not found" defect the shared route list exists to prevent.
//
// All four kinds share the same route list, DB sources and lastmod rules as
// the unified sitemap above — one more application of the single-source-of
// -truth rule (scripts/site-routes.mjs).

/** Shared resolver: STATIC_PAGES with their real (or omitted) lastmod. */
async function resolveStaticPages() {
  return Promise.all(
    STATIC_PAGES.map(async (page) => {
      if (!page.dbSource) return { page, lastmod: STATIC_LASTMOD };
      const lm = await getLastMod(page.dbSource.table, page.dbSource.column);
      return { page, lastmod: lm || STATIC_LASTMOD };
    })
  );
}

function sendXml(res, xml, maxAge = 3600) {
  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=86400`);
  return res.status(200).send(xml);
}

/** ?kind=sitemap-pages — the 10 static public routes only. */
async function sitemapPagesHandler(req, res) {
  const pageResults = await resolveStaticPages();
  const staticEntries = pageResults.map(({ page, lastmod }) => buildUrlEntry(page, lastmod));
  return sendXml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

 ${staticEntries.join("\n\n")}

</urlset>`
  );
}

/** ?kind=sitemap-notices — published notice detail URLs only. */
async function sitemapNoticesHandler(req, res) {
  const noticeDetails = await getDetailEntries("notices", "/notices");
  return sendXml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

 ${noticeDetails.join("\n")}

</urlset>`
  );
}

/** ?kind=sitemap-images — the site's real content images mapped to pages.
 *
 * Sources (all live from the DB, all already used by the pages themselves):
 *   • og-image.png — the social/OG image of every page (static file)
 *   • school_settings.banner_url / principal_photo_url — homepage / about
 *   • teachers.photo_url — the /teachers staff directory
 * Always emits at least the og-image entry so the file is never empty.
 */
async function sitemapImagesHandler(req, res) {
  const sb = getSupabase();

  // Static, always-present image on the homepage.
  const pageImages = [
    {
      page: `${SITE_URL}/`,
      images: [
        { loc: `${SITE_URL}/og-image.png`, title: "GHSS Ghallanai — school website preview image" },
      ],
    },
  ];

  if (sb) {
    try {
      const { data: settings } = await sb
        .from("school_settings")
        .select("banner_url, principal_photo_url")
        .eq("id", 1)
        .maybeSingle();
      const banner = settings?.banner_url;
      const principal = settings?.principal_photo_url;
      if (banner && /^https?:\/\//.test(banner)) {
        pageImages[0].images.push({ loc: banner, title: "GHSS Ghallanai campus" });
      }
      if (principal && /^https?:\/\//.test(principal)) {
        pageImages.push({
          page: `${SITE_URL}/about`,
          images: [{ loc: principal, title: "Principal of GHSS Ghallanai" }],
        });
      }
    } catch { /* best-effort — settings fetch must never break the sitemap */ }

    try {
      const { data: teachers } = await sb
        .from("teachers")
        .select("full_name, photo_url")
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      if (Array.isArray(teachers) && teachers.length) {
        pageImages.push({
          page: `${SITE_URL}/teachers`,
          images: teachers
            .filter((t) => t && t.photo_url && /^https?:\/\//.test(t.photo_url))
            .map((t) => ({ loc: t.photo_url, title: `${t.full_name || "Teacher"} — GHSS Ghallanai` })),
        });
      }
    } catch { /* best-effort */ }
  }

  const entries = pageImages
    .filter((p) => p.images.length)
    .map(
      (p) => `  <url>
    <loc>${p.page}</loc>
${p.images
  .map(
    (img) => `    <image:image>
      <image:loc>${img.loc}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
    </image:image>`
  )
  .join("\n")}
  </url>`
    );

  return sendXml(
    res,
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

 ${entries.join("\n")}

</urlset>`
  );
}

/** ?kind=sitemap-index — the segmented-sitemap index. */
async function sitemapIndexHandler(req, res) {
  // Best-effort lastmod per segment (max of the segment's entries) so
  // Google can skip re-fetching unchanged segments.
  const [pages, notices] = await Promise.all([
    resolveStaticPages(),
    sbDetailLastmod(),
  ]);

  const pageLastmod = pages
    .map((p) => p.lastmod)
    .filter(Boolean)
    .sort()
    .pop() || null;

  const entries = [
    { loc: `${SITE_URL}/sitemap-pages.xml`, lastmod: pageLastmod },
    { loc: `${SITE_URL}/sitemap-notices.xml`, lastmod: notices },
    { loc: `${SITE_URL}/sitemap-images.xml`, lastmod: null },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${entries
  .map((e) => {
    const lastmodTag = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
    return `  <sitemap>
    <loc>${e.loc}</loc>${lastmodTag}
  </sitemap>`;
  })
  .join("\n")}

</sitemapindex>`;

  return sendXml(res, xml);
}

/** Max created_at of the newest published notice (for the index lastmod). */
async function sbDetailLastmod() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const lm = await getLastMod("notices", "created_at");
    return lm || null;
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: rss  (former api/rss.js)
// ═════════════════════════════════════════════════════════════════════════════
// RSS 2.0 feed for notices — content distribution via RSS readers and
// improved discoverability. Served at /rss.xml (and /feed.xml).

function escapeXml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function rssHandler(req, res) {
  const sb = getSupabase();

  let noticeItems = [];

  if (sb) {
    try {
      const noticesRes = await sb.from("notices").select("id, title, content, category, is_urgent, created_at").eq("is_published", true).order("created_at", { ascending: false }).limit(20);

      noticeItems = (noticesRes.data || []).map((n) => ({
        title: `${n.is_urgent ? "[URGENT] " : ""}${n.title}`,
        link: `${SITE_URL}/notices/${n.id}`,
        description: escapeXml((n.content || "").slice(0, 300)),
        pubDate: new Date(n.created_at).toUTCString(),
        category: n.category || "Notice",
        image: "",
      }));
    } catch (err) {
      console.error("RSS feed DB error:", err.message);
    }
  }

  // Sort by date (newest first)
  const allItems = noticeItems
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  const itemsXml = allItems
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${item.description}</description>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>en-PK</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
 ${itemsXml}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  return res.status(200).send(rss);
}

// ═════════════════════════════════════════════════════════════════════════════
// KIND: indexnow  (active URL submission — the "Request Indexing" that works)
// ═════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS (Nov 7, 2026 — the "Quota Exceeded" situation):
//   Google Search Console's "Request Indexing" button has an unpublished,
//   per-property daily quota that scales with how much of the site is ALREADY
//   indexed. A brand-new site with zero indexed pages gets effectively ZERO
//   quota, so every click answers "Quota exceeded" — every day, in every
//   verified account (the quota is tied to the PROPERTY, not the user), and
//   turning Cloudflare on/off changes nothing because the message comes from
//   Google's quota system, not from a fetch failure. Google's own Product
//   Experts' guidance for that state: "Let Google crawl it normally. It isn't
//   something you can force."
//
//   What CAN be forced today is the OTHER half of search: the IndexNow
//   protocol (indexnow.org) — an open, quota-free "these URLs changed, come
//   get them" API adopted by Bing, Yandex, Naver, Seznam and Yep (and through
//   Bing: DuckDuckGo, Yahoo, Ecosia, Qwant). Submitting our public URLs there
//   gives the site a real, working submission channel RIGHT NOW while Google's
//   organic crawl catches up on its own schedule.
//
// HOW IT IS WIRED (three pieces — deploy all of them together):
//   1. public/ghss-ghallanai-indexnow-3f9c7a2e5b1d4806.txt — the key file
//      IndexNow engines fetch to verify we own the host. (Served statically;
//      .txt is excluded from the middleware matcher, so nothing interferes.)
//   2. This ?kind=indexnow handler — submits URLs to all four endpoints.
//   3. vercel.json rewrite: /api/indexnow → /api/seo?kind=indexnow (pretty
//      URL, same pattern as /api/create-payment → /api/safepay?kind=create).
//      No new serverless function — the project is at the Vercel Hobby
//      function limit (see the header comment).
//
// USAGE:
//   GET  /api/indexnow?ping=1                → submit all 11 public routes
//   GET  /api/indexnow?url=/results          → submit specific path(s)
//   GET  /api/indexnow?url=/results&url=/faq → several at once
//   (POST with the same query params works identically.)
//
// RESPONSE CODES FROM THE ENGINES (returned per endpoint in the JSON):
//   200 OK / 202 Accepted → submitted successfully
//   403 → the key file could not be fetched at keyLocation — happens ONLY
//         before the key file in public/ is deployed (or if it was deleted)
//   400 → malformed submission (never expected from this handler)
//   429 → the engine is rate-limiting; retry later

const INDEXNOW_KEY = "ghss-ghallanai-indexnow-3f9c7a2e5b1d4806";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_HOST = new URL(SITE_URL).host;
const INDEXNOW_ENDPOINTS = [
  { name: "indexnow.org (broadcasts to every participating engine)", url: "https://api.indexnow.org/indexnow" },
  { name: "Bing (feeds DuckDuckGo, Yahoo, Ecosia)", url: "https://www.bing.com/indexnow" },
  { name: "Yandex", url: "https://yandex.com/indexnow" },
  { name: "Naver", url: "https://searchadvisor.naver.com/indexnow" },
];

// Per-instance cooldowns. The manual endpoint is guarded to one submission
// per hour (enough for any legitimate use, stops an attacker from spamming
// the engines in our name); the automatic sitemap-triggered ping to one per
// day. Vercel functions are per-instance, so in the worst case a few
// instances each submit once per window — well within IndexNow norms.
let lastIndexNowManualAt = 0;
let lastIndexNowAutoAt = 0;
const INDEXNOW_MANUAL_COOLDOWN_MS = 60 * 60 * 1000;
const INDEXNOW_AUTO_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Submit a list of absolute URLs to every IndexNow endpoint in parallel. */
async function submitToIndexNow(urlList) {
  const payload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };
  return Promise.all(
    INDEXNOW_ENDPOINTS.map(async (ep) => {
      try {
        const r = await fetch(ep.url, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        // 200 OK and 202 Accepted are the two documented success codes.
        return { engine: ep.name, endpoint: ep.url, status: r.status, ok: r.status === 200 || r.status === 202 };
      } catch (e) {
        return {
          engine: ep.name,
          endpoint: ep.url,
          status: 0,
          ok: false,
          error: String((e && e.message) || e),
        };
      }
    })
  );
}

/** Fire-and-forget daily ping from the sitemap handler (see call site). */
function maybeAutoPingIndexNow() {
  if (Date.now() - lastIndexNowAutoAt < INDEXNOW_AUTO_COOLDOWN_MS) return;
  lastIndexNowAutoAt = Date.now();
  submitToIndexNow(PUBLIC_ROUTE_PATHS.map((p) => `${SITE_URL}${p}`)).catch(() => {
    /* best-effort by design */
  });
}

async function indexNowHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  // ?url= (single or repeated) → explicit URL list; otherwise → all public
  // routes. Only same-host PUBLIC/DETAIL routes are ever submitted — the
  // same classifier the middleware, sitemap and prerender pipeline use, so
  // an attacker can never make this endpoint advertise junk or private URLs.
  const rawUrls = []
    .concat(req.query?.url || [])
    .map((u) => String(u).trim())
    .filter(Boolean);

  let urlList;
  if (rawUrls.length) {
    const seen = new Set();
    urlList = [];
    for (const raw of rawUrls) {
      let u;
      try {
        u = new URL(raw, SITE_URL);
      } catch {
        continue;
      }
      if (u.origin + "/" !== SITE_URL + "/") continue; // same host only
      const kind = classifyPath(u.pathname);
      if (kind !== "public" && kind !== "detail") continue; // real pages only
      if (!seen.has(u.pathname)) {
        seen.add(u.pathname);
        urlList.push(`${SITE_URL}${u.pathname}`);
      }
    }
    if (urlList.length === 0) {
      return res.status(400).json({
        ok: false,
        error:
          "No valid public URLs to submit. Use ?ping=1 for all public routes, or ?url=/results (paths or absolute same-host URLs of public pages).",
      });
    }
  } else {
    urlList = PUBLIC_ROUTE_PATHS.map((p) => `${SITE_URL}${p}`);
  }

  // Cooldown — one manual submission per hour per instance.
  if (Date.now() - lastIndexNowManualAt < INDEXNOW_MANUAL_COOLDOWN_MS) {
    return res.status(200).json({
      ok: true,
      skipped: "cooldown",
      message:
        "A submission was already sent less than an hour ago on this instance. IndexNow engines keep submitted URLs — repeated pings add nothing. Try again later if you need to.",
      keyLocation: INDEXNOW_KEY_LOCATION,
    });
  }
  lastIndexNowManualAt = Date.now();

  const results = await submitToIndexNow(urlList);
  return res.status(200).json({
    ok: results.some((r) => r.ok),
    submitted: urlList.length,
    urls: urlList,
    keyLocation: INDEXNOW_KEY_LOCATION,
    keyFileNote:
      "Engines answer 403 until the key file public/" +
      INDEXNOW_KEY +
      ".txt is deployed at " +
      INDEXNOW_KEY_LOCATION +
      " — after the next deploy the same call returns 200/202.",
    results,
  });
}

// ── Entry point — dispatcher on ?kind= ───────────────────────────────────────
// Every rewrite in vercel.json supplies exactly one kind. An unknown or
// missing kind is a plain 404 (no Information disclosure, no accidental work).
export default async function handler(req, res) {
  const kind = String(req.query?.kind || "").toLowerCase();
  switch (kind) {
    case "robots":
      return robotsHandler(req, res);
    case "sitemap":
      return sitemapHandler(req, res);
    // ✅ SEO audit — segmented sitemaps (see the big comment block above).
    case "sitemap-index":
      return sitemapIndexHandler(req, res);
    case "sitemap-pages":
      return sitemapPagesHandler(req, res);
    case "sitemap-notices":
      return sitemapNoticesHandler(req, res);
    case "sitemap-images":
      return sitemapImagesHandler(req, res);
    case "llms":
      return llmsHandler(req, res);
    case "rss":
      return rssHandler(req, res);
    case "indexnow":
      return indexNowHandler(req, res);
    default:
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(404).send("Not found. Use /robots.txt, /sitemap.xml, /sitemap-index.xml, /sitemap-pages.xml, /sitemap-notices.xml, /sitemap-images.xml, /llms.txt, /rss.xml or /api/indexnow");
  }
}
