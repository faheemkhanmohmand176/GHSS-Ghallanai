import type { Metadata, Viewport } from "next";
import { inter, playfair } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme";
import { SITE } from "@/content/site";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${SITE.fullName} — ICS, Pre-Medical, Pre-Engineering & Arts`,
    template: `%s — ${SITE.name}`,
  },
  description:
    "Government Higher Secondary School Ghallanai, Mohmand District, Khyber Pakhtunkhwa. Admissions, results, merit lists and programme guides for ICS, Pre-Medical, Pre-Engineering and Arts — from any phone, on any network.",
  keywords: [
    "GHSS Ghallanai",
    "Government Higher Secondary School Ghallanai",
    "admission Mohmand District",
    "ICS Ghallanai",
    "F.Sc pre-medical KPK",
    "FA arts college",
    "result lookup",
    "merit list Ghallanai",
  ],
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/crest.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: SITE.fullName,
    description: "Admissions, results and programme guides for Mohmand District's government higher secondary school.",
    siteName: SITE.name,
    locale: "en_PK",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: SITE.fullName },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14532D" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1F14" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="bright" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Theme before first paint — no wrong-theme flash (§5.3) */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
