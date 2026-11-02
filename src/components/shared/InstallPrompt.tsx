import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Share2, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ghss_install_prompt_dismissed";
const DISMISS_MS = 3 * 24 * 60 * 60 * 1000; // ask again after 3 days
const SHOW_DELAY_MS = 4000;

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isIOSSafari = () =>
  isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

/**
 * Install banner for new visitors. Uses the install event captured in
 * index.html (so it is never missed) and shows iOS Safari instructions,
 * since iOS has no install event.
 */
export default function InstallPrompt() {
  const { pathname } = useLocation();
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios] = useState(() => typeof navigator !== "undefined" && isIOSSafari());

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_MS) return;
    } catch { /* ignore */ }
    setDismissed(false);

    const early = (window as unknown as { __pwaInstallEvent?: BIPEvent | null }).__pwaInstallEvent;
    if (early) setEvt(early);

    const onAvail = () => {
      const e = (window as unknown as { __pwaInstallEvent?: BIPEvent | null }).__pwaInstallEvent;
      if (e) setEvt(e);
    };
    const onInstalled = () => { setEvt(null); setDismissed(true); };
    window.addEventListener("pwa-install-available", onAvail);
    window.addEventListener("pwa-installed", onInstalled);
    const t = window.setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => {
      window.removeEventListener("pwa-install-available", onAvail);
      window.removeEventListener("pwa-installed", onInstalled);
      window.clearTimeout(t);
    };
  }, []);

  const skip = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  if (dismissed || !ready || skip || (!evt && !ios)) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  };

  const install = async () => {
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "dismissed") close();
    } finally {
      (window as unknown as { __pwaInstallEvent?: unknown }).__pwaInstallEvent = null;
      setEvt(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install GHSS Ghallanai app"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-[60] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:mx-0 lg:w-[24rem]"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-xl">
        <img src="/icon-96.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install GHSS Ghallanai app</p>
          {ios && !evt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share2 className="mx-0.5 inline h-3.5 w-3.5" aria-hidden="true" /> Share, then
              “Add to Home Screen”.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Quick access to results, notices and roll slips — even offline.
              </p>
              <button
                type="button"
                onClick={install}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Install
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
