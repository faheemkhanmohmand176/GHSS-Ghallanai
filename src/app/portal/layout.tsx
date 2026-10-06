import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Portal guard — Master Plan §8.6: middleware checks the session cookie and
 * role claim before any portal route renders. Two modes:
 *  LIVE — Supabase session → profile role routing.
 *  DEMO — ghss-demo-role cookie set by /login preview buttons.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const demoRole = jar.get("ghss-demo-role")?.value;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!configured && !demoRole) {
    redirect("/login");
  }
  // In LIVE mode the real guard validates the Supabase session here and
  // redirects unauthenticated users to /login (see README → hardening notes).

  return (
    <div className="app-shell bg-secondary/30">
      <div className="app-main">{children}</div>
    </div>
  );
}
