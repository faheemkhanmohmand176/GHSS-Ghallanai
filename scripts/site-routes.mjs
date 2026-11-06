// ─────────────────────────────────────────────────────────────────────────────
// scripts/site-routes.mjs — SINGLE SOURCE OF TRUTH for the public route surface
//
// WHY THIS FILE EXISTS
// ────────────────────
// Four separate places used to keep their own copy of "which URLs exist":
//
//   • middleware.ts            (which paths are real pages → 404 for the rest)
//   • scripts/prerender-lib.mjs (which paths get a prerendered HTML file)
//   • api/seo.js               (which paths go into sitemap.xml)
//   • api/render.js            (which paths the live renderer accepts)
//
// They had already drifted apart, and the drift is what caused the site's
// indexing failure: the middleware served the SPA shell (HTTP 200, homepage
// title) for EVERY unknown URL, so Google crawled dozens of junk URLs, saw the
// same homepage HTML for all of them, and classified the whole site as
// duplicate/soft-404 content. Meanwhile the prerender and the sitemap each
// maintained their own list, so a route could be prerendered but not listed in
// the sitemap (or vice-versa).
//
// One list, imported everywhere, removes the entire class of bug. If a new
// public page is added, it is added HERE — and the build-time cross-check in
// scripts/prerender-lib.mjs proves that the prerender output, the sitemap and
// the React router all agree before the build is allowed to finish.
//
// THIS MODULE MUST STAY DEPENDENCY-FREE.
// It is imported by:
//   • middleware.ts          — Vercel Edge Runtime (no Node APIs allowed)
//   • api/render.js          — Vercel Node Functions
//   • api/seo.js             — Vercel Node Functions
//   • scripts/prerender-lib.mjs — the build (Node)
// so it may only use plain ESM + strings. No fs, no path, no process.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_URL = "https://ghssghallanai.dpdns.org";
export const SITE_NAME = "GHSS Ghallanai";

// ── The public, indexable pages (the navbar destinations) ───────────────────
// `label` is the navbar text; `path` is the canonical URL. These are the only
// routes that appear in sitemap.xml, get a prerendered HTML file, and are
// accepted by the live renderer.
export const PUBLIC_ROUTES = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
  { label: "Admission", path: "/admission" },
  { label: "Notices", path: "/notices" },
  { label: "Results", path: "/results" },
  { label: "Merit List", path: "/merit-list" },
  { label: "Roll No. Slip", path: "/roll-no-slip" },
  { label: "Teachers", path: "/teachers" },
  { label: "Library", path: "/library" },
  { label: "FAQ", path: "/faq" },
];

export const PUBLIC_ROUTE_PATHS = PUBLIC_ROUTES.map((r) => r.path);
export const PUBLIC_ROUTE_SET = new Set(PUBLIC_ROUTE_PATHS);

/** Navbar pairs [label, href] — the shape the rest of the codebase expects. */
export const NAV_LINKS = PUBLIC_ROUTES.map((r) => [r.label, r.path]);

// ── Real application screens that are NOT indexable ────────────────────────
// They are valid pages (a 404 here would be a lie) but they carry noIndex
// directives in src/components/seo/RouteSEOInjector.tsx and are disallowed in
// robots.txt, so they never enter the sitemap.
export const APP_ROUTES = [
  "/search",
  "/admission/apply",
  "/admission/login",
  "/admission/portal",
  "/admission/profile",
  "/admission/register",
  "/admission/ssc",
];
export const APP_ROUTE_SET = new Set(APP_ROUTES);

// ── Private / authenticated areas ─────────────────────────────────────────
// Robots-disallowed, never in the sitemap, but a valid route (a 404 would be
// wrong and would confuse a signed-in user).
export const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/auth"];

// ── Path shapes ────────────────────────────────────────────────────────────
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const FILE_LIKE_RE = /\.[A-Za-z0-9]{1,8}$/;

/** Normalise a pathname: strip the trailing slash (except the root) and
 *  guarantee a leading slash. */
export function normalizePath(pathname) {
  let p = typeof pathname === "string" ? pathname : "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "") || "/";
  return p;
}

/**
 * Classify a pathname.
 *
 *   "public"  → an indexable page (sitemap + prerendered + live-rendered)
 *   "detail"  → a content page addressed by an id (/notices/<uuid>)
 *   "app"     → a real but noIndex application screen
 *   "private" → a real but robots-disallowed area
 *   "notfound"→ the URL does not exist and MUST answer with a real 404
 *
 * The "notfound" verdict is the important one: it is what stops the site from
 * answering every junk URL with HTTP 200 + the homepage shell.
 */
export function classifyPath(pathname) {
  const p = normalizePath(pathname);

  if (PUBLIC_ROUTE_SET.has(p)) return "public";
  if (APP_ROUTE_SET.has(p)) return "app";

  // /notices/<uuid> — a published notice. The id shape is validated here; the
  // renderer additionally checks that the notice actually EXISTS.
  const notice = p.match(/^\/notices\/([^/]+)$/);
  if (notice) return UUID_RE.test(notice[1]) ? "detail" : "notfound";

  // /admission/application/<reference> — the applicant tracking page.
  const app = p.match(/^\/admission\/application\/([^/]+)$/);
  if (app) return ID_RE.test(app[1]) ? "detail" : "notfound";

  // Private areas — /teacher is the protected dashboard; /teachers (the PUBLIC
  // staff directory) is a normal public route and was matched above.
  if (p === "/teacher" || p.startsWith("/teacher/")) return "private";
  for (const pre of PRIVATE_PREFIXES) {
    if (p === pre || p.startsWith(pre + "/")) return "private";
  }

  // A path that looks like a file (has an extension) is not a page. Every
  // real static file is excluded from the middleware matcher, so anything
  // that reaches here with an extension is genuinely missing → 404.
  const last = p.slice(p.lastIndexOf("/") + 1);
  if (FILE_LIKE_RE.test(last)) return "notfound";

  return "notfound";
}

/** True when the path addresses real, crawlable content. */
export function isIndexablePath(pathname) {
  const kind = classifyPath(pathname);
  return kind === "public" || kind === "detail";
}

/** True when the path is a route the site actually serves (never a 404). */
export function isKnownPath(pathname) {
  return classifyPath(pathname) !== "notfound";
}
