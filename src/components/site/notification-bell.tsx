"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Megaphone, Trophy, CalendarDays, Newspaper, Check, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/auth";

/**
 * NotificationBell — header broadcast bell (Babi Khel feature).
 * Reads the `notifications` table (audience 'all'; 'admin' rows are added
 * when the session holds the admin role). Read state is per-device
 * (localStorage) for visitors; realtime channel refreshes instantly when
 * live. Poll fallback every 60s.
 */
interface NotificationRow {
  id: string;
  audience: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
}

const READ_KEY = "ghss-read-notifications";

const TYPE_ICON: Record<string, { icon: typeof Bell; tone: string }> = {
  notice: { icon: Megaphone, tone: "text-primary" },
  news: { icon: Newspaper, tone: "text-sky-600 dark:text-sky-400" },
  results: { icon: Trophy, tone: "text-gold-strong dark:text-gold" },
  event: { icon: CalendarDays, tone: "text-emerald-600 dark:text-emerald-400" },
  default: { icon: Bell, tone: "text-muted-foreground" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function NotificationBell({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setRead(new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")));
      } catch {
        setRead(new Set());
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;

    const load = async () => {
      setLive(true);
      const { data: sess } = await sb.auth.getSession();
      let q = sb
        .from("notifications")
        .select("id, audience, type, title, body, link, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      // Public visitors see 'all'; admins additionally see 'admin' rows.
      if (!isAdmin) q = q.eq("audience", "all");
      const { data } = await q;
      if (data) setItems(data as NotificationRow[]);
    };
    const first = setTimeout(load, 0);
    void first;

    const poll = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [isAdmin]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((i) => !read.has(i.id)).length;

  function markRead(id?: string) {
    setRead((prev) => {
      const next = id ? new Set([...prev, id]) : new Set(items.map((i) => i.id));
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-200)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (pathname?.startsWith("/admin")) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="button-press relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-bold text-[#1A2E22]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[75] max-h-[70svh] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-small font-bold">
              Notifications
              {live && items.length === 0 && (
                <span className="ml-2 text-xs font-medium text-muted-foreground">listening…</span>
              )}
            </p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markRead()}
                  className="button-press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold text-primary hover:bg-secondary"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden /> Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="button-press inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className="scroll-thin max-h-[52svh] overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-small text-muted-foreground">
                No notifications yet. School announcements appear here.
              </p>
            )}
            {items.map((n) => {
              const meta = TYPE_ICON[n.type] ?? TYPE_ICON.default;
              const isRead = read.has(n.id);
              const content = (
                <>
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary ${meta.tone}`}
                  >
                    <meta.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-small ${isRead ? "font-medium" : "font-bold"}`}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <span className="mt-0.5 block text-[0.68rem] text-muted-foreground">
                      {timeAgo(n.created_at)}
                      {n.audience === "admin" && " · admin"}
                    </span>
                  </span>
                  {!isRead && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                </>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3 border-b border-border/60 px-4 py-3 transition-colors hover:bg-secondary/50"
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
