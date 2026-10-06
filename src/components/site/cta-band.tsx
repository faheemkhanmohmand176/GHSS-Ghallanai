import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { SITE, WHATSAPP_LINK, formatDate } from "@/content/site";
import { WhatsAppIcon } from "./whatsapp";
import { Button } from "@/components/ui/button";

/**
 * CTA band — gold-on-green closing panel with admission status,
 * deadline, WhatsApp click-to-chat (§6.1, TMUC pattern).
 */
export function CtaBand() {
  return (
    <section className="bg-primary-strong dark:bg-[#0a1810]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="kicker !text-gold">Admissions {SITE.session}</p>
          <h2 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight text-[#FAFDF7]">
            {SITE.admissionStatus.open
              ? "Apply online today — the form takes fifteen minutes."
              : "The next admissions window opens soon."}
          </h2>
          {SITE.admissionStatus.open && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-small font-semibold text-gold">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Applications close {formatDate(SITE.admissionStatus.deadline)}
            </p>
          )}
          <p className="mt-4 text-lead text-[#E8F5EC]/80">
            Your progress saves as you type — one bus ride of connectivity is enough. Every
            applicant receives a tracking number and a WhatsApp confirmation.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full bg-gold px-8 text-base font-bold text-[#1A2E22] hover:bg-gold-strong">
              <Link href="/admissions/apply">Apply Online</Link>
            </Button>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-[#E8F5EC]/30 px-6 text-base font-semibold text-[#E8F5EC] transition-colors hover:border-gold hover:text-gold"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
