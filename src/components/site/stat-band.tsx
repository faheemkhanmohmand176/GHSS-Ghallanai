import { Odometer } from "./odometer";
import { Reveal } from "./reveal";
import { SCHOOL_STATS } from "@/content/programmes";

/**
 * Statistics band — deep-green panel, gold figures, odometer counters (§6.1).
 * Pattern adopted from TMUC/Exeter research.
 */
export function StatBand() {
  return (
    <section aria-label="School statistics" className="bg-primary-strong dark:bg-[#0a1810]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 md:py-12">
        {SCHOOL_STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="text-center">
            <p className="text-num text-gold">
              <Odometer value={s.value} />
              {s.suffix}
            </p>
            <p className="mt-2 text-small font-medium text-[#E8F5EC]/80">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
