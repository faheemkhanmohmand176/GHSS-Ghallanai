import type { Metadata } from "next";
import Link from "next/link";
import { UR } from "@/content/urdu";
import { SCHOOL_STATS } from "@/content/programmes";
import { getNotices } from "@/lib/data";
import { SITE, formatDate } from "@/content/site";
import { Odometer } from "@/components/site/odometer";

export const metadata: Metadata = {
  title: "ایل ایچ ایس ایس غلانئی — سرِ ورق",
  description: "گورنمنٹ ہائر سیکنڈری سکول غلانئی — داخلہ، نتائج اور پروگرامز کی مکمل معلومات اردو میں۔",
  alternates: { languages: { en: "/" } },
};

export default async function UrduHome() {
  const notices = await getNotices(3);
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary-strong py-16 md:py-24 dark:bg-[#0a1810]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="kicker !text-gold">{UR.home.kicker}</p>
          <h1 className="urdu-display mt-3 max-w-3xl text-[#FAFDF7]">{UR.home.heroTitle}</h1>
          <p className="urdu-body mt-5 max-w-xl text-[#E8F5EC]/85">{UR.home.heroLead}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admissions/apply"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gold px-8 text-base font-bold text-[#1A2E22] hover:bg-gold-strong"
            >
              {UR.home.apply}
            </Link>
            <Link
              href="/academics"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#E8F5EC]/35 px-8 text-base font-semibold text-[#E8F5EC] hover:border-gold hover:text-gold"
            >
              {UR.home.explore}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section aria-label={UR.home.statsTitle} className="bg-primary-strong border-t border-[#E8F5EC]/10 dark:bg-[#0a1810]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
          {SCHOOL_STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-num text-gold">
                <Odometer value={s.value} />
                {s.suffix}
              </p>
              <p className="urdu-body mt-2 !text-sm text-[#E8F5EC]/80">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Programmes */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="urdu-display">{UR.home.programmesTitle}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["آئی سی ایس — کمپیوٹر سائنس", "پروگرامنگ، ریاضی اور کمپیوٹنگ", "/academics/ics"],
            ["ایف ایس سی پری میڈیکل", "طب اور حیاتیات کا راستہ", "/academics/pre-medical"],
            ["ایف ایس سی پری انجینئرنگ", "انجینئرنگ کے تمام شعبے", "/academics/pre-engineering"],
            ["ایف اے ہیومینٹیز", "قانون، سول سروس، میڈیا", "/academics/arts"],
          ].map(([t, d, href]) => (
            <Link
              key={href}
              href={href}
              className="card-lift rounded-xl border border-border bg-card p-6 focus-visible:border-gold"
            >
              <p className="urdu-body !text-lg font-bold">{t}</p>
              <p className="urdu-body mt-1 !text-sm text-muted-foreground">{d}</p>
              <p className="mt-3 text-xs font-semibold text-primary">تفصیل دیکھیں (انگریزی) ←</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Notices */}
      <section className="border-y border-border/70 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="urdu-display">{UR.home.noticesTitle}</h2>
          <ul className="mt-6 space-y-3">
            {notices.map((n) => (
              <li key={n.id} className="rounded-xl border border-border bg-card p-5">
                <p className="urdu-body !text-base font-bold">{n.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.date)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6">
        <h2 className="urdu-display">{SITE.admissionStatus.label}</h2>
        <p className="urdu-body mt-3 text-muted-foreground">{UR.home.urduNote}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/admissions/apply"
            className="inline-flex h-12 items-center rounded-full bg-primary px-8 text-base font-bold text-primary-foreground"
          >
            {UR.home.apply}
          </Link>
          <Link
            href="/ur/results"
            className="inline-flex h-12 items-center rounded-full border border-border px-8 text-base font-semibold hover:border-gold hover:text-gold"
          >
            {UR.home.resultsCta}
          </Link>
        </div>
      </section>
    </>
  );
}
