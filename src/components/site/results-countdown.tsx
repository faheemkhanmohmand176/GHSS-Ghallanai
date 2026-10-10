"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

/**
 * ResultsCountdownStrip — gold ribbon pinned above the header counting
 * down to the next scheduled board-results publish (Babi Khel feature,
 * school-schedule mode; roll-no-slip surfaces excluded by request).
 * Flips to "Results are LIVE" for 90 seconds after the moment passes.
 */
export function ResultsCountdownStrip({ at, label }: { at: string; label: string }) {
  const target = new Date(at).getTime();
  const [now, setNow] = useState<number | null>(null); // null until mounted (no SSR mismatch)

  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  if (now === null) return null;

  const diff = target - now;
  if (diff < -90_000) return null; // long past — let the published results speak

  if (diff <= 0) {
    return (
      <Link
        href="/results/lookup"
        className="block bg-gradient-to-r from-[#A97C0C] via-[#B8860B] to-[#A97C0C] text-center text-small font-bold text-[#1A2E22]"
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Results are LIVE — tap to view
        </span>
      </Link>
    );
  }

  const dd = Math.floor(diff / 86_400_000);
  const hh = Math.floor((diff % 86_400_000) / 3_600_000);
  const mm = Math.floor((diff % 3_600_000) / 60_000);
  const ss = Math.floor((diff % 60_000) / 1000);
  const chip = (v: number, l: string) => (
    <span className="inline-flex items-center gap-1">
      <span className="rounded bg-[#0e3b20] px-1.5 py-0.5 font-mono text-xs font-bold text-[#F2D27A] tabular-nums">
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[0.65rem] font-semibold uppercase opacity-80">{l}</span>
    </span>
  );

  return (
    <Link
      href="/results"
      className="block bg-gradient-to-r from-[#A97C0C] via-[#B8860B] to-[#A97C0C] text-center text-small font-bold text-[#1A2E22]"
      aria-live="off"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1A2E22] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1A2E22]" />
          </span>
          {label.toUpperCase()} IN
        </span>
        {dd > 0 && chip(dd, "d")}
        {chip(hh, "h")}
        {chip(mm, "m")}
        {chip(ss, "s")}
      </span>
    </Link>
  );
}
