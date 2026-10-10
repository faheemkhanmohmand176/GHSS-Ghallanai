"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Megaphone, ClipboardList, Users, CalendarDays, BookOpen, Images,
  Trophy, Wallet, RefreshCw, ArrowRight, ShieldCheck, GraduationCap,
} from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/console";
import { countRows } from "@/lib/admin-data";
import { supabaseBrowser } from "@/lib/auth";

/** Admin Overview — Babi Khel-style control room: live counts, quick
 *  actions, needs-attention cards, recent activity timeline. */
interface Kpi { label: string; value: number | null; href: string; icon: typeof Users }

const QUICK_ACTIONS = [
  { label: "Publish a notice", href: "/admin/announcements", icon: Megaphone },
  { label: "Review admissions", href: "/admin/admissions", icon: ClipboardList },
  { label: "Publish results", href: "/admin/results", icon: Trophy },
  { label: "Add a teacher", href: "/admin/teachers", icon: GraduationCap },
  { label: "Generate vouchers", href: "/admin/fees", icon: Wallet },
  { label: "Add an event", href: "/admin/events", icon: CalendarDays },
];

export default function AdminOverview() {
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [activity, setActivity] = useState<{ kind: string; title: string; when: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${Math.max(1, m)}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    setLoading(true);
    if (!sb) {
      // Demo numbers
      setKpis({
        students: 640, teachers: 28, admissions: 146, pending_admissions: 6,
        notices: 18, news: 12, events: 4, library: 9, albums: 3, results: 1142, users: 4,
      });
      setActivity([
        { kind: "Notice", title: "Admissions open for the 2026-27 session", when: "2 days ago" },
        { kind: "Admission", title: "SAMPLE Applicant 5 — under review", when: "3 hours ago" },
        { kind: "News", title: "Toppers story — Annual 2026", when: "2 weeks ago" },
        { kind: "Event", title: "Parent-teacher meeting scheduled", when: "1 day ago" },
      ]);
      setLoading(false);
      setLastSync(new Date());
      return;
    }

    const [
      teachers, admissions, pendingAdmissions, notices, news, events,
      library, albums, results, profiles, students, vouchers,
    ] = await Promise.all([
      countRows("teachers"),
      countRows("admissions"),
      countRows("admissions", "id", ["status", "received"]),
      countRows("notices"),
      countRows("news_posts"),
      countRows("school_events"),
      countRows("library_files"),
      countRows("gallery_albums"),
      countRows("board_results"),
      countRows("profiles"),
      countRows("students"),
      countRows("fee_vouchers"),
    ]);

    setKpis({
      teachers, admissions, pending_admissions: pendingAdmissions, notices,
      news, events, library, albums, results, profiles, students, vouchers,
    });
    setLastSync(new Date());

    // Recent activity: latest notices + admissions + news merged
    try {
      const [n, a, w] = await Promise.all([
        sb.from("notices").select("title, created_at").order("created_at", { ascending: false }).limit(3),
        sb.from("admissions").select("full_name, status, created_at").order("created_at", { ascending: false }).limit(3),
        sb.from("news_posts").select("title, created_at").order("created_at", { ascending: false }).limit(2),
      ]);
      const merged = [
        ...(n.data ?? []).map((r: { title: string; created_at: string }) => ({ kind: "Notice", title: r.title, when: r.created_at })),
        ...(a.data ?? []).map((r: { full_name: string; status: string; created_at: string }) => ({ kind: `Admission · ${r.status}`, title: r.full_name, when: r.created_at })),
        ...(w.data ?? []).map((r: { title: string; created_at: string }) => ({ kind: "News", title: r.title, when: r.created_at })),
      ]
        .sort((x, y) => y.when.localeCompare(x.when))
        .slice(0, 6);
      setActivity(merged.map((m) => ({ ...m, when: timeAgo(m.when) })));
    } catch {
      setActivity([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const kpiCards: Kpi[] = [
    { label: "Students", value: kpis.students, href: "/admin/users", icon: Users },
    { label: "Teachers", value: kpis.teachers, href: "/admin/teachers", icon: GraduationCap },
    { label: "Applications", value: kpis.admissions, href: "/admin/admissions", icon: ClipboardList },
    { label: "Results rows", value: kpis.results, href: "/admin/results", icon: Trophy },
  ];

  const contentTiles = [
    { label: "Notices", value: kpis.notices, href: "/admin/announcements", icon: Megaphone },
    { label: "News stories", value: kpis.news, href: "/admin/announcements", icon: TrendingUp },
    { label: "Library files", value: kpis.library, href: "/admin/library", icon: BookOpen },
    { label: "Gallery albums", value: kpis.albums, href: "/admin/gallery", icon: Images },
    { label: "Events", value: kpis.events, href: "/admin/events", icon: CalendarDays },
    { label: "Fee vouchers", value: kpis.vouchers, href: "/admin/fees", icon: Wallet },
  ];

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Overview"
        desc="Platform telemetry: people, applications, publishing activity and money — live from the database, with audit logging on every write."
        actions={
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                Synced {timeAgo(lastSync.toISOString())}
              </span>
            )}
            <Button variant="outline" onClick={load} disabled={loading} className="button-press h-10 rounded-full">
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <Card className="card-lift h-full transition-shadow group-hover:shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <s.icon className="h-4 w-4 text-primary" aria-hidden />
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <p className="font-display text-3xl font-bold text-primary">
                    {s.value?.toLocaleString() ?? "—"}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Needs attention */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold-soft/30 p-4 dark:bg-gold-soft/15">
              <div className="min-w-0">
                <p className="text-small font-bold">
                  {(kpis.pending_admissions ?? 0) as number} applications awaiting review
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Move applicants through the status machine — every decision is audited.
                </p>
              </div>
              <Button asChild size="sm" className="button-press h-9 shrink-0 rounded-full">
                <Link href="/admin/admissions">Open queue</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-small font-bold">{kpis.users ?? 0} user accounts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Review roles — admin grants are explicit and audit-logged.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="button-press h-9 shrink-0 rounded-full">
                <Link href="/admin/users">Manage users</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="min-w-0">
                <p className="text-small font-bold">Site identity &amp; admission window</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The College Setting drives the homepage, header and footer.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="button-press h-9 shrink-0 rounded-full">
                <Link href="/admin/settings">Edit settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="py-6 text-center text-small text-muted-foreground">
                No activity yet — publish a notice to start the trail.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-small font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.kind}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-small">Quick actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="button-press flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-secondary/40 px-4 text-small font-semibold hover:border-primary/40 hover:bg-secondary"
              >
                <a.icon className="h-4.5 w-4.5 text-primary" aria-hidden />
                {a.label}
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content tiles */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {contentTiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className="card-lift flex h-full flex-row items-center justify-between p-4 transition-shadow group-hover:shadow-lg">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <t.icon className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <p className="min-w-0 truncate text-small font-semibold">{t.label}</p>
              </div>
              {loading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <Badge variant="outline" className="shrink-0 border-primary/40 text-sm font-bold text-primary">
                  {t.value ?? 0}
                </Badge>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </AdminChrome>
  );
}
