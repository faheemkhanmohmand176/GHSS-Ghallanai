import { CalendarCheck, Users, TrendingUp, AlertTriangle, Download, Save } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid } from "@/components/admin/stat-card";
import { BarChart, LineChart } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/lib/supabase";

// ---- Types -----------------------------------------------------------------

interface RosterStudent {
  id: string;
  roll_no: string;
  name: string;
  status: "present" | "absent" | "late" | "leave" | "halfday";
}

interface ClassAttendance {
  class_label: string;
  programme: string;
  rate: number;
  present: number;
  total: number;
}

// ---- Demo data -------------------------------------------------------------

const DEMO_ROSTER: RosterStudent[] = [
  { id: "s1", roll_no: "11-ICS-01", name: "Abdul Rahman Khan", status: "present" },
  { id: "s2", roll_no: "11-ICS-02", name: "Ayesha Bibi", status: "present" },
  { id: "s3", roll_no: "11-ICS-03", name: "Hassan Ali", status: "absent" },
  { id: "s4", roll_no: "11-ICS-04", name: "Fatima Khan", status: "late" },
  { id: "s5", roll_no: "11-ICS-05", name: "Bilal Ahmed", status: "present" },
  { id: "s6", roll_no: "11-ICS-06", name: "Zainab Bibi", status: "leave" },
  { id: "s7", roll_no: "11-ICS-07", name: "Usman Khan", status: "present" },
  { id: "s8", roll_no: "11-ICS-08", name: "Maryam Bibi", status: "halfday" },
];

const DEMO_CLASS_STATS: ClassAttendance[] = [
  { class_label: "1st Year", programme: "ICS", rate: 94, present: 301, total: 320 },
  { class_label: "1st Year", programme: "Pre-Medical", rate: 91, present: 373, total: 410 },
  { class_label: "1st Year", programme: "Pre-Engineering", rate: 89, present: 338, total: 380 },
  { class_label: "1st Year", programme: "Arts", rate: 86, present: 112, total: 130 },
  { class_label: "2nd Year", programme: "ICS", rate: 92, present: 295, total: 320 },
  { class_label: "2nd Year", programme: "Pre-Medical", rate: 88, present: 361, total: 410 },
  { class_label: "2nd Year", programme: "Pre-Engineering", rate: 90, present: 342, total: 380 },
  { class_label: "2nd Year", programme: "Arts", rate: 84, present: 109, total: 130 },
];

const DEMO_WEEKLY_TREND = [
  { label: "Mon", value: 92 },
  { label: "Tue", value: 94 },
  { label: "Wed", value: 89 },
  { label: "Thu", value: 91 },
  { label: "Fri", value: 88 },
  { label: "Sat", value: 93 },
];

// Demo monthly grid: 7 days × 5 students
const DEMO_GRID_STUDENTS = [
  "Abdul Rahman Khan",
  "Ayesha Bibi",
  "Hassan Ali",
  "Fatima Khan",
  "Bilal Ahmed",
];
const DEMO_GRID_DAYS = ["Mon 23", "Tue 24", "Wed 25", "Thu 26", "Fri 27", "Sat 28", "Mon 30"];
// cell value: P / A / L / LV / H / —
const DEMO_GRID_CELLS: string[][] = [
  ["P", "P", "P", "P", "P", "P", "P"],
  ["P", "P", "L", "P", "P", "P", "P"],
  ["A", "P", "P", "P", "P", "A", "P"],
  ["P", "P", "P", "L", "P", "P", "P"],
  ["P", "P", "P", "P", "H", "P", "P"],
];

// ---- Status helpers --------------------------------------------------------

const STATUS_CONFIG: Record<
  RosterStudent["status"],
  { label: string; short: string; classes: string; chip: string }
> = {
  present: {
    label: "Present",
    short: "P",
    classes: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5",
    chip: "bg-emerald-500 text-white",
  },
  absent: {
    label: "Absent",
    short: "A",
    classes: "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/5",
    chip: "bg-rose-500 text-white",
  },
  late: {
    label: "Late",
    short: "L",
    classes: "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5",
    chip: "bg-amber-500 text-white",
  },
  leave: {
    label: "Leave",
    short: "LV",
    classes: "border-primary/40 text-primary bg-primary/5",
    chip: "bg-primary text-primary-foreground",
  },
  halfday: {
    label: "Half Day",
    short: "H",
    classes: "border-gold/40 text-gold-strong bg-gold/5",
    chip: "bg-gold-strong text-white",
  },
};

