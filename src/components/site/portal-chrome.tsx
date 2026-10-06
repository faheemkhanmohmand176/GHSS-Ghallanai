"use client";

/**
 * Portal chrome — bottom navigation bar on mobile (§9.4),
 * sidebar rail on desktop. Shared by student and teacher portals.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Badge } from "@/components/ui/badge";

export interface PortalTab {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | undefined }>;
}

export function PortalChrome({
  title,
  subtitle,
  badge,
  tabs,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  tabs: PortalTab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const demo = typeof document !== "undefined" && document.cookie.includes("ghss-demo-role") ||
    (typeof window !== "undefined" && !window.location.origin.includes("supabase"));

  return (
    <div className="min-h-svh">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <CrestMark className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-small font-bold leading-tight">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
            {badge && (
              <Badge variant="outline" className="hidden border-gold/50 text-gold-strong sm:inline-flex dark:text-gold">
                {badge}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full px-3 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Switch
            </Link>
          </div>
        </div>
        {/* Desktop tabs */}
        <nav aria-label="Portal sections" className="mx-auto hidden max-w-6xl px-6 md:block">
          <ul className="flex gap-1">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-small font-semibold transition-colors ${
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="h-4 w-4" aria-hidden />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 md:pb-10">{children}</main>

      {/* Mobile bottom nav (§9.4) */}
      <nav
        aria-label="Portal sections"
        className="fixed bottom-0 left-0 right-0 z-40 grid border-t border-border bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
      >
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-semibold ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-5 w-5" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function DemoBanner({ mode }: { mode: string }) {
  return (
    <p className="mb-5 rounded-xl border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground dark:bg-gold-soft/20">
      <span className="font-bold">DEMO MODE · {mode}.</span> Screens show SAMPLE data. Configure
      Supabase (README → Setup) to load live records behind row-level security — every screen and
      interaction you see here maps one-to-one onto the production queries.
    </p>
  );
}
