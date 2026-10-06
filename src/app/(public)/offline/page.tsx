import Link from "next/link";
import { WifiOff, ArrowLeft, RefreshCw } from "lucide-react";
import { SITE } from "@/content/site";

export const metadata = {
  title: "You are offline",
  description: "The GHSS Ghallanai app is offline. Pages you have already visited still work.",
};

/**
 * /offline — service-worker fallback (§9.1). Pure static, tiny, bilingual.
 */
export default function OfflinePage() {
  return (
    <div className="app-shell">
      <main className="app-main mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
          <WifiOff className="h-10 w-10 text-primary" aria-hidden />
        </span>
        <h1 className="mt-6 text-h1">You are offline</h1>
        <p className="mt-3 text-lead text-muted-foreground">
          Pages you have already opened still work from your phone&apos;s cache. Reconnect to load
          the latest notices and results.
        </p>
        <p className="urdu-body mt-4 text-muted-foreground" dir="rtl" lang="ur">
          انٹرنیٹ دستیاب نہیں ہے — پہلے کھولے گئے صفحات اب بھی کام کر رہے ہیں۔
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <a
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-small font-bold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Try home (cached)
          </a>
          <button
            type="button"
            onClick={undefined}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-6 text-small font-semibold"
            data-reload
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Retry
          </button>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">
          {SITE.fullName} · {SITE.district}
        </p>
      </main>
    </div>
  );
}
