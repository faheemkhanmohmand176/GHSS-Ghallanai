"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HeroTypewriter — segment-aware typewriter (Babi Khel pattern).
 * The full sentence stays in the DOM (sr-only) for SEO/prerender; the visible
 * line types character-by-character. Invisible placeholder reserves the exact
 * height so there is never a layout shift. Pauses when the tab is hidden and
 * renders statically under prefers-reduced-motion.
 */
export function HeroTypewriter({
  phrases,
  className,
}: {
  phrases: string[];
  className?: string;
}) {
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const alive = useRef(true);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (reduced || phrases.length === 0) return;
    const current = phrases[idx % phrases.length];
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!alive.current) return;
      if (document.hidden) {
        timer = setTimeout(tick, 1000);
        return;
      }
      if (!deleting) {
        const next = current.slice(0, text.length + 1);
        setText(next);
        if (next === current) {
          timer = setTimeout(() => {
            setDeleting(true);
            tick();
          }, 2200);
          return;
        }
        timer = setTimeout(tick, 62);
      } else {
        const next = current.slice(0, Math.max(0, text.length - 1));
        setText(next);
        if (next.length === 0) {
          setDeleting(false);
          setIdx((i) => (i + 1) % phrases.length);
          timer = setTimeout(tick, 500);
          return;
        }
        timer = setTimeout(tick, 34);
      }
    };
    tick();
    return () => clearTimeout(timer);
  }, [text, deleting, idx, phrases, reduced]);

  if (reduced || phrases.length === 0) {
    return <span className={className}>{phrases[0] ?? ""}</span>;
  }

  return (
    <span className={className}>
      {/* Full sentence for crawlers + screen readers */}
      <span className="sr-only">{phrases.join(". ")}</span>
      <span aria-hidden className="relative">
        {/* Invisible placeholder keeps the exact height reserved */}
        <span className="invisible">{phrases[idx % phrases.length]}</span>
        {/* Typed text with a gold underline that tracks its own width */}
        <span className="absolute inset-0">
          <span className="border-b-2 border-gold/50 pb-0.5">
            {text}
          </span>
          <span className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] animate-pulse bg-gold align-middle" />
        </span>
      </span>
    </span>
  );
}
