import type { Metadata } from "next";
import Link from "next/link";
import { Landmark, ShieldCheck, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { FEES, SCHOLARSHIPS } from "@/content/news";
import { WHATSAPP_LINK, SITE } from "@/content/site";
import { WhatsAppIcon } from "@/components/site/whatsapp";

export const metadata: Metadata = {
  title: "Fee Structure & Concessions",
  description:
    "The official fee table of GHSS Ghallanai — admission fee, laboratory and sports funds, board fees as notified, plus merit and need-based concessions. No hidden charges.",
};

export default function FeesPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · For parents"
        title={<>Fees stated <span className="text-gold">plainly</span></>}
        lead="As a government institution there is no monthly tuition fee. The table lists every head a family pays, exactly as the office collects it — board fees pass through at the board's own notification, nothing added."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Fee Structure", href: "/admissions/fees" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <SectionHeading kicker="Fee table" title={`Every head, ${SITE.session} session`} />
            <Reveal>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/60 text-left">
                      <th className="px-5 py-3.5 font-bold">Head</th>
                      <th className="px-5 py-3.5 font-bold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEES.map((f) => (
                      <tr key={f.head} className="border-b border-border/50 last:border-0">
                        <td className="px-5 py-3.5">{f.head}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-primary">{f.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border bg-secondary/40 px-5 py-3 text-xs text-muted-foreground">
                  SAMPLE table — the office publishes the confirmed fee schedule with the admission
                  notice each session, per the government fee structure for the school&apos;s category.
                </p>
              </div>
            </Reveal>
            <p className="mt-4 text-small text-muted-foreground">
              Online payment arrives in a future release (Master Plan §6.4). Until then, fees are
              deposited at the school office counter against a proper receipt.
            </p>
          </div>

          <div>
            <SectionHeading kicker="Concessions & scholarships" title="What a family can claim" />
            <ul className="space-y-3">
              {SCHOLARSHIPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 60}>
                  <div className="card-lift rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2.5">
                      {i === 0 ? (
                        <Trophy_ />
                      ) : i === 1 ? (
                        <HandCoins className="h-5 w-5 text-primary" aria-hidden />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                      )}
                      <h3 className="text-small font-bold">{s.title}</h3>
                    </div>
                    <p className="mt-2 text-small leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-h3">Questions about fees?</h2>
              <p className="mt-2 text-small text-muted-foreground">
                The office answers fee questions on WhatsApp during office hours — usually the
                fastest route for a parent.
              </p>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-small font-semibold hover:border-gold hover:text-gold"
              >
                <WhatsAppIcon className="h-4 w-4" />
                WhatsApp the office
              </a>
            </div>
          </div>
        </div>

        <p className="mt-10 text-small">
          <Link href="/admissions/apply" className="font-semibold text-primary underline underline-offset-4">
            Apply online →
          </Link>{" "}
          · <Link href="/admissions/faq" className="font-semibold text-primary underline underline-offset-4">
            Read the FAQ →
          </Link>
        </p>
      </section>
    </>
  );
}

function Trophy_() {
  return <Landmark className="h-5 w-5 text-primary" aria-hidden />;
}
