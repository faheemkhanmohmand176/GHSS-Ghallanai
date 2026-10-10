"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Settings2, BarChart3, ClipboardList, Trophy, Wallet,
  GraduationCap, Users, CalendarDays, CalendarClock, Megaphone, BookOpen,
  Images, ShieldCheck, LogOut, Menu, X, Search, ExternalLink, ChevronRight,
} from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { signOut, getProfile, supabaseBrowser } from "@/lib/auth";
import { useEffect } from "react";

/**
 * AdminChrome — the console shell (Babi Khel pattern): grouped sidebar with
 * a search filter, admin profile card, sign-out, mobile drawer. Section set
 * mirrors the requested GHS Babi Khel features:
 *   OVERVIEW   · Overview, College Setting, Site Analytics
 *   ACADEMICS  · Admission, Manage Results, Fee Management, Merit List
 *   SCHOOL     · Manage Teachers, TimeTable, Event Calendar
 *   CONTENT    · Announcements, Library, Gallery
 *   ACCESS     · Manage Users
 */

const NAV_SECTIONS: { heading: string; items: { href: string; label: string; icon: typeof LayoutDashboard; keywords?: string[] }[] }[] = [
  {
    heading: "Overview",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, keywords: ["dashboard", "home", "stats", "kpi"] },
      { href: "/admin/settings", label: "College Setting", icon: Settings2, keywords: ["school", "identity", "principal", "site", "name", "phone"] },
      { href: "/admin/analytics", label: "Site Analytics", icon: BarChart3, keywords: ["visits", "traffic", "views", "devices", "referrers"] },
    ],
  },
  {
    heading: "Academics",
    items: [
      { href: "/admin/admissions", label: "Admission", icon: ClipboardList, keywords: ["applications", "queue", "applicants", "review"] },
      { href: "/admin/results", label: "Manage Results", icon: Trophy, keywords: ["board", "marks", "publish", "grades", "bise"] },
      { href: "/admin/fees", label: "Fee Management", icon: Wallet, keywords: ["vouchers", "payments", "structures", "defaulters", "challan"] },
      { href: "/admin/merit-list", label: "Merit List", icon: GraduationCap, keywords: ["merit", "toppers", "positions", "list"] },
    ],
  },
  {
    heading: "School",
    items: [
      { href: "/admin/teachers", label: "Manage Teachers", icon: Users, keywords: ["faculty", "staff", "subject"] },
      { href: "/admin/timetable", label: "TimeTable", icon: CalendarClock, keywords: ["schedule", "periods", "classes", "grid"] },
      { href: "/admin/events", label: "Event Calendar", icon: CalendarDays, keywords: ["events", "holidays", "exams", "ptm"] },
    ],
  },
  {
    heading: "Content",
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, keywords: ["notices", "news", "polls", "urgent"] },
      { href: "/admin/library", label: "Library", icon: BookOpen, keywords: ["files", "past papers", "notes", "books"] },
      { href: "/admin/gallery", label: "Gallery", icon: Images, keywords: ["albums", "photos", "images"] },
    ],
  },
  {
    heading: "Access",
    items: [
      { href: "/admin/users", label: "Manage Users", icon: ShieldCheck, keywords: ["admins", "profiles", "roles", "accounts"] },
    ],
  },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [adminName, setAdminName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabaseBrowser();
      if (!sb) return;
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session?.user || cancelled) return;
      const profile = await getProfile();
      if (!cancelled) setAdminName(profile?.full_name ?? "Administrator");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return NAV_SECTIONS;
    return NAV_SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          (i.keywords ?? []).some((k) => k.includes(q) || q.includes(k))
      ),
    })).filter((s) => s.items.length > 0);
  }, [filter]);

  const nav = (
    <nav aria-label="Admin sections" className="space-y-4">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="px-3.5 pb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {section.heading}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((n) => {
              const active = pathname === n.href;
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-small font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/75 hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <n.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{n.label}</span>
                    {active && <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-60" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {sections.length === 0 && (
        <p className="px-3.5 py-4 text-xs text-muted-foreground">No section matches “{filter}”.</p>
      )}
    </nav>
  );

  return (
    <div className="min-h-svh bg-secondary/30">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <CrestMark className="h-8 w-8" />
          <span className="text-small font-bold">Admin · GHSS Ghallanai</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close admin menu" : "Open admin menu"}
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-b border-border bg-background p-4 lg:hidden">
          <AdminSearch value={filter} onChange={setFilter} />
          <div className="mt-3">{nav}</div>
          <AdminSignOutLinks />
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
          <div className="flex items-center gap-3 px-1.5 py-3">
            <CrestMark className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-small font-bold leading-tight">
                Admin <span className="text-gold">Dashboard</span>
              </p>
              <p className="text-xs text-muted-foreground">GHSS Ghallanai</p>
            </div>
          </div>

          {/* Admin profile card */}
          <div className="mx-1.5 mt-2 flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {(adminName ?? "A").split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("") || "A"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{adminName ?? "Administrator"}</p>
              <p className="text-[0.65rem] text-muted-foreground">Administrator</p>
            </div>
            <Badge variant="outline" className="border-gold/50 px-1.5 text-[0.6rem] font-bold text-gold-strong dark:text-gold">
              <ShieldCheck className="mr-1 h-3 w-3" aria-hidden /> Admin
            </Badge>
          </div>

          <div className="mt-3 px-1.5">
            <AdminSearch value={filter} onChange={setFilter} />
          </div>

          <div className="scroll-thin mt-2 flex-1 overflow-y-auto pb-3">{nav}</div>

          <div className="space-y-1 border-t border-border p-2">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-small font-semibold text-foreground/75 hover:bg-secondary"
            >
              <ExternalLink className="h-4.5 w-4.5" aria-hidden /> View public site
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = "/";
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 text-small font-semibold text-foreground/75 hover:bg-secondary"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden /> Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function AdminSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search sections…"
        aria-label="Filter admin sections"
        className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-3 text-xs font-semibold outline-none focus:border-primary/50"
      />
    </div>
  );
}

function AdminSignOutLinks() {
  return (
    <div className="mt-3 space-y-1 border-t border-border pt-3">
      <Link
        href="/"
        className="flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-small font-semibold text-foreground/75 hover:bg-secondary"
      >
        <ExternalLink className="h-4.5 w-4.5" aria-hidden /> View public site
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          window.location.href = "/";
        }}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 text-small font-semibold text-foreground/75 hover:bg-secondary"
      >
        <LogOut className="h-4.5 w-4.5" aria-hidden /> Sign Out
      </button>
    </div>
  );
}

export function AdminDemoBanner() {
  return (
    <p className="mb-6 rounded-xl border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground dark:bg-gold-soft/20">
      <span className="font-bold">DEMO MODE.</span> Every mutation here maps to a Supabase write
      behind admin RLS policies with audit logging (§7.5/§11.3). Configure Supabase env vars to go live.
    </p>
  );
}

export function AdminTitle({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-h2">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-small text-muted-foreground">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}
