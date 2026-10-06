import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SUPABASE — Master Plan §8.
 * The site runs in two modes:
 *  1. LIVE — env vars set → all reads/writes hit Supabase with RLS.
 *  2. DEMO — env vars absent → static content + demo data (safe to unzip & run).
 * isSupabaseConfigured() tells every data function which path to take.
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

/** Server-side Supabase client. Uses service role ONLY inside trusted
 *  route handlers (§8.6) — never expose the service key to the browser. */
export function getSupabaseServer(): SupabaseClient {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
