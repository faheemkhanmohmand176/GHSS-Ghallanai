import { MARQUEE_SUBJECTS } from "@/content/demo-content";

/**
 * SubjectsMarquee — two copies of the subject chip row scrolling at a fixed
 * 40s loop (pure CSS, GPU-composited). Edge gradients fade the ends.
 * Reduced-motion: static wrapped chips (CSS `motion-safe:` gating).
 */
export function SubjectsMarquee() {
  const chips = [...MARQUEE_SUBJECTS, ...MARQUEE_SUBJECTS];
  return (
    <section aria-label="Subjects taught at the school" className="border-b border-border/70 bg-background">
      <div className="relative overflow-hidden py-4">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent"
          aria-hidden
        />
        <div className="marquee-row flex w-max items-center gap-3 motion-safe:animate-none motion-reduce:!animate-none"
          style={{ animation: "ghss-marquee 40s linear infinite" }}>
          <style>{`@keyframes ghss-marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
@media (prefers-reduced-motion: reduce) { .marquee-row { animation: none !important; flex-wrap: wrap; width: 100%; justify-content: center; } }`}</style>
          {chips.map((s, i) => (
            <span
              key={`${s}-${i}`}
              aria-hidden={i >= MARQUEE_SUBJECTS.length}
              className="inline-flex shrink-0 items-center rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-small font-semibold text-foreground/80"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
