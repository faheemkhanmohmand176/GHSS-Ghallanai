import { requireAdmin, getSessionUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

/**
 * Admin layout — role-gated shell.
 *
 * In LIVE mode (Supabase configured), requireAdmin() throws to /login if the
 * visitor is not signed in or not an admin. RLS at the DB layer enforces this
 * for every query — this guard is the UX layer.
 *
 * In DEMO mode (no env), the demo cookie set at /login is honored.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const session = await getSessionUser();

  return (
    <AdminShell user={session ?? user}>
      {children}
    </AdminShell>
  );
}
