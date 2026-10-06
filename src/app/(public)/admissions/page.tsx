import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { ADMISSION_STEPS, ADMISSION_DATES } from "@/content/news";
import { SITE, formatDate, WHATSAPP_LINK } from "@/content/site";
import { CtaBand } from "@/components/site/cta-band";
import { WhatsAppIcon } from "@/components/site/whatsapp";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admissions — How to Apply (1st & 2nd Year) · HED-aligned",
  description:
    "Apply for admission to GHSS Ghallanai — both 1st-year (Part-I after matric) and 2nd-year (Part-II transfer) applications are accepted. The six-step form mirrors the HED KPK Online College Admission System (OCAS) at admission.hed.gkp.pk: admission type, matric academic record (board verification style), personal details (with domicile cascade), programme selection, documents, and review with declaration. Tracking ID issued on submission.",
};

const DOCUMENTS_FIRST_YEAR = [
  { doc: "Two passport-size photographs", note: "Recent, plain background" },
  { doc: "B-form (CRC) / own CNIC photocopy", note: "CNIC required if 18+ at the time of applying" },
  { doc: "Father / guardian CNIC photocopy", note: "Required by HED admission policy" },
  { doc: "Matric result card / DMC", note: "Attested photocopy; provisional certificate accepted if board card is pending" },
  { doc: "Domicile certificate (own / father)", note: "Per HED KPK admission policy" },
  { doc: "Character certificate", note: "From the institution last attended; or signed by a gazetted officer if private candidate" },
  { doc: "Concession / scholarship proof", note: "Only if applying for a merit or need-based concession" },
];

const DOCUMENTS_SECOND_YEAR = [
  ...DOCUMENTS_FIRST_YEAR,
  { doc: "1st-year (Part-I) detail mark certificate (DMC)", note: "From the issuing board" },
  { doc: "Board registration certificate (1st year)", note: "Proves board registration is active" },
  { doc: "Migration affidavit on Rs.50 stamp paper", note: "Undertaking to obtain NOC/migration certificate from the previous college before enrolment" },
];

export default function AdmissionsPage() {
  return (
    <>
      <PageHeader
        kicker={`Admissions ${SITE.session}`}
        title={<>Four steps from <span className="text-gold">matric</span> to first / second year</>}
        lead="The admission journey is engineered around the parent's decision sequence — understand, prepare, apply, track. Applications for both 1st-year (Part-I after matric) and 2nd-year (Part-II transfer) admission in ICS, Pre-Medical, Pre-Engineering and Arts are open now. The form mirrors the HED KPK Online College Admission System (OCAS) so applicants see familiar fields."
        breadcrumbs={[{ name: "Admissions", href: "/admissions" }]}
      />

      {/* Journey timeline (§6.4) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="journey">
        <SectionHeading kicker="The journey" title="How admissions work" />
        <ol className="grid gap-4 md:grid-cols-4">
          {ADMISSION_STEPS.map((s, i) => (
            <Reveal as="li" key={s.step} delay={i * 60}>
              <Link
                href={s.href}
                className="card-lift group flex h-full flex-col rounded-xl border border-border bg-card p-5 focus-visible:border-gold"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground">
                  {s.step}
                </span>
                <h3 className="mt-4 text-base font-bold group-hover:text-primary">{s.title}</h3>
                <p className="mt-2 flex-1 text-small leading-relaxed text-muted-foreground">{s.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] text-gold">
                  Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Key dates table */}
      <section className="border-y border-border/70 bg-secondary/50" aria-labelledby="dates">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <SectionHeading
            kicker={`Key dates — ${SITE.session}`}
            title="Mark these on the calendar"
            lead="SAMPLE dates for the coming session; confirmed dates arrive with the admission notice and are broadcast on WhatsApp."
          />
          <Reveal>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/60 text-left">
                    <th className="px-5 py-3.5 font-bold">Stage</th>
                    <th className="px-5 py-3.5 font-bold">Date</th>
                    <th className="px-5 py-3.5 font-bold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ADMISSION_DATES.map((d) => {
                    const isDeadline = d.stage.includes("deadline");
                    return (
                      <tr key={d.stage} className="border-b border-border/50 last:border-0">
                        <td className="px-5 py-3.5 font-semibold">{d.stage}</td>
                        <td className="px-5 py-3.5">
                          <span className={isDeadline ? "font-bold text-gold-strong dark:text-gold" : "text-muted-foreground"}>
                            {formatDate(d.date)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{d.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Documents checklist (§6.4) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="documents">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <SectionHeading
              kicker="Documents"
              title="What to have ready before you apply"
              lead="Gather these before starting the online form — the upload step asks for all required documents. The list mirrors the HED KPK admission policy. 2nd-year (Part-II) applicants must additionally attach their 1st-year records and migration affidavit. Families preferring paper can collect the same form from the school office."
            />
            <h3 className="mb-3 mt-2 text-small font-bold uppercase tracking-wide text-muted-foreground">1st year (Part-I) applicants</h3>
            <ul id="documents-1" className="space-y-3">
              {DOCUMENTS_FIRST_YEAR.map((d, i) => (
                <Reveal as="li" key={d.doc} delay={i * 60}>
                  <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-small font-bold">{d.doc}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
            <h3 className="mb-3 mt-6 text-small font-bold uppercase tracking-wide text-muted-foreground">2nd year (Part-II transfer applicants) — additional documents</h3>
            <ul id="documents-2" className="space-y-3">
              {DOCUMENTS_SECOND_YEAR.slice(DOCUMENTS_FIRST_YEAR.length).map((d, i) => (
                <Reveal as="li" key={d.doc} delay={i * 60}>
                  <div className="flex gap-3 rounded-xl border border-gold/40 bg-gold-soft/20 p-4 dark:bg-gold-soft/10">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gold-strong dark:text-gold" aria-hidden />
                    <div>
                      <p className="text-small font-bold">{d.doc}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
            <p className="mt-4 text-small text-muted-foreground no-print">
              <Download className="mr-1 inline h-4 w-4" aria-hidden />
              The printable checklist PDF ships with the prospectus — collect it from the school
              office, or use this page&apos;s print view (browser menu → Print).
            </p>
          </div>

          {/* Tracking explainer */}
          <div id="tracking" className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 className="text-h3">Tracking your application</h2>
            <p className="mt-3 text-small leading-relaxed text-muted-foreground">
              Every submitted application issues a formatted number like{" "}
              <span className="font-bold text-primary">GHSS-2026-0001</span>. Keep it — it is how
              you follow the process and how the office references you.
            </p>
            <ol className="mt-5 space-y-3 text-small">
              {[
                ["Received", "Form submitted; documents verified by the office"],
                ["Under review", "Marks checked against the stream's eligibility"],
                ["Shortlisted", "Called for test/interview where applicable"],
                ["Merit list", "Published on this website and the notice board"],
                ["Admitted", "Fee deposit and enrolment week complete the journey"],
              ].map(([s, d], i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-bold">{s}</span>
                    <span className="mt-0.5 block text-muted-foreground">{d}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="h-11 rounded-full font-semibold">
                <Link href="/admissions/register">
                  Register &amp; apply <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full font-semibold">
                <Link href="/admissions/track">Track application</Link>
              </Button>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-small font-semibold hover:border-gold hover:text-gold"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Ask on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
