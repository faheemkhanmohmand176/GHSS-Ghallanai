import type { Metadata } from "next";
import { Download, ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { getMeritList } from "@/lib/data";
import { Reveal } from "@/components/site/reveal";


export const metadata: Metadata = {
  title: "Merit Lists — Published & Versioned",
  description:
    "Admission merit lists of GHSS Ghallanai published as accessible HTML tables with PDF downloads — dated, versioned, and archived by session.",
};

export default async function MeritListPage() {
  const merit = await getMeritList();
  const version = "v1.0";
  const published = "30 Nov 2025";
  const counts = {
    admitted: merit.filter((m) => m.status === "Admitted").length,
    waitlisted: merit.filter((m) => m.status === "Waitlisted").length,
  };

  return (
    <>
      <PageHeader
        kicker="Results · Merit lists"
        title={<>The merit list, <span className="text-gold">published</span></>}
        lead="Accessible HTML tables — not scanned photographs — with the version and publication date stated, so every family sees the same list at the same moment."
        breadcrumbs={[
          { name: "Results", href: "/results" },
          { name: "Merit Lists", href: "/results/merit-list" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2">First-year admission · Session 2026-27</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ListOrdered className="h-4 w-4" aria-hidden />
                {merit.length} listed · {counts.admitted} admitted · {counts.waitlisted} waitlisted
              </span>
              <span aria-hidden>·</span>
              <span>
                Published {published} · {version}
              </span>
            </p>
          </div>
          <span className="no-print inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-5 text-small font-semibold text-muted-foreground" aria-disabled="true" title="Generated from the admin dashboard in production">
            <Download className="h-4 w-4" aria-hidden /> PDF (office copy)
          </span>
        </div>

        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">
                Merit list for first-year admission, session 2026-27, ranked by matriculation
                percentage with test scores where applicable
              </caption>
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left">
                  <th className="px-5 py-3.5 font-bold">Merit #</th>
                  <th className="px-5 py-3.5 font-bold">Application No</th>
                  <th className="px-5 py-3.5 font-bold">Candidate</th>
                  <th className="px-5 py-3.5 font-bold">Programme</th>
                  <th className="px-5 py-3.5 font-bold text-right">Matric %</th>
                  <th className="px-5 py-3.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {merit.map((m) => (
                  <tr key={m.applicationNo} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3.5 font-bold text-primary">{m.meritNo}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{m.applicationNo}</td>
                    <td className="px-5 py-3.5 font-medium">{m.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{m.programme}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">{m.matricPercent}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          m.status === "Admitted"
                            ? "bg-secondary text-primary"
                            : "bg-gold-soft text-gold-strong dark:text-gold"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-small font-bold">How this list was produced</h3>
            <p className="mt-2 text-small leading-relaxed text-muted-foreground">
              Ranked from admitted-mark applications against each programme&apos;s seat quota, by
              matric percentage (plus admission test score where a test was held). The publish
              action in the admin dashboard generates the list, posts it here, and triggers the
              WhatsApp broadcast in one click (Master Plan §7.1).
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-small font-bold">Previous years</h3>
            <ul className="mt-2 space-y-2 text-small">
              {[
                ["Session 2025-26 first-year admission", "published 28 Nov 2024 · v1.2"],
                ["Session 2024-25 first-year admission", "published 30 Nov 2023 · v2.0 (revision after quota adjustment)"],
              ].map(([t, d]) => (
                <li key={t} className="flex flex-col border-b border-border/50 pb-2 last:border-0">
                  <span className="font-semibold">{t}</span>
                  <span className="text-xs text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              SAMPLE entries — archives fill automatically as lists are published in production.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
