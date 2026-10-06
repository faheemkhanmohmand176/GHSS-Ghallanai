import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SUPABASE — Browser-safe client.
 *
 * The site runs in two modes:
 *  1. LIVE — env vars set → all reads/writes hit Supabase with RLS.
 *  2. DEMO — env vars absent → static content + demo data (safe to unzip & run).
 *
 * Server-side code uses `@/lib/supabase-server` instead (which depends on
 * next/headers and cannot be imported by client components).
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

let browserClient: SupabaseClient | null = null;

/** Browser-side Supabase client (anon key; RLS protects every table). */
export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
  }
  return browserClient;
}

/**
 * Service-role client — bypasses RLS. Use ONLY in trusted route handlers where
 * RLS would otherwise block a legitimate server-side operation (e.g. sending
 * a notification, recording analytics). NEVER expose this key to the browser.
 *
 * Note: this function reads SUPABASE_SERVICE_ROLE_KEY from process.env which
 * is only available server-side. Calling it from a client component will
 * throw at runtime — by design.
 */
export function getSupabaseService(): SupabaseClient {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
