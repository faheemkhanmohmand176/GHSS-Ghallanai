import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { ProgrammeCard } from "@/components/site/programme-card";
import { Reveal } from "@/components/site/reveal";
import { PROGRAMMES } from "@/content/programmes";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "Academics — Four Programmes",
  description:
    "The scheme of studies at GHSS Ghallanai: ICS Computer Science, F.Sc Pre-Medical, F.Sc Pre-Engineering and FA Humanities, with subject combinations, eligibility and careers.",
};

/** Academic calendar (§6.3) — SAMPLE terms */
const CALENDAR = [
  { term: "Term 1", period: "Dec - Mar", events: "Classes, monthly tests, sports week" },
  { term: "Term 2", period: "Mar - Jun", events: "Classes, monthly tests, send-up exams" },
  { term: "Board exams", period: "Apr - May (2nd yr) / May - Jun (1st yr)", events: "BISE annual examinations" },
  { term: "Term 3 + practicals", period: "Jun - Oct", events: "Classes, lab practicals, board practicals" },
];

export default function AcademicsPage() {
  return (
    <>
      <PageHeader
        kicker="Academics"
        title={<>Four programmes, one <span className="text-gold">standard</span> of teaching</>}
        lead="Every stream follows the BISE intermediate scheme of studies across first and second year, taught by subject specialists with monthly tests and supervised practicals. Each programme has its own page — subjects, eligibility, assessment and the careers the stream feeds."
        breadcrumbs={[{ name: "Academics", href: "/academics" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMMES.map((p, i) => (
            <ProgrammeCard key={p.slug} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* Scheme of studies */}
      <section className="border-y border-border/70 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading
            kicker="Scheme of studies"
            title="How the two years are structured"
            lead="Compulsory subjects (English, Urdu, Islamiyat, Pakistan Studies) run across both years; each stream adds its core combination. Marks shown are the board's theory + practical pattern for the annual examinations."
          />
          <Reveal>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/60 text-left">
                    <th className="px-5 py-3.5 font-bold">Programme</th>
                    <th className="px-5 py-3.5 font-bold">Core subjects</th>
                    <th className="px-5 py-3.5 font-bold">First year</th>
                    <th className="px-5 py-3.5 font-bold">Second year</th>
                    <th className="px-5 py-3.5 font-bold">Leads to</th>
                  </tr>
                </thead>
                <tbody>
                  {PROGRAMMES.map((p) => (
                    <tr key={p.slug} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-4 font-semibold">
                        <a href={`/academics/${p.slug}`} className="text-primary hover:underline underline-offset-4">
                          {p.shortName}
                        </a>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {p.subjects
                          .filter((s) => s.note?.includes("Core"))
                          .map((s) => s.subject)
                          .join(", ") || "Three electives + compulsories"}
                      </td>
                      <td className="px-5 py-4">
                        {[...new Set(p.subjects.filter((s) => s.year === 1).map((s) => s.subject))].length} subjects
                      </td>
                      <td className="px-5 py-4">
                        {[...new Set(p.subjects.filter((s) => s.year === 2).map((s) => s.subject))].length} subjects
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{p.careers[0].paths.split(",")[0]}, …</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Academic calendar */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading
          kicker="Academic calendar"
          title={`The rhythm of the ${SITE.session} session`}
          lead="SAMPLE calendar — the office publishes the confirmed calendar with the year's first notice. Month views live in the student portal timetable."
        />
        <ol className="grid gap-4 md:grid-cols-4">
          {CALENDAR.map((c, i) => (
            <Reveal as="li" key={c.term} delay={i * 60}>
              <div className="card-lift h-full rounded-xl border border-border bg-card p-5">
                <CalendarDays className="h-5 w-5 text-gold" aria-hidden />
                <h3 className="mt-3 text-base font-bold">{c.term}</h3>
                <p className="mt-0.5 text-xs font-semibold text-primary">{c.period}</p>
                <p className="mt-2 text-small text-muted-foreground">{c.events}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>
    </>
  );
}
