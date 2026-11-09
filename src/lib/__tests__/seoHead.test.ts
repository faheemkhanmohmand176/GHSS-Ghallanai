// @vitest-environment node
/**
 * src/lib/__tests__/seoHead.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Regression tests for the SEO <head> normaliser (scripts/seo-page-content.mjs
 * → applySeoHead / normalizeRenderedHead).
 *
 * THE BUG THIS GUARDS AGAINST
 * ───────────────────────────
 * The SPA shell (index.html) ships a STATIC
 *   <link rel="canonical" href="https://ghssghallanai.dpdns.org/">
 * for the HOMEPAGE. react-helmet-async does NOT remove pre-existing static
 * tags from the document — it only manages the tags it created itself (the
 * ones carrying data-rh="true"). A Chromium-rendered page therefore ended up
 * with TWO canonicals:
 *
 *   1. the shell's homepage canonical
 *   2. Helmet's correct per-route canonical
 *
 * Google sees two conflicting canonicals for the same URL. Its documented
 * behaviour is to ignore conflicting canonicals — or to pick the wrong one
 * (the homepage). Either way the message is "this page is a duplicate of /".
 * Applied to every route of the site at once, that collapses the ENTIRE site
 * into a single indexed page: no page can rank, and Search Console reports
 * the rest as duplicates. The same duplication hit meta description (×2),
 * og:url (×2), robots (×2) and the JSON-LD graph (×4..×9).
 *
 * This was INVISIBLE on Vercel only because the Chromium phase is skipped
 * there (the static fallback is used instead) — so it silently returned the
 * moment the build ran anywhere with a browser. The normaliser makes the
 * output identical on both paths.
 */
import { describe, expect, it } from "vitest";
import {
  applySeoHead,
  normalizeRenderedHead,
  buildFallbackHtml,
} from "../../../scripts/seo-page-content.mjs";
import { SCHOOL_EMIS_CODE } from "../../../scripts/site-routes.mjs";

const SITE = "https://ghssghallanai.dpdns.org";

/** Strip HTML comments so a comment containing tag-like text is never counted. */
function stripComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function canonicals(html: string): string[] {
  return [
    ...stripComments(html).matchAll(
      /<link\b[^>]*\brel=(["'])canonical\1[^>]*>/gi
    ),
  ].map((m) => m[0]);
}

function canonicalHref(html: string): string {
  const c = canonicals(html)[0] || "";
  return c.match(/href=(["'])(.*?)\1/i)?.[2] || "";
}

/**
 * A realistic Chromium-rendered page: the SPA shell's static homepage
 * canonical + Helmet's correct per-route canonical, plus the duplicated
 * description / og:url / robots / JSON-LD that come with them.
 */
const RENDERED_ABOUT = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>About GHSS Ghallanai — History, Mission &amp; Vision | District Mohmand KPK</title>
    <link rel="canonical" href="${SITE}/" />
    <meta name="description" content="Static shell description." />
    <meta property="og:url" content="${SITE}/" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[]}</script>
    <link rel="icon" href="/favicon.ico?v=6" />
  </head>
  <body>
    <div id="root"><h1>About GHSS Ghallanai</h1><p>Real rendered body text.</p></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

describe("SEO head normalisation — exactly one canonical per page", () => {
  it("removes the shell's conflicting homepage canonical", () => {
    const out = applySeoHead(RENDERED_ABOUT, "/about");
    expect(out).toBeTruthy();
    expect(canonicals(out)).toHaveLength(1);
  });

  it("the surviving canonical points at THIS route, not the homepage", () => {
    const out = applySeoHead(RENDERED_ABOUT, "/about");
    expect(canonicalHref(out)).toBe(`${SITE}/about`);
  });

  it("leaves the rendered BODY untouched", () => {
    const out = applySeoHead(RENDERED_ABOUT, "/about");
    expect(out).toContain("Real rendered body text.");
    expect(out).toContain('<div id="root">');
    expect(out).toContain("/assets/index-abc.js");
  });

  it("deduplicates description, og:url, robots and the JSON-LD graph", () => {
    const out = stripComments(applySeoHead(RENDERED_ABOUT, "/about") || "");
    expect(out.match(/<meta[^>]*name="description"/gi)).toHaveLength(1);
    expect(out.match(/<meta[^>]*property="og:url"/gi)).toHaveLength(1);
    expect(out.match(/<meta[^>]*name="robots"/gi)).toHaveLength(1);
    expect(out.match(/application\/ld\+json/gi)).toHaveLength(1);
  });

  it("keeps exactly one title", () => {
    const out = applySeoHead(RENDERED_ABOUT, "/about");
    expect(out!.match(/<title>/g)).toHaveLength(1);
  });

  it("the homepage canonical keeps its trailing slash", () => {
    const out = applySeoHead(RENDERED_ABOUT, "/");
    expect(canonicals(out)).toHaveLength(1);
    expect(canonicalHref(out)).toBe(`${SITE}/`);
  });

  it("normalizeRenderedHead() behaves identically to applySeoHead()", () => {
    const a = applySeoHead(RENDERED_ABOUT, "/faq");
    const b = normalizeRenderedHead(RENDERED_ABOUT, "/faq");
    expect(canonicalHref(a!)).toBe(canonicalHref(b!));
    expect(canonicals(a!)).toHaveLength(1);
    expect(canonicals(b!)).toHaveLength(1);
  });

  it("a document without a head returns null instead of a broken page", () => {
    expect(applySeoHead("<p>no head here</p>", "/about")).toBeNull();
  });

  it("the static fallback path produces the SAME single canonical", () => {
    const shell = `<!DOCTYPE html><html><head><title>Shell</title>
      <link rel="canonical" href="${SITE}/" />
      <meta name="description" content="shell" />
      <meta name="robots" content="index, follow" />
      </head><body><div id="root"></div></body></html>`;
    const out = buildFallbackHtml(shell, "/results");
    expect(out).toBeTruthy();
    expect(canonicals(out!)).toHaveLength(1);
    expect(canonicalHref(out!)).toBe(`${SITE}/results`);
  });
});

describe("EMIS code — one identity across every layer", () => {
  it("the shared constant is the school's real code", () => {
    expect(SCHOOL_EMIS_CODE).toBe("60645");
  });

  it("appears in the JSON-LD graph of every public route", () => {
    for (const route of ["/", "/about", "/contact", "/admission", "/results", "/faq"]) {
      const out = applySeoHead(RENDERED_ABOUT, route);
      expect(out, route).toBeTruthy();
      expect(out, route).toContain(SCHOOL_EMIS_CODE);
    }
  });

  it("the static fallback carries it too", () => {
    const shell = `<!DOCTYPE html><html><head><title>Shell</title></head>
      <body><div id="root"></div></body></html>`;
    const out = buildFallbackHtml(shell, "/");
    expect(out).toBeTruthy();
    expect(out).toContain(SCHOOL_EMIS_CODE);
  });
});
