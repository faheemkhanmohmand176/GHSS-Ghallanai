import type { MetadataRoute } from "next";
import { PROGRAMMES } from "@/content/programmes";

/**
 * Dynamic sitemap — Master Plan §10.1.
 * Static routes + programme pages.
 * In production, news/merit entries join from the database at request time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: "/", changeFrequency: "daily", priority: 1, lastModified: now },
    { url: "/about", changeFrequency: "monthly", priority: 0.7 },
    { url: "/about/principal", changeFrequency: "yearly", priority: 0.5 },
    { url: "/about/faculty", changeFrequency: "monthly", priority: 0.6 },
    { url: "/academics", changeFrequency: "monthly", priority: 0.8 },
    { url: "/admissions", changeFrequency: "weekly", priority: 0.9 },
    { url: "/admissions/eligibility", changeFrequency: "monthly", priority: 0.8 },
    { url: "/admissions/fees", changeFrequency: "monthly", priority: 0.8 },
    { url: "/admissions/faq", changeFrequency: "monthly", priority: 0.6 },
    { url: "/admissions/apply", changeFrequency: "weekly", priority: 0.95 },
    { url: "/results", changeFrequency: "weekly", priority: 0.9 },
    { url: "/results/lookup", changeFrequency: "weekly", priority: 0.95 },
    { url: "/results/merit-list", changeFrequency: "weekly", priority: 0.8 },
    { url: "/results/toppers", changeFrequency: "monthly", priority: 0.6 },
    { url: "/notices", changeFrequency: "daily", priority: 0.8 },
    { url: "/gallery", changeFrequency: "weekly", priority: 0.5 },
    { url: "/library", changeFrequency: "weekly", priority: 0.6 },
    { url: "/calendar", changeFrequency: "weekly", priority: 0.6 },
    { url: "/contact", changeFrequency: "monthly", priority: 0.7 },
  ];

  const programmeRoutes: MetadataRoute.Sitemap = PROGRAMMES.map((p) => ({
    url: `/academics/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.85,
    lastModified: now,
  }));

  return [...staticRoutes, ...programmeRoutes].map((r) => ({ ...r, url: `${base}${r.url}` }));
}
