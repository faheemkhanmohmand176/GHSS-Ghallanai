import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * MIDDLEWARE — Master Plan §11.3.
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth session on every request (cookies out-of-date
 *      by 1+ hour are silently refreshed via @supabase/ssr).
 *   2. Inject x-path header so server components / auth helpers can read the
 *      current path without recomputing it.
 *   3. Block obvious malicious bots (sqlmap, nikto, curl probes) before they
 *      touch the DB.
 *   4. Demo-mode fallback: when Supabase env vars are absent, the demo cookie
 *      set at /login is the only gate.
 *
 * NOTE: this is a Next.js Edge middleware (Vercel runtime). Per-IP rate limiting
 * is implemented in individual route handlers (the stateful in-memory Map
 * pattern does not survive across edge instances).
 */

const BLOCKED_UA = [
  "sqlmap", "nikto", "nmap", "masscan", "dirbuster", "gobuster", "wpscan",
  "acunetix", "nessus", "arachni", "zap", "skipfish",
];

export async function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent")?.toLowerCase() ?? "";
  if (BLOCKED_UA.some((b) => ua.includes(b))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const res = NextResponse.next({
    request: { headers: req.headers },
  });

  // Inject the current path so server components can read it.
  res.headers.set("x-path", req.nextUrl.pathname);

  // Refresh Supabase session (only if configured)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                res.cookies.set(name, value, options);
              });
            },
          },
        }
      );
      // getUser() will refresh the session if needed and update the cookies
      // via the setAll callback above.
      await supabase.auth.getUser();
    } catch {
      // ignore — auth will be re-tried in the server component
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *   - static assets (/_next/static, /_next/image, /icons, /fonts, /sw.js)
     *   - public files (favicon, manifest)
     *   - OG image / API routes that handle their own auth
     */
    "/((?!_next/static|_next/image|icons|fonts|sw.js|favicon.ico|favicon-16.png|favicon-32.png|apple-touch-icon.png|manifest.webmanifest|og-image.jpg|robots.txt|sitemap.xml|api).*)",
  ],
};
