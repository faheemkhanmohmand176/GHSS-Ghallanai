import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SUPABASE SSR — server-only module.
 *
 * Use `getSupabaseServer()` inside Server Components, Route Handlers, Server
 * Actions and middleware. It reads the auth session from the Next.js cookie
 * jar so RLS sees the user.
 *
 * Client components import from `@/lib/supabase` instead.
 */

export async function getSupabaseServer(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              jar.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore (middleware refreshes).
          }
        },
      },
    }
  ) as unknown as SupabaseClient;
}

/**
 * Service-role client — bypasses RLS. Use ONLY in trusted route handlers where
 * RLS would otherwise block a legitimate server-side operation.
 */
export function getSupabaseService(): SupabaseClient {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
