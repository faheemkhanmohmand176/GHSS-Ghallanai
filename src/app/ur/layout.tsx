import Link from "next/link";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { HtmlLangEffect } from "@/components/site/html-lang-effect";

/**
 * Urdu shell — full RTL layout, Nastaliq typography (§5.4),
 * nav back to English site. Only key pages render in Urdu (§4.2).
 */
export default function UrduLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" lang="ur" className="app-shell">
      <HtmlLangEffect lang="ur" dir="rtl" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-primary-foreground"
      >
        مرکزی مواد پر جائیں
      </a>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/ur" className="flex min-w-0 items-center gap-2.5" aria-label="صفحہ اول">
            <CrestMark className="h-10 w-10" />
            <span className="min-w-0 leading-relaxed">
              <span className="urdu-display block !text-[1.15rem] !leading-[1.8] font-bold">
                <span className="text-gold">ایل ایچ ایس ایس</span> غلانئی
              </span>
              <span className="block text-[0.7rem] font-medium text-muted-foreground">
                گورنمنٹ ہائر سیکنڈری سکول
              </span>
            </span>
          </Link>
          <nav aria-label="اردو مینو" className="hidden items-center gap-1 md:flex">
            {[
              ["/ur", "سرِ ورق"],
              ["/ur/admissions", "داخلہ"],
              ["/ur/admissions/fees", "فیس"],
              ["/ur/results", "نتیجہ"],
              ["/ur/contact", "رابطہ"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="urdu-body inline-flex min-h-11 items-center !text-base px-3 font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full px-3 text-small font-bold text-primary hover:bg-secondary"
              lang="en"
            >
              English
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="app-main">
        {children}
      </main>
      <footer className="mt-auto border-t border-border bg-primary-strong py-8 text-center text-[#E8F5EC]/80 dark:bg-[#0a1810]">
        <p className="urdu-body">
          گورنمنٹ ہائر سیکنڈری سکول غلانئی · ضلع مہمند · خیبر پختونخوا
        </p>
        <p className="mt-2 text-xs text-[#E8F5EC]/60">
          <Link href="/" className="underline underline-offset-4 hover:text-white">
            Full site in English →
          </Link>
        </p>
      </footer>
      {/* mobile bottom nav for Urdu pages */}
      <nav
        aria-label="اردو نیویگیشن"
        className="sticky bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]"
      >
        {[
          ["/ur", "سرِ ورق"],
          ["/ur/admissions", "داخلہ"],
          ["/ur/results", "نتیجہ"],
          ["/ur/contact", "رابطہ"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="urdu-body flex min-h-14 flex-col items-center justify-center !text-sm font-semibold text-foreground/75 active:text-primary"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
