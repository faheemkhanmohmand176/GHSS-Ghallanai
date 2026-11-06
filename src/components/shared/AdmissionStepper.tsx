import { Check } from "lucide-react";

interface AdmissionStepperProps {
  steps: string[];
  /** 1-based index of the active step */
  current: number;
  /**
   * Every step is finished (e.g. the applicant was admitted).  The last step
   * is then drawn as completed instead of active, so a finished tracker never
   * looks like it is still waiting on something.
   */
  allComplete?: boolean;
}

/**
 * Slim, premium progress tracker for the admission flow.
 * Equal-width columns, labels never cut off (they wrap under each dot),
 * thin connecting rail with a gold fill for completed steps.
 */
export default function AdmissionStepper({ steps, current, allComplete = false }: AdmissionStepperProps) {
  return (
    <ol
      className="mb-6 grid rounded-2xl border border-gold/25 bg-card/80 px-2 py-3.5 shadow-card"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label="Progress"
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const done = allComplete ? true : n < current;
        const active = !allComplete && n === current;
        return (
          <li key={label} className="relative flex flex-col items-center text-center px-0.5">
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-[13px] right-1/2 h-px w-full ${done || active ? "bg-gold/80" : "bg-border"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                done
                  ? "bg-gold text-white"
                  : active
                  ? "border border-gold bg-card text-gold ring-4 ring-gold/15"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : n}
            </span>
            <span
              className={`mt-1.5 text-[10.5px] sm:text-[11.5px] leading-tight font-medium tracking-wide ${
                active ? "text-foreground" : done ? "text-foreground/80" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
