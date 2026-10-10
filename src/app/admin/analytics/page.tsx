"use client";

import { useMemo, useState } from "react";
import { BarChart3, RefreshCw, Eye, Users, MonitorSmartphone, Globe, FileText, Zap } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/console";
import { useSiteAnalytics } from "@/lib/admin-data";

/**
 * Site Analytics — Babi Khel-style dashboard over the append-only
 * site_visits table. Aggregation happens server-side in the
 * get_site_analytics RPC (admin-gated); charts are dependency-free SVG.
 */

const PERIODS = [
  { id: 1, label: "Today" },
  { id: 7, label: "7 days" },
  { id: 15, label: "15 days" },
  { id: 30, label: "30 days" },
];

function TrendChart({ daily }: { daily: { day: string; views: number; visitors: number }[] }) {
  const w = 640;
  const h = 180;
  const pad = 24;
  const max = Math.max(1, ...daily.map((d) => d.views));
  const step = daily.length > 1 ? (w - pad * 2) / (daily.length - 1) : 0;
  const line = (key: "views" | "visitors") =>
    daily
      .map((d, i) => {
        const x = pad + i * step;
        const y = h - pad - (d[key] / max) * (h - pad * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const area = `${line("views")} L${(pad + (daily.length - 1) * step).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Traffic trend">
      <defs>
        <linearGradient id="ghss-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="var(--color-border)" strokeDasharray="3 4" />
      ))}
      {daily.length > 1 && <path d={area} fill="url(#ghss-area)" />}
      {daily.length > 1 && <path d={line("views")} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" />}
      {daily.length > 1 && <path d={line("visitors")} fill="none" stroke="var(--color-gold)" strokeWidth="2" strokeDasharray="5 4" />}
    </svg>
  );
}

function DeviceDonut({ devices }: { devices: { device: string; count: number }[] }) {
  const total = devices.reduce((a, d) => a + d.count, 0) || 1;
  const colors: Record<string, string> = {
    mobile: "var(--color-gold)",
    desktop: "var(--color-primary)",
    tablet: "var(--color-chart-3, #2b8659)",
    unknown: "var(--color-muted-foreground)",
  };
  const r = 52;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  // Precompute running offsets with a pure reduce (no closure reassignment)
  const segments = devices.reduce<{ device: string; offset: number; dash: number }[]>((out, d) => {
    const prev = out[out.length - 1];
    const offset = prev ? prev.offset + prev.dash : 0;
    out.push({ device: d.device, offset, dash: (d.count / total) * circumference });
    return out;
  }, []);
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label="Device split">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-secondary)" strokeWidth="14" />
        {segments.map((seg) => (
          <circle
            key={seg.device}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors[seg.device] ?? colors.unknown}
            strokeWidth="14"
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy + 5} textAnchor="middle" className="fill-[var(--color-foreground)]" fontSize="15" fontWeight="700">
          {devices.reduce((a, d) => a + d.count, 0)}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2">
        {devices.length === 0 && <li className="text-xs text-muted-foreground">No visits recorded yet.</li>}
        {devices.map((d) => (
          <li key={d.device} className="flex items-center gap-2 text-small">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: colors[d.device] ?? colors.unknown }} />
            <span className="capitalize">{d.device}</span>
            <span className="ml-auto font-bold tabular-nums">{d.count}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankedList({ title, icon: Icon, rows }: { title: string; icon: typeof FileText; rows: { label: string; value: number; sub?: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-small">
          <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((r, i) => (
              <li key={r.label + i} className="text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{r.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-muted-foreground">{r.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function DemoAnalytics() {
  const gen = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      day: `D-${n - i}`,
      views: 60 + Math.round(Math.sin(i / 2.2) * 35 + (i % 5) * 9),
      visitors: 40 + Math.round(Math.sin(i / 2.2) * 22 + (i % 4) * 6),
    }));
  return {
    since: "",
    totals: { views: 0, visitors: 0 },
    daily: gen(30),
    devices: [
      { device: "mobile", count: 742 },
      { device: "desktop", count: 214 },
      { device: "tablet", count: 38 },
    ],
    top_pages: [
      { page: "/", views: 412, visitors: 301 },
      { page: "/results/lookup", views: 287, visitors: 190 },
      { page: "/admissions/apply", views: 204, visitors: 141 },
      { page: "/notices", views: 132, visitors: 98 },
      { page: "/academics", views: 96, visitors: 71 },
    ],
    top_referrers: [
      { referrer: "(direct)", count: 518 },
      { referrer: "https://www.google.com/", count: 284 },
      { referrer: "https://wa.me/", count: 121 },
      { referrer: "https://www.facebook.com/", count: 71 },
    ],
  };
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(7);
  const { data, loading, error, reload, live } = useSiteAnalytics(days);
  const [demo] = useState(DemoAnalytics);
  const payload = live ? (data ?? null) : demo;
  const busy = live && loading;

  const kpis = useMemo(() => {
    if (!payload) return null;
    const views = live ? payload.totals.views : payload.daily.reduce((a, d) => a + d.views, 0);
    const visitors = live ? payload.totals.visitors : payload.daily.reduce((a, d) => a + d.visitors, 0);
    const perDay = views / Math.max(1, days);
    const peak = payload.daily.reduce((a, d) => (d.views > a.views ? d : a), payload.daily[0] ?? { day: "", views: 0, visitors: 0 });
    return { views, visitors, perDay, peak };
  }, [payload, live, days]);

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Site Analytics"
        desc="First-party visit analytics from the append-only site_visits table — no third-party trackers, aggregated server-side by an admin-gated RPC."
        actions={
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Period" className="flex gap-1 rounded-full border border-border p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDays(p.id)}
                  aria-pressed={days === p.id}
                  className={`button-press h-8 rounded-full px-3 text-xs font-bold ${
                    days === p.id ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={reload} className="button-press h-10 rounded-full">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
            </Button>
          </div>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-semibold text-destructive">
          {error} — make sure the site_visits table exists (migration 0006) and your account is an admin.
        </p>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-strong p-6 text-white shadow-lg dark:bg-[#0a1810] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-2xl" />
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#E8F5EC]/70">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Live traffic · last {days === 1 ? "day" : `${days} days`}
        </p>
        {busy || !kpis ? (
          <Skeleton className="mt-3 h-12 w-44 !bg-white/10" />
        ) : (
          <p className="mt-2 font-display text-4xl font-bold tabular-nums sm:text-5xl">
            {kpis.views.toLocaleString()}
            <span className="ml-2 text-base font-semibold text-[#E8F5EC]/60">page views</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-[#E8F5EC]/80">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gold" aria-hidden />
            {kpis ? kpis.visitors.toLocaleString() : "—"} unique visitors
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-gold" aria-hidden />
            {kpis ? Math.round(kpis.perDay).toLocaleString() : "—"} avg / day
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-gold" aria-hidden />
            Peak day {kpis?.peak?.day ?? "—"} ({kpis?.peak?.views ?? 0})
          </span>
        </div>
      </div>

      {/* Trend + devices */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden /> Traffic trend
              <span className="ml-auto flex items-center gap-3 text-[0.65rem] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-primary" /> views</span>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 rounded bg-gold" /> unique visitors</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {busy || !payload ? <Skeleton className="h-44 w-full" /> : <TrendChart daily={payload.daily} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <MonitorSmartphone className="h-4 w-4 text-primary" aria-hidden /> Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {busy || !payload ? <Skeleton className="h-32 w-full" /> : <DeviceDonut devices={payload.devices} />}
            <p className="mt-3 text-xs text-muted-foreground">
              {payload && payload.devices.length > 0
                ? `${Math.round(((payload.devices.find((d) => d.device === "mobile")?.count ?? 0) / Math.max(1, payload.devices.reduce((a, d) => a + d.count, 0))) * 100)}% of visits come from phones — the mobile-first design pays for itself.`
                : "No device data yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top pages + referrers */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {payload && (
          <>
            <RankedList
              title="Top pages"
              icon={FileText}
              rows={payload.top_pages.map((p) => ({ label: p.page, value: p.views, sub: p.visitors }))}
            />
            <RankedList
              title="Top referrers"
              icon={Globe}
              rows={payload.top_referrers.map((r) => ({
                label: r.referrer.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
                value: r.count,
              }))}
            />
          </>
        )}
      </div>
    </AdminChrome>
  );
}
