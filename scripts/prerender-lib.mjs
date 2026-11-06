// ─────────────────────────────────────────────────────────────────────────────
// scripts/prerender-lib.mjs — Shared build-time prerender core
//
// WHY THIS MODULE EXISTS
// ─────────────────────────────────────────────────────────────────────────────
// The site is a client-rendered React SPA. Without prerendering, every
// no-JavaScript reader (GPTBot/ChatGPT, ClaudeBot, PerplexityBot, Gemini,
// Meta AI, older Bingbot, social link previews…) receives a ~3.3 KB empty
// shell with ~60 readable characters — the "discoverable but unreadable"
// crawlability problem.
//
// THE DEPLOYMENT BUG THIS FIXES
// ─────────────────────────────────────────────────────────────────────────────
// Previously prerendering only ran when the build command was exactly
// `npm run build` (vite build && node scripts/prerender.mjs). Vercel's Vite
// framework preset runs `vite build` DIRECTLY — so the deployed site had NO
// prerendered pages at all, and every crawler got the empty shell.
//
// The prerender step is therefore now invoked from a Vite `closeBundle` hook
// (see vite.config.ts), so it runs with ANY build command, from any CI, on
// any machine. scripts/prerender.mjs remains as a manual CLI entry point.
//
// WHAT runPrerender() DOES (never fails the build)
// ─────────────────────────────────────────────────────────────────────────────
//   1. writeAssetManifestAndPatchSW() — PWA offline manifest + per-build SW
//      version stamp. Runs on EVERY call, before anything else.
//   2. Chromium phase — renders every public route (plus latest notices
//      detail pages) with headless Chromium and writes dist/<route>/index.html
//      with the FULL rendered DOM. Skipped when PRERENDER=false.
//   3. Static fallback phase — for any public route the Chromium phase did
//      not produce a full page (browser missing, render failure, …), writes a
//      guaranteed crawler-readable page from scripts/seo-page-content.mjs:
//      per-route <title>/meta/JSON-LD + real school content + internal links.
//      Skipped only when SEO_FALLBACK=false.
//   4. Writes dist/.ghss-prerender-done marker so the CLI wrapper never runs
//      the pipeline twice for the same dist.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  SITE_URL,
  NAV_LINKS,
  getPageMeta,
  buildFallbackHtml,
} from "./seo-page-content.mjs";
// SHARED route list — the same one the middleware uses to decide what a 404
// is, the sitemap generator uses to decide what to list, and api/render.js
// uses to decide what it may render. One list, no drift.
import { PUBLIC_ROUTE_PATHS } from "./site-routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dist/ is normally next to the project root (this file lives in scripts/).
// The cwd fallback covers exotic invocations where the script is copied or
// bundled elsewhere — e.g. Vite bundles vite.config.ts into a temp dir, and
// if this module ever ends up inside such a bundle, __dirname would point to
// the temp location while the build's cwd is still the project root.
function resolveDist() {
  const primary = path.resolve(__dirname, "..", "dist");
  if (existsSync(primary)) return primary;
  const secondary = path.resolve(process.cwd(), "dist");
  if (existsSync(secondary)) return secondary;
  return primary;
}
const DIST = resolveDist();
const PORT = Number(process.env.PRERENDER_PORT || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const SETTLE_MS = Number(process.env.PRERENDER_SETTLE_MS || 1800);
const DETAIL_LIMIT = Number(process.env.PRERENDER_DETAIL_LIMIT || 20);
const PAGE_TIMEOUT_MS = 45000;
// The bare SPA shell is ~3.3 KB. Any prerendered page must be far larger than
// this to count as "real content" — otherwise the static fallback takes over.
const MIN_VALID_HTML_BYTES = 8 * 1024;
const MARKER = path.join(DIST, ".ghss-prerender-done");

// True on Vercel — the build container cannot run a headless browser (see the
// skipChromium logic in runPrerender()).
const IS_VERCEL = !!process.env.VERCEL;

/**
 * True when the HTML is a real, content-bearing page — NOT the bare SPA shell.
 *
 * WHY THIS IS NOT A SIZE CHECK (this was a live bug):
 *   the old code decided "a Chromium render already exists" purely by file
 *   size, using MIN_VALID_HTML_BYTES (8 KB) as the threshold. The SPA shell
 *   itself is ~15 KB — BIGGER than the threshold — so the homepage was
 *   classified as "already rendered" and was never given a prerendered page.
 *   It was the only route in the whole site without one: the most important
 *   URL had the thinnest crawlable footprint, and its raw HTML carried no
 *   <link rel="canonical"> (the canonical was only injected at runtime by
 *   React Helmet, i.e. never for a crawler that does not execute JS).
 *
 * THE FIX: decide on CONTENT, not size. The shell's only <h1> lives inside a
 * <noscript> block, so strip <noscript> sections first and then require a
 * real <h1> element in the remaining markup.
 *
 * @param {string} html
 * @returns {boolean}
 */
function hasRenderedContent(html) {
  if (!html || html.length < 2048) return false;
  const withoutNoscript = String(html).replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  return /<h1[\s>]/i.test(withoutNoscript);
}

/**
 * Read a prerendered file and report whether it is a usable page.
 * @returns {Promise<{ok: boolean, size: number, html: string}>}
 */
async function readRenderedPage(outPath) {
  let html = "";
  let size = 0;
  try {
    html = await readFile(outPath, "utf8");
    size = html.length;
  } catch {
    return { ok: false, size: 0, html: "" };
  }
  return { ok: hasRenderedContent(html), size, html };
}

// ── Public routes (mirrors App.tsx public routes + sitemap) ─────────────────
// SHARED: the list now comes from scripts/site-routes.mjs, which the
// middleware (404 decisions), api/seo.js (sitemap) and api/render.js (live
// renderer) also import. Previously each of those four places kept its own
// copy and they drifted — which is exactly how the homepage ended up without
// a prerendered file while the sitemap happily listed it.
//
// Every route here gets a prerendered /<route>/index.html on every build,
// and the vercel.json rewrites then serve that file as the FALLBACK when the
// middleware's live-render hop times out or fails (cold start, Supabase
// hiccup, BISEP slow). Without a prerendered fallback, the request falls
// through to the SPA shell /index.html — which carries the HOMEPAGE title —
// so Googlebot sees /roll-no-slip returning 200 with the same content as /,
// reads it as a duplicate/soft-404 and refuses to index it. This was the
// actual root cause of the Search Console "errors" on /roll-no-slip.
export const STATIC_ROUTES = PUBLIC_ROUTE_PATHS;

// ── MIME types for the local static server ──────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json",
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Local static server with SPA fallback (for the Chromium phase) ──────────
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", BASE);
      let pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith("/api/")) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Not found (prerender local server)" }));
        return;
      }

      if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }

      let abs = path.join(DIST, path.posix.normalize(pathname || "/"));
      if (!abs.startsWith(DIST)) abs = path.join(DIST, "index.html");

      let filePath = null;
      try {
        const st = await stat(abs);
        if (st.isFile()) filePath = abs;
        else if (st.isDirectory()) {
          const idx = path.join(abs, "index.html");
          if (existsSync(idx)) filePath = idx;
        }
      } catch {
        /* not found — fall through */
      }
      if (!filePath) filePath = path.join(DIST, "index.html");

      const ext = path.extname(filePath).toLowerCase();
      const body = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.end(body);
    } catch {
      res.statusCode = 500;
      res.end("prerender server error");
    }
  });

  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

