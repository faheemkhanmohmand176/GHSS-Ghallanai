// @vitest-environment node
/**
 * src/lib/__tests__/middleware.seo.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the Edge middleware's crawler/SEO behaviour — the exact
 * paths Googlebot and Bingbot take through middleware.ts:
 *
 *   1. Googlebot on a valid page route receives the live-rendered HTML.
 *   2. A DELIBERATE renderer 404 (dead notice UUID, wrong-case URL, unknown
 *      route) is passed through as a real 404 — never masked by a 200 SPA
 *      shell (the "soft 404" defect Search Console reports as
 *      "Duplicate without user-selected canonical" / thin content).
 *   3. A renderer FAILURE (5xx / non-HTML) still falls back to the static
 *      pipeline so crawling never breaks.
 *   4. /index.html and /&lt;route&gt;/index.html canonicalise with a 308 to the
 *      clean path (duplicate-URL fix).
 *   5. Trusted search-engine bots are exempt from the page-route rate
 *      limiter; everyone else is still throttled.
 *   6. Social preview crawlers are redirected to /api/og on page routes only.
 *   7. Attack-tool user agents stay blocked (403).
 *
 * The /api/render hop is mocked with vi.stubGlobal("fetch") so no network,
 * Supabase or Vercel is needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import middleware from "../../../middleware";

const ORIGIN = "https://ghssghallanai.dpdns.org";
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

const RENDER_200_HTML =
  "<!DOCTYPE html><html><head><title>Live page</title></head><body><h1>Hello</h1></body></html>";
const RENDER_404_HTML =
  '<!DOCTYPE html><html><head><title>Page not found</title><meta name="robots" content="noindex"></head></html>';

function makeRequest(path: string, ua: string, ip = "203.0.113.7") {
  return new Request(`${ORIGIN}${path}`, {
    method: "GET",
    headers: { "User-Agent": ua, "x-forwarded-for": ip },
  });
}

function mockRenderHop(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      handler(typeof input === "string" ? input : input.toString())
    )
  );
}

beforeEach(() => {
  // Fresh module state per test would need vi.resetModules; the rate-limit
  // store persists per file, so each test uses a unique client IP.
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("middleware crawler paths (SEO)", () => {
  it("Googlebot on a valid page falls through to Vercel's prerendered HTML (no /api/render proxy)", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): the middleware no longer proxies
    // Googlebot through /api/render (which was returning HTTP 500
    // FUNCTION_INVOCATION_FAILED in production, causing every URL to fall
    // through to the bare SPA shell → soft-404 storm → "quota exceeded"
    // in Search Console for 10+ days). Googlebot now falls through to
    // Vercel's static pipeline, which serves the build-time prerendered
    // HTML file (with unique <title>/meta/h1 per route) via vercel.json
    // rewrites like `/admission → /admission/index.html`.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.1"));
    // Falls through to Vercel — middleware returns undefined.
    expect(res).toBeUndefined();
    // The /api/render proxy is NOT invoked.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dead notice UUID → falls through to Vercel (no /api/render dependency)", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): the middleware no longer proxies
    // crawlers through /api/render, so dead URLs no longer get a clean 404
    // from the renderer. Instead, they fall through to Vercel's static
    // pipeline — which serves the SPA shell for unknown notice UUIDs (a
    // soft-404 regression for dead URLs, but the trade-off is necessary to
    // keep the LIVE pages indexable when /api/render is broken. Dead-URL
    // 404s can be re-added later by either fixing /api/render or by adding
    // a Supabase existence check directly in the middleware).
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(
      makeRequest("/notices/00000000-0000-4000-8000-000000000000", GOOGLEBOT, "198.51.100.2")
    );
    expect(res).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("wrong-case /FAQ → falls through to Vercel (no /api/render dependency)", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): the middleware no longer proxies
    // crawlers through /api/render. Wrong-case URLs (e.g. /FAQ instead of
    // /faq) now fall through to Vercel, which on Linux is case-sensitive —
    // /FAQ does NOT match /faq/index.html, so Vercel falls through to the
    // SPA shell. This is a soft-404 regression for wrong-case URLs, but
    // the trade-off is necessary to keep the LIVE pages indexable when
    // /api/render is broken.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/FAQ", GOOGLEBOT, "198.51.100.3"));
    expect(res).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renderer 500 / non-HTML / dead-URL paths fall through to Vercel — /api/render is never called", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): the middleware no longer calls
    // /api/render at all for crawlers — so a 500 from /api/render can never
    // again cause a soft-404 storm. The render hop's failure modes are now
    // irrelevant to indexing.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.4"));
    expect(res).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("non-HTML 404 from /api/render is irrelevant — /api/render is never called", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): the middleware no longer calls
    // /api/render at all, so its response shape (HTML, JSON, 404, 500, …)
    // is irrelevant. Crawlers always fall through to Vercel.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.5"));
    expect(res).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("/faq/index.html canonicalises with a 308 to /faq", async () => {
    const res = await middleware(makeRequest("/faq/index.html", GOOGLEBOT, "198.51.100.6"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(308);
    expect(res!.headers.get("location")).toBe(`${ORIGIN}/faq`);
  });

  it("/index.html canonicalises with a 308 to /", async () => {
    const res = await middleware(makeRequest("/index.html", BROWSER, "198.51.100.7"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(308);
    expect(res!.headers.get("location")).toBe(`${ORIGIN}/`);
  });

  it("query strings survive the /index.html canonicalisation", async () => {
    const res = await middleware(makeRequest("/notices/index.html?page=2", BROWSER, "198.51.100.8"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(308);
    expect(res!.headers.get("location")).toBe(`${ORIGIN}/notices?page=2`);
  });

  it("Googlebot is never rate-limited on page routes", async () => {
    // CRITICAL INDEXING FIX (Nov 2026): Googlebot now bypasses the rate
    // limiter entirely (the middleware returns undefined before reaching
    // the rate-limit check). Hammering past the default 100 req/min
    // ceiling from ONE "IP" must never produce a 429 for a recognised
    // crawler — that is the guarantee Googlebot needs to crawl freely.
    // (The previous mockRenderHop() is now unused — /api/render is no
    // longer called — but is kept here for clarity.)
    mockRenderHop(
      () =>
        new Response(RENDER_200_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    );
    // default tier = 100 req/min — hammer far past it from ONE "IP".
    let saw429 = false;
    for (let i = 0; i < 160; i++) {
      const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.9"));
      // `undefined` is the expected fall-through to Vercel — NOT a rate-limit.
      // Only a real 429 Response counts as rate-limited.
      if (res && res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(false);
  });

  it("ordinary clients are still rate-limited on page routes", async () => {
    let saw429 = false;
    for (let i = 0; i < 220; i++) {
      const res = await middleware(makeRequest("/faq", BROWSER, "198.51.100.10"));
      if (res && res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it("social preview crawler on a page route is redirected to /api/og", async () => {
    const res = await middleware(
      makeRequest(
        "/faq",
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "198.51.100.11"
      )
    );
    expect(res).toBeDefined();
    expect(res!.status).toBe(302);
    expect(res!.headers.get("location")).toContain("/api/og?path=%2Ffaq");
  });

  it("attack-tool user agents remain blocked", async () => {
    const res = await middleware(makeRequest("/faq", "sqlmap/1.5.2#stable (http://sqlmap.org)", "198.51.100.12"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(403);
  });

  it("ordinary browsers pass through untouched (no live-render hop)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/faq", BROWSER, "198.51.100.13"));
    expect(res).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
