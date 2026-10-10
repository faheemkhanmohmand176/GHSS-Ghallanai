"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

/**
 * CLIENT AUTH — browser-side session helpers (Babi Khel pattern).
 * The anon key + RLS do the enforcing; these helpers only READ identity so
 * the UI can show the right controls (admin shield, sign out, bell scope).
 */

export interface AdminProfile {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  avatar_url?: string | null;
}

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
  }
  return client;
}

/** Current session, or null in demo mode / signed out. */
export async function getSession(): Promise<Session | null> {
  const sb = supabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

/** Profile row for the signed-in user (role gates the admin UI). */
export async function getProfile(): Promise<AdminProfile | null> {
  const sb = supabaseBrowser();
  if (!sb) return null;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;
  const { data } = await sb
    .from("profiles")
    .select("id, full_name, role, avatar_url")
    .eq("id", uid)
    .maybeSingle();
  return (data as AdminProfile) ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  const sb = supabaseBrowser();
  if (!sb) return { ok: false as const, error: "Supabase is not configured on this deployment." };
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };
  // Verify the account really holds the admin role before entering /admin.
  const { data: profile } = await sb
    .from("profiles")
    .select("role, full_name")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") {
    await sb.auth.signOut();
    return { ok: false as const, error: "This account does not have administrator access." };
  }
  return { ok: true as const };
}

export async function signOut() {
  const sb = supabaseBrowser();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const sb = supabaseBrowser();
  if (!sb) return { ok: false as const, error: "Supabase is not configured on this deployment." };
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}/admin/login` : undefined,
  });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
