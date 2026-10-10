"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Command, Phone, Moon, Sun, FileText } from "lucide-react";

/**
 * CommandPalette — ⌘K / Ctrl+K site-wide search (Babi Khel feature).
 * Fuzzy-lite search over static page index + live notices/news/teachers
 * (passed in as props from the server). Quick actions pinned: call office,
 * toggle theme. Full keyboard navigation. Recent searches persisted.
 */

export interface PaletteItem {
  group: "Pages" | "Notices" | "News" | "Teachers" | "Quick actions";
  label: string;
  href?: string;
  desc?: string;
}

const PAGES: PaletteItem[] = [
  { group: "Pages", label: "Home", href: "/", desc: "The school homepage" },
  { group: "Pages", label: "About the School", href: "/about", desc: "Our story, vision and mission" },
  { group: "Pages", label: "Principal's Message", href: "/about/principal", desc: "From the head of the institution" },
  { group: "Pages", label: "Faculty Directory", href: "/about/faculty", desc: "Meet our teaching staff" },
  { group: "Pages", label: "Programme Hub", href: "/academics", desc: "All four streams" },
  { group: "Pages", label: "ICS — Computer Science", href: "/academics/ics", desc: "Programming and computing" },
  { group: "Pages", label: "Pre-Medical (F.Sc)", href: "/academics/pre-medical", desc: "Medicine and life sciences" },
  { group: "Pages", label: "Pre-Engineering (F.Sc)", href: "/academics/pre-engineering", desc: "Engineering disciplines" },
  { group: "Pages", label: "Arts (FA Humanities)", href: "/academics/arts", desc: "Law, civil service, media" },
  { group: "Pages", label: "How Admissions Work", href: "/admissions", desc: "The four-step journey" },
  { group: "Pages", label: "Apply Online", href: "/admissions/apply", desc: "Six-step application" },
  { group: "Pages", label: "Track Application", href: "/admissions/track", desc: "Search your tracking ID" },
  { group: "Pages", label: "Fee Structure", href: "/admissions/fees", desc: "Fees and concessions" },
  { group: "Pages", label: "Result Lookup", href: "/results/lookup", desc: "Result by roll number" },
  { group: "Pages", label: "Merit Lists", href: "/results/merit-list", desc: "Published merit lists" },
  { group: "Pages", label: "Toppers", href: "/results/toppers", desc: "Position holders" },
  { group: "Pages", label: "Notices", href: "/notices", desc: "The notice board" },
  { group: "Pages", label: "Event Calendar", href: "/calendar", desc: "Upcoming events and exams" },
  { group: "Pages", label: "Photo Gallery", href: "/gallery", desc: "Albums from school life" },
  { group: "Pages", label: "Digital Library", href: "/library", desc: "Past papers, notes and books" },
  { group: "Pages", label: "Contact", href: "/contact", desc: "Phone, map and enquiries" },
];

const RECENT_KEY = "ghss_cmdk_recent";

export function CommandPalette({
  notices = [],
  news = [],
  teachers = [],
  phone,
}: {
  notices?: { id: string; title: string }[];
  news?: { id: string; slug?: string; title: string }[];
  teachers?: { id: string; full_name: string; subject: string }[];
  phone?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5));
      } catch {
        setRecent([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ghss:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ghss:open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const reset = setTimeout(() => {
        setQuery("");
        setActive(0);
      }, 0);
      const focus = setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(reset);
        clearTimeout(focus);
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const items: (PaletteItem & { action?: () => void })[] = useMemo(() => {
    const base: (PaletteItem & { action?: () => void })[] = [
      ...PAGES,
      ...notices.slice(0, 8).map((n) => ({ group: "Notices" as const, label: n.title, href: "/notices" })),
      ...news.slice(0, 8).map((n) => ({
        group: "News" as const,
        label: n.title,
        href: "/notices",
      })),
      ...teachers.slice(0, 8).map((t) => ({
        group: "Teachers" as const,
        label: t.full_name,
        desc: t.subject,
        href: "/about/faculty",
      })),
      {
        group: "Quick actions",
        label: phone ? `Call school office (${phone})` : "Call school office",
        action: () => {
          if (phone) window.location.href = `tel:${phone.replace(/[^+\d]/g, "")}`;
        },
      },
      {
        group: "Quick actions",
        label: "Toggle light / dark mode",
        action: () => {
          const el = document.documentElement;
          const dark = el.getAttribute("data-theme") === "dark";
          el.setAttribute("data-theme", dark ? "bright" : "dark");
          try {
            localStorage.setItem("ghss-theme", dark ? "bright" : "dark");
          } catch {
            /* ignore */
          }
        },
      },
    ];
    return base;
  }, [notices, news, teachers, phone]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Quick actions pinned above the page list (Babi Khel pattern)
      const quick = items.filter((i) => i.group === "Quick actions");
      const rest = items.filter((i) => i.group !== "Quick actions").slice(0, 7);
      return [...quick, ...rest];
    }
    return items
      .filter((i) => (i.label + " " + (i.desc ?? "")).toLowerCase().includes(q))
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    const t = setTimeout(() => setActive(0), 0);
    return () => clearTimeout(t);
  }, [query]);

  function run(item: (PaletteItem & { action?: () => void }) | undefined) {
    if (!item) return;
    if (!query.trim()) {
      try {
        const next = [item.label, ...recent.filter((r) => r !== item.label)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    if (item.action) {
      item.action();
      setOpen(false);
      return;
    }
    if (item.href) {
      router.push(item.href);
      setOpen(false);
    }
  }

  if (!open) return null;

  const groups = [...new Set(filtered.map((f) => f.group))];

  return (
    <div role="dialog" aria-modal="true" aria-label="Site search" className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close search"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-primary-strong/40 backdrop-blur-[2px]"
      />
      <div className="relative mx-auto mt-[12vh] w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(filtered[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search pages, notices, news, teachers…"
            aria-label="Search the site"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="scroll-thin max-h-[50svh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-small text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          )}

          {recent.length > 0 && !query.trim() && (
            <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
              Recent searches
            </p>
          )}

          {groups.map((g) => (
            <div key={g}>
              <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                {g}
              </p>
              {filtered
                .filter((f) => f.group === g)
                .map((item) => {
                  const idx = filtered.indexOf(item);
                  return (
                    <button
                      key={`${item.group}-${item.label}`}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        idx === active ? "bg-secondary" : "hover:bg-secondary/60"
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-semibold">{item.label}</span>
                        {item.desc && (
                          <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>
                        )}
                      </span>
                      {idx === active && (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/40 px-4 py-2.5 text-[0.68rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Command className="h-3 w-3" aria-hidden /> K to open · ↑↓ to move · Enter to go
          </span>
          <span className="inline-flex items-center gap-1">
            <Moon className="h-3 w-3" aria-hidden /> <Sun className="h-3 w-3" aria-hidden /> theme toggle in actions
          </span>
        </div>
      </div>
    </div>
  );
}
