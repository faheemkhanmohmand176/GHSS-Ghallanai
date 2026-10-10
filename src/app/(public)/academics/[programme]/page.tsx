import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Code2, FlaskConical, Cog, Feather, Briefcase, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { getProgramme, PROGRAMMES, type Programme } from "@/content/programmes";
import { JsonLdCourse } from "@/components/site/json-ld";
import { Button } from "@/components/ui/button";

/** Programme microsite — one identical template for all four streams (§6.3). */

export function generateStaticParams() {
  return PROGRAMMES.map((p) => ({ programme: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programme: string }>;
}): Promise<Metadata> {
  const { programme } = await params;
  const p = getProgramme(programme);
  if (!p) return {};
  return {
    title: `${p.shortName} — Subjects, Eligibility & Careers`,
    description: `${p.promise} Full subject combination for first and second year, entry requirements, assessment pattern and university pathways at GHSS Ghallanai, Mohmand District.`,
    alternates: { canonical: `/academics/${p.slug}` },
  };
}

const ICONS = { code: Code2, flask: FlaskConical, gear: Cog, quill: Feather } as const;

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ programme: string }>;
}) {
  const { programme } = await params;
  const p = getProgramme(programme);
  if (!p) notFound();

  const Icon = ICONS[p.icon];
  const year1 = p.subjects.filter((s) => s.year === 1);
  const year2 = p.subjects.filter((s) => s.year === 2);

  return (
    <>
      <JsonLdCourse name={p.name} description={p.promise} slug={p.slug} />
      <PageHeader
        kicker={`${p.accentWord} · 2 years · BISE`}
        title={
          <>
            {p.shortName}
          </>
        }
        lead={p.promise}
        breadcrumbs={[
          { name: "Academics", href: "/academics" },
          { name: p.shortName, href: `/academics/${p.slug}` },
        ]}
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} aria-hidden />
          </span>
        </div>
      </PageHeader>

      {/* Overview (3 paragraphs §6.3) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="measure space-y-4 text-base leading-relaxed text-foreground/90">
          {p.overview.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {/* Subject combination tables */}
      <section className="border-y border-border/70 bg-secondary/50" aria-labelledby="subjects">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading
            kicker="Scheme of studies"
            title="Subject combination and marks"
            lead="Theory + practical marks follow the BISE intermediate pattern. The same combination continues from first year into second year."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { label: "First year (Grade 11)", rows: year1 },
              { label: "Second year (Grade 12)", rows: year2 },
            ].map((tbl, t) => (
              <Reveal key={tbl.label} delay={t * 80}>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <h3 className="border-b border-border bg-secondary/60 px-5 py-3 font-bold">{tbl.label}</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-muted-foreground">
                        <th className="px-5 py-2.5 font-semibold">Subject</th>
                        <th className="px-5 py-2.5 font-semibold">Marks</th>
                        <th className="px-5 py-2.5 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tbl.rows.map((s) => (
                        <tr key={s.subject} className="border-b border-border/40 last:border-0">
                          <td className="px-5 py-3 font-medium">{s.subject}</td>
                          <td className="px-5 py-3 text-muted-foreground">{s.marks}</td>
                          <td className="px-5 py-3">
                            {s.note ? (
                              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-primary">
                                {s.note}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility + careers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading kicker="Entry requirements" title="Who should apply" />
            <ul className="space-y-3">
              {p.eligibility.map((e, i) => (
                <Reveal as="li" key={e.requirement} delay={i * 60}>
                  <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-small font-bold">{e.requirement}</p>
                      <p className="mt-0.5 text-small text-muted-foreground">{e.detail}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
            <p className="mt-4 text-small text-muted-foreground">
              See the{" "}
              <Link href="/admissions/eligibility" className="font-semibold text-primary underline underline-offset-4">
                full eligibility table
              </Link>{" "}
              and the{" "}
              <Link href="/admissions/apply" className="font-semibold text-primary underline underline-offset-4">
                five-step application
              </Link>
              .
            </p>
          </div>
          <div>
            <SectionHeading kicker="Careers pathway" title="Where this stream leads" />
            <ul className="space-y-3">
              {p.careers.map((c, i) => (
                <Reveal as="li" key={c.field} delay={i * 60}>
                  <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
                    <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
                    <div>
                      <p className="text-small font-bold">{c.field}</p>
                      <p className="mt-0.5 text-small text-muted-foreground">{c.paths}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Assessment pattern */}
      <section className="border-y border-border/70 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading kicker="Assessment" title="How learning is measured" />
          <ul className="grid gap-4 md:grid-cols-3">
            {p.assessment.map((a, i) => (
              <Reveal as="li" key={i} delay={i * 60}>
                <div className="card-lift h-full rounded-xl border border-border bg-card p-5">
                  <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />
                  <p className="mt-3 text-small leading-relaxed">{a}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Programme-specific facilities */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading kicker="Facilities & support" title={`What backs the ${p.shortName} student`} />
        <div className="grid gap-4 md:grid-cols-2">
          {p.facilities.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className="card-lift h-full rounded-xl border border-border bg-card p-6">
                <h3 className="text-h3">{f.title}</h3>
                <p className="mt-2 text-small leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA into admissions (§6.3) */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-gold/30 bg-gold-soft/40 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8 dark:bg-gold-soft/20">
          <div>
            <h2 className="text-h2">Ready to join {p.shortName}?</h2>
            <p className="mt-2 max-w-xl text-small text-muted-foreground">
              Check the eligibility table, then complete the five-step online application. Your
              progress saves as you type, and every applicant receives a tracking number.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="h-11 rounded-full px-6 font-semibold">
              <Link href="/admissions/eligibility">Check Eligibility</Link>
            </Button>
            <Button asChild className="h-11 rounded-full px-6 font-semibold">
              <Link href="/admissions/apply">
                Apply Now <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
