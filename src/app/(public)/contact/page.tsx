import type { Metadata } from "next";
import { MapPin, Phone, Clock, Mail, Navigation } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/site/section-heading";
import { Reveal } from "@/components/site/reveal";
import { FeedbackForm } from "@/components/site/feedback-form";
import { WhatsAppIcon } from "@/components/site/whatsapp";
import { SITE, WHATSAPP_LINK, MAP_LINK } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact & Directions",
  description:
    "Reach GHSS Ghallanai: office directory, WhatsApp, visiting hours, directions from Mohmand's main junctions, and the feedback channel that reaches the principal's office.",
  alternates: { languages: { ur: "/ur/contact" } },
};

const DIRECTORY = [
  { office: "Principal's office", contact: SITE.phone, hours: "By appointment · school hours" },
  { office: "Admissions office", contact: SITE.whatsappDisplay, hours: SITE.officeHours },
  { office: "Exam branch", contact: SITE.phone, hours: SITE.officeHours },
  { office: "General office", contact: SITE.email, hours: SITE.officeHours },
];

const DIRECTIONS = [
  "From Ghalanai main bazaar: the school sits a few minutes' walk from the district headquarters complex — any shopkeeper can point the way to 'Sarkari High School'.",
  "From Mohmand's main junctions: shared transport runs to Ghallanai throughout the day; ask for the stop nearest the district offices (DC office side).",
  "Visiting: bring your CNIC for the gate register. Office staff flagged unannounced document requests as the most common visitor pain — carrying your documents saves a second trip.",
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        kicker="Contact"
        title={<>Talk to the <span className="text-gold">school</span></>}
        lead="The office answers WhatsApp fastest during school hours; the feedback channel below files directly into the principal's dashboard with a tracked reference."
        breadcrumbs={[{ name: "Contact", href: "/contact" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          {/* Left: directory + WhatsApp + map */}
          <div className="space-y-8">
            <div>
              <SectionHeading kicker="Directory" title="Offices and hours" />
              <ul className="space-y-3">
                {DIRECTORY.map((d, i) => (
                  <Reveal as="li" key={d.office} delay={i * 50}>
                    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
                      <div>
                        <p className="text-small font-bold">{d.office}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{d.hours}</p>
                      </div>
                      <p className="text-small font-semibold text-primary">{d.contact}</p>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>

            {/* WhatsApp card — prominent (§6.7) */}
            <Reveal>
              <div className="rounded-2xl border border-border bg-[#075E54] p-6 text-white md:p-8 dark:border-[#075E54]/40">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366]">
                    <WhatsAppIcon className="h-6 w-6 text-white" />
                  </span>
                  <div>
                    <p className="text-base font-bold">WhatsApp the school</p>
                    <p className="text-small text-white/75">{SITE.whatsappDisplay}</p>
                  </div>
                </div>
                <p className="mt-4 text-small leading-relaxed text-white/85">
                  The community&apos;s default channel — admission questions, fee questions,
                  result-day queries. Opt-in families receive the school&apos;s broadcast alerts
                  for notices, merit lists and results. Quiet hours 9 PM – 7 AM are respected.
                </p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-6 text-small font-bold text-white transition-transform hover:scale-[1.02]"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Start the chat
                </a>
              </div>
            </Reveal>

            {/* Location (static, low-bandwidth — external map link, no heavy embed JS) */}
            <Reveal>
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-5 w-5 text-primary" aria-hidden />
                  <h2 className="text-h3">Find us in Ghallanai</h2>
                </div>
                <ul className="mt-4 space-y-3 text-small leading-relaxed text-muted-foreground">
                  {DIRECTIONS.map((d, i) => (
                    <li key={i} className="flex gap-2.5">
                      <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
                <a
                  href={MAP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-small font-semibold hover:border-gold hover:text-gold"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  Open in Google Maps
                </a>
                <p className="mt-3 text-xs text-muted-foreground">
                  SAMPLE coordinates — pin the surveyed location in one line of site config.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Right: feedback form */}
          <div>
            <SectionHeading
              kicker="Feedback & complaints"
              title="The channel that reaches the principal"
              lead="Every submission receives a tracked reference and an acknowledgment — the complaint-channel pattern the plan adopts from Islamia College (§2.3)."
            />
            <FeedbackForm />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="flex items-center gap-2 text-small font-bold">
                  <Clock className="h-4 w-4 text-primary" aria-hidden /> Response time
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Acknowledged immediately; answered within working days by the concerned office.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="flex items-center gap-2 text-small font-bold">
                  <Mail className="h-4 w-4 text-primary" aria-hidden /> Also by email
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{SITE.email}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
