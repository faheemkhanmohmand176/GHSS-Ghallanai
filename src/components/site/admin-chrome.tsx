"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Megaphone, ClipboardList, BarChart3, Users, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Badge } from "@/components/ui/badge";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/notices", label: "Notices", icon: Megaphone },
  { href: "/admin/admissions", label: "Admissions", icon: ClipboardList },
  { href: "/admin/results", label: "Results", icon: BarChart3 },
  { href: "/admin/users", label: "Users & roles", icon: Users },
];

/** Admin shell — sidebar workspace, dark/bright from the same tokens (§7.5). */
export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Admin sections" className="space-y-1">
      {ADMIN_NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-small font-semibold transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/75 hover:bg-secondary hover:text-foreground"
            }`}
          >
            <n.icon className="h-4.5 w-4.5" aria-hidden />
            {n.label}
          </Link>
        );
      })}
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
        <div className="border-b border-border bg-background p-4 lg:hidden">{nav}</div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-background p-4 lg:flex">
          <div className="flex items-center gap-3 px-1.5 py-3">
            <CrestMark className="h-10 w-10" />
            <div className="min-w-0">
              <p className="text-small font-bold leading-tight">
                Admin <span className="text-gold">Dashboard</span>
              </p>
              <p className="text-xs text-muted-foreground">GHSS Ghallanai</p>
            </div>
          </div>
          <div className="mt-4 flex-1">{nav}</div>
          <div className="space-y-1 border-t border-border pt-3">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3.5 text-small font-semibold text-foreground/75 hover:bg-secondary"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden /> View public site
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function AdminDemoBanner() {
  return (
    <p className="mb-6 rounded-xl border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground dark:bg-gold-soft/20">
      <span className="font-bold">DEMO MODE.</span> Every mutation here maps to a Supabase write
      behind admin RLS policies with audit logging (§7.5/§11.3). Urdu microcopy for office staff
      appears on production forms.
    </p>
  );
}

export function AdminTitle({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
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
