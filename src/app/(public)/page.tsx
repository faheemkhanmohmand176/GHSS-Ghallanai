import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap, Landmark, ShieldCheck, Trophy } from "lucide-react";
import { PROGRAMMES } from "@/content/programmes";
import { getNews, getNotices } from "@/lib/data";
import { PROGRAMMES as PROG } from "@/content/programmes";
import { TESTIMONIALS } from "@/content/news";
import { SITE, formatDate } from "@/content/site";
import { ProgrammeCard } from "@/components/site/programme-card";
import { StatBand } from "@/components/site/stat-band";
import { CtaBand } from "@/components/site/cta-band";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { JsonLdSchool } from "@/components/site/json-ld";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const revalidate = 60; // ISR 60s — notices/news reflect admin within a minute (§8.3)

export const metadata: Metadata = {
  title: `${SITE.fullName} — Admissions ${SITE.session}, Results & Programmes`,
  description:
    "Apply online, check results by roll number, and explore ICS, Pre-Medical, Pre-Engineering and Arts at Mohmand District's government higher secondary school in Ghallanai, Khyber Pakhtunkhwa.",
  alternates: { languages: { ur: "/ur" } },
};

const WHY_US = [
  {
    icon: Landmark,
    title: "Government credibility",
    body: "A public institution of Mohmand District, run on the record: published merit lists, verifiable results, and fees stated plainly. Nothing here depends on who you know.",
  },
  {
    icon: GraduationCap,
    title: "Faculty that knows names",
    body: "Subject-specialist teachers across all four streams, a monthly test system with teacher remarks, and counselling that notices a bad month before it becomes a bad year.",
  },
  {
    icon: Trophy,
    title: "Results you can check yourself",
    body: "Subject-wise results by roll number on this website the day they release, toppers honoured by name, and a five-year record that speaks for itself.",
  },
];

