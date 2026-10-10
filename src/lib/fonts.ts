import localFont from "next/font/local";

/**
 * Self-hosted variable fonts — Master Plan §5.4 & §11.1.
 * Total site font cost: ~86KB (Inter 48KB + Playfair 38KB).
 * All fonts use display:swap with metric-compatible fallbacks (no CLS).
 */
export const inter = localFont({
  src: "../fonts/inter-var.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  preload: true,
});

export const playfair = localFont({
  src: "../fonts/playfair-var.woff2",
  variable: "--font-playfair",
  display: "swap",
  weight: "400 900",
  fallback: ["Georgia", "Times New Roman", "serif"],
  preload: true,
});
