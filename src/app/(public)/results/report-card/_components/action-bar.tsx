"use client";

import { Printer, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionBarProps {
  /** Text payload for the Web Share API / clipboard fallback. */
  shareText: string;
  /** Title used by navigator.share. */
  shareTitle: string;
}

/**
 * ActionBar — print / share / new-search actions for the report card.
 *
 * Print → window.print() (the page-level print stylesheet isolates the
 * report card).
 *
 * Share → navigator.share when available, otherwise falls back to
 * navigator.clipboard.writeText.
 *
 * New Search → navigates back to /results/report-card (clearing
 * searchParams so the lookup tabs reappear).
 */
export function ReportCardActionBar({ shareText, shareTitle }: ActionBarProps) {
  return (
    <div className="no-print mt-8 flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}
        className="h-11 rounded-full font-semibold"
      >
        <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          if (typeof navigator === "undefined") return;
          if (navigator.share) {
            try {
              await navigator.share({ title: shareTitle, text: shareText });
            } catch {
              /* user dismissed — ignore */
            }
          } else if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(shareText);
            } catch {
              /* ignore */
            }
          }
        }}
        className="h-11 rounded-full font-semibold"
      >
        <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> Share
      </Button>
      <Button asChild variant="ghost" className="h-11 rounded-full font-semibold">
        <a href="/results/report-card">
          <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> New Search
        </a>
      </Button>
    </div>
  );
}
