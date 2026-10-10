"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";

/**
 * NewsTicker — Babi Khel's measured-width seamless loop, Next.js edition.
 * Headlines arrive as props (server-fetched: notices + news + admission
 * banner). The component renders one copy, measures it, duplicates it, then
 * animates a fixed 48 px/s translate — no width guesses, no jumps. The
 * duplicate copy is aria-hidden and pointer-transparent. Reduced-motion users
 * get a static wrapped list.
 */
export interface TickerItem {
  key: string;
  label: string;
  href: string;
  tag?: string;
}

export function NewsTicker({ items }: { items: TickerItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const [dur, setDur] = useState(24);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced || items.length === 0) return;
    const measure = () => {
      const el = trackRef.current;
      if (!el) return;
      const w = el.scrollWidth;
      if (w > 40) {
        setDistance(w + 40);
        setDur(Math.max(4, Math.round(w / 48)));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [items, reduced]);

  if (items.length === 0) return null;

  if (reduced) {
    return (
      <div className="border-b border-border/70 bg-secondary">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> Headlines
          </span>
          {items.map((i) => (
            <Link key={i.key} href={i.href} className="text-xs text-foreground/85 hover:text-foreground hover:underline underline-offset-4">
              {i.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-b border-border/70 bg-secondary">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary">
          <Megaphone className="h-3.5 w-3.5" aria-hidden />
          Headlines
        </span>
        <div
          className="relative flex-1 overflow-hidden"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          <style>{distance > 0 ? `@keyframes ghss-ticker { from { transform: translate3d(0,0,0); } to { transform: translate3d(-${distance}px,0,0); } }` : ""}</style>
          <div
            ref={trackRef}
            className="ticker-track flex w-max items-center gap-10"
            style={
              distance > 0
                ? { animation: `ghss-ticker ${dur}s linear infinite` }
                : undefined
            }
            onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
            onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
          >
            {items.map((i) => (
              <Link
                key={i.key}
                href={i.href}
                className="inline-flex items-center gap-2 whitespace-nowrap text-small text-foreground/85 hover:text-foreground hover:underline underline-offset-4"
              >
                {i.tag && (
                  <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-primary sm:inline-flex">
                    {i.tag}
                  </span>
                )}
                <span className="font-semibold">{i.label}</span>
              </Link>
            ))}
            {/* Second copy — measured loop, invisible to a11y tree */}
            {distance > 0 &&
              items.map((i) => (
                <Link
                  key={`${i.key}-dup`}
                  href={i.href}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none inline-flex items-center gap-2 whitespace-nowrap text-small text-foreground/85"
                >
                  {i.tag && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                      {i.tag}
                    </span>
                  )}
                  <span className="font-semibold">{i.label}</span>
                </Link>
              ))}
          </div>
        </div>
        <Link
          href="/notices"
          className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4 sm:inline-flex"
        >
          All notices
        </Link>
      </div>
    </div>
  );
}