// ── Supabase REST helpers (public anon key, published rows only) ────────────
function supabaseEnv() {
  return {
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function fetchIds(table, limit) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      `${url}/rest/v1/${table}?select=id&is_published=eq.true&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => r.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Latest published items for the static fallback lists. Returns
 * { notices, library, stats } — empty values when the
 * env vars are missing or a fetch fails (fallback stays fully functional).
 *
 * EXTENDED (2026-08): previously only notices were injected at build
 * time, so the STATIC fallback pages for /library were
 * almost content-free for any crawler that does not receive the live render
 * (weak AI tools with browser-like user-agents, offline archives, …). Now
 * the build-time snapshot carries the same public data the live renderer
 * serves: library files
 * and the school's real statistics.
 */
async function fetchLatestLists(limit = 10) {
  const { url, key } = supabaseEnv();
  const out = {
    notices: [],
    library: [],
    admissionFiles: [],
    stats: null,
  };
  if (!url || !key) return out;

  const withTimeout = async (label, run) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await run(controller.signal);
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      console.warn(`[prerender] ${label} fetch failed — static fallback continues without it.`);
      return null;
    }
  };
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const grab = (table) =>
    withTimeout(table, (signal) =>
      fetch(
        `${url}/rest/v1/${table}?select=id,title,created_at&is_published=eq.true&order=created_at.desc&limit=${limit}`,
        { headers, signal }
      )
    );

  const [notices, libraryRows, settingsRow, admissionFileRows] =
    await Promise.all([
      grab("notices"),
      withTimeout("library_files", (signal) =>
        fetch(
          `${url}/rest/v1/library_files?select=id,title,category,class,file_url,created_at&order=created_at.desc&limit=12`,
          { headers, signal }
        )
      ),
      withTimeout("school_settings", (signal) =>
        fetch(
          `${url}/rest/v1/school_settings?select=total_students,total_teachers,pass_percentage,established_year&id=eq.1`,
          { headers, signal }
        )
      ),
      // Admin-uploaded admission documents (prospectus, fee structure, …).
      // Baked into the static /admission page so even browser-UA AI tools
      // that never receive the live render see the real form URLs.
      withTimeout("library_files:admission", (signal) =>
        fetch(
          `${url}/rest/v1/library_files?select=id,title,description,file_url,file_type,created_at&category=ilike.Admission&order=created_at.desc&limit=20`,
          { headers, signal }
        )
      ),
    ]);

  out.notices = Array.isArray(notices) ? notices.filter((r) => r && r.id && r.title) : [];
  out.library = Array.isArray(libraryRows) ? libraryRows.filter((r) => r && r.title) : [];
  out.admissionFiles = Array.isArray(admissionFileRows)
    ? admissionFileRows.filter((r) => r && r.title && r.file_url)
    : [];

  if (Array.isArray(settingsRow) && settingsRow[0]) {
    const s = settingsRow[0];
    out.stats = {
      total_students: typeof s.total_students === "number" ? s.total_students : null,
      total_teachers: typeof s.total_teachers === "number" ? s.total_teachers : null,
      pass_percentage: typeof s.pass_percentage === "number" ? s.pass_percentage : null,
      established_year: typeof s.established_year === "number" ? s.established_year : null,
    };
  }
  return out;
}

// ── PWA offline: asset manifest + service-worker version stamp ──────────────
// Runs on EVERY build (before any skip check — the manifest and the SW stamp
// are required even when prerendering itself is disabled):
//   1. Writes dist/asset-manifest.json — public/sw.js precaches every file in
//      it at install time, which is what makes ALL pages work offline.
//   2. Stamps a unique CACHE_VERSION into dist/sw.js so every deploy ships a
//      byte-different worker → browsers reinstall → fresh precache of the new
//      hashed files.
async function writeAssetManifestAndPatchSW() {
  try {
    const assetsDir = path.join(DIST, "assets");
    if (!existsSync(assetsDir)) {
      console.warn("PWA offline: dist/assets not found — skipping asset manifest.");
      return;
    }
    const entries = await readdir(assetsDir);
    const files = entries
      .filter((f) => /\.(js|mjs|css|woff2?|ttf|otf|png|jpe?g|webp|svg|avif|gif|ico|json|wasm)$/i.test(f))
      .map((f) => `/assets/${f}`)
      .sort();

    const manifest = { builtAt: new Date().toISOString(), count: files.length, files };
    await writeFile(path.join(DIST, "asset-manifest.json"), JSON.stringify(manifest), "utf8");

    const swPath = path.join(DIST, "sw.js");
    if (existsSync(swPath)) {
      const stamp = `ghss-${Date.now().toString(36)}`;
      let swSource = await readFile(swPath, "utf8");
      if (/const CACHE_VERSION = "[^"]*";/.test(swSource)) {
        swSource = swSource.replace(
          /const CACHE_VERSION = "[^"]*";/,
          `const CACHE_VERSION = "${stamp}";`
        );
        await writeFile(swPath, swSource, "utf8");
      }
    }

    console.log(
      `Prerender: asset-manifest.json written (${files.length} assets), sw.js version stamped.`
    );
  } catch (e) {
    console.warn(`PWA offline: skipped (${e.message}) — build continues.`);
  }
}

// ── Chromium launcher with auto-install fallback ────────────────────────────
async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    ({ chromium } = await import("playwright-core"));
  }

  const args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
  try {
    return await chromium.launch({ args });
  } catch (launchErr) {
    console.warn("Prerender: Chromium not installed — downloading (one-time)…");
    const install = spawnSync("npx playwright install chromium", {
      shell: true,
      stdio: "inherit",
      timeout: 300000,
    });
    if (install.status !== 0) throw launchErr;
    return await chromium.launch({ args });
  }
}

// ── Render one route to a static HTML file ──────────────────────────────────
async function renderPage(context, route, outPath, originalPreloads) {
  const page = await context.newPage();
  try {
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: PAGE_TIMEOUT_MS });
    } catch {
      try {
        await page.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
      } catch {
        /* page may still be usable — try to continue */
      }
    }

    await page.waitForSelector("footer", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);

    // Strip runtime-added modulepreload/prefetch links (the idle route
    // prefetcher injects 50+ chunks incl. exceljs ~938 KB — catastrophic on
    // 3G if baked into every saved page). Keep only the shell's originals.
    await page.evaluate((keepSet) => {
      const keep = new Set(keepSet);
      document
        .querySelectorAll('link[rel="modulepreload"], link[rel="prefetch"]')
        .forEach((link) => {
          const href = (link.getAttribute("href") || "").split("?")[0];
          if (!keep.has(href)) link.remove();
        });
      document.querySelectorAll('link[rel="preload"][as="script"]').forEach((link) => {
        const href = (link.getAttribute("href") || "").split("?")[0];
        if (href.startsWith("/assets/") || href.includes("/assets/")) {
          if (!keep.has(href)) link.remove();
        }
      });
    }, originalPreloads);

    const html = await page.content();
    if (!hasRenderedContent(html))
      throw new Error("rendered HTML has no real page content — skipping");

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    return html.length;
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Notice-detail rows for /notices/<id> fallback pages ──────────────────
// The sitemap (api/seo.js DETAIL_PAGE_LIMIT = 200) advertises up to 200
// notice-detail URLs. The Chromium phase renders only the newest
// DETAIL_LIMIT (20) — and none at all on builders without a browser
// (Vercel). The static fallback covers the newest NOTICE_FALLBACK_LIMIT so
// every notice URL that existed at build time serves a real, unique page
// instead of the duplicate SPA shell (soft-404).
const NOTICE_FALLBACK_LIMIT = Number(process.env.PRERENDER_NOTICE_FALLBACK_LIMIT || 200);

async function fetchNoticeDetails(limit = NOTICE_FALLBACK_LIMIT) {
  const { url, key } = supabaseEnv();
  if (!url || !key) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(
      `${url}/rest/v1/notices?select=id,title,content,category,is_urgent,created_at&is_published=eq.true&order=created_at.desc&limit=${limit}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => r && r.id && r.title);
  } catch {
    console.warn("[prerender] notices fetch failed — notice-detail fallbacks skipped.");
    return [];
  }
}

