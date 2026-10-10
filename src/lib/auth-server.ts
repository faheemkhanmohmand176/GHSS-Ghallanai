import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * SERVER-SIDE ADMIN GATE (Babi Khel security model, Next.js edition).
 *
 * Defense in depth:
 *   1. middleware.ts — bounces /admin/* visitors with no auth cookie at all.
 *   2. THIS file (called from src/app/admin/layout.tsx) — verifies the JWT
 *      with Supabase Auth AND requires profiles.role = 'admin'.
 *   3. RLS policies (0007) — every admin write re-checks is_admin() in the
 *      database, so even a bypassed UI gate cannot mutate data.
 *
 * Demo mode (no Supabase env): the console stays open with a DEMO banner.
 */

export interface AdminSession {
  userId: string;
  email: string | null;
  fullName: string;
}

/** Find the Supabase auth cookie and extract the access token. */
async function readAccessToken(jar: Awaited<ReturnType<typeof cookies>>): Promise<string | null> {
  const pattern = /^sb-[a-z0-9]+-auth-token$/i;
  for (const [name, value] of jar.getAll().map((c) => [c.name, c.value] as const)) {
    if (!pattern.test(name)) continue;
    try {
      const raw = decodeURIComponent(value);
      // Cookie v1 stores JSON; base64 variants store a encoded payload.
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        if (parsed.access_token) return parsed.access_token as string;
      } else {
        const decoded = Buffer.from(raw, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) return parsed.access_token as string;
      }
    } catch {
      /* try the next cookie */
    }
  }
  return null;
}

/** Verify the session + admin role. Returns null when not an admin. */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const jar = await cookies();
    const token = await readAccessToken(jar);
    if (!token) return null;

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData.user) return null;

    const { data: profile } = await sb
      .from("profiles")
      .select("role, full_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile || profile.role !== "admin") return null;

    return {
      userId: userData.user.id,
      email: userData.user.email ?? null,
      fullName: (profile.full_name as string) ?? "Administrator",
    };
  } catch {
    return null;
  }
}

/**
 * Gate used by the admin layout: redirects to the sign-in page when the
 * deployment is LIVE and the visitor is not a verified administrator.
 * `next` lets the login page send the person back where they were going.
 */
export async function requireAdmin(nextPath?: string): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null; // demo mode — open with banner
  const session = await getAdminSession();
  if (!session) {
    const target = nextPath ? `/admin/login?next=${encodeURIComponent(nextPath)}` : "/admin/login";
    redirect(target);
  }
  return session;
}
