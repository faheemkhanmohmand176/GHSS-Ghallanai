// ─────────────────────────────────────────────────────────────────────────────
// scripts/indexnow-ping.mjs — build-time IndexNow submission (SEO audit)
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ────────────────
// The site already has TWO IndexNow submission paths at RUNTIME
// (api/seo.js ?kind=indexnow + the opportunistic auto-ping when the sitemap
// is fetched). What was missing is the third, most reliable one: a ping
// fired on EVERY DEPLOY — the exact moment the content actually changed.
// A deploy means every prerendered HTML file was just rewritten, so
// re-submitting the public URLs immediately tells the IndexNow network
// (Bing, Yandex, Naver, Seznam — and through Bing: DuckDuckGo, Yahoo,
// Ecosia) to come re-crawl. This is the closest thing that exists to
// "Request Indexing" without Google's per-property quota.
//
// WHAT IT SUBMITS
// ────────────────
//   • the 10 public routes (from the SINGLE SOURCE OF TRUTH — the same
//     scripts/site-routes.mjs the middleware, sitemap and renderer use)
//   • every notice-detail page the build just prerendered (discovered by
//     scanning dist/notices/*/index.html — zero extra requests)
//
// GUARDS (a build must NEVER fail because of a ping)
// ─────────────────────────────────────────────
//   • skipped entirely on Vercel PREVIEW/development deployments
//     (VERCEL_ENV) and when GHSS_SKIP_INDEXNOW=1 — local/dev builds and
//     pull-request previews must not spam the engines.
//   • network/HTTP failures are logged and swallowed — exit code is
//     always 0.
//   • --dry-run flag: print the payload instead of sending (used by the
//     repo's own build test so the test never pings the real engines).
//
// ZERO NEW DEPENDENCIES: plain Node 18+ fetch + fs.
// ─────────────────────────────────────────────────────────────────────────────

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Same constants as api/seo.js (?kind=indexnow) — the key IS public (it is
// served at https://…/<key>.txt for engine verification; that is the protocol).
const SITE_URL = "https://ghssghallanai.dpdns.org";
const INDEXNOW_KEY = "ghss-ghallanai-indexnow-3f9c7a2e5b1d4806";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_HOST = new URL(SITE_URL).host;

// The broadcast endpoint fans the submission out to every participating
// engine; Bing is added directly because it powers the largest downstream
// surface (DuckDuckGo, Yahoo, Ecosia, Qwant).
const ENDPOINTS = [
  { name: "indexnow.org (broadcast)", url: "https://api.indexnow.org/indexnow" },
  { name: "Bing", url: "https://www.bing.com/indexnow" },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");

const isDryRun = process.argv.includes("--dry-run");
const skipEnv =
  process.env.GHSS_SKIP_INDEXNOW === "1" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "development";

/** Import the shared route list WITHOUT bundling the whole module graph —
 *  site-routes.mjs is dependency-free by design, so a plain dynamic import
 *  is safe in every build environment. */
async function publicRoutePaths() {
  const mod = await import("./site-routes.mjs");
  return mod.PUBLIC_ROUTE_PATHS;
}

// Notice detail pages the build just prerendered (dist/notices/<id>/index.html).
async function prerenderedNoticePaths() {
  const dir = path.join(DIST, "notices");
  if (!existsSync(dir)) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "index.html")))
      .map((e) => `/notices/${e.name}`);
  } catch {
    return [];
  }
}

async function main() {
  if (skipEnv && !isDryRun) {
    console.log("[indexnow-ping] skipped (preview/dev build or GHSS_SKIP_INDEXNOW=1)");
    return;
  }

  const [routes, notices] = await Promise.all([
    publicRoutePaths(),
    prerenderedNoticePaths(),
  ]);

  const urlList = [...routes, ...notices].map((p) => `${SITE_URL}${p === "/" ? "/" : p}`);
  if (!urlList.length) {
    console.log("[indexnow-ping] no URLs to submit — nothing to do");
    return;
  }

  const payload = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };

  if (isDryRun) {
    console.log(`[indexnow-ping] DRY RUN — would submit ${urlList.length} URL(s):`);
    for (const u of urlList) console.log(`  ${u}`);
    return;
  }

  console.log(`[indexnow-ping] submitting ${urlList.length} URL(s) to ${ENDPOINTS.length} endpoint(s)…`);

  const results = await Promise.all(
    ENDPOINTS.map(async (ep) => {
      try {
        const r = await fetch(ep.url, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });
        // 200 OK and 202 Accepted are the documented success codes.
        const ok = r.status === 200 || r.status === 202;
        console.log(`[indexnow-ping]   ${ep.name}: HTTP ${r.status} ${ok ? "OK" : "(will be retripped on next sitemap fetch)"}`);
        return ok;
      } catch (e) {
        console.log(`[indexnow-ping]   ${ep.name}: failed (${e?.message || e}) — not fatal`);
        return false;
      }
    })
  );

  if (results.some(Boolean)) {
    console.log("[indexnow-ping] done — at least one engine accepted the submission.");
  } else {
    console.log("[indexnow-ping] done — all endpoints unreachable; the runtime auto-ping on sitemap fetch remains as backup.");
  }
}

main().catch((e) => {
  // A ping must never break the deploy.
  console.log(`[indexnow-ping] unexpected error (ignored): ${e?.message || e}`);
});
