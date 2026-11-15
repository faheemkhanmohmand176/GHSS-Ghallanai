// src/components/shared/CommandPalette.tsx
// Global search & command palette — Ctrl/⌘+K, "/" or the navbar search icon.
//
// v2 (2026-11) — rebuilt to match the current website:
//   • Every action and page is the REAL, current route of the site
//     (Admission, Track Application, Roll No. Slip, Results, Merit List,
//     Notices, Teachers, About, Contact, FAQs …) — nothing stale.
//   • LIVE admission status: the "Apply for Admission" row shows whether
//     admissions are open / opening soon / closed, the session and the days
//     left, read from the same admission settings the Admission page uses.
//   • Searches pages, the official FAQ answers (same dataset as /faq and the
//     AI assistant), live notices and teachers — with typo-tolerant fuzzy
//     matching, Roman-Urdu keywords (natija, dakhla, rabta …) and an
//     always-available "search the whole site" fallback to /search.
//   • Empty state: quick actions, latest notices, popular searches, recents.
//   • Mobile-first: 16px input (no iOS zoom), 52px+ touch rows, safe-area
//     aware, list height follows the on-screen keyboard (visualViewport).
//   • Voice search kept (Web Speech API; hidden where unsupported).
//
// Performance: this shell only listens for the shortcut / open event and is
// ~2 KB. The data hooks + Fuse indexes + the palette UI live in
// ./CommandPaletteSheet.tsx, which is React.lazy()-loaded the moment the
// palette is opened — zero cost on the entry chunk and zero background cost
// on every page (previously the whole sheet + fuse.js rode the entry chunk
// on every visit). lazyWithRetry gives the sheet chunk the same crash-proof
// download recovery the route chunks have (offline first open, stale chunk
// after a deploy, flaky mobile link).

import { Suspense, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const PaletteSheet = lazyWithRetry<{ onClose: () => void }>(
  () => import("./CommandPaletteSheet"),
);

// Tiny global open API — any button anywhere (e.g. the navbar search icon)
// can open the palette without prop drilling.
const OPEN_EVENT = "ghss:open-command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/* ── Loading backdrop shown only while the sheet chunk downloads ────────
   Pure CSS (no framer-motion here — the shell stays dependency-free), the
   same visual language as the sheet's own backdrop so the hand-off between
   backdrop and real palette is seamless. On a warm cache (service worker /
   browser HTTP cache, or an intent prefetch) this never appears at all. */
function PaletteLoading() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-4 sm:pt-[10vh]"
      style={{ background: "linear-gradient(180deg, rgba(6,24,18,0.62), rgba(3,10,8,0.78))" }}
      role="dialog"
      aria-modal="true"
      aria-label="Opening search…"
    >
      <div className="mt-24 flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-card/80">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent" aria-hidden="true" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Shell — only listens for the shortcut / open event
   ═══════════════════════════════════════════════════════════════════════ */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && tag !== "select" && !target?.isContentEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  if (!open) return null;
  return createPortal(
    <Suspense fallback={<PaletteLoading />}>
      <PaletteSheet onClose={close} />
    </Suspense>,
    document.body,
  );
}
