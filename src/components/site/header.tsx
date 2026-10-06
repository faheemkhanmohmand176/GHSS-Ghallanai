"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, LogIn, Languages } from "lucide-react";
import { NAV, SITE } from "@/content/site";
import { CrestMark } from "./crest";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Header — Master Plan §4.3.
 * Desktop: crest, primary items with mega-panels, theme toggle, Urdu link, Apply Now.
 * Mobile: logo + theme toggle + hamburger → full-screen sheet with accordions,
 * 48px tap targets, Apply Now pinned to the bottom.
 */

export function SiteHeader() {
  const [open, setOpen] = useState(false); // mobile sheet
  const [expanded, setExpanded] = useState<string | null>(null); // mobile accordion
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const isUrduPage = pathname?.startsWith("/ur");

  return (
    <>
      {/* Utility bar: admission status ribbon (§4.3) */}
      {SITE.admissionStatus.open && (
        <div className="bg-gold-soft text-center text-small py-1.5 px-4 border-b border-border/60">
          <Link
            href={isUrduPage ? "/ur/admissions/apply" : "/admissions/apply"}
            className="font-medium text-foreground/90 hover:underline underline-offset-2"
          >
            📢 {SITE.admissionStatus.label} — <span className="font-semibold">Apply online</span>
          </Link>
        </div>
      )}

      <header
        className={`sticky top-0 z-50 border-b border-border/70 backdrop-blur supports-[backdrop-filter]:bg-background/85 ${
          scrolled ? "shadow-sm" : ""
        }`}
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
              <span className="block truncate font-display text-[1.05rem] font-bold tracking-tight">
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
                item.children && "children" in item && item.children.length > 0 ? (
                  <li key={item.label} className="group relative">
                    <Link
                      href={item.href}
                      className="flex items-center gap-1 rounded-md px-3 py-2.5 text-[0.92rem] font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground aria-[current=page]:text-primary"
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      {item.label}
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    </Link>
                    {/* Mega panel: two-column preview with descriptions */}
                    <div className="invisible absolute left-1/2 top-full z-50 w-max min-w-72 -translate-x-1/2 translate-y-1 pt-2 opacity-0 transition-all duration-[180ms] group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <div className="rounded-xl border border-border bg-popover p-2 shadow-lg">
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
                      className="block rounded-md px-3 py-2.5 text-[0.92rem] font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <Link
              href={isUrduPage ? "/" : "/ur"}
              className="hidden h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
              lang="ur"
              dir="rtl"
            >
              <Languages className="h-4 w-4" aria-hidden />
              {isUrduPage ? "English" : "اردو"}
            </Link>
            <ThemeToggle />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden h-11 rounded-full border-border px-4 font-semibold md:inline-flex"
            >
              <Link href="/login">
                <LogIn className="h-4 w-4" aria-hidden />
                Sign In
              </Link>
            </Button>
            <Button asChild size="sm" className="hidden h-11 rounded-full px-5 font-semibold md:inline-flex">
              <Link href={isUrduPage ? "/ur/admissions/apply" : "/admissions/apply"}>Apply Now</Link>
            </Button>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-secondary lg:hidden"
            >
              <Menu className="h-6 w-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen sheet (§4.3) */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden"
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
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
                className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </div>
          </div>

          <nav aria-label="Mobile" className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
            <ul>
              {NAV.map((item) => (
                <li key={item.label} className="border-b border-border/60 last:border-0">
                  {"children" in item && item.children.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                        aria-expanded={expanded === item.label}
                        className="flex min-h-12 w-full items-center justify-between py-3 text-left text-base font-semibold"
                      >
                        {item.label}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-150 ${
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
                              className="block min-h-12 rounded-lg px-3 py-3 text-small font-semibold text-primary hover:bg-secondary"
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
                      className="flex min-h-12 items-center py-3 text-base font-semibold"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
              <li className="border-b border-border/60 last:border-0">
                <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center py-3 text-base font-semibold">
                  Sign In — Student / Teacher / Admin
                </Link>
              </li>
              <li className="pt-3">
                <Link
                  href={isUrduPage ? "/" : "/ur"}
                  lang="ur"
                  dir="rtl"
                  className="flex min-h-12 items-center gap-2 py-3 text-base font-semibold"
                >
                  <Languages className="h-4 w-4" aria-hidden />
                  {isUrduPage ? "English version" : "اردو میں دیکھیں"}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Apply Now pinned to bottom */}
          <div className="border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button asChild className="h-12 w-full rounded-full text-base font-semibold">
              <Link href={isUrduPage ? "/ur/admissions/apply" : "/admissions/apply"} onClick={() => setOpen(false)}>Apply Now</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
