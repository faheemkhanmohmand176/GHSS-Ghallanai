import { SITE } from "@/content/site";

/** JSON-LD structured data — Master Plan §10.2 (five vocabularies). */

export function JsonLdSchool() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "School",
          name: SITE.fullName,
          alternateName: SITE.name,
          description: `Government higher secondary school in Ghallanai, Mohmand District, Khyber Pakhtunkhwa — ICS, Pre-Medical, Pre-Engineering and Arts programmes for grades 11 and 12.`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ghallanai",
            addressRegion: "Khyber Pakhtunkhwa",
            addressCountry: "PK",
          },
          geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
          telephone: SITE.phone,
          email: SITE.email,
          identifier: { "@type": "PropertyValue", name: "EMIS", value: "fill-from-office-records" },
        }),
      }}
    />
  );
}

export function JsonLdBreadcrumb({ items }: { items: { name: string; href: string }[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{ name: "Home", href: "/" }, ...items].map((it, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: it.name,
            item: it.href,
          })),
        }),
      }}
    />
  );
}

export function JsonLdCourse({ name, description, slug }: { name: string; description: string; slug: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Course",
          name,
          description,
          url: `/academics/${slug}`,
          provider: { "@type": "School", name: SITE.fullName, sameAs: "/" },
          educationalAlignment: {
            "@type": "AlignmentObject",
            alignmentType: "educationalLevel",
            targetName: "BISE Intermediate (Grades 11-12)",
          },
          inLanguage: "en",
        }),
      }}
    />
  );
}

export function JsonLdFaq({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      }}
    />
  );
}

export function JsonLdArticle({ title, description, date, slug }: { title: string; description: string; date: string; slug: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: title,
          description,
          datePublished: date,
          url: `/notices/${slug}`,
          publisher: { "@type": "Organization", name: SITE.fullName },
        }),
      }}
    />
  );
}
