/**
 * Turnstile — reusable Cloudflare Turnstile widget.
 *
 * Renders the challenge iframe from challenges.cloudflare.com (the CSP in
 * vercel.json allows it).  The token it produces is handed to the Vercel
 * auth-gateway, which verifies it server-side before calling any Supabase RPC.
 *
 * FIX (widget "appears, disappears, appears…" and never succeeds):
 *   The widget used to be destroyed and re-created every time the parent
 *   component re-rendered, because inline callbacks such as
 *   `onExpire={() => …}` are a NEW function on every render and the render
 *   effect depended on them.  Each re-render therefore threw away the
 *   half-finished challenge, so it could never complete.  The callbacks are
 *   now kept in refs, and the widget is created ONCE per mount (it only
 *   re-renders when the site key changes).
 *
 * `appearance`:
 *   "always"           — visible challenge box (default; unchanged behaviour).
 *   "interaction-only" — runs silently in the background and shows a box ONLY
 *                        if Cloudflare needs the person to tap something.
 *                        Used on the application Submit step so the page is
 *                        not cluttered on a phone.
 *
 * Fail-safe: if VITE_TURNSTILE_SITE_KEY is missing, a clear admin warning is
 * shown and the gateway skips verification (see api/auth-gateway.js).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

let scriptPromise: Promise<boolean> | null = null;

/** Resolves true when window.turnstile is ready, false if the script failed.
 *  A failed load is NOT cached, so a retry can succeed. */
function loadTurnstileScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    const fail = () => {
      scriptPromise = null;
      document.querySelector(`script[src="${SCRIPT_SRC}"]`)?.remove();
      resolve(false);
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.turnstile)));
      existing.addEventListener("error", fail);
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(Boolean(window.turnstile));
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface TurnstileProps {
  /** Called every time a fresh token is produced. */
  onToken: (token: string) => void;
  /** Called when the challenge expires or errors (token no longer valid). */
  onExpire?: () => void;
  /** Called when the challenge fails to render. */
  onError?: () => void;
  /** "interaction-only" = invisible unless Cloudflare needs a tap. */
  appearance?: "always" | "interaction-only";
  /** "flexible" = ONE thin full-width line (default); "compact" = small square. */
  size?: "flexible" | "normal" | "compact";
  /** Cloudflare needs the person to tap the box. */
  onInteractive?: () => void;
  /** The tap was done (or the challenge ended). */
  onInteractiveDone?: () => void;
  /** The challenge timed out waiting for a tap. */
  onTimeout?: () => void;
  className?: string;
}

export default function Turnstile({
  onToken, onExpire, onError, appearance = "always", size = "flexible",
  onInteractive, onInteractiveDone, onTimeout, className,
}: TurnstileProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Always call the LATEST callbacks without ever re-creating the widget.
  const cb = useRef({ onToken, onExpire, onError, onInteractive, onInteractiveDone, onTimeout });
  cb.current = { onToken, onExpire, onError, onInteractive, onInteractiveDone, onTimeout };

  const removeWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
    }
    widgetIdRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!siteKey) return;
    setLoadFailed(false);
    loadTurnstileScript().then((ok) => {
      if (cancelled) return;
      if (!ok || !window.turnstile || !containerRef.current) { setLoadFailed(true); return; }
      removeWidget();
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        size,
        appearance,
        retry: "auto",
        "retry-interval": 3000,
        "refresh-expired": "auto",
        callback: (token: string) => cb.current.onToken(token),
        "expired-callback": () => cb.current.onExpire?.(),
        "error-callback": () => { cb.current.onError?.(); },
        "before-interactive-callback": () => cb.current.onInteractive?.(),
        "after-interactive-callback": () => cb.current.onInteractiveDone?.(),
        "timeout-callback": () => cb.current.onTimeout?.(),
      });
    });
    return () => {
      cancelled = true;
      removeWidget();
    };
    // Created once per mount — only the site key / appearance / retry matter.
  }, [siteKey, appearance, size, attempt, removeWidget]);

  if (!siteKey) {
    return (
      <div className={`rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 ${className || ""}`}>
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Security check (Turnstile) is not configured on the server. The site
          still works but bot protection is OFF. Please ask an administrator to
          add <code className="font-mono">VITE_TURNSTILE_SITE_KEY</code> and
          <code className="font-mono">TURNSTILE_SECRET_KEY</code> in Vercel.
        </span>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className={`rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 ${className || ""}`}>
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span className="flex-1">The security check could not load. Check your internet connection and try again.</span>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-1 rounded-full border border-amber-400/60 px-2.5 py-1 font-semibold"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-label="Security check" />;
}
