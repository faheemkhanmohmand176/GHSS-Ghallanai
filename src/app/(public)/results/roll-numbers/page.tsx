import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Hash, Search, User } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDemoUpcomingSession, getPublishedSession, getUpcomingSession, lookupRollNumber } from "./_lib/data";
import type { ExamRollNumber } from "./_lib/demo";
import { Countdown } from "./_components/countdown";
import { RollSlip } from "./_components/roll-slip";

export const metadata: Metadata = {
  title: "Exam Roll Numbers — 1st Year & 2nd Year · Annual Examination 2026",
  description:
    "Look up your exam roll number slip for the GHSS Ghallanai intermediate annual examination 2026. Search by class and full name — official, printable, shareable.",
  alternates: { languages: { ur: "/ur/results" } },
};

interface RollNumbersPageProps {
  searchParams: Promise<{
    class?: string;
    name?: string;
    preview?: string;
  }>;
}

export default async function RollNumbersPage({ searchParams }: RollNumbersPageProps) {
  const params = await searchParams;
  const classLabel = params.class?.trim();
  const nameQuery = params.name?.trim();
  const previewSoon = params.preview?.toLowerCase() === "soon";

  // Decide what mode to render in.
  // 1. ?preview=soon — force the Coming-Soon UI for QA/design review.
  // 2. LIVE/DEMO — query for the latest published session; if none, look for
  //    a scheduled upcoming session to drive the countdown.
  const session = previewSoon ? null : await getPublishedSession();
  const upcoming =
    !session && previewSoon
      ? getDemoUpcomingSession()
      : !session
        ? await getUpcomingSession()
        : null;

  // If a session is published AND the user has provided class + name, look up.
  let slip: ExamRollNumber | null = null;
  let notFound = false;
  let queryEcho: { class: string; name: string } | null = null;
  if (session && classLabel && nameQuery) {
    const r = await lookupRollNumber(session.id, classLabel, nameQuery);
    queryEcho = { class: classLabel, name: nameQuery };
    if (r) {
      slip = r;
    } else {
      notFound = true;
    }
  }

  // Generated-at stamp for the roll slip — server-time, fixed per render.
  const generatedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });

  return (
    <>
      <PageHeader
        kicker="Results · Exam Roll Numbers"
        title={
          <>
            Exam <span className="text-gold">Roll Numbers</span>
          </>
        }
        lead="1st Year & 2nd Year · Annual Examination 2026 — find your exam roll slip the moment it is published by the exam branch. Search by class and full name, then print the slip for your records."
        breadcrumbs={[
          { name: "Results", href: "/results" },
          { name: "Roll Numbers", href: "/results/roll-numbers" },
        ]}
      />

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Print stylesheet — isolate the roll slip when the user prints */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * { visibility: hidden !important; }
                .roll-slip-print, .roll-slip-print * { visibility: visible !important; }
                .roll-slip-print {
                  position: absolute !important;
                  top: 0; left: 0;
                  width: 100%;
                  border: 2px solid #14532d !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                }
                .no-print { display: none !important; }
              }
            `,
          }}
        />

        {/* Mode 1: Published session — show lookup form (+ slip if matched). */}
        {session && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="kicker">Published session</p>
                  <h2 className="mt-2 font-display text-h3 font-bold">{session.title}</h2>
                  <p className="mt-1 text-small text-muted-foreground">
                    {session.exam_term} · {session.exam_year} · Classes {session.classes.join(", ")}
                  </p>
                </div>
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-bold text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Live
                </span>
              </div>

              <form
                method="get"
                action="/results/roll-numbers"
                className="mt-6 grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="class" className="text-small font-semibold">
                    Class
                  </Label>
                  <select
                    id="class"
                    name="class"
                    defaultValue={classLabel ?? "1st Year"}
                    className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-small font-semibold">
                    Full name (as recorded on admission form)
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={nameQuery ?? ""}
                    placeholder="e.g. Muhammad Hamza Khan"
                    className="h-12 text-base"
                    autoComplete="off"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="h-11 w-full rounded-full font-semibold sm:w-auto">
                    <Search className="mr-1.5 h-4 w-4" aria-hidden /> Search Roll Number
                  </Button>
                </div>
              </form>

              <p className="mt-4 text-xs text-muted-foreground">
                SAMPLE data — try <span className="font-mono">Muhammad Hamza Khan</span> in 1st
                Year, or <span className="font-mono">Fatima Khan</span> in 2nd Year.
              </p>
            </div>

            {/* Result — the roll slip card */}
            {slip && <RollSlip slip={slip} sessionTitle={session.title} generatedAt={generatedAt} />}

            {/* Result — no match empty state */}
            {notFound && queryEcho && (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="mt-4 text-h3 font-display font-bold">No matching roll number</h3>
                <p className="mx-auto mt-2 max-w-md text-small text-muted-foreground">
                  We could not find a roll slip in <strong>{session.title}</strong> for{" "}
                  <strong>{queryEcho.name}</strong> in <strong>{queryEcho.class}</strong>. Check the
                  spelling of your name, or ask the exam branch to confirm how your name was
                  recorded.
                </p>
                <div className="no-print mt-6 flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline" className="h-11 rounded-full font-semibold">
                    <Link href="/results/roll-numbers">Start a new search</Link>
                  </Button>
                  <Button asChild variant="ghost" className="h-11 rounded-full font-semibold">
                    <Link href="/contact">Contact the exam branch</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: Coming Soon — upcoming session with a publish_at countdown. */}
        {!session && upcoming && <Countdown session={upcoming} previewMode={previewSoon} />}

        {/* Mode 3: Nothing published and nothing scheduled. */}
        {!session && !upcoming && (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <h3 className="mt-4 text-h3 font-display font-bold">Roll numbers not yet published</h3>
            <p className="mx-auto mt-2 max-w-md text-small text-muted-foreground">
              No exam roll number session is currently scheduled. The exam branch will announce the
              publication date in the notice ticker as the examination approaches.
            </p>
            <Button asChild variant="outline" className="mt-6 h-11 rounded-full font-semibold">
              <Link href="/notices">View notices</Link>
            </Button>
          </div>
        )}

        {/* Related lookups */}
        <div className="no-print mt-10 rounded-2xl border border-border bg-card p-6">
          <p className="kicker">Related lookups</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            <li>
              <Link
                href="/results/report-card"
                className="group flex items-start gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-secondary/40"
              >
                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold text-foreground transition-colors group-hover:text-primary">
                    Report Card Lookup
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Subject-wise card by exam roll number or report card code.
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/results/lookup"
                className="group flex items-start gap-3 rounded-lg p-2 -m-2 transition-colors hover:bg-secondary/40"
              >
                <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold text-foreground transition-colors group-hover:text-primary">
                    Board Result Lookup
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Subject-wise card by roll number, year and programme.
                  </span>
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
