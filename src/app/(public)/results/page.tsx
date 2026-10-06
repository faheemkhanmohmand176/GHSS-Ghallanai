import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, ListOrdered, Search, TrendingUp, FileText, Hash } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { getMeritList } from "@/lib/data";
import { TOPPERS, RESULT_TREND } from "@/content/results";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Results — Lookup, Merit Lists & Toppers",
  description:
    "The results hub of GHSS Ghallanai: subject-wise result lookup, published merit lists, the toppers honour wall and the school's five-year performance record.",
};

export default async function ResultsHub() {
  const merit = await getMeritList();
  return (
    <>
      <PageHeader
        kicker="Results"
        title={<>Transparency, <span className="text-gold">verifiable</span></>}
        lead="Three surfaces, one promise: every number published on this page can be checked by anyone, from any phone — the day it releases."
        breadcrumbs={[{ name: "Results", href: "/results" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Result Lookup",
              body: "Subject-wise card by roll number — printable, shareable, published on result day.",
              href: "/results/lookup",
              cta: "Check a result",
            },
            {
              icon: FileText,
              title: "Report Card",
              body: "Detailed annual report card by exam roll number or report-card code. 1st Year & 2nd Year, all programmes.",
              href: "/results/report-card",
              cta: "View report card",
            },
            {
              icon: Hash,
              title: "Exam Roll Numbers",
              body: "Find your exam roll number slip — published when the exam branch opens the session.",
              href: "/results/roll-numbers",
              cta: "Find my roll number",
            },
            {
              icon: ListOrdered,
              title: "Merit Lists",
              body: "Each session's admission merit list as accessible HTML tables, dated and versioned.",
              href: "/results/merit-list",
              cta: "View merit list",
            },
            {
              icon: Trophy,
              title: "Toppers",
              body: "Position holders honoured by name with photographs and interviews, session by session.",
              href: "/results/toppers",
              cta: "Meet the toppers",
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 60}>
              <Link
                href={c.href}
                className="card-lift flex h-full flex-col rounded-xl border border-border bg-card p-6 focus-visible:border-gold"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                  <c.icon className="h-5.5 w-5.5 text-primary" strokeWidth={1.75} aria-hidden />
                </span>
                <h2 className="mt-4 text-h3">{c.title}</h2>
                <p className="mt-2 flex-1 text-small leading-relaxed text-muted-foreground">{c.body}</p>
                <span className="mt-4 text-small font-bold text-primary">{c.cta} →</span>
              </Link>
            </Reveal>
          ))}
        </div>

        {/* Five-year trend (§6.5 Result Statistics) */}
        <div className="mt-16">
          <div className="mb-8">
            <p className="kicker">Result statistics</p>
            <h2 className="mt-2 text-h2">Five-year performance trend</h2>
            <p className="mt-3 max-w-2xl text-lead text-muted-foreground">
              The school&apos;s pass percentage in intermediate annual examinations — evidence of
              institutional improvement, charted simply and honestly. SAMPLE figures.
            </p>
          </div>
          <Reveal>
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              {/* High-contrast CSS bar chart — zero JS, zero chart library (§11.1) */}
              <div className="flex h-48 items-end gap-3 sm:gap-6" role="img" aria-label="Pass percentage by year: 2021: 71%, 2022: 76%, 2023: 82%, 2024: 86%, 2025: 90%">
                {RESULT_TREND.map((r) => (
                  <div key={r.year} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-bold text-primary">{r.passPercent}%</span>
                    <div
                      className="w-full rounded-t-lg bg-primary transition-all"
                      style={{ height: `${r.passPercent}%` }}
                      aria-hidden
                    />
                    <span className="text-xs font-semibold text-muted-foreground">{r.year}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                Pass percentage, intermediate annual examinations (all programmes combined).
              </div>
            </div>
          </Reveal>
        </div>

        {/* Quick links to latest merit + toppers preview */}
        <div className="mt-16 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="kicker">Latest merit list</p>
              <h2 className="mt-2 text-h3">Session {new Date().getFullYear() - 1} first-year admission</h2>
              <ul className="mt-4 space-y-2 text-small">
                {merit.slice(0, 3).map((m) => (
                  <li key={m.applicationNo} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                    <span className="font-semibold">
                      #{m.meritNo} {m.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{m.programme}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-5 h-11 rounded-full">
                <Link href="/results/merit-list">Full merit list</Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div className="rounded-2xl border border-gold/30 bg-card p-6">
              <p className="kicker">Honour wall</p>
              <h2 className="mt-2 text-h3">Latest toppers</h2>
              <ul className="mt-4 space-y-2 text-small">
                {TOPPERS.slice(0, 3).map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0">
                    <span className="font-semibold">{t.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {t.position} · {t.percentage}
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-5 h-11 rounded-full">
                <Link href="/results/toppers">The toppers wall</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
