import type { Metadata } from "next";
import { Megaphone, Pin } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { getNotices } from "@/lib/data";
import { formatDate } from "@/content/site";
import { Reveal } from "@/components/site/reveal";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Notice Board",
  description:
    "Official notices of GHSS Ghallanai — admission dates, exam schedules, result announcements, scholarships and holidays, published the moment they are issued.",
};

const CATEGORY_STYLES: Record<string, string> = {
  admission: "bg-secondary text-primary",
  exam: "bg-gold-soft text-gold-strong dark:text-gold",
  result: "bg-secondary text-primary",
  general: "bg-secondary text-primary",
  holiday: "bg-destructive/10 text-destructive",
  scholarship: "bg-gold-soft text-gold-strong dark:text-gold",
};

export default async function NoticesPage() {
  const notices = await getNotices();
  return (
    <>
      <PageHeader
        kicker="Official announcements"
        title={<>The <span className="text-gold">notice board</span>, without the walk</>}
        lead="Every notice the office issues — admissions, examinations, results, scholarships, holidays — published here the same minute, and broadcast on WhatsApp to opted-in families."
        breadcrumbs={[{ name: "Notices", href: "/notices" }]}
      />

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ul className="space-y-4">
          {notices.map((n, i) => (
            <Reveal as="li" key={n.id} delay={i * 50}>
              <article className={`card-lift rounded-xl border bg-card p-6 ${n.pinned ? "border-gold/50" : "border-border"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-bold uppercase tracking-wide ${CATEGORY_STYLES[n.category] ?? CATEGORY_STYLES.general}`}
                  >
                    {n.category}
                  </span>
                  <time dateTime={n.date} className="font-semibold text-muted-foreground">
                    {formatDate(n.date)}
                  </time>
                  {n.pinned && (
                    <span className="inline-flex items-center gap-1 font-bold text-gold-strong dark:text-gold">
                      <Pin className="h-3.5 w-3.5" aria-hidden /> Pinned
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-bold leading-snug">{n.title}</h2>
                <p className="mt-2 text-small leading-relaxed text-muted-foreground">{n.body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Megaphone className="h-4 w-4" aria-hidden />
          Notices publish from the admin dashboard in under five minutes — the KPI this page exists
          to meet (Master Plan §1.4).
        </p>
      </section>
    </>
  );
}
