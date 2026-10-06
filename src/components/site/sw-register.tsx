"use client";

import { useEffect, useState } from "react";

/**
 * Service-worker registration (§9.1) — production only.
 * Respects the update toast pattern: a new SW activates in background and
 * the next navigation shows "A new version is available" with a Refresh action.
 */
export function SwRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => {
        reg = r;
        r.addEventListener("updatefound", () => {
          r.installing?.addEventListener("statechange", (e) => {
            const sw = e.target as ServiceWorker;
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        /* SW is progressive enhancement — never fatal */
      });

    function onControllerChange() {
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      reg = undefined;
    };
  }, []);

  if (!updateReady) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-xl"
    >
      <p className="text-small font-semibold">A new version is available.</p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setUpdateReady(false)}
          className="h-9 rounded-full px-4 text-xs font-semibold text-muted-foreground hover:bg-secondary"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-9 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
