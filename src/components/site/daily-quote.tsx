"use client";

import { useEffect, useState } from "react";

/**
 * DailyQuote — "Thought of the Day" (Babi Khel pattern): a static,
 * deterministic quote rotated by day-of-year. Zero network, zero flash.
 */
export function DailyQuote({ quote }: { quote: { text: string; author: string; category: string } }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 100);
    return () => clearTimeout(t);
  }, []);

  const theme =
    quote.category === "islamic"
      ? "from-emerald-600/90 to-teal-800/90 text-white"
      : quote.category === "educational"
        ? "from-sky-700/90 to-indigo-800/90 text-white"
        : "from-amber-600/90 to-orange-700/90 text-white";

  return (
    <section aria-label="Thought of the day" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-20">
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-lg transition-all duration-700 sm:p-10 ${theme} ${
          shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <span aria-hidden className="pointer-events-none absolute -top-6 left-4 select-none font-serif text-[9rem] leading-none opacity-15">
          ❝
        </span>
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">Thought of the day</p>
          <blockquote className="mt-3 max-w-2xl font-display text-lg italic leading-relaxed sm:text-xl">
            “{quote.text}”
          </blockquote>
          <p className="mt-4 inline-flex items-center gap-2 text-small font-semibold">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">— {quote.author}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
