import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import type { TeacherRow, AchievementRow } from "@/content/demo-content";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** Meet Our Teachers — homepage strip (Babi Khel feature). */
export function TeachersStrip({ teachers }: { teachers: TeacherRow[] }) {
  if (teachers.length === 0) return null;
  return (
    <section aria-labelledby="faculty-strip" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
      <SectionHeading
        kicker="Our faculty"
        title={<>Meet our <span className="text-gold">teachers</span></>}
        align="center"
      />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {teachers.slice(0, 4).map((t, i) => (
          <Reveal key={t.id} delay={i * 60}>
            <article className="card-lift h-full rounded-xl border border-border bg-card p-5 text-center">
              {t.photo_url ? (
                 
                <img
                  src={t.photo_url}
                  alt={t.full_name}
                  loading="lazy"
                  className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-secondary transition-colors group-hover:ring-gold/50"
                />
              ) : (
                <span
                  aria-hidden
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-strong font-display text-2xl font-bold text-gold ring-4 ring-secondary"
                >
                  {t.full_name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("")}
                </span>
              )}
              <h3 className="mt-4 text-small font-bold leading-snug">{t.full_name}</h3>
              <p className="mt-0.5 text-xs font-semibold text-primary">{t.subject}</p>
              {t.qualification && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {t.qualification}
                </p>
              )}
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-center">
        <Link
          href="/about/faculty"
          className="inline-flex items-center gap-1 text-small font-bold text-primary hover:underline underline-offset-4"
        >
          All teachers <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </p>
    </section>
  );
}

/** Achievements — "Our Pride" homepage strip (Babi Khel feature). */
export function AchievementsStrip({ achievements }: { achievements: AchievementRow[] }) {
  if (achievements.length === 0) return null;
  return (
    <section aria-labelledby="pride-strip" className="border-y border-border/70 bg-secondary/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading kicker="Our pride" title={<>Achievements worth <span className="text-gold">honouring</span></>} align="center" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {achievements.slice(0, 3).map((a, i) => (
            <Reveal key={a.id} delay={i * 60}>
              <article className="card-lift h-full rounded-xl border border-border bg-card p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold-soft">
                  <Trophy className="h-5.5 w-5.5 text-gold-strong dark:text-gold" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-4 text-small font-bold leading-snug">{a.title}</h3>
                {(a.student_name || a.class_label) && (
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {[a.student_name, a.class_label].filter(Boolean).join(" · ")}
                  </p>
                )}
                {a.description && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
