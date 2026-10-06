import { requireUser } from "@/lib/auth";

/**
 * Portal layout — auth-gated shell for students and teachers.
 * In LIVE mode requireUser() throws to /login if not signed in.
 * Each portal page (student/teacher) renders its own PortalChrome
 * with the appropriate title/subtitle/tabs.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="app-shell bg-secondary/30">
      <div className="app-main">{children}</div>
    </div>
  );
}
