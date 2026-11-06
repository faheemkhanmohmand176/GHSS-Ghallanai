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
 *      shell (the "soft 404" defect that kept every page out of the index).
 *   3. A renderer FAILURE (5xx / non-HTML / timeout) still falls back to the
 *      static pipeline so crawling never breaks.
 *   4. Unknown URLs answer with a REAL 404 — the fix for the soft-404 storm
 *      where every junk URL returned HTTP 200 + the homepage shell.
 *   5. /index.html and /&lt;route&gt;/index.html canonicalise with a 308 to the
 *      clean path (duplicate-URL fix).
 *   6. Trusted search-engine bots are exempt from the page-route rate
 *      limiter; everyone else is still throttled.
 *   7. Social preview crawlers are redirected to /api/og on page routes only.
 *   8. Attack-tool user agents stay blocked (403).
 *
 * The /api/render hop is mocked with vi.stubGlobal("fetch") so no network,
 * Supabase or Vercel is needed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("middleware crawler paths (SEO)", () => {
  it("Googlebot on a valid page receives the live-rendered HTML", async () => {
    // The live renderer gives crawlers the CURRENT database content instead
    // of the build-time snapshot, which is what makes a results/notices site
    // indexable at all. api/render.js used to answer HTTP 500
    // (FUNCTION_INVOCATION_FAILED) because it referenced an undeclared
    // `effectiveRoute` identifier — the 500 was piped through to the crawler
    // and the request fell through to the SPA shell, i.e. the HOMEPAGE, for
    // every URL. That is what made the whole site look like one duplicated
    // page and kept 100% of it out of the index.
    mockRenderHop(
      () =>
        new Response(RENDER_200_HTML, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    );
    const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.1"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("x-ghss-live-render")).toBe("1");
    // Crawler-only body must never be stored in the shared CDN cache.
    expect(res!.headers.get("cache-control")).toContain("no-store");
    expect(await res!.text()).toContain("<h1>Hello</h1>");
  });

  it("dead notice UUID → the renderer's 404 is passed through as a real 404", async () => {
    mockRenderHop(
      () =>
        new Response(RENDER_404_HTML, {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
    );
    const res = await middleware(
      makeRequest("/notices/00000000-0000-4000-8000-000000000000", GOOGLEBOT, "198.51.100.2")
    );
    expect(res).toBeDefined();
    expect(res!.status).toBe(404);
  });

  it("wrong-case /FAQ → real 404 (never the 200 homepage shell)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await middleware(makeRequest("/FAQ", GOOGLEBOT, "198.51.100.3"));
    expect(res).toBeDefined();
    expect(res!.status).toBe(404);
    expect(res!.headers.get("x-robots-tag")).toContain("noindex");
    // The renderer is never even consulted for a URL that does not exist.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renderer 500 / non-HTML falls through to Vercel — crawling never breaks", async () => {
    mockRenderHop(
      () =>
        new Response("boom", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
    );
    const res = await middleware(makeRequest("/faq", GOOGLEBOT, "198.51.100.4"));
    // undefined = continue to the prerendered static page for /faq.
    expect(res).toBeUndefined();
  });

  it("unknown URLs answer with a REAL 404 for every client (the soft-404 fix)", async () => {
    // The single most important behavioural change: /library/notes, /Gallery,
    // /notices/<dead-id> and every other junk URL used to return HTTP 200 with
    // the HOMEPAGE HTML. Google then saw the whole site as one duplicated page
    // and refused to index anything.
    for (const path of [
      "/library/notes",
      "/Gallery",
      "/notices/not-a-uuid",
      "/this-page-does-not-exist",
      "/missing.html",
    ]) {
      const res = await middleware(makeRequest(path, GOOGLEBOT, "198.51.100.20"));
      expect(res, `${path} must not answer 200`).toBeDefined();
      expect(res!.status, `${path} must answer 404`).toBe(404);
      expect(res!.headers.get("x-robots-tag")).toContain("noindex");
      expect(await res!.text()).toContain("Page not found");
    }
  });

  it("real public routes are never 404'd", async () => {
    const paths = [
      "/",
      "/about",
      "/contact",
      "/admission",
      "/notices",
      "/results",
      "/merit-list",
      "/roll-no-slip",
      "/teachers",
      "/library",
      "/faq",
      "/search",
      "/admission/apply",
      "/admin",
      "/teacher",
      "/auth/signin",
    ];
    for (const path of paths) {
      const res = await middleware(makeRequest(path, BROWSER, "198.51.100.21"));
      // undefined = pass through to the static/SPA pipeline (never a 404).
      expect(res, `${path} must not be a 404`).toBeUndefined();
    }
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
