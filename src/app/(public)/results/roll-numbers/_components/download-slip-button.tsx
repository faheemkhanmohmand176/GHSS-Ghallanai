"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DownloadSlipButton — opens the browser print dialog so the family
 * can save the roll slip as a PDF (Master Plan §6.5 — "printable for
 * the family record"). The page-level print stylesheet isolates the
 * slip when printing.
 */
export function DownloadSlipButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="h-11 rounded-full font-semibold"
    >
      <Download className="mr-1.5 h-4 w-4" aria-hidden /> Download PDF
    </Button>
  );
}
