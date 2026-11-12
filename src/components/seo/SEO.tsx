import { Helmet } from "react-helmet-async";

export const SITE_URL  = "https://ghssghallanai.dpdns.org";
export const SITE_NAME = "GHSS Ghallanai";

// EMIS code — the Government of Khyber Pakhtunkhwa identifier of this school
// (Elementary & Secondary Education Department). It is a unique, non-generic
// token for the institution, so it belongs in the structured data, the meta
// layer and the machine-readable feeds: it is what lets Google attach this
// site to the RIGHT school entity instead of to a generic secondary school.
//
// The single source of truth is scripts/site-routes.mjs (SCHOOL_EMIS_CODE).
// The value is duplicated here as a literal because this module is imported
// by the browser bundle, which cannot import the build-time .mjs scripts.
// scripts/prerender-lib.mjs asserts on every build that the two values match.
export const EMIS_CODE = "60645";

// ✅ OG image: actual file is 1200×630 px (public/og-image.png)
const DEFAULT_IMAGE        = `${SITE_URL}/og-image.png`;
const DEFAULT_IMAGE_WIDTH  = "1200";
const DEFAULT_IMAGE_HEIGHT = "630";

// ✅ Twitter handle — update to your real @handle or set to "" to omit
const TWITTER_SITE = "@GHSSGhallanai";

export interface SEOProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  imageWidth?: string;
  imageHeight?: string;
  keywords?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
  breadcrumbs?: { name: string; path: string }[];
  /** Pass true on pages that have Urdu content — adds ur hreflang */
  hasUrdu?: boolean;
  /** ISO 8601 date string for article:published_time OG tag */
  publishedTime?: string;
  /** ISO 8601 date string for article:modified_time OG tag */
  modifiedTime?: string;
}

/**
 * SEO component — additive only. Uses react-helmet-async to inject
 * meta tags, Open Graph, Twitter cards, canonical, hreflang, and JSON-LD.
 */
const SEO = ({
  title,
  description,
  path = "",
  image = DEFAULT_IMAGE,
  imageWidth = DEFAULT_IMAGE_WIDTH,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  keywords,
  type = "website",
  noIndex = false,
  jsonLd,
  breadcrumbs,
  hasUrdu = false,
  publishedTime,
  modifiedTime,
}: SEOProps) => {
  const fullTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;

  // Canonical URL (SEO audit fix): the HOMEPAGE keeps its trailing slash
  // (https://…/) so the client-rendered canonical is byte-identical with the
  // sitemap entry, the static shell canonical in index.html and the
  // prerendered canonical from scripts/seo-page-content.mjs. The old code
  // stripped the slash from "/" via .replace(/\/$/, ""), producing
  // https://…dpdns.org (no slash) in the hydrated DOM while every other
  // layer said https://…dpdns.org/ — a needless inconsistency across the
  // same URL's canonical signals. Every other route stays slash-less,
  // matching the middleware's 308 /index.html canonicalisation.
  const url =
    path === "/" || path === ""
      ? `${SITE_URL}/`
      : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`.replace(/\/+$/, "") ||
        SITE_URL;

  const schemas: Record<string, any>[] = [];
  if (jsonLd) {
    if (Array.isArray(jsonLd)) schemas.push(...jsonLd);
    else schemas.push(jsonLd);
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: `${SITE_URL}${b.path.startsWith("/") ? b.path : `/${b.path}`}`,
      })),
    });
  }

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="author" content={SITE_NAME} />
      <meta
        name="robots"
        content={
          noIndex
            ? "noindex, nofollow"
            : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        }
      />

      {/* ✅ Canonical — prevents duplicate-content issues for every page */}
      <link rel="canonical" href={url} />

      {/* ✅ hreflang (SEO audit): self-referencing en-PK + x-default for this
          single-language site. The previous removal targeted the OLD code,
          which emitted en-PK AND ur alternates that all pointed at the SAME
          URL — a genuinely conflicting language signal. A single
          self-referencing en-PK pair is the documented single-language
          pattern: each alternate names THIS page for its own locale, so
          nothing can conflict, and Google receives an explicit Pakistan
          targeting hint. Urdu-specific URLs can be added later as real
          alternates once they exist. */}
      <link rel="alternate" hrefLang="en-PK" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content={imageWidth} />
      <meta property="og:image:height" content={imageHeight} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_PK" />
      {hasUrdu && <meta property="og:locale:alternate" content="ur_PK" />}
      {type === "article" && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {type === "article" && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* ✅ Twitter — twitter:site added so card is attributed to school handle */}
      <meta name="twitter:card" content="summary_large_image" />
      {TWITTER_SITE && <meta name="twitter:site" content={TWITTER_SITE} />}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={fullTitle} />

      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
export { DEFAULT_IMAGE };
