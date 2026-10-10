"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, Search, ShieldCheck, LogIn, LogOut } from "lucide-react";
import { NAV, SITE } from "@/content/site";
import { CrestMark } from "./crest";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { Button } from "@/components/ui/button";
import { getProfile, signOut, supabaseBrowser } from "@/lib/auth";

/**
 * Header — Master Plan §4.3 + Babi Khel theme bar (English-only).
 *
 * RIGHT CONTROL CLUSTER ("theme bar", desktop):
 *   1. Search (⌘K command palette)
 *   2. Notification bell (broadcast alerts)
 *   3. Theme toggle (bright / dark)
 *   4. Sign In (gold pill) — or Admin shield + Sign Out when signed in
 *   5. Apply Now (admission CTA)
 *
 * Mobile: logo + bell + theme + hamburger → slide-in sheet with accordions,
 * 48px tap targets, Apply Now pinned to the bottom, staggered entrance.
 * The bar hides on scroll-down and reveals instantly on scroll-up.
 */

function isActive(pathname: string | undefined, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ admissionBanner }: { admissionBanner?: string | null }) {
  const [open, setOpen] = useState(false); // mobile sheet
  const [expanded, setExpanded] = useState<string | null>(null); // mobile accordion
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const pathname = usePathname();

  // Scroll state: shadow when scrolled; hide on scroll-down, show on scroll-up
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (!open && y > 72 && y > lastY + 4) setHidden(true);
      else if (y < lastY - 4 || y <= 72) setHidden(false);
      lastY = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  // UX-only admin detection (real enforcement is server-side + RLS)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session?.user || cancelled) return;
      const profile = await getProfile();
      if (!cancelled && profile?.role === "admin") setAdminName(profile.full_name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close sheet on navigation + lock body scroll while open
  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function handleSignOut() {
    await signOut();
    setAdminName(null);
    window.location.href = "/";
  }

  const openPalette = () => window.dispatchEvent(new Event("ghss:open-palette"));

  return (
    <>
      {/* Utility bar: admission status ribbon (§4.3, settings-driven) */}
      {SITE.admissionStatus.open && (
        <div className="bg-gold-soft text-center text-small py-1.5 px-4 border-b border-border/60 dark:bg-gold-soft/20">
          <Link
            href="/admissions/apply"
            className="font-medium text-foreground/90 hover:underline underline-offset-2"
          >
            📢 {admissionBanner ?? `${SITE.admissionStatus.label} — Apply online`}
          </Link>
        </div>
      )}

      <header
        className={`sticky top-0 z-50 border-b border-border/70 backdrop-blur supports-[backdrop-filter]:bg-background/85 transition-transform duration-200 ${
          scrolled ? "shadow-sm" : ""
        } ${hidden ? "-translate-y-full" : "translate-y-0"}`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
          {/* Logo lockup */}
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 py-1"
            aria-label={`${SITE.fullName} — home`}
          >
            <CrestMark className="h-10 w-10" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-[0.95rem] font-bold tracking-tight sm:text-[1.05rem]">
                GHSS <span className="text-gold">Ghallanai</span>
              </span>
              <span className="hidden text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:block">
                Govt. Higher Secondary School
              </span>
            </span>
          </Link>

          {/* Desktop mega-menu */}
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {NAV.map((item) =>
                "children" in item && item.children && item.children.length > 0 ? (
                  <li key={item.label} className="group relative">
                    <Link
                      href={item.href}
                      className={`flex items-center gap-1 rounded-md px-3 py-2.5 text-[0.92rem] font-semibold transition-colors hover:bg-secondary hover:text-foreground ${
                        isActive(pathname, item.href) ? "text-primary" : "text-foreground/80"
                      }`}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    >
                      {item.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    </Link>
                    {/* Mega panel: two-column preview with descriptions */}
                    <div className="invisible absolute left-1/2 top-full z-50 w-max min-w-72 -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-all duration-[180ms] group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <div className="rounded-xl border border-border bg-popover p-2 shadow-lg">
                        <div className="mb-1.5 h-0.5 rounded-full bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden />
                        <ul className="grid grid-cols-1 gap-0.5">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className="block rounded-lg px-3.5 py-2.5 transition-colors hover:bg-secondary"
                              >
                                <span className="block text-small font-semibold text-foreground">
                                  {child.label}
                                </span>
                                <span className="block text-xs text-muted-foreground">{child.desc}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-3 py-2.5 text-[0.92rem] font-semibold transition-colors hover:bg-secondary hover:text-foreground ${
                        isActive(pathname, item.href) ? "text-primary" : "text-foreground/80"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>

          {/* Right control cluster — the "theme bar" */}
          <div className="flex items-center gap-1">
            {/* 1 — Search (⌘K) — hidden below md (keyboard shortcut is
                desktop-only; the palette stays reachable from wide screens) */}
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search the site (Ctrl+K)"
              className="button-press group hidden h-11 w-11 items-center justify-center rounded-full text-foreground/80 hover:bg-secondary hover:text-foreground md:inline-flex"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>

            {/* 2 — Notification bell */}
            <NotificationBell isAdmin={Boolean(adminName)} />

            {/* 3 — Theme toggle */}
            <ThemeToggle />

            {/* 4 — Sign In / Admin shield */}
            {adminName ? (
              <div className="hidden items-center gap-1 md:flex">
                <Link
                  href="/admin"
                  aria-label="Open the admin dashboard"
                  title={`Admin: ${adminName}`}
                  className="button-press inline-flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-secondary"
                >
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="button-press inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground/70 hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5" aria-hidden />
                </button>
              </div>
            ) : (
              <Button
                asChild
                size="sm"
                className="button-press hidden h-11 rounded-full bg-gold px-5 font-bold text-[#1A2E22] hover:bg-gold-strong md:inline-flex"
              >
                <Link href="/admin/login">
                  <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Sign In
                </Link>
              </Button>
            )}

            {/* 5 — Apply Now */}
            <Button
              asChild
              size="sm"
              className="button-press hidden h-11 rounded-full px-5 font-semibold xl:inline-flex"
            >
              <Link href="/admissions/apply">Apply Now</Link>
            </Button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="button-press inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary active:bg-secondary lg:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </div>

        {/* Gold spotlight hairline */}
        <div
          aria-hidden
          className="h-0.5 bg-gradient-to-r from-transparent via-gold/70 to-transparent"
        />
      </header>

      {/* Mobile slide-in sheet (§4.3) */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden"
        >
          {/* Backdrop layer behind the panel for depth */}
          <div className="sheet-backdrop pointer-events-none absolute inset-0 bg-primary-strong/20 lg:hidden" />

          <div className="sheet-panel relative flex h-full w-full flex-col bg-background">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5" aria-label="Home">
                <CrestMark className="h-9 w-9" />
                <span className="font-display text-lg font-bold">
                  GHSS <span className="text-gold">Ghallanai</span>
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="button-press inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary active:bg-secondary"
                >
                  <X className="h-6 w-6" aria-hidden />
                </button>
              </div>
            </div>

            <nav aria-label="Mobile" className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
              <ul>
                {NAV.map((item, idx) => (
                  <li
                    key={item.label}
                    className="border-b border-border/60 last:border-0 item-slide"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {"children" in item && item.children && item.children.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                          aria-expanded={expanded === item.label}
                          className={`flex min-h-12 w-full items-center justify-between py-3 text-left text-base font-semibold ${
                            isActive(pathname, item.href) ? "text-primary" : ""
                          }`}
                        >
                          {item.label}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${
                              expanded === item.label ? "rotate-180" : ""
                            }`}
                            aria-hidden
                          />
                        </button>
                        {expanded === item.label && (
                          <ul className="pb-2 pl-3">
                            <li>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="flex min-h-12 items-center rounded-lg px-3 py-3 text-small font-semibold text-primary hover:bg-secondary"
                              >
                                {item.label} overview →
                              </Link>
                            </li>
                            {item.children.map((child) => (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className="flex min-h-12 flex-col justify-center rounded-lg px-3 py-2 hover:bg-secondary"
                                >
                                  <span className="text-small font-semibold">{child.label}</span>
                                  <span className="text-xs text-muted-foreground">{child.desc}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-12 items-center py-3 text-base font-semibold ${
                          isActive(pathname, item.href) ? "text-primary" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>

              {/* Account section */}
              <div className="mt-4 space-y-1 rounded-xl border border-border bg-secondary/40 p-3">
                {adminName ? (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-small font-bold text-primary hover:bg-secondary"
                    >
                      <ShieldCheck className="h-4.5 w-4.5" aria-hidden /> Admin Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-small font-semibold hover:bg-secondary"
                    >
                      <LogOut className="h-4.5 w-4.5" aria-hidden /> Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/admin/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-small font-bold text-primary hover:bg-secondary"
                  >
                    <LogIn className="h-4.5 w-4.5" aria-hidden /> Sign In (Staff & Admin)
                  </Link>
                )}
              </div>
            </nav>

            {/* Apply Now pinned to bottom */}
            <div className="border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button asChild className="button-press h-12 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/25">
                <Link href="/admissions/apply" onClick={() => setOpen(false)}>Apply Now</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