export default async function HomePage() {
  const [news, notices] = await Promise.all([getNews(3), getNotices(4)]);

  return (
    <>
      <JsonLdSchool />

      {/* ============ HERO — poster-first (low bandwidth §11.1) ============ */}
      <section className="relative overflow-hidden bg-primary-strong dark:bg-[#0a1810]">
        {/* Crest watermark */}
        <svg
          viewBox="0 0 512 512"
          aria-hidden
          className="pointer-events-none absolute -right-20 top-1/2 hidden h-[34rem] w-[34rem] -translate-y-1/2 opacity-[0.07] md:block"
        >
          <path
            d="M256 64 L416 104 L416 240 C 416 330 352 400 256 448 C 160 400 96 330 96 240 L96 104 Z"
            fill="none"
            stroke="#F5E6C4"
            strokeWidth="14"
          />
          <path
            d="M256 322 C 226 300 190 296 158 300 L158 352 C 190 348 226 352 256 372 C 286 352 322 348 354 352 L354 300 C 322 296 286 300 256 322 Z"
            fill="#F5E6C4"
          />
        </svg>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:py-28">
          <p className="kicker !text-gold">
            {SITE.district} · {SITE.province}
          </p>
          {/* Headline with gold accent word (§5.6 hero entrance, CSS-driven) */}
          <h1 className="mt-3 max-w-3xl text-display text-[#FAFDF7]">
            The district&apos;s gateway to{" "}
            <span className="relative inline-block text-gold">
              university
              <span
                aria-hidden
                className="absolute -bottom-2 left-0 h-2 w-full origin-left rounded-full bg-gold/50 md:scale-x-100"
                style={{ transform: "scaleX(0.98)" }}
              />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lead text-[#E8F5EC]/85">
            Two decisive years. Four streams — ICS, Pre-Medical, Pre-Engineering and Arts.
            One government school in Ghallanai that treats every family&apos;s question as
            worth answering, on any phone, on any network.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="sheen relative h-12 overflow-hidden rounded-full bg-gold px-8 text-base font-bold text-[#1A2E22] hover:bg-gold-strong">
              <Link href="/admissions/apply">
                Apply Now
                <ArrowRight className="ml-1 h-5 w-5" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-[#E8F5EC]/35 bg-transparent px-8 text-base font-semibold text-[#E8F5EC] hover:bg-[#E8F5EC]/10 hover:text-white">
              <Link href="/academics">Explore Programmes</Link>
            </Button>
          </div>
          {/* Trust strip */}
          <dl className="mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-[#E8F5EC]/15 pt-6">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#E8F5EC]/60">Grades</dt>
              <dd className="mt-1 font-display text-lg font-bold text-[#FAFDF7]">11 & 12</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#E8F5EC]/60">Streams</dt>
              <dd className="mt-1 font-display text-lg font-bold text-[#FAFDF7]">4 programmes</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#E8F5EC]/60">Board</dt>
              <dd className="mt-1 font-display text-lg font-bold text-[#FAFDF7]">BISE intermediate</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ============ STATISTICS BAND (odometers) ============ */}
      <StatBand />

      {/* ============ PROGRAMMES BAND ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20" aria-labelledby="programmes">
        <SectionHeading
          kicker="Four streams, four futures"
          title={<>Choose the <span className="text-gold">stream</span> that matches the career</>}
          lead="Every programme page carries the full subject combination, eligibility, assessment pattern and the university degrees the stream feeds — the guidance a family needs before it fills the form."
        />
        <div id="programmes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMMES.map((p, i) => (
            <ProgrammeCard key={p.slug} p={p} index={i} />
          ))}
        </div>
      </section>

      {/* ============ WHY-US BAND ============ */}
      <section className="border-y border-border/70 bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            kicker="Why GHSS Ghallanai"
            title="Proof, not adjectives"
            lead="The research behind this school's digital campus studied the finest college websites in Pakistan and abroad. These are the standards we hold ourselves to."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {WHY_US.map((w, i) => (
              <Reveal key={w.title} delay={i * 60}>
                <article className="card-lift h-full rounded-xl border border-border bg-card p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                    <w.icon className="h-5.5 w-5.5 text-primary" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-h3">{w.title}</h3>
                  <p className="mt-2 text-small leading-relaxed text-muted-foreground">{w.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ NOTICES + NEWS BAND ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20" aria-labelledby="news-band">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHeading
              kicker="News & stories"
              title={<>What&apos;s happening at the school</>}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {news.map((n, i) => (
                <Reveal key={n.id} delay={i * 60}>
                  <article className="card-lift flex h-full flex-col rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-primary">
                        {n.category}
                      </span>
                      <time dateTime={n.date}>{formatDate(n.date)}</time>
                      <span aria-hidden>·</span>
                      <span>{n.readingMinutes} min read</span>
                    </div>
                    <h3 className="mt-3 text-base font-bold leading-snug">{n.title}</h3>
                    <p className="mt-2 flex-1 text-small leading-relaxed text-muted-foreground">{n.excerpt}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
          <div>
            <SectionHeading kicker="Notice board" title="Latest notices" />
            <ul className="space-y-3">
              {notices.map((n, i) => (
                <Reveal as="li" key={n.id} delay={i * 60} className="card-lift list-none rounded-xl border border-border bg-card p-4">
                    <Link href="/notices" className="group block">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-small font-bold leading-snug group-hover:text-primary">
                          {n.title}
                        </h3>
                        {n.pinned && (
                          <span className="shrink-0 rounded-full bg-gold-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gold-strong dark:text-gold">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(n.date)} · {n.category}
                      </p>
                    </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============ VOICES BAND (§6.1) ============ */}
      <section className="border-y border-border/70 bg-secondary/50" aria-labelledby="voices">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            kicker="Voices of Ghallanai"
            title="Students, parents and graduates"
            align="center"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 60}>
                <figure className="h-full rounded-xl border border-border bg-card p-6">
                  <blockquote className="text-lead font-display italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4 text-small">
                    <span className="font-bold">{t.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.context}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CTA BAND ============ */}
      <CtaBand />
    </>
  );
}