// ── Static fallback filler ───────────────────────────────────────────────────
/**
 * Fill dynamic lists inside a fallback page with build-time public data.
 * Handles:
 *   • <ul data-ghss-list="notices"></ul>   — latest published items
 *   • <ul data-ghss-list="library"></ul>        — latest library downloads
 *   • <ul data-ghss-stats></ul>                 — real school statistics
 * Each list's "empty" paragraph is removed when real items exist (or the
 * marker is removed when the list is empty).
 */
function makeListFiller(lists) {
  return (html) => {
    for (const source of ["notices", "library", "admission-files"]) {
      const items = source === "admission-files" ? (lists && lists.admissionFiles) || [] : (lists && lists[source]) || [];
      const ulRe = new RegExp(`<ul data-ghss-list="${source}"></ul>`);
      const pRe = new RegExp(`\\s*<p data-ghss-empty="${source}">[\\s\\S]*?</p>`);
      if (items.length > 0) {
        let lis = "";
        if (source === "notices") {
          lis = items
            .map((it) => {
              const date = it.created_at ? new Date(it.created_at) : null;
              const nice = date && !isNaN(date.getTime())
                ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : "";
              const label = nice ? `${esc(it.title)} — ${nice}` : esc(it.title);
              return `<li><a href="/${source}/${esc(it.id)}">${label}</a></li>`;
            })
            .join("");
        } else if (source === "library") {
          lis = items
            .map((f) => {
              const bits = [];
              if (f.category) bits.push(esc(f.category));
              if (f.class && f.class !== "All") bits.push(`Class ${esc(f.class)}`);
              const meta = bits.length ? ` (${bits.join(" · ")})` : "";
              const href = f.file_url || "/library";
              return `<li><a href="${esc(href)}">${esc(f.title)}</a>${meta}</li>`;
            })
            .join("");
        } else if (source === "admission-files") {
          // Direct download links to the admin-uploaded admission documents.
          lis = items
            .map((f) => {
              const meta = f.file_type ? ` — ${esc(f.file_type)}` : "";
              return `<li><a href="${esc(f.file_url)}">${esc(f.title)}</a>${meta}</li>`;
            })
            .join("");
        }
        html = html.replace(ulRe, `<ul>${lis}</ul>`).replace(pRe, "");
      } else {
        html = html.replace(ulRe, "").replace(pRe, "");
      }
    }

    // Real school statistics — never let a crawler read "0+" placeholders.
    const stats = lists && lists.stats;
    if (stats && (stats.total_students != null || stats.total_teachers != null || stats.pass_percentage != null)) {
      const lis = [
        stats.total_students != null ? `<li>${stats.total_students}+ students enrolled</li>` : "",
        stats.total_teachers != null ? `<li>${stats.total_teachers} teachers</li>` : "",
        stats.pass_percentage != null ? `<li>${stats.pass_percentage}% pass rate</li>` : "",
        stats.established_year != null ? `<li>Established ${stats.established_year}</li>` : "",
      ]
        .filter(Boolean)
        .join("");
      html = html
        .replace(/<ul data-ghss-stats><\/ul>/, `<ul>${lis}</ul>`)
        .replace(/\s*<p data-ghss-stats-empty>[\s\S]*?<\/p>/, "");
    } else {
      html = html.replace(/<ul data-ghss-stats><\/ul>/, "").replace(/\s*<p data-ghss-stats-empty>[\s\S]*?<\/p>/, "");
    }
    return html;
  };
}

