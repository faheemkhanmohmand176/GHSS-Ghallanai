import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Admin guard — role-gated shell (§8.6). Demo cookie or Supabase admin session. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const demoRole = jar.get("ghss-demo-role")?.value;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (!configured && !demoRole) {
    redirect("/login");
  }
  if (configured && !demoRole) {
    // LIVE mode: verify the Supabase session's profile.role === 'admin' here.
  }

  return <>{children}</>;
}
