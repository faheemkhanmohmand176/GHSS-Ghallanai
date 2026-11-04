import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  /** What to call when the applicant taps Retry (usually refresh()). */
  onRetry: () => void;
  /** Short description of what could not load. */
  what?: string;
  /** Optional "back" link shown under the button. */
  backTo?: { to: string; label: string };
}

/**
 * AdmissionSessionRetry — shown by the portal pages when the applicant's
 * session/data could not be loaded because of the NETWORK (never for a real
 * "not found" / "expired" answer).
 *
 * Replaces two bad slow-internet behaviours:
 *   • AdmissionPortal used to fall through to "No applications yet" while the
 *     session call was failing — an applicant could genuinely panic.
 *   • ApplyFlow / profile forms rendered their forms with no session behind
 *     them, so every submit failed with a confusing error.
 *
 * The message is deliberately calm and truthful: nothing is lost, the server
 * still has the application, just retry. Design matches the admission
 * feature's premium gold-on-card language (mobile-first).
 */
export default function AdmissionSessionRetry({ onRetry, what, backTo }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="border-amber-500/40 bg-amber-500/[0.04] shadow-card">
      <CardContent className="p-7 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <WifiOff className="h-6 w-6 text-amber-600" strokeWidth={1.5} />
        </div>
        <h2 className="font-heading text-xl font-bold text-foreground">Couldn't load {what || "your session"}</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          Your connection is slow or offline. Nothing is lost — the college server still has
          every detail you saved. Check your connection and try again.
        </p>
        <Button
          onClick={() => { setBusy(true); try { onRetry(); } finally { setBusy(false); } }}
          disabled={busy}
          className="mt-5 h-11 px-8 font-semibold"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          Try Again
        </Button>
        {backTo && (
          <div className="mt-3">
            <Link to={backTo.to} className="text-[12.5px] font-semibold text-primary hover:underline">
              {backTo.label}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
