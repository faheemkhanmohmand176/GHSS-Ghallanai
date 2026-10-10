import { Odometer } from "./odometer";
import { Reveal } from "./reveal";
import type { SchoolSettingsRow } from "@/content/demo-content";

/**
 * Statistics band — deep-green panel, gold figures, odometer counters (§6.1).
 * Babi Khel pattern: five tiles driven by the College Setting row
 * (students, teachers, pass rate, established, board grade).
 */
export function StatBand({ settings }: { settings: SchoolSettingsRow }) {
  const tiles = [
    { label: "Students enrolled", value: settings.total_students ?? 640, suffix: "+" },
    { label: "Teaching staff", value: settings.total_teachers ?? 28, suffix: "" },
    { label: "Board pass rate", value: settings.pass_percentage ?? 92, suffix: "%" },
    { label: "Established", value: settings.established_year ?? 2005, suffix: "" },
    { label: "Board results grade", value: null, text: settings.board_results ?? "A+" },
  ];

  return (
    <section aria-label="School statistics" className="bg-primary-strong dark:bg-[#0a1810]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-5 md:py-12">
        {tiles.map((s, i) => (
          <Reveal key={s.label} delay={i * 80} className="text-center">
            {s.value !== null ? (
              <p className="text-num text-gold">
                <Odometer value={s.value} />
                {s.suffix}
              </p>
            ) : (
              <p className="text-num text-gold">{s.text}</p>
            )}
            <p className="mt-2 text-small font-medium text-[#E8F5EC]/80">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
