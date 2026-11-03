/**
 * Turnstile — reusable Cloudflare Turnstile widget.
 *
 * Renders the challenge iframe from challenges.cloudflare.com (the CSP in
 * vercel.json is updated to allow it).  The token it produces is handed to
 * the Vercel auth-gateway, which verifies it server-side before calling any
 * Supabase RPC.  The browser never calls the protected RPCs directly.
 *
 * Fail-safe: if VITE_TURNSTILE_SITE_KEY is missing, the widget renders a
 * clear admin warning instead of breaking the page.  The gateway also skips
 * verification in that case (see api/auth-gateway.js).
 *
 * Mobile-first: the widget is responsive and uses the "compact" appearance
 * below the sm breakpoint.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ShieldAlert } from "lucide-react";

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

let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
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
  className?: string;
}

export default function Turnstile({ onToken, onExpire, onError, className }: TurnstileProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const render = useCallback(() => {
    if (!siteKey || !window.turnstile || !containerRef.current) return;
    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      widgetIdRef.current = null;
    }
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      size: isMobile ? "compact" : "normal",
      callback: (token: string) => onToken(token),
      "expired-callback": () => onExpire?.(),
      "error-callback": () => onError?.(),
    });
  }, [siteKey, onToken, onExpire, onError]);

  useEffect(() => {
    let cancelled = false;
    if (!siteKey) { setLoadFailed(true); return; }
    loadTurnstileScript().then(() => {
      if (cancelled) return;
      if (!window.turnstile) { setLoadFailed(true); return; }
      render();
    });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      }
    };
  }, [siteKey, render]);

  if (!siteKey || loadFailed) {
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

  return <div ref={containerRef} className={className} aria-label="Security check" />;
}
