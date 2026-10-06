import type { MetadataRoute } from "next";

/**
 * Web app manifest — Master Plan §9.2 (Table 13).
 * Standalone display, portrait, brand theme colours, shortcuts to the
 * three highest-intent destinations, screenshots for richer install UI.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GHSS Ghallanai",
    short_name: "GHSS Ghallanai",
    description:
      "Government Higher Secondary School Ghallanai — admissions, results, notices and programmes, offline-capable.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#14532D",
    background_color: "#FAFDF7",
    categories: ["education"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/crest.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Result Lookup",
        short_name: "Results",
        url: "/results/lookup?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Apply Now",
        short_name: "Apply",
        url: "/admissions/apply?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Notices",
        short_name: "Notices",
        url: "/notices?source=pwa",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", form_factor: "narrow" },
    ],
  };
}
