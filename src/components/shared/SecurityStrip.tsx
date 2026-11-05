/**
 * SecurityStrip — the Submit-step security check as ONE thin line ("tape").
 *
 * It wraps the Cloudflare Turnstile check but never shows Cloudflare's big
 * box.  The person only ever sees one slim status line:
 *
 *     ⟳ Verifying you are human…       →      ✓ Verified
 *
 * Cloudflare's own widget runs hidden in the background.  It is revealed (as
 * a thin line, never a square) only when Cloudflare itself needs a tap, when
 * the check is taking unusually long, or after an error — and a Retry button
 * is always available.  This removes the old "box appears, disappears,
 * appears…" confusion: a finished check simply turns the line green.
 *
 * If no Turnstile site key is configured the strip renders nothing (the
 * gateway skips verification in that case too).
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import Turnstile from "@/components/shared/Turnstile";

type State = "verifying" | "interactive" | "verified" | "error";

interface Props {
  onToken: (token: string) => void;
  onExpire: () => void;
}

export default function SecurityStrip({ onToken, onExpire }: Props) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [state, setState] = useState<State>("verifying");
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  // If verification is taking unusually long, show Cloudflare's thin line in
  // case it is waiting for a tap.
  useEffect(() => {
    if (state !== "verifying") { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [state, attempt]);

  const handleToken = useCallback((t: string) => { setState("verified"); onToken(t); }, [onToken]);
  const handleExpire = useCallback(() => { setState("verifying"); onExpire(); }, [onExpire]);
  const handleError = useCallback(() => { setState("error"); onExpire(); }, [onExpire]);
  const handleInteractive = useCallback(() => setState("interactive"), []);
  const handleTimeout = useCallback(() => setState("error"), []);

  const retry = () => { onExpire(); setState("verifying"); setSlow(false); setAttempt((n) => n + 1); };

  if (!siteKey) return null;

  const showWidget = state === "interactive" || state === "error" || slow;

  const tone =
    state === "verified" ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
    : state === "error" ? "border-red-500/40 bg-red-500/10 text-red-600"
    : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold ${tone}`} role="status" aria-live="polite">
        {state === "verified" && <ShieldCheck className="h-4 w-4 shrink-0" />}
        {state === "error" && <ShieldAlert className="h-4 w-4 shrink-0" />}
        {(state === "verifying" || state === "interactive") && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
        <span className="flex-1 truncate">
          {state === "verified" && "Verified. You can submit."}
          {state === "verifying" && "Verifying you are human…"}
          {state === "interactive" && "Tap the box below to verify"}
          {state === "error" && "Verification failed. Please retry."}
        </span>
        {(state === "error" || (slow && state === "verifying")) && (
          <button type="button" onClick={retry}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current/30 px-2.5 py-0.5 text-[12px]">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>

      {/* Cloudflare's own check: hidden while it works silently, shown as a
          thin line only when it needs the person. */}
      <div
        className={showWidget ? "mt-2" : ""}
        style={showWidget ? undefined : { position: "fixed", left: -10000, top: 0, width: 320, height: 70 }}
        aria-hidden={!showWidget}
      >
        <Turnstile
          key={attempt}
          size="flexible"
          appearance="interaction-only"
          onToken={handleToken}
          onExpire={handleExpire}
          onError={handleError}
          onInteractive={handleInteractive}
          onInteractiveDone={() => setState((s) => (s === "interactive" ? "verifying" : s))}
          onTimeout={handleTimeout}
        />
      </div>
    </div>
  );
}