function cellStyle(value: string) {
  if (value === "P") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (value === "A") return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (value === "L") return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (value === "LV") return "bg-primary/15 text-primary border-primary/30";
  if (value === "H") return "bg-gold/15 text-gold-strong border-gold/30";
  return "bg-secondary text-muted-foreground border-border";
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; programme?: string; date?: string }>;
}) {
  const params = await searchParams;
  const selectedClass = params.class ?? "1st Year";
  const selectedProgramme = params.programme ?? "ics";
  const selectedDate = params.date ?? new Date().toISOString().slice(0, 10);

  let roster: RosterStudent[] = DEMO_ROSTER;
  let classStats: ClassAttendance[] = DEMO_CLASS_STATS;
  let weeklyTrend = DEMO_WEEKLY_TREND;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("attendance_daily_stats")
        .select("*")
        .order("date", { ascending: false })
        .limit(60);
      if (!error && data && data.length > 0) {
        // Build class-level aggregates from the cached daily stats
        const grouped = new Map<string, ClassAttendance>();
        for (const r of data as any[]) {
          const key = `${r.class_label}-${r.programme ?? "all"}`;
          const cur = grouped.get(key);
          if (cur) {
            cur.total += r.total_students ?? 0;
            cur.present += r.present_count ?? 0;
          } else {
            grouped.set(key, {
              class_label: r.class_label,
              programme: r.programme ?? "all",
              rate: 0,
              present: r.present_count ?? 0,
              total: r.total_students ?? 0,
            });
          }
        }
        classStats = Array.from(grouped.values()).map((c) => ({
          ...c,
          rate: c.total > 0 ? Math.round((c.present / c.total) * 1000) / 10 : 0,
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const avgRate =
    classStats.length === 0
      ? 0
      : Math.round((classStats.reduce((s, c) => s + c.rate, 0) / classStats.length) * 10) / 10;
  const presentToday = classStats.reduce((s, c) => s + c.present, 0);
  const totalToday = classStats.reduce((s, c) => s + c.total, 0);
  const belowThreshold = classStats.filter((c) => c.rate < 75);

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Attendance"
        desc="Mark daily attendance, review monthly reports and watch class-level trends. The 75% minimum threshold governs exam eligibility — classes below are flagged."
        actions={
          <Button className="h-11 rounded-full font-semibold">
            <Save className="mr-1.5 h-4 w-4" aria-hidden /> Save Today's Roll
          </Button>
        }
      />

      <Tabs defaultValue="mark">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* =================== Mark Attendance =================== */}
        <TabsContent value="mark">
          <SectionCard
            title="Daily Attendance Register"
            description="Pick a class, programme and date; tap a status pill for each student on the roster."
          >
            <form className="mb-5 flex flex-wrap gap-3" method="get">
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Class
                </Label>
                <select
                  name="class"
                  defaultValue={selectedClass}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Programme
                </Label>
                <select
                  name="programme"
                  defaultValue={selectedProgramme}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ics">ICS</option>
                  <option value="pre-medical">Pre-Medical</option>
                  <option value="pre-engineering">Pre-Engineering</option>
                  <option value="arts">Arts</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </Label>
                <Input
                  type="date"
                  name="date"
                  defaultValue={selectedDate}
                  className="h-11 w-[180px]"
                />
              </div>
              <Button type="submit" variant="outline" className="h-11 self-end">
                Load Roster
              </Button>
            </form>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.values(STATUS_CONFIG).map((s) => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.classes}`}
                >
                  <span className={`h-2 w-2 rounded-full ${s.chip}`} aria-hidden />
                  {s.label}
                </span>
              ))}
            </div>

            {/* Roster */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="divide-y divide-border">
                {roster.map((s, idx) => {
                  const cfg = STATUS_CONFIG[s.status];
                  return (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center gap-3 bg-background px-4 py-3 hover:bg-secondary/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-muted-foreground">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{s.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{s.roll_no}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(STATUS_CONFIG) as RosterStudent["status"][]).map((k) => {
                          const c = STATUS_CONFIG[k];
                          const isActive = s.status === k;
                          return (
                            <span
                              key={k}
                              className={`inline-flex h-9 min-w-[44px] cursor-pointer items-center justify-center rounded-md border px-2 text-xs font-bold transition-colors ${
                                isActive ? c.classes : "border-border text-muted-foreground hover:bg-secondary"
                              }`}
                              title={c.label}
                            >
                              {c.short}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-6 text-sm">
                <span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {roster.filter((r) => r.status === "present").length}
                  </span>{" "}
                  Present
                </span>
                <span>
                  <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {roster.filter((r) => r.status === "absent").length}
                  </span>{" "}
                  Absent
                </span>
                <span>
                  <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {roster.filter((r) => r.status === "late").length}
                  </span>{" "}
                  Late
                </span>
                <span>
                  <span className="font-bold tabular-nums text-primary">
                    {roster.filter((r) => r.status === "leave").length}
                  </span>{" "}
                  Leave
                </span>
                <span>
                  <span className="font-bold tabular-nums text-gold-strong">
                    {roster.filter((r) => r.status === "halfday").length}
                  </span>{" "}
                  Half Day
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Attendance rate today:{" "}
                <span className="font-bold text-foreground">
                  {Math.round((roster.filter((r) => r.status === "present").length / roster.length) * 1000) / 10}%
                </span>
              </p>
            </div>
          </SectionCard>
        </TabsContent>

        {/* =================== Reports =================== */}
        <TabsContent value="reports">
          <SectionCard
            title="Monthly Attendance Grid"
            description={`${selectedClass} · ${selectedProgramme.toUpperCase()} · September 2026`}
            actions={
              <Button variant="outline" className="h-11 rounded-full">
                <Download className="mr-1.5 h-4 w-4" aria-hidden /> Export to Excel
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Student
                    </th>
                    {DEMO_GRID_DAYS.map((d) => (
                      <th
                        key={d}
                        className="border-b border-border px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {d}
                      </th>
                    ))}
                    <th className="border-b border-border px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_GRID_STUDENTS.map((name, rIdx) => {
                    const row = DEMO_GRID_CELLS[rIdx] ?? [];
                    const present = row.filter((c) => c === "P").length;
                    const rate = Math.round((present / row.length) * 100);
                    return (
                      <tr key={name} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 font-medium">{name}</td>
                        {row.map((c, cIdx) => (
                          <td key={cIdx} className="px-1.5 py-2 text-center">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-bold ${cellStyle(c)}`}
                            >
                              {c}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`font-bold tabular-nums ${
                              rate >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Class average</p>
                <p className="font-display text-xl font-bold tabular-nums">91.2%</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Below 75% threshold</p>
                <p className="font-display text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">1</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Total school days</p>
                <p className="font-display text-xl font-bold tabular-nums">26</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Report generated</p>
                <p className="font-display text-xl font-bold tabular-nums">Today</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* =================== Analytics =================== */}
        <TabsContent value="analytics">
          <StatGrid className="mb-5">
            <StatCard
              label="Avg Attendance Rate"
              value={`${avgRate}%`}
              hint="Across all classes"
              icon={CalendarCheck}
              accent="primary"
              trend={{ direction: "up", value: "+1.4% WoW" }}
            />
            <StatCard
              label="Present Today"
              value={presentToday.toLocaleString()}
              hint={`of ${totalToday.toLocaleString()} enrolled`}
              icon={Users}
              accent="success"
            />
            <StatCard
              label="Classes Below Threshold"
              value={belowThreshold.length}
              hint="Below 75% minimum"
              icon={AlertTriangle}
              accent={belowThreshold.length > 0 ? "danger" : "neutral"}
            />
            <StatCard
              label="Weekly Trend"
              value={`${weeklyTrend.reduce((s, d) => s + d.value, 0) / weeklyTrend.length}%`}
              hint="Last 6 working days"
              icon={TrendingUp}
              accent="gold"
            />
          </StatGrid>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard
              title="Class-by-Class Attendance"
              description="Average rate per class and programme"
            >
              <BarChart
                data={classStats.map((c) => ({
                  label: `${c.class_label.slice(0, 1)}-${c.programme.slice(0, 2).toUpperCase()}`,
                  value: c.rate,
                  hint: `${c.present}/${c.total}`,
                }))}
                accent="primary"
                height={240}
              />
            </SectionCard>

            <SectionCard
              title="Weekly Trend"
              description="School-wide attendance % over the last week"
            >
              <LineChart data={weeklyTrend} accent="gold" height={240} />
            </SectionCard>
          </div>

          <SectionCard
            title="Eligibility Threshold"
            description="The 75% minimum attendance rule governs exam eligibility per BISE policy"
            className="mt-5"
          >
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold">75% Minimum Attendance</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Students falling below 75% attendance in a month are flagged for counselling and may be
                  debarred from board examinations. Warning threshold is set at 80%.
                </p>
              </div>
              {belowThreshold.length > 0 && (
                <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400">
                  {belowThreshold.length} class{belowThreshold.length === 1 ? "" : "es"} below
                </Badge>
              )}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
