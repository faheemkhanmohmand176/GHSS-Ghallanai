import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase-server";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * AUTH HELPERS — server-side only.
 *
 * The site supports two modes (see supabase.ts):
 *   1. LIVE — env vars set. Real Supabase auth + RLS.
 *   2. DEMO — env vars absent. Anyone can preview the admin/portal UI with the
 *      demo cookie set at /login (ghss-demo-role = student | teacher | admin).
 *
 * These helpers hide the difference so layout files stay clean.
 */

export type Role = "student" | "teacher" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

const DEMO_COOKIE = "ghss-demo-role";

function demoRoleFrom(value: string | undefined): Role | null {
  if (value === "student" || value === "teacher" || value === "admin") return value;
  return null;
}

/** Returns the current session user, or null when not signed in. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // DEMO mode: no Supabase env → look at the demo cookie.
  if (!isSupabaseConfigured()) {
    const jar = await import("next/headers").then((m) => m.cookies());
    const role = demoRoleFrom(jar.get(DEMO_COOKIE)?.value);
    if (!role) return null;
    return {
      id: `demo-${role}`,
      email: `${role}@ghssghallanai.edu.pk`,
      full_name: `Demo ${role}`,
      role,
    };
  }

  // LIVE mode: read the SSR cookie session.
  const sb = await getSupabaseServer();
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile?.full_name ?? user.email ?? "Unnamed",
    role: (profile?.role as Role) ?? "student",
  };
}

/** Throws to /login if not signed in. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) {
    const next = await getNextPath();
    redirect("/login?next=" + encodeURIComponent(next));
  }
  return u!;
}

/** Throws to /login if not signed in or not an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "admin") {
    const next = await getNextPath();
    redirect("/login?next=" + encodeURIComponent(next) + "&reason=role");
  }
  return u;
}

/** Throws to /login if not signed in or not a teacher/admin. */
export async function requireStaff(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "teacher" && u.role !== "admin") {
    const next = await getNextPath();
    redirect("/login?next=" + encodeURIComponent(next) + "&reason=role");
  }
  return u;
}

// next/headers can only be read inside server components / route handlers,
// so we peek the current path from headers() (set by middleware).
async function getNextPath(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    return h.get("x-path") ?? "/";
  } catch {
    return "/";
  }
}
