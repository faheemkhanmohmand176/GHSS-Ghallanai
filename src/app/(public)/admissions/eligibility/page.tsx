import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { PROGRAMMES } from "@/content/programmes";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admission Eligibility",
  description:
    "Entry requirements for ICS, Pre-Medical, Pre-Engineering and Arts at GHSS Ghallanai — minimum matric marks and required subject combinations per stream.",
};

export default function EligibilityPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Step 1"
        title={<>Eligibility per <span className="text-gold">programme</span></>}
        lead="The table below states each stream's entry requirements exactly as the admissions committee applies them. Minimum marks are guidance drawn from what succeeds in the stream, not hard gates — the committee reviews borderline cases individually."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Eligibility", href: "/admissions/eligibility" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/60 text-left">
                  <th className="px-5 py-3.5 font-bold">Programme</th>
                  <th className="px-5 py-3.5 font-bold">Matric group</th>
                  <th className="px-5 py-3.5 font-bold">Required subjects</th>
                  <th className="px-5 py-3.5 font-bold">Comfortable minimum</th>
                </tr>
              </thead>
              <tbody>
                {PROGRAMMES.map((p) => (
                  <tr key={p.slug} className="border-b border-border/50 align-top last:border-0">
                    <td className="px-5 py-4">
                      <Link href={`/academics/${p.slug}`} className="font-bold text-primary hover:underline underline-offset-4">
                        {p.shortName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{p.eligibility[0].detail}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {p.eligibility.slice(1).map((e) => e.requirement).join("; ")}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{p.eligibility[1].detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="flex gap-3 rounded-xl border border-border bg-card p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-small font-bold">Borderline cases are reviewed, not rejected</h2>
                <p className="mt-1 text-small text-muted-foreground">
                  A student two marks under the guidance line for a stream they are determined to
                  join should still apply: the committee weighs matric subject scores, the
                  interview, and seat availability before deciding.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div className="flex gap-3 rounded-xl border border-gold/40 bg-gold-soft/30 p-5 dark:bg-gold-soft/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-strong dark:text-gold" aria-hidden />
              <div>
                <h2 className="text-small font-bold">Programme eligibility pre-check runs in the form</h2>
                <p className="mt-1 text-small text-muted-foreground">
                  The online application checks your matric marks and subjects against the chosen
                  stream automatically and flags any mismatch before you submit — so a wrong
                  combination never reaches the committee.
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-10 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="h-11 rounded-full px-6 font-semibold">
            <Link href="/admissions/apply">Proceed to the Application</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full px-6 font-semibold">
            <Link href="/admissions/fees">See the Fee Structure</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
