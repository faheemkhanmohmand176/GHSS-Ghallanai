import { requireAdmin } from "@/lib/auth-server";

/**
 * Admin shell — role-gated (§8.6, Babi Khel security model).
 *
 * LIVE MODE (Supabase configured): every /admin/* render verifies the JWT
 * from the auth cookie AND the profiles.role = 'admin' row. Anything less
 * redirects to /admin/login. RLS re-enforces every write in the database,
 * so even a bypassed UI gate cannot mutate data.
 *
 * DEMO MODE: the console stays open with a DEMO banner (safe unzip & run).
 * The sign-in screen lives at /admin/login outside this gated layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
