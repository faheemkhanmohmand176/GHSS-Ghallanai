import { Helmet } from "react-helmet-async";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { SITE_URL, SITE_NAME } from "./SEO";

/**
 * Site-wide JSON-LD schemas: Organization, HighSchool (with full address),
 * WebSite (with SearchAction). Mounted once at app root.
 *
 * Phone, email, address and principal name are pulled LIVE from the
 * school_settings table (the same values the admin edits in the dashboard),
 * so a stale value here can never disagree with what the admin just saved.
 *
 * The fallbacks below are only used if the settings fetch fails.
 *
 * `sameAs` lists the school's official Facebook page (from Contact.tsx)
 * so Google connects the website + Facebook page into one entity.
 */
const SiteSchema = () => {
  const { data: settings } = useSchoolSettings();

  const ogImage = `${SITE_URL}/og-image.png`;
  const logoIcon = `${SITE_URL}/apple-touch-icon.png`;

  // ── Live contact data ──
  const phone = (settings?.phone || "").trim();
  const email = (settings?.email || "").trim();
  const principal = (settings?.principal_name || "").trim();

  // Use live coordinates when the admin has set them; otherwise the
  // district defaults (these match the fallbackSettings in useSchoolSettings).
  const lat = settings?.location_lat ?? 34.6403;
  const lng = settings?.location_lng ?? 71.3080;

  const organization: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "HighSchool"],
    "@id": `${SITE_URL}#organization`,
    name: settings?.school_name || "Government Higher Secondary School Ghallanai",
    alternateName: SITE_NAME,
    url: SITE_URL,
    logo: logoIcon,
    image: ogImage,
    ...(settings?.established_year ? { foundingDate: String(settings.established_year) } : {}),
    description:
      settings?.description ||
      "Government Higher Secondary School Ghallanai — quality education and excellence, District Mohmand, KPK Pakistan.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Ghallanai",
      addressLocality: "Ghallanai",
      addressRegion: "Khyber Pakhtunkhwa",
      addressCountry: "PK",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: String(lat),
      longitude: String(lng),
    },
    hasMap: `https://maps.google.com/?q=${lat},${lng}`,
    telephone: phone,
    email: email,
    areaServed: {
      "@type": "AdministrativeArea",
      name: "District Mohmand, Khyber Pakhtunkhwa, Pakistan",
    },
    // Official Facebook page — connects website + FB into ONE Google entity.
    sameAs: ["https://www.facebook.com/share/1EERTSk1W7/"],
  };

  // Principal as a named employee (richer Knowledge Panel) — only emitted
  // when the admin has actually set a principal name in the dashboard.
  if (principal) {
    organization.employee = [
      {
        "@type": "Person",
        name: principal,
        jobTitle: "Principal",
        worksFor: { "@id": `${SITE_URL}#organization` },
      },
    ];
  }

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: { "@id": `${SITE_URL}#organization` },
    inLanguage: ["en", "ur"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(organization)}</script>
      <script type="application/ld+json">{JSON.stringify(website)}</script>
    </Helmet>
  );
};

export default SiteSchema;
