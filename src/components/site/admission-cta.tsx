import Link from "next/link";
import { ArrowRight, CalendarClock, GraduationCap, Search } from "lucide-react";
import type { SchoolSettingsRow } from "@/content/demo-content";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

/**
 * AdmissionCta — settings-driven final CTA (Babi Khel pattern).
 * OPEN state shows the session, deadline and Apply/Track buttons; CLOSED
 * state flips to a community message with results + programme links.
 */
export function AdmissionCta({ settings }: { settings: SchoolSettingsRow }) {
  const open =
    settings.admission_open &&
    (!settings.admission_deadline || settings.admission_deadline >= new Date().toISOString().slice(0, 10));

  return (
    <section aria-labelledby="admission-cta" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-primary-strong p-6 text-center shadow-xl dark:bg-[#0a1810] sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-gold/10 blur-2xl" />

          {open ? (
            <>
              <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft/30 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-gold dark:bg-gold-soft/15">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
                Admissions Open · {settings.admission_session}
              </p>
              <h2 id="admission-cta" className="mt-5 font-display text-2xl font-bold text-white sm:text-3xl">
                Apply for admission <span className="text-gold">today</span>
              </h2>
              {settings.admission_banner && (
                <p className="mx-auto mt-3 max-w-xl text-small leading-relaxed text-[#E8F5EC]/85">
                  {settings.admission_banner}
                </p>
              )}
              <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {settings.admission_deadline && (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8F5EC]">
                    <CalendarClock className="h-3.5 w-3.5 text-gold" aria-hidden />
                    Last date: {settings.admission_deadline}
                  </li>
                )}
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8F5EC]">
                  <GraduationCap className="h-3.5 w-3.5 text-gold" aria-hidden />
                  1st & 2nd Year
                </li>
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8F5EC]">
                  ICS · Pre-Medical · Pre-Engineering · Arts
                </li>
              </ul>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="button-press sheen relative h-12 overflow-hidden rounded-full bg-gold px-8 text-base font-bold text-[#1A2E22] hover:bg-gold-strong"
                >
                  <Link href="/admissions/apply">
                    Apply Online <ArrowRight className="ml-1 h-5 w-5" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="button-press h-12 rounded-full border-[#E8F5EC]/35 bg-transparent px-8 text-base font-semibold text-[#E8F5EC] hover:bg-[#E8F5EC]/10 hover:text-white"
                >
                  <Link href="/admissions/track">
                    <Search className="mr-1.5 h-4.5 w-4.5" aria-hidden /> Track my application
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Join our community</p>
              <h2 id="admission-cta" className="mt-5 font-display text-2xl font-bold text-white sm:text-3xl">
                Ready to begin your <span className="text-gold">educational journey</span>?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-small leading-relaxed text-[#E8F5EC]/85">
                Admissions for the {settings.admission_session} session are closed. Explore our programmes
                and check results while you wait for the next window.
              </p>
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="button-press h-12 rounded-full bg-gold px-8 text-base font-bold text-[#1A2E22] hover:bg-gold-strong"
                >
                  <Link href="/academics">Explore Programmes</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="button-press h-12 rounded-full border-[#E8F5EC]/35 bg-transparent px-8 text-base font-semibold text-[#E8F5EC] hover:bg-[#E8F5EC]/10 hover:text-white"
                >
                  <Link href="/results/lookup">Check Results</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
