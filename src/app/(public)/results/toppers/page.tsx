import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { TOPPERS } from "@/content/results";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Toppers — Honour Wall",
  description:
    "The position holders of GHSS Ghallanai — honour cards with the marks, the programme and a word from each topper. Verified by the exam branch before publication.",
};

export default function ToppersPage() {
  return (
    <>
      <PageHeader
        kicker="Results · Honour wall"
        title={<>Counted, dated, <span className="text-gold">named</span></>}
        lead="The research behind this school's plan was blunt about it: no statistic communicates a school better than a student explaining what it changed for them. Every entry below is verified by the exam branch before it publishes."
        breadcrumbs={[
          { name: "Results", href: "/results" },
          { name: "Toppers", href: "/results/toppers" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          kicker="Annual 2026"
          title="Position holders"
          lead="Gold-styled honour cards; photographs join the wall as media is collected with guardian consent (§11.4)."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {TOPPERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 60}>
              <article className="card-lift relative h-full overflow-hidden rounded-xl border border-gold/40 bg-card p-6">
                <span
                  aria-hidden
                  className="absolute -right-6 -top-6 flex h-20 w-20 items-center justify-center rounded-full bg-gold-soft/60 dark:bg-gold-soft/30"
                >
                  <Trophy className="h-9 w-9 text-gold" aria-hidden />
                </span>
                <p className="relative text-xs font-bold uppercase tracking-[0.14em] text-gold-strong dark:text-gold">
                  {t.position} · {t.programme}
                </p>
                <h2 className="relative mt-2 text-h3">{t.name}</h2>
                <p className="mt-1 text-small font-semibold text-primary">
                  {t.percentage} · {t.year}
                </p>
                <blockquote className="relative mt-4 border-l-2 border-gold/50 pl-4 text-small italic leading-relaxed text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          SAMPLE honour cards — the wall fills from the results import pipeline each result day,
          feeding the same content into the home statistics band (Master Plan §6.5).
        </p>
      </section>
    </>
  );
}
