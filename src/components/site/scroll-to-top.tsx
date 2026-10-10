"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * ScrollToTop — floating round button (Babi Khel feature). Appears past
 * 400px of scroll, auto-hides 900ms after scrolling stops.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const show = window.scrollY > 400;
      setVisible(show);
      if (show) {
        setPeek(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setPeek(false), 900);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll back to top"
      className={`button-press fixed bottom-36 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur transition-opacity lg:bottom-[4.5rem] lg:right-6 ${
        peek ? "opacity-100" : "opacity-70 hover:opacity-100"
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
