"use client";

import Link from "next/link";
import { TrendingUp, Megaphone, ClipboardList, BarChart3 } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_ADMIN_STATS, DEMO_ADMISSIONS_QUEUE } from "@/content/portal";

/** Admin overview — the SaaS control room home (§7.5). */
export default function AdminOverview() {
  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Overview"
        desc="Platform telemetry: applications, publishing activity, result traffic and PWA adoption. Sourced from Vercel Analytics plus internal events in production."
        actions={
          <Button asChild className="h-11 rounded-full font-bold">
            <Link href="/admin/notices">
              <Megaphone className="mr-1.5 h-4 w-4" aria-hidden /> Publish a notice
            </Link>
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DEMO_ADMIN_STATS.map((s) => (
          <Card key={s.label} className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-bold text-primary">{s.value}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden />
                {s.delta}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Review queue preview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Admissions awaiting review
            </CardTitle>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
              <Link href="/admin/admissions">Open queue</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {DEMO_ADMISSIONS_QUEUE.slice(0, 4).map((a) => (
                <li key={a.no} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-small font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.no} · {a.programme} · {a.percent}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      a.status === "shortlisted"
                        ? "border-primary/40 text-primary"
                        : a.status === "review"
                          ? "border-gold/50 text-gold-strong dark:text-gold"
                          : ""
                    }
                  >
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Publishing activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden /> Publishing activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50 text-small">
              {[
                ["Admissions open for 2026-27", "2 days ago", "Notice · pinned"],
                ["Send-up exam schedule", "6 days ago", "Notice"],
                ["Toppers story — Annual 2026", "2 weeks ago", "News"],
                ["Merit list v1.0 published", "10 months ago", "Results"],
              ].map(([t, d, k]) => (
                <li key={t} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 font-semibold">{t}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{d} · {k}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Target: a notice publishes in under 5 minutes from this dashboard (KPI §1.4) — the
              home ticker reflects it within 60 seconds (ISR).
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminChrome>
  );
}
