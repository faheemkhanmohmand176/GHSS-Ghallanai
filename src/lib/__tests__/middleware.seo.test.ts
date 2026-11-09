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

describe("middleware API routes (BISE Peshawar proxy + OG image pass-through)", () => {
  // ── Regression (Nov 7, 2026 — the "No result announced yet" bug) ──────────
  // /api/bisep-proxy and /api/og are the ONLY /api paths in the middleware
  // matcher (they opt in for the scrapeProxy rate limit). classifyPath() is
  // a PAGE-route classifier, so it labelled both "notfound", and the 404
  // layer answered them with a 404 HTML page BEFORE the serverless function
  // could run. Every poll of /api/bisep-proxy?mode=current then failed, so
  // useBisepCurrentExam() could never learn the live exam title and the
  // homepage + /results BISE Peshawar section permanently showed the
  // "No result announced yet" fallback card. Roll-number lookups only kept
  // working through the 24 h on-device localStorage cache. /api/og (social
  // link previews) was 404'd by the same line. These tests pin the fix:
  // API routes must NEVER be classified by the page-route 404 layer.

  it("/api/bisep-proxy?mode=current reaches the function — never a 404 (the 'No result announced yet' regression)", async () => {
    for (const ua of [BROWSER, GOOGLEBOT]) {
      const res = await middleware(
        makeRequest("/api/bisep-proxy?mode=current", ua, "198.51.100.30")
      );
      // undefined = middleware passes the request through to the serverless
      // function, exactly what the BISE Peshawar proxy needs.
      expect(res, `UA ${ua} must reach the function`).toBeUndefined();
    }
  });

  it("/api/bisep-proxy?roll=<n> reaches the function too (live board lookups)", async () => {
    const res = await middleware(
      makeRequest("/api/bisep-proxy?roll=15101145&v=3", BROWSER, "198.51.100.31")
    );
    expect(res).toBeUndefined();
  });

  it("/api/og reaches the function — including for social crawlers (no 302 redirect loop)", async () => {
    // facebookexternalhit on a PAGE is 302-redirected to /api/og; once it
    // arrives there the middleware must pass it through, or previews die.
    const res = await middleware(
      makeRequest(
        "/api/og?path=%2Ffaq",
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "198.51.100.32"
      )
    );
    expect(res).toBeUndefined();
  });

  it("CORS preflights to /api/bisep-proxy pass through untouched", async () => {
    const req = new Request(`${ORIGIN}/api/bisep-proxy?mode=current`, {
      method: "OPTIONS",
      headers: {
        "User-Agent": BROWSER,
        "Access-Control-Request-Method": "GET",
        "x-forwarded-for": "198.51.100.33",
      },
    });
    const res = await middleware(req);
    expect(res).toBeUndefined();
  });

  it("the scrapeProxy rate limit still guards /api/bisep-proxy (429 past 300/min)", async () => {
    // Exempting API routes from the 404 layer must NOT bypass the rate
    // limiter — that is the only reason these endpoints are in the matcher.
    let saw429 = false;
    for (let i = 0; i < 700; i++) {
      const res = await middleware(
        makeRequest("/api/bisep-proxy?mode=current", BROWSER, "198.51.100.34")
      );
      if (res && res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });

  it("junk PAGE urls are still 404'd after the API exemption (the soft-404 fix is intact)", async () => {
    for (const path of ["/library/notes", "/this-page-does-not-exist"]) {
      const res = await middleware(makeRequest(path, BROWSER, "198.51.100.35"));
      expect(res, `${path} must not pass through`).toBeDefined();
      expect(res!.status).toBe(404);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REMOVED PAGES — 410 Gone, never a redirect to the homepage
// ═══════════════════════════════════════════════════════════════════════════
// Search Console reported "Page with redirect" as the reason pages were not
// being indexed. The cause was three REMOVED features (/duty, /notes,
// /notes/*) that answered 308 → "/". Redirecting a deleted page to the
// homepage is the worst possible pattern: every old URL becomes a duplicate
// of the homepage, the homepage's own ranking signals get diluted, and the
// URLs are reported as "Page with redirect" forever.
//
// The correct answer for "this page is gone and has no equivalent" is
// HTTP 410 Gone — which tells the engines to drop it and stop crawling it.
// /result-card is deliberately NOT in this list: that page MOVED to
// /results and still exists there, so it keeps its permanent redirect.
describe("middleware removed pages (410 Gone)", () => {
  const REMOVED = [
    "/gallery",
    "/gallery/2024",
    "/duty",
    "/duty/morning",
    "/notes",
    "/notes/anything",
    "/notes/a/b/c",
  ];

  it("every removed feature answers 410 Gone with a noindex directive", async () => {
    for (const path of REMOVED) {
      const res = await middleware(makeRequest(path, BROWSER, "198.51.100.40"));
      expect(res, `${path} must be answered, not passed through`).toBeDefined();
      expect(res!.status, `${path} must be 410 Gone`).toBe(410);
      expect(res!.headers.get("X-Robots-Tag"), `${path} must be noindex`).toBe("noindex");
    }
  });

  it("a removed page is NEVER redirected to the homepage", async () => {
    for (const path of ["/duty", "/notes", "/notes/x"]) {
      const res = await middleware(makeRequest(path, BROWSER, "198.51.100.41"));
      expect(res!.status).toBe(410);
      // A 410 carries no Location header at all — there is nothing to follow.
      expect(res!.headers.get("Location")).toBeNull();
    }
  });

  it("crawlers get the 410 too — Googlebot must not be live-rendered for a gone page", async () => {
    mockRenderHop(() => new Response(RENDER_200_HTML, { status: 200 }));
    for (const path of ["/duty", "/notes"]) {
      const res = await middleware(makeRequest(path, GOOGLEBOT, "198.51.100.42"));
      expect(res).toBeDefined();
      expect(res!.status).toBe(410);
    }
  });

  it("the live pages that REPLACED removed features are still served normally", async () => {
    mockRenderHop(() => new Response(RENDER_200_HTML, { status: 200 }));
    for (const path of ["/", "/notices", "/teachers"]) {
      const res = await middleware(makeRequest(path, GOOGLEBOT, "198.51.100.43"));
      // undefined = the request continues into Vercel's static pipeline
      expect(res).toBeUndefined();
    }
  });
});
