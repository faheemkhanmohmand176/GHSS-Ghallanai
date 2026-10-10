import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * EDGE SECURITY PROXY (Babi Khel middleware pattern, Next.js 16 edition).
 *
 * Layers, in order:
 *   1. Attack-tool user-agent blocking — word-boundary, escaped, case-
 *      insensitive match on known scanners (sqlmap, nikto, …). Never add a
 *      bare "bot" token — that would block Googlebot.
 *   2. Tiered in-memory rate limiting per fingerprint (ip + ua prefix):
 *      pages 100/60s · admin/api 30/60s · ai-chat 10/60s.
 *   3. Admin cookie gate — /admin/* without an sb-*-auth-token cookie
 *      redirects to /admin/login (the layout + RLS still do real checks).
 *   4. Security headers on every response.
 *
 * Demo mode (no Supabase env): the admin gate is skipped so the console
 * stays open with its DEMO banner.
 */

const ATTACK_TOOLS = [
  "sqlmap", "nikto", "dirbuster", "nmap", "masscan", "zgrab", "gobuster",
  "wfuzz", "hydra", "medusa", "ncrack", "arachni", "w3af", "skipfish",
  "whatweb", "nuclei", "aquatone", "amass", "subfinder", "python-requests",
  "go-http-client",
];

const ATTACK_RE = new RegExp(`\\b(${ATTACK_TOOLS.map((t) => t.replace(/[-]/g, "\\-")).join("|")})\\b`, "i");

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

function rateKey(request: NextRequest): string {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase().slice(0, 50);
  return `${ip}:${ua}`;
}

function limit(key: string, max: number, windowMs: number): { blocked: boolean; retryAfter: number } {
  const now = Date.now();
  if (now - lastCleanup > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    lastCleanup = now;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { blocked: false, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { blocked: true, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(self)");
  response.headers.set("X-DNS-Prefetch-Control", "on");
  return response;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Attack-tool blocking ────────────────────────────────────────────
  const ua = request.headers.get("user-agent") ?? "";
  if (ATTACK_RE.test(ua) || /^$/.test(ua) || /^[A-Z]{20,}$/.test(ua)) {
    const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    res.headers.set("X-Block-Reason", "attack-tool");
    return withSecurityHeaders(res);
  }

  // ── 2. Rate limiting ────────────────────────────────────────────────────
  const key = rateKey(request);
  let max = 100;
  let windowMs = 60_000;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) {
    max = 30;
    windowMs = 60_000;
  }
  if (pathname.startsWith("/api/ai-chat")) {
    max = 10;
    windowMs = 60_000;
  }
  const { blocked, retryAfter } = limit(key, max, windowMs);
  if (blocked) {
    const res = NextResponse.json({ error: "Too many requests." }, { status: 429 });
    res.headers.set("Retry-After", String(Math.max(1, retryAfter)));
    return withSecurityHeaders(res);
  }

  // ── 3. Admin cookie gate (cheap presence check; real verification is in
  //       the admin layout + RLS) ──────────────────────────────────────────
  const live = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (live && pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => /^sb-[a-z0-9]+-auth-token$/i.test(c.name));
    if (!hasAuthCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return withSecurityHeaders(NextResponse.redirect(url));
    }
  }

  // ── 4. Pass through with hardened headers ───────────────────────────────
  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml).*)"],
};
