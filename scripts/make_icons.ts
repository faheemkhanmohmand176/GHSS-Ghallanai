// GHSS Ghallanai — brand crest + PWA icon exports
// Crest per Master Plan §5.1: shield + open book + rising peak, emerald/gold
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";

const GOLD = "#B8860B";
const GOLD_LIGHT = "#D4A017";
const GREEN_DEEP = "#0E3B20";
const GREEN = "#14532D";
const GREEN_MID = "#2b8659";
const GREEN_LIGHT = "#7FBF9B";
const CREAM = "#FAFDF7";

function crestSvg({ maskable = false } = {}) {
  // For maskable: same art, safely inside 80% safe zone (scale 0.72, centered)
  const scale = maskable ? 0.72 : 1;
  const art = `
    <!-- Rising peaks (Mohmand hills) -->
    <path d="M116 236 L170 158 L206 206 L232 168 L296 236 Z" fill="${GREEN_MID}" opacity="0.92"/>
    <path d="M170 158 L206 206 L232 168 L296 236 L262 236 L216 190 L184 226 L146 226 Z" fill="${GREEN_DEEP}" opacity="0.35"/>
    <!-- Open book with 4 leaf pairs = 4 programmes -->
    <g>
      <path d="M256 322 C 226 300 190 296 158 300 L158 352 C 190 348 226 352 256 372 C 286 352 322 348 354 352 L354 300 C 322 296 286 300 256 322 Z" fill="${GOLD}"/>
      <path d="M256 322 C 226 300 190 296 158 300 L158 312 C 190 308 226 312 256 332 C 286 312 322 308 354 312 L354 300 C 322 296 286 300 256 322 Z" fill="${GOLD_LIGHT}" opacity="0.85"/>
      <path d="M256 332 C 226 312 190 308 158 312 L158 352 C 190 348 226 352 256 372 C 286 352 322 348 354 352 L354 312 C 322 308 286 312 256 332 Z" fill="${GOLD}" opacity="0.94"/>
      <!-- book spine -->
      <rect x="252" y="318" width="8" height="56" rx="3" fill="${GREEN_DEEP}"/>
      <!-- leaf pair separators (4 programmes) -->
      <path d="M196 306 L196 352" stroke="${GREEN_DEEP}" stroke-width="4" opacity="0.5"/>
      <path d="M316 306 L316 352" stroke="${GREEN_DEEP}" stroke-width="4" opacity="0.5"/>
    </g>
    <!-- Rising sun rays above peaks -->
    <circle cx="256" cy="128" r="20" fill="${GOLD_LIGHT}"/>
    <g stroke="${GOLD_LIGHT}" stroke-width="8" stroke-linecap="round" opacity="0.9">
      <path d="M256 96 L256 82"/>
      <path d="M222 106 L212 92"/>
      <path d="M290 106 L300 92"/>
    </g>
    <!-- Banner ribbon -->
    <path d="M150 398 L362 398 L350 428 L362 458 L150 458 L162 428 Z" fill="${GREEN}"/>
    <text x="256" y="436" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="22" letter-spacing="3" fill="${GOLD_LIGHT}">GHSS</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GREEN}"/>
      <stop offset="1" stop-color="${GREEN_DEEP}"/>
    </linearGradient>
  </defs>
  ${maskable ? `<rect width="512" height="512" fill="${GREEN_DEEP}"/>` : ""}
  <g transform="translate(${256 - 256 * scale}, ${256 - 256 * scale}) scale(${scale})">
    <!-- Shield -->
    <path d="M256 64 L416 104 L416 240 C 416 330 352 400 256 448 C 160 400 96 330 96 240 L96 104 Z"
      fill="url(#shieldGrad)" stroke="${GOLD}" stroke-width="10"/>
    <path d="M256 84 L396 119 L396 240 C 396 320 340 382 256 426 C 172 382 116 320 116 240 L116 119 Z"
      fill="none" stroke="${GOLD_LIGHT}" stroke-width="3" opacity="0.55"/>
    ${art}
  </g>
</svg>`;
}

mkdirSync("public/icons", { recursive: true });
mkdirSync("src/components/site", { recursive: true });

// Master SVG (for site logo use)
writeFileSync("public/icons/crest.svg", crestSvg());

const jobs = [
  ["crest.svg", "icon-192.png", 192],
  ["crest.svg", "icon-512.png", 512],
  ["crest.svg", "apple-touch-icon.png", 180],
  ["crest.svg", "favicon-32.png", 32],
].map(([src, out, size]) =>
  sharp(Buffer.from(crestSvg())).resize(size, size).png().toFile(`public/icons/${out}`)
);

const maskable = [
  ["icon-maskable-192.png", 192],
  ["icon-maskable-512.png", 512],
].map(([out, size]) =>
  sharp(Buffer.from(crestSvg({ maskable: true }))).resize(size, size).png().toFile(`public/icons/${out}`)
);

// Wordmark lockup for header (horizontal crest + text)
const lockup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 140" width="640" height="140">
  <g transform="translate(8,4) scale(0.256)">
    ${crestSvg().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}
  </g>
</svg>`;
writeFileSync("public/icons/crest-lockup.svg", lockup);

await Promise.all([...jobs, ...maskable]);
console.log("icons done");
