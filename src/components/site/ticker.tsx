import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import type { Notice } from "@/content/news";
import { formatDate } from "@/content/site";

/**
 * NoticeTicker — marquee of latest notices, pauses on hover/focus,
 * links each item (§6.1). Reduced-motion: wraps statically (CSS).
 */
export function NoticeTicker({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  const items = notices.slice(0, 4);
  return (
    <div className="border-b border-border/70 bg-secondary">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-primary">
          <Megaphone className="h-3.5 w-3.5" aria-hidden />
          Notices
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center gap-8">
            {[...items, ...items].map((n, i) => (
              <Link
                key={`${n.id}-${i}`}
                href="/notices"
                className="inline-flex items-center gap-2 whitespace-nowrap text-small text-foreground/85 hover:text-foreground hover:underline underline-offset-4"
              >
                <span className="font-semibold">{n.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(n.date)}</span>
              </Link>
            ))}
          </div>
        </div>
        <Link
          href="/notices"
          className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline underline-offset-4 sm:inline-flex"
        >
          All notices <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
