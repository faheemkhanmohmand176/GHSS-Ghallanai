"use client";

import { useEffect, useState } from "react";

/**
 * InstallPrompt — earned, not shouted (§9.2).
 * Appears only after beforeinstallprompt fires (Chrome engagement heuristics);
 * permanently dismisses on decline. On iOS, a one-time tooltip points to
 * Share → Add to Home Screen.
 */
const DISMISS_KEY = "ghss-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari has no beforeinstallprompt — show share-menu tip once
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const seenTip = sessionStorage.getItem("ghss-ios-tip");
    if (isIos && !seenTip) {
      const t = setTimeout(() => {
        setShowIosTip(true);
        setHidden(false);
        sessionStorage.setItem("ghss-ios-tip", "1");
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") setHidden(true);
    setDeferred(null);
  }

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className="fixed right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl bottom-[calc(env(safe-area-inset-bottom)+9rem)] md:bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))]"
    >
      <p className="text-small font-bold">Add GHSS to your home screen</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {showIosTip ? (
          <>
            On iPhone: tap <span className="font-semibold">Share</span> →{" "}
            <span className="font-semibold">Add to Home Screen</span>.
          </>
        ) : (
          <>
            Works offline, loads fast on slow connections, and brings result and notice alerts.
          </>
        )}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="button-press h-10 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-secondary"
        >
          Not now
        </button>
        {!showIosTip && (
          <button
            type="button"
            onClick={install}
            className="button-press h-10 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