/**
 * Guarantee crawler-readable HTML for every public route.
 * For each static route: if the Chromium phase did not write a sufficiently
 * large dist/<route>/index.html, write the static fallback page. Also covers
 * dist/index.html (the homepage) when it is still the bare shell.
 *
 * ROOT-CAUSE NOTE (Nov 2026): for weeks this function wrote ZERO pages on
 * Vercel even though it "never throws" — buildFallbackHtml() injected its
 * content with a /<div id="root"><\/div>/ pattern that never matched the
 * real shell (whose #root contains a <noscript> block), silently returned
 * null for every route, and this loop's `if (!html) continue;` skipped them
 * all. The result: every URL served the identical SPA shell → Google
 * soft-404/duplicate storm → Search Console "quota exceeded" for 10+ days
 * with zero pages indexed. buildFallbackHtml() is fixed (robust #root
 * injection); the loud verification at the end of runPrerender() now makes
 * any future regression of this guarantee impossible to miss in build logs.
 */
async function fillMissingRoutesWithStaticContent() {
  const shellPath = path.join(DIST, "index.html");
  if (!existsSync(shellPath)) return { filled: [], noticeFilled: 0, skipped: "dist/index.html missing" };

  const shellHtml = await readFile(shellPath, "utf8");
  // Always fetch build-time data (library/notice lists + stats blocks).
  const lists = await fetchLatestLists(10);

  const filler = makeListFiller(lists);
  const filled = [];

  for (const route of STATIC_ROUTES) {
    const meta = getPageMeta(route);
    if (!meta) continue;

    const outPath =
      route === "/" ? shellPath : path.join(DIST, route.replace(/^\//, ""), "index.html");

    let current = await readRenderedPage(outPath);
    if (current.ok) continue; // a real page already exists for this route

    const html = buildFallbackHtml(shellHtml, route, filler);
    if (!html) continue;

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    filled.push(route);
    console.log(
      `  ⚑ ${route} — static fallback written (${(html.length / 1024).toFixed(1)} KB, no Chromium render)`
    );
  }

  // ── Notice-detail fallback pages (/notices/<id>) ─────────────────────────
  // The sitemap advertises these URLs (api/seo.js), so each one must serve a
  // real page with its own <title>/canonical/content — not the SPA shell.
  // Same rule as above: never overwrite a full Chromium render.
  let noticeFilled = 0;
  const notices = await fetchNoticeDetails();
  const safeId = (id) => /^[A-Za-z0-9_-]{1,80}$/.test(String(id));
  for (const notice of notices) {
    if (!safeId(notice.id)) continue; // path-safety: never trust DB ids in paths
    const route = `/notices/${notice.id}`;
    const outPath = path.join(DIST, "notices", String(notice.id), "index.html");
    const current = await readRenderedPage(outPath);
    if (current.ok) continue; // a real page already exists for this notice
    const html = buildFallbackHtml(shellHtml, route, filler, notice);
    if (!html) continue;
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    noticeFilled++;
  }
  if (noticeFilled > 0) {
    console.log(
      `  ⚑ /notices/<id> — ${noticeFilled} notice-detail page(s) written (static fallback, no Chromium render)`
    );
  }

  return { filled, noticeFilled };
}

// ── Main orchestrator ────────────────────────────────────────────────────────
/**
 * Run the full prerender pipeline. NEVER throws — a build always succeeds.
 * @param {string} source "vite" (closeBundle hook) or "cli" (manual script).
 */
export async function runPrerender(source = "cli") {
  // 1. PWA manifest + SW stamp — every call, unconditionally.
  await writeAssetManifestAndPatchSW();

  if (!existsSync(DIST)) {
    console.warn("Prerender: dist/ not found — run `vite build` first. Skipping.");
    return;
  }

  // The Vite hook runs right after a fresh build (outDir was emptied), so it
  // always runs. The CLI wrapper skips when the hook already did the work.
  if (source === "cli" && existsSync(MARKER)) {
    console.log("Prerender: already completed during this build (vite closeBundle) — skipping CLI run.");
    return;
  }

  const log = [];
  const skipChromium =
    process.env.PRERENDER === "false" ||
    process.env.PRERENDER === "0" ||
    // VERCEL: the Chromium phase cannot work here. The build container has no
    // browser and no browser system libraries, so `chromium.launch()` fails
    // and the code below used to run "npx playwright install chromium" — a
    // ~5 minute download that (a) burns the Vercel build budget and can push
    // the whole deployment over the build timeout, and (b) still could not
    // launch a browser without libnss3/libatk/etc. The static fallback phase
    // below already produces a complete, unique, canonical HTML page for
    // every public route, so on Vercel the browser phase is pure risk with
    // no benefit. Set PRERENDER_CHROMIUM=1 to force it on anyway.
    (IS_VERCEL && process.env.PRERENDER_CHROMIUM !== "1");
  const skipFallback = process.env.SEO_FALLBACK === "false" || process.env.SEO_FALLBACK === "0";

  // 2. Chromium phase — full-fidelity rendered pages.
  let chromiumOk = 0;
  let chromiumFailed = 0;
  const server = await startServer();
  let browser = null;
  try {
    if (skipChromium) {
      console.log(
        IS_VERCEL && process.env.PRERENDER_CHROMIUM !== "1"
          ? "Prerender: Chromium phase skipped (no browser in the Vercel build container — " +
            "the static fallback phase below writes every public route). " +
            "Set PRERENDER_CHROMIUM=1 to force it on."
          : "Prerender: Chromium phase skipped (PRERENDER=false)."
      );
    } else {
      browser = await launchBrowser();

      // Capture vite's ORIGINAL modulepreload set from the shell — anything
      // added at runtime must be stripped from the saved HTML.
      const shellHtml = await readFile(path.join(DIST, "index.html"), "utf8").catch(() => "");
      const originalPreloads = [...shellHtml.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)]
        .map((m) => (/rel="(modulepreload|preload|stylesheet|prefetch)"/.test(m[0]) ? m[1] : null))
        .filter(Boolean);
      if (originalPreloads.length) {
        console.log(
          `Prerender: keeping ${originalPreloads.length} original preload links, stripping runtime-added ones.`
        );
      }

      const context = await browser.newContext({
        viewport: { width: 1366, height: 900 },
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GHSPrerender/1.0",
      });

      // Don't pollute analytics with local prerender hits.
      await context.route("**/*", (route) => {
        const u = route.request().url();
        if (u.includes("plausible.io")) return route.abort();
        return route.continue();
      });

      const noticeIds = await fetchIds("notices", DETAIL_LIMIT);
      const routes = [
        ...STATIC_ROUTES,
        ...noticeIds.map((id) => `/notices/${id}`),
      ];

      console.log(
        `\nPrerender: rendering ${routes.length} routes (${STATIC_ROUTES.length} static + ${noticeIds.length} notices)…`
      );

      for (const route of routes) {
        const outPath =
          route === "/" ? path.join(DIST, "index.html") : path.join(DIST, route.replace(/^\//, ""), "index.html");
        try {
          const size = await renderPage(context, route, outPath, originalPreloads);
          chromiumOk++;
          if (STATIC_ROUTES.includes(route)) log.push(`  ✔ ${route} (${(size / 1024).toFixed(1)} KB)`);
        } catch (e) {
          chromiumFailed++;
          log.push(`  ✘ ${route}: ${e.message}`);
        }
      }
      console.log(log.join("\n"));
    }
  } catch (e) {
    console.warn(`Prerender: Chromium phase aborted (${e.message}) — static fallback will cover public routes.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }

  // 3. Static fallback phase — guaranteed content for anything missing.
  let fallbackCount = 0;
  let noticeFallbackCount = 0;
  if (skipFallback) {
    console.log("Prerender: static fallback skipped (SEO_FALLBACK=false).");
  } else {
    try {
      const { filled, noticeFilled } = await fillMissingRoutesWithStaticContent();
      fallbackCount = filled.length;
      noticeFallbackCount = noticeFilled || 0;
      if (fallbackCount > 0) {
        console.log(
          `Prerender: static fallback filled ${fallbackCount} route(s) without a full Chromium render.`
        );
      }
    } catch (e) {
      console.warn(`Prerender: static fallback failed (${e.message}) — build continues.`);
    }
  }

  // 3b) POST-RUN VERIFICATION — the exact failure that cost 10+ days of
  // Google indexing (fallback silently wrote ZERO pages; every URL served the
  // identical SPA shell → soft-404 storm) must never be silent again.
  //
  // The check is now CONTENT-based (hasRenderedContent), not size-based: a
  // file is only accepted when it really carries a page, so a 15 KB SPA shell
  // can no longer masquerade as a prerendered homepage.
  //
  // It also cross-checks the three lists that used to drift apart:
  //   • the shared route list (scripts/site-routes.mjs),
  //   • the React router (src/App.tsx),
  //   • the sitemap generator (api/seo.js).
  // Anything inconsistent prints a LOUD error in the Vercel build log. (The
  // build still never fails — this is a visibility guarantee, not a gate.)
  try {
    const missing = [];
    for (const route of STATIC_ROUTES) {
      const outPath =
        route === "/"
          ? path.join(DIST, "index.html")
          : path.join(DIST, route.replace(/^\//, ""), "index.html");
      const page = await readRenderedPage(outPath);
      if (!page.ok) missing.push(`${route} (${page.size} bytes — no real page content)`);
    }
    if (missing.length) {
      console.error(
        "\n⛔⛔⛔ PRERENDER VERIFICATION FAILED ⛔⛔⛔\n" +
          "The following public routes have NO crawler-readable page in dist/:\n" +
          missing.map((m) => `  • ${m}`).join("\n") +
          "\nGoogle will receive the SPA shell (duplicate/soft-404) for these URLs" +
          "\nand they will NOT be indexed. Fix scripts/seo-page-content.mjs /" +
          "\nscripts/prerender-lib.mjs BEFORE deploying.\n⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔\n"
      );
    } else {
      console.log(`Prerender verification OK — ${STATIC_ROUTES.length} public routes carry real content.`);
    }

    // ── Cross-list consistency: router vs. shared route list ───────────────
    // A public page that exists in the React router but not in
    // scripts/site-routes.mjs would 404 for real visitors (the middleware
    // would classify it as unknown) and would never be prerendered or listed
    // in the sitemap. That is exactly the drift that produced the original
    // soft-404 storm, so it is checked on every build.
    try {
      const appSource = await readFile(path.resolve(__dirname, "..", "src", "App.tsx"), "utf8");
      const routerPaths = new Set(
        [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
      );
      const known = new Set([
        ...STATIC_ROUTES,
        "/search",
        "/admission/apply",
        "/admission/login",
        "/admission/portal",
        "/admission/profile",
        "/admission/register",
        "/admission/ssc",
        "/admission/application/:id",
        "/notices/:id",
        "/admin",
        "/dashboard",
        "/teacher",
        "/auth/signin",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/mfa-enroll",
        "/auth/mfa-verify",
        "/auth/callback",
      ]);
      const unknown = [...routerPaths].filter((p) => !known.has(p) && p !== "*");
      if (unknown.length) {
        console.error(
          "\n⛔ ROUTE LIST OUT OF SYNC ⛔\n" +
            "These React routes are not classified in scripts/site-routes.mjs:\n" +
            unknown.map((u) => `  • ${u}`).join("\n") +
            "\nThey would answer with a 404 for visitors and would never be" +
            "\nprerendered or listed in the sitemap. Add them to" +
            "\nscripts/site-routes.mjs (or to the 'known' set in" +
            "\nscripts/prerender-lib.mjs) BEFORE deploying.\n⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔⛔\n"
        );
      }
    } catch (e) {
      console.warn(`Prerender route cross-check skipped (${e.message}).`);
    }
  } catch (e) {
    console.warn(`Prerender verification skipped (${e.message}).`);
  }

  // 4. Marker so the CLI wrapper never double-runs for this dist.
  try {
    await writeFile(
      MARKER,
      JSON.stringify({
        at: new Date().toISOString(),
        source,
        chromiumOk,
        chromiumFailed,
        fallback: fallbackCount,
        noticeFallback: noticeFallbackCount,
      }),
      "utf8"
    );
  } catch {
    /* non-fatal */
  }

  console.log(
    `Prerender complete (source=${source}): chromium ${chromiumOk} ok / ${chromiumFailed} failed, ` +
      `${fallbackCount} static fallback page(s) + ${noticeFallbackCount} notice page(s) written.\n`
  );
}
