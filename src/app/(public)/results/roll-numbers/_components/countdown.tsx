"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import type { ExamRollSession } from "../_lib/demo";

interface CountdownProps {
  session: ExamRollSession;
  previewMode?: boolean;
}

interface Diff {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function diffFromMs(remainingMs: number): Diff {
  const d = Math.max(0, remainingMs);
  return {
    days: Math.floor(d / 86_400_000),
    hours: Math.floor((d % 86_400_000) / 3_600_000),
    minutes: Math.floor((d % 3_600_000) / 60_000),
    seconds: Math.floor((d % 60_000) / 1_000),
    done: d === 0,
  };
}

const SKELETON: Diff = { days: 0, hours: 0, minutes: 0, seconds: 0, done: false };

/**
 * Countdown — "Coming Soon" panel with a live ticking countdown to the
 * next scheduled publish_at.
 *
 * Server-renders a static date line + skeleton tiles (so the markup is
 * stable across SSR/CSR hydration). On the client, a `requestAnimationFrame`
 * schedules the first tick (immediate — not synchronous-in-effect, which
 * would trip the cascading-render lint rule), then a 1-second interval
 * keeps the tiles fresh. Reduced-motion users still see the date stamp.
 */
export function Countdown({ session, previewMode }: CountdownProps) {
  const targetMs = session.publish_at ? new Date(session.publish_at).getTime() : 0;
  const [t, setT] = useState<Diff | null>(null);

  useEffect(() => {
    const tick = () => setT(diffFromMs(targetMs - Date.now()));
    // Defer the first tick to the next animation frame so it doesn't fire
    // synchronously inside the effect body.
    const rafId =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(tick)
        : setTimeout(tick, 16);
    const intervalId = setInterval(tick, 1000);
    return () => {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId as number);
      } else {
        clearTimeout(rafId as ReturnType<typeof setTimeout>);
      }
      clearInterval(intervalId);
    };
  }, [targetMs]);

  const mounted = t !== null;
  const value = t ?? SKELETON;

  const publishDate = session.publish_at
    ? new Date(session.publish_at).toLocaleString("en-PK", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
      })
    : null;

  const label = session.countdown_label || "Exam Roll Numbers will be published in";

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/40 bg-card">
      <header className="relative border-b border-border bg-gradient-to-br from-primary-strong to-primary px-6 py-6 text-[#FAFDF7] dark:from-[#0a1810] dark:to-[#12291b]">
        <span
          className="pointer-events-none absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-gold/70"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute bottom-4 left-4 h-10 w-10 border-b-2 border-l-2 border-gold/70"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <CrestMark className="h-14 w-14 shrink-0" />
          <div className="flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gold">
              Coming Soon
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
              {session.title}
            </h2>
            <p className="mt-1 text-small text-[#E8F5EC]/85">
              {session.exam_term} · {session.exam_year} · Classes {session.classes.join(", ")}
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8">
        <p className="text-center text-small font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>

        {mounted && session.publish_at && !value.done ? (
          <div className="mt-6 grid grid-cols-4 gap-3">
            <Tile label="Days" value={value.days} />
            <Tile label="Hours" value={value.hours} />
            <Tile label="Minutes" value={value.minutes} />
            <Tile label="Seconds" value={value.seconds} />
          </div>
        ) : mounted && value.done ? (
          <p className="mt-6 rounded-lg border border-gold/40 bg-gold-soft/30 px-4 py-4 text-center text-base font-semibold text-primary dark:text-gold">
            The session is being published — please refresh the page in a moment.
          </p>
        ) : (
          // Server-rendered / no-JS fallback — skeleton tiles before hydration.
          <div className="mt-6 grid grid-cols-4 gap-3" aria-hidden>
            <Tile label="Days" value={0} skeleton />
            <Tile label="Hours" value={0} skeleton />
            <Tile label="Minutes" value={0} skeleton />
            <Tile label="Seconds" value={0} skeleton />
          </div>
        )}

        {publishDate && (
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-small text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            Scheduled for <strong className="text-foreground">{publishDate}</strong>
          </p>
        )}

        {previewMode && (
          <p className="mt-4 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
            Preview mode (<code className="font-mono">?preview=soon</code>) — admin has not
            published a session yet, so this countdown is illustrative.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          The moment the countdown reaches zero, the roll-number lookup form will appear here
          automatically. The exam branch will also broadcast the publication on the school notice
          ticker and via WhatsApp.
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  skeleton,
}: {
  label: string;
  value: number;
  skeleton?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-secondary/30 p-3 text-center ${
        skeleton ? "animate-pulse" : ""
      }`}
    >
      <p className="font-display text-3xl font-black tabular-nums text-primary dark:text-gold">
        {value.toString().padStart(2, "0")}
      </p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
