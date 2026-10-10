import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { getEvents } from "@/lib/data";
import { EVENT_TYPE_META } from "@/lib/constants";
import { SITE, formatDate } from "@/content/site";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Event Calendar — GHSS Ghallanai",
  description:
    "Examination dates, holidays, parent-teacher meetings and school events at GHSS Ghallanai, Mohmand District.",
};

function toIcsDate(d: string): string {
  return d.replace(/-/g, "");
}

export default async function CalendarPage() {
  const events = await getEvents(true);

  // A tiny, dependency-free .ics feed served as a data URL — subscribable in
  // Google Calendar / phone calendar apps.
  const ics =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GHSS Ghallanai//Events//EN\r\n" +
    events
      .map(
        (e) =>
          `BEGIN:VEVENT\r\nUID:${e.id}@ghssghallanai\r\nDTSTAMP:${toIcsDate(new Date().toISOString().slice(0, 10))}T000000Z\r\nDTSTART;VALUE=DATE:${toIcsDate(e.start_date)}\r\n${
            e.end_date ? `DTEND;VALUE=DATE:${toIcsDate(e.end_date)}\r\n` : ""
          }SUMMARY:${e.title.replace(/[,;]/g, " ")}\r\nEND:VEVENT\r\n`
      )
      .join("") +
    "END:VCALENDAR";

  return (
    <>
      <PageHeader
        kicker="What's coming"
        title={<>Event <span className="text-gold">calendar</span></>}
        lead="Examination windows, holidays, parent-teacher meetings and school functions — published from the admin console's Event Calendar section."
        breadcrumbs={[{ name: "Calendar", href: "/calendar" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16" aria-label="Upcoming events">
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-small font-semibold">No upcoming events published.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The office calendar fills up as the session progresses — check the notice board meanwhile.
            </p>
            <p className="mt-3">
              <Link href="/notices" className="text-xs font-bold text-primary hover:underline underline-offset-4">
                Go to notices →
              </Link>
            </p>
          </div>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border/70 pl-6">
            {events.map((e, i) => {
              const meta = EVENT_TYPE_META[e.event_type] ?? EVENT_TYPE_META.general;
              const d = new Date(e.start_date + "T00:00:00");
              return (
                <Reveal as="li" key={e.id} delay={i * 50} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[calc(1.5rem+5px)] top-5 h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-background"
                  />
                  <article className="card-lift rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[0.68rem] font-bold uppercase tracking-[0.14em] ${meta.color}`}>
                          {meta.label}
                        </p>
                        <h2 className="mt-1 text-small font-bold leading-snug">{e.title}</h2>
                        {e.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{e.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-center">
                        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                          {d.toLocaleDateString("en-PK", { month: "short" })}
                        </p>
                        <p className="font-display text-2xl font-bold text-primary">{d.getDate()}</p>
                        <p className="text-[0.65rem] font-semibold text-muted-foreground">{d.getFullYear()}</p>
                      </div>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {formatDate(e.start_date)}
                      {e.end_date ? ` — ${formatDate(e.end_date)}` : ""}
                      <span aria-hidden>·</span>
                      {SITE.fullName}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </ol>
        )}

        {/* One-click .ics subscription (data URL) */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Add these to your phone:{" "}
          <a
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
            download="ghss-ghallanai-events.ics"
            className="font-bold text-primary hover:underline underline-offset-4"
          >
            Download the calendar file (.ics)
          </a>
        </p>
      </section>
    </>
  );
}
