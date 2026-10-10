"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/auth";

/**
 * PageTracker — records a site_visits row per route change (Babi Khel
 * pattern, feeding Site Analytics). Deferred ≥2.5s + requestIdleCallback so
 * analytics never competes with content. Skips /admin. RLS: append-only.
 */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const record = () => {
      const sb = supabaseBrowser();
      if (!sb) return; // demo mode — nothing to record
      const ua = navigator.userAgent;
      const device = /iPad|Tablet/i.test(ua)
        ? "tablet"
        : /Mobi|Android|iPhone/i.test(ua)
          ? "mobile"
          : "desktop";
      let session: string;
      try {
        session = sessionStorage.getItem("ghss_sid") ?? "";
        if (!session) {
          session = crypto.randomUUID();
          sessionStorage.setItem("ghss_sid", session);
        }
      } catch {
        session = "anonymous-" + Math.random().toString(36).slice(2, 12);
      }
      void sb.from("site_visits").insert({
        page: pathname.slice(0, 512),
        referrer: document.referrer ? document.referrer.slice(0, 512) : null,
        user_agent: ua.slice(0, 512),
        device_type: device,
        session_id: session,
      });
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = window.setTimeout(() => w.requestIdleCallback!(record, { timeout: 2500 }), 2500);
      return () => window.clearTimeout(id);
    }
    const t = window.setTimeout(record, 3000);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
