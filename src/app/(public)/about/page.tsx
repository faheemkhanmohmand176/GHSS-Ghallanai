import type { Metadata } from "next";
import Link from "next/link";
import { School, FlaskConical, Monitor, BookOpen, Trees, FileCheck } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { TIMELINE, VISION_MISSION, FACILITIES } from "@/content/about";
import { SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "About the School",
  description:
    "The story, vision and mission of Government Higher Secondary School Ghallanai — serving Mohmand District with intermediate education across four streams.",
};

const FACILITY_ICONS = { school: School, flask: FlaskConical, monitor: Monitor, book: BookOpen, trees: Trees, file: FileCheck } as const;

export default function AboutPage() {
  return (
    <>
      <PageHeader
        kicker="About us"
        title={<>A school of <span className="text-gold">record</span> in the heart of Mohmand</>}
        lead="Government Higher Secondary School Ghallanai serves the district headquarters with the two years of education that decide university paths — under the discipline, transparency and care a public institution owes its people."
        breadcrumbs={[{ name: "About", href: "/about" }]}
      />

      {/* Story + timeline (§6.2) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="story">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeading kicker="Our story" title="Built by the community, for the community" />
            <div className="space-y-4 text-base leading-relaxed text-foreground/90">
              <p>
                Ghallanai is the administrative headquarters of Mohmand District — the town where
                the district&apos;s offices, markets and families converge. Its government higher
                secondary school carries a correspondingly public duty: every serious student of
                the surrounding valleys, whatever the family&apos;s means, has a right to two years
                of disciplined intermediate education here.
              </p>
              <p>
                The school teaches first year and second year under the BISE intermediate system,
                across the four streams the district&apos;s ambitions actually run through: ICS for
                the programmers and analysts, Pre-Medical for the healers, Pre-Engineering for the
                builders, and the Humanities for the future lawyers, civil servants and writers.
              </p>
              <p>
                This website is part of the same duty. Admissions, fees, results and notices are
                published here in English, reachable from the cheapest phone on the
                weakest network — because a family&apos;s access to information about its own
                school should never depend on office hours.
              </p>
            </div>
          </div>

          {/* Heritage timeline with gold milestones */}
          <div>
            <SectionHeading kicker="Milestones" title="The school through the years" />
            <ol className="relative space-y-8 border-l-2 border-border pl-6">
              {TIMELINE.map((t, i) => (
                <Reveal as="li" key={i} delay={i * 60} className="relative">
                  <span
                    aria-hidden
                    className={`absolute -left-[1.85rem] top-1 h-3 w-3 rounded-full border-2 border-background ${
                      t.milestone ? "bg-gold" : "bg-primary"
                    }`}
                  />
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold">{t.year}</p>
                  <h3 className="mt-1 text-base font-bold">{t.title}</h3>
                  <p className="mt-1.5 text-small leading-relaxed text-muted-foreground">{t.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Vision / mission (§6.2) */}
      <section className="border-y border-border/70 bg-secondary/50" aria-labelledby="vision">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading kicker="Vision & mission" title="What we hold ourselves to" align="center" />
          <div className="grid gap-4 md:grid-cols-2">
            <Reveal>
              <article className="h-full rounded-xl border border-gold/30 bg-card p-6 md:p-8">
                <h3 className="font-display text-xl font-bold text-primary">Vision</h3>
                <p className="mt-3 text-lead leading-relaxed text-foreground/90">{VISION_MISSION.vision}</p>
              </article>
            </Reveal>
            <Reveal delay={60}>
              <article className="h-full rounded-xl border border-border bg-card p-6 md:p-8">
                <h3 className="font-display text-xl font-bold text-primary">Mission</h3>
                <p className="mt-3 text-lead leading-relaxed text-foreground/90">{VISION_MISSION.mission}</p>
              </article>
            </Reveal>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VISION_MISSION.values.map((v, i) => (
              <Reveal key={v.title} delay={i * 60}>
                <article className="card-lift h-full rounded-xl border border-border bg-card p-5">
                  <h4 className="text-small font-bold uppercase tracking-[0.08em] text-gold">{v.title}</h4>
                  <p className="mt-2 text-small leading-relaxed text-muted-foreground">{v.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities (§6.2) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="facilities">
        <SectionHeading
          kicker="Facilities"
          title="Classrooms, laboratories and grounds"
          lead="What a student physically works with across the week — the practical side of every stream. (Photograph galleries will be added as media is collected with guardian consent.)"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACILITIES.map((f, i) => {
            const Icon = FACILITY_ICONS[f.icon as keyof typeof FACILITY_ICONS];
            return (
              <Reveal key={f.title} delay={i * 60}>
                <article className="card-lift h-full rounded-xl border border-border bg-card p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-5.5 w-5.5 text-primary" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-h3">{f.title}</h3>
                  <p className="mt-2 text-small leading-relaxed text-muted-foreground">{f.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <div id="facilities" />
      </section>

      {/* Cross-links */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3 md:p-8">
          {[
            { title: "Principal's Message", href: "/about/principal", desc: "A word from the head of the institution" },
            { title: "Faculty Directory", href: "/about/faculty", desc: "The teachers behind the results" },
            { title: "Academics", href: "/academics", desc: "Programmes, subjects and assessment" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="card-lift rounded-xl border border-border bg-secondary/40 p-5 focus-visible:border-gold"
            >
              <h3 className="text-base font-bold group-hover:text-primary">{c.title}</h3>
              <p className="mt-1 text-small text-muted-foreground">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
