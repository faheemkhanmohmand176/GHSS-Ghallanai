import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIPhoneOrIPad() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Installs the app when the browser has exposed its native prompt. When it
 * has not, the control gives the correct browser-menu instructions instead of
 * silently doing nothing. It disappears after installation or in standalone
 * display mode.
 */
export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIPhoneOrIPad());

    const early = (window as unknown as { __pwaInstallEvent?: BeforeInstallPromptEvent | null }).__pwaInstallEvent;
    if (early) setInstallEvent(early);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
      return;
    }

    if (ios) {
      toast.info("To install: tap Share, choose Add to Home Screen, then open the app.");
      return;
    }

    toast.info("Open your browser menu and choose Install app or Add to Home screen.");
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install GHSS Ghallanai app"
        className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span className="hidden 2xl:inline">Install app</span>
      </button>
    );
  }

  return (
    <li className="border-b border-border/60">
      <button
        type="button"
        onClick={install}
        className="flex min-h-12 w-full items-center justify-between py-3 text-left text-base font-semibold text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          {ios ? <Share2 className="h-4 w-4 text-gold" aria-hidden="true" /> : <Download className="h-4 w-4 text-gold" aria-hidden="true" />}
          {ios ? "Add to Home Screen" : "Install app"}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{ios ? "Share" : "App"}</span>
      </button>
    </li>
  );
}
