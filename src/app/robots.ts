import type { MetadataRoute } from "next";

/** robots.txt — Master Plan §10.1: public routes allowed, portals/admin disallowed. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/portal", "/login", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
