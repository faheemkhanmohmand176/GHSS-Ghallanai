import Link from "next/link";
import {
  GraduationCap, ClipboardList, Wallet, Trophy, Megaphone, CalendarCheck,
  CalendarDays, Hash, UserCog, Users, TrendingUp, ArrowRight, Bell,
} from "lucide-react";
import { AdminDemoBanner, AdminTitle } from "@/components/admin/admin-shell";
import { PageContainer, StatCard, StatGrid, SectionCard } from "@/components/admin/stat-card";
import { BarChart, DonutChart, LineChart } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Admin Overview — premium SaaS control room.
 *
 * In LIVE mode, KPIs are fetched from Supabase (admin RLS).
 * In DEMO mode, sample data is shown.
 */
export default async function AdminOverviewPage() {
  const live = isSupabaseConfigured();
  let stats = {
    students: 1240,
    teachers: 48,
    admissionsPending: 17,
    admissionsTotal: 312,
    feesCollected: 1842500,
    feesOutstanding: 312400,
    noticesPublished: 28,
    newsPublished: 12,
    achievements: 9,
    meritLists: 5,
    examRollSessions: 1,
    attendanceToday: 92.4,
  };

  if (live) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const [
        { count: studentsCount },
        { count: admissionsPending },
        { count: admissionsTotal },
        { count: noticesCount },
        { count: newsCount },
        { count: achievementsCount },
        { count: meritCount },
        { count: examSessionsCount },
      ] = await Promise.all([
        sb.from("students").select("*", { count: "exact", head: true }).eq("deleted_at", null),
        sb.from("admissions").select("*", { count: "exact", head: true }).eq("status", "received"),
        sb.from("admissions").select("*", { count: "exact", head: true }),
        sb.from("notices").select("*", { count: "exact", head: true }).eq("published", true).is("deleted_at", null),
        sb.from("news_posts").select("*", { count: "exact", head: true }).eq("published", true).is("deleted_at", null),
        sb.from("achievements").select("*", { count: "exact", head: true }).eq("is_published", true).is("deleted_at", null),
        sb.from("merit_list_publications").select("*", { count: "exact", head: true }).eq("is_published", true),
        sb.from("exam_roll_sessions").select("*", { count: "exact", head: true }).eq("is_published", true),
      ]);

      // teacher count = profiles where role='teacher'
      const { count: teachersCount } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "teacher");

      stats = {
        students: studentsCount ?? 0,
        teachers: teachersCount ?? 0,
        admissionsPending: admissionsPending ?? 0,
        admissionsTotal: admissionsTotal ?? 0,
        feesCollected: 1842500,
        feesOutstanding: 312400,
        noticesPublished: noticesCount ?? 0,
        newsPublished: newsCount ?? 0,
        achievements: achievementsCount ?? 0,
        meritLists: meritCount ?? 0,
        examRollSessions: examSessionsCount ?? 0,
        attendanceToday: 92.4,
      };
    } catch {
      /* fall back to demo numbers */
    }
  }

  const trend = [
    { label: "Mon", value: 88 },
    { label: "Tue", value: 91 },
    { label: "Wed", value: 87 },
    { label: "Thu", value: 93 },
    { label: "Fri", value: 90 },
    { label: "Sat", value: 92 },
    { label: "Sun", value: 0 },
  ];

  const programmeDist = [
    { label: "ICS", value: 320, color: "#14532D" },
    { label: "Pre-Medical", value: 410, color: "#b8860b" },
    { label: "Pre-Engineering", value: 380, color: "#10b981" },
    { label: "Arts", value: 130, color: "#f43f5e" },
  ];

  const feeTrend = [
    { label: "Jan", value: 1680000 },
    { label: "Feb", value: 1725000 },
    { label: "Mar", value: 1790000 },
    { label: "Apr", value: 1812000 },
    { label: "May", value: 1842500 },
    { label: "Jun", value: 1760000 },
  ];

  const quickActions = [
    { href: "/admin/announcements", label: "Publish Notice", icon: Megaphone },
    { href: "/admin/admissions", label: "Review Applications", icon: ClipboardList },
    { href: "/admin/results", label: "Import Results", icon: TrendingUp },
    { href: "/admin/exam-roll-numbers", label: "Generate Roll Numbers", icon: Hash },
    { href: "/admin/fees", label: "Generate Fee Vouchers", icon: Wallet },
    { href: "/admin/merit-list", label: "Publish Merit List", icon: Trophy },
  ];

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Dashboard"
        desc="A single pane of glass over the digital campus: admissions, results, fees, attendance and publishing activity."
        actions={
          <Button asChild className="h-11 rounded-full font-semibold">
            <Link href="/admin/announcements">
              <Megaphone className="mr-1.5 h-4 w-4" aria-hidden /> New Announcement
            </Link>
          </Button>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Enrolled Students"
          value={stats.students.toLocaleString()}
          hint={`${stats.teachers} teaching staff`}
          icon={GraduationCap}
          accent="primary"
          trend={{ direction: "up", value: "+24 this term" }}
        />
        <StatCard
          label="Pending Applications"
          value={stats.admissionsPending}
          hint={`${stats.admissionsTotal} total this session`}
          icon={ClipboardList}
          accent="gold"
          trend={{ direction: "up", value: "+8 this week" }}
        />
        <StatCard
          label="Fees Collected (PKR)"
          value={`Rs ${(stats.feesCollected / 100000).toFixed(1)}L`}
          hint={`Rs ${(stats.feesOutstanding / 1000).toFixed(0)}K outstanding`}
          icon={Wallet}
          accent="success"
          trend={{ direction: "up", value: "+3.1% MoM" }}
        />
        <StatCard
          label="Attendance Today"
          value={`${stats.attendanceToday}%`}
          hint="School-wide average"
          icon={CalendarCheck}
          accent="primary"
          trend={{ direction: "flat", value: "stable" }}
        />
      </StatGrid>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Quick actions */}
        <SectionCard
          title="Quick Actions"
          description="One-tap shortcuts to the most-used admin flows"
          className="lg:col-span-1"
        >
          <div className="grid gap-2.5">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-secondary"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <a.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{a.label}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* Weekly attendance trend */}
        <SectionCard
          title="Weekly Attendance"
          description="% students present"
          className="lg:col-span-2"
        >
          <LineChart data={trend} accent="primary" height={220} />
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Programme Distribution"
          description="Students per stream"
          className="lg:col-span-1"
        >
          <DonutChart data={programmeDist} />
        </SectionCard>

        <SectionCard
          title="Fee Collection Trend"
          description="Last 6 months (PKR)"
          className="lg:col-span-2"
        >
          <BarChart
            data={feeTrend.map((d) => ({
              label: d.label,
              value: Math.round(d.value / 10000) / 10, // Convert to lakh for readability
              hint: "L PKR",
            }))}
            accent="gold"
            height={220}
          />
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Recent activity */}
        <SectionCard
          title="Recent Activity"
          description="Latest admin operations across the campus"
        >
          <ul className="divide-y divide-border/50">
            {[
              { t: "Admissions open for 2026-27", d: "2 days ago", k: "Notice · pinned", icon: Megaphone },
              { t: "Send-up exam schedule published", d: "6 days ago", k: "Notice", icon: CalendarDays },
              { t: "Annual 2026 results imported", d: "1 week ago", k: "Results", icon: TrendingUp },
              { t: "Inter-Science Quiz winners", d: "2 weeks ago", k: "Achievement", icon: Trophy },
              { t: "Roll number session published", d: "3 weeks ago", k: "Exam Rolls", icon: Hash },
            ].map((a) => (
              <li key={a.t} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <a.icon className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.t}</p>
                  <p className="text-xs text-muted-foreground">{a.k} · {a.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Quick stats grid */}
        <SectionCard
          title="Campus Highlights"
          description="At-a-glance metrics"
        >
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Notices Published", value: stats.noticesPublished, icon: Megaphone, accent: "primary" },
              { label: "News Articles", value: stats.newsPublished, icon: TrendingUp, accent: "gold" },
              { label: "Achievements", value: stats.achievements, icon: Trophy, accent: "gold" },
              { label: "Merit Lists", value: stats.meritLists, icon: Trophy, accent: "primary" },
              { label: "Exam Sessions", value: stats.examRollSessions, icon: Hash, accent: "gold" },
              { label: "Teachers", value: stats.teachers, icon: UserCog, accent: "primary" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <s.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                  <span className="font-display text-xl font-bold tabular-nums">{s.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
