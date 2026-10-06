"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Megaphone, ClipboardList, BarChart3, Users, LogOut, Menu, X,
  GraduationCap, UserCog, CalendarCheck, Wallet, Trophy, CalendarDays, Hash, Settings,
  type LucideIcon,
} from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { SessionUser } from "@/lib/auth";

interface NavItem { href: string; label: string; icon: LucideIcon; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/settings", label: "School Settings", icon: Settings },
    ],
  },
  {
    title: "Students & Staff",
    items: [
      { href: "/admin/students", label: "Students", icon: GraduationCap },
      { href: "/admin/teachers", label: "Teachers", icon: UserCog },
      { href: "/admin/users", label: "Users & Roles", icon: Users },
    ],
  },
  {
    title: "Academics",
    items: [
      { href: "/admin/admissions", label: "Admissions", icon: ClipboardList },
      { href: "/admin/results", label: "Results", icon: BarChart3 },
      { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/admin/timetable", label: "Timetable", icon: CalendarDays },
    ],
  },
  {
    title: "Exams & Honours",
    items: [
      { href: "/admin/exam-roll-numbers", label: "Exam Roll Numbers", icon: Hash },
      { href: "/admin/merit-list", label: "Merit List", icon: Trophy },
    ],
  },
  {
    title: "Finance & Comms",
    items: [
      { href: "/admin/fees", label: "Fee Management", icon: Wallet },
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
    ],
  },
];

interface AdminShellProps {
  user: SessionUser;
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const live = isSupabaseConfigured();

  const nav = (
    <nav aria-label="Admin sections" className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${active ? "" : "text-muted-foreground group-hover:text-foreground"}`}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  function initials(name: string) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0] ?? "")
      .join("")
      .toUpperCase();
  }

  async function signOut() {
    if (live) {
      try {
        const { getSupabaseBrowser } = await import("@/lib/supabase");
        await getSupabaseBrowser().auth.signOut();
      } catch {
        /* ignore */
      }
    }
    document.cookie = "ghss-demo-role=; path=/; max-age=0; samesite=lax";
    router.push("/login");
  }

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" /> View public site
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-svh bg-secondary/30">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <CrestMark className="h-8 w-8" />
          <span className="text-sm font-bold">Admin · GHSS Ghallanai</span>
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
          {nav}
          <div className="mt-4">{profileMenu}</div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-72 shrink-0 flex-col border-r border-border bg-background p-4 lg:flex">
          <div className="flex items-center gap-3 px-1.5 py-3">
            <CrestMark className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">
                Admin <span className="text-gold">Dashboard</span>
              </p>
              <p className="text-xs text-muted-foreground">GHSS Ghallanai</p>
            </div>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto pr-1">{nav}</div>
          <div className="mt-3 border-t border-border pt-3">
            {profileMenu}
            {!live && (
              <p className="mt-2 px-2 text-center text-[10px] text-muted-foreground/70">
                Demo mode · Supabase not configured
              </p>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function AdminDemoBanner() {
  return (
    <div className="mb-6 rounded-xl border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground dark:bg-gold-soft/20">
      <span className="font-bold text-gold-strong">DEMO MODE.</span>{" "}
      Every mutation here maps to a Supabase write behind admin RLS policies with
      audit logging. Configure Supabase env vars to enable live mode.
    </div>
  );
}

export function AdminTitle({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="text-h2 font-display tracking-tight">{title}</h1>
        {desc && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{desc}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
