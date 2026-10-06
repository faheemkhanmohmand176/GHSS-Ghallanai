import Link from "next/link";
import { Trophy, Plus, Eye, Download, GraduationCap, Building2, Info } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid, EmptyState } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";

// ---- Types -----------------------------------------------------------------

interface MeritEntry {
  rank: number;
  name: string;
  father_name: string;
  programme: string;
  class_label: string;
  obtained: number;
  total: number;
  percent: number;
  grade: string;
}

interface MeritPublication {
  id: string;
  title: string;
  year: number;
  scope: "class" | "school" | "school-bise";
  class_label: string | null;
  programme: string | null;
  exam_type: string;
  is_published: boolean;
  published_at: string | null;
  total_students: number;
  passing_count: number;
  highest_percentage: number;
  average_percentage: number;
  entries: MeritEntry[];
}

// ---- Demo data -------------------------------------------------------------

const DEMO_SCHOOL_MERIT_PUBS: MeritPublication[] = [
  {
    id: "ml1",
    title: "1st Year — Top 10 (Send-up 2026)",
    year: 2026,
    scope: "class",
    class_label: "1st Year",
    programme: "All",
    exam_type: "Send-up",
    is_published: true,
    published_at: "2026-09-15T10:00:00Z",
    total_students: 320,
    passing_count: 296,
    highest_percentage: 89.2,
    average_percentage: 71.4,
    entries: [
      { rank: 1, name: "SAMPLE Topper A", father_name: "—", programme: "Pre-Medical", class_label: "1st Year", obtained: 491, total: 550, percent: 89.2, grade: "A+" },
      { rank: 2, name: "SAMPLE Topper B", father_name: "—", programme: "Pre-Engineering", class_label: "1st Year", obtained: 487, total: 550, percent: 88.5, grade: "A+" },
      { rank: 3, name: "SAMPLE Topper C", father_name: "—", programme: "ICS", class_label: "1st Year", obtained: 482, total: 550, percent: 87.6, grade: "A+" },
      { rank: 4, name: "SAMPLE Topper D", father_name: "—", programme: "Pre-Medical", class_label: "1st Year", obtained: 478, total: 550, percent: 86.9, grade: "A+" },
      { rank: 5, name: "SAMPLE Topper E", father_name: "—", programme: "Arts", class_label: "1st Year", obtained: 470, total: 550, percent: 85.5, grade: "A+" },
    ],
  },
  {
    id: "ml2",
    title: "2nd Year — Top 10 (Send-up 2026)",
    year: 2026,
    scope: "class",
    class_label: "2nd Year",
    programme: "All",
    exam_type: "Send-up",
    is_published: false,
    published_at: null,
    total_students: 280,
    passing_count: 254,
    highest_percentage: 87.4,
    average_percentage: 69.8,
    entries: [
      { rank: 1, name: "SAMPLE Topper F", father_name: "—", programme: "Pre-Medical", class_label: "2nd Year", obtained: 481, total: 550, percent: 87.4, grade: "A+" },
      { rank: 2, name: "SAMPLE Topper G", father_name: "—", programme: "Pre-Engineering", class_label: "2nd Year", obtained: 472, total: 550, percent: 85.8, grade: "A+" },
      { rank: 3, name: "SAMPLE Topper H", father_name: "—", programme: "ICS", class_label: "2nd Year", obtained: 469, total: 550, percent: 85.2, grade: "A+" },
      { rank: 4, name: "SAMPLE Topper I", father_name: "—", programme: "Pre-Medical", class_label: "2nd Year", obtained: 463, total: 550, percent: 84.2, grade: "A+" },
      { rank: 5, name: "SAMPLE Topper J", father_name: "—", programme: "Arts", class_label: "2nd Year", obtained: 458, total: 550, percent: 83.3, grade: "A+" },
    ],
  },
];

const DEMO_BISE_PUBS: MeritPublication[] = [
  {
    id: "bl1",
    title: "BISE Peshawar — 1st Year Annual 2026",
    year: 2026,
    scope: "school-bise",
    class_label: "1st Year",
    programme: "All",
    exam_type: "Annual",
    is_published: false,
    published_at: null,
    total_students: 320,
    passing_count: 286,
    highest_percentage: 88.7,
    average_percentage: 68.2,
    entries: [
      { rank: 1, name: "SAMPLE Student A", father_name: "—", programme: "Pre-Medical", class_label: "1st Year", obtained: 488, total: 550, percent: 88.7, grade: "A+" },
      { rank: 2, name: "SAMPLE Student B", father_name: "—", programme: "Pre-Engineering", class_label: "1st Year", obtained: 482, total: 550, percent: 87.6, grade: "A+" },
      { rank: 3, name: "SAMPLE Student C", father_name: "—", programme: "ICS", class_label: "1st Year", obtained: 475, total: 550, percent: 86.4, grade: "A+" },
      { rank: 4, name: "SAMPLE Student D", father_name: "—", programme: "Pre-Medical", class_label: "1st Year", obtained: 470, total: 550, percent: 85.5, grade: "A+" },
      { rank: 5, name: "SAMPLE Student E", father_name: "—", programme: "Arts", class_label: "1st Year", obtained: 465, total: 550, percent: 84.5, grade: "A+" },
    ],
  },
  {
    id: "bl2",
    title: "BISE Peshawar — 2nd Year Annual 2026",
    year: 2026,
    scope: "school-bise",
    class_label: "2nd Year",
    programme: "All",
    exam_type: "Annual",
    is_published: false,
    published_at: null,
    total_students: 280,
    passing_count: 252,
    highest_percentage: 89.4,
    average_percentage: 70.1,
    entries: [
      { rank: 1, name: "SAMPLE Student F", father_name: "—", programme: "Pre-Medical", class_label: "2nd Year", obtained: 492, total: 550, percent: 89.4, grade: "A+" },
      { rank: 2, name: "SAMPLE Student G", father_name: "—", programme: "Pre-Engineering", class_label: "2nd Year", obtained: 488, total: 550, percent: 88.7, grade: "A+" },
      { rank: 3, name: "SAMPLE Student H", father_name: "—", programme: "ICS", class_label: "2nd Year", obtained: 484, total: 550, percent: 88.0, grade: "A+" },
      { rank: 4, name: "SAMPLE Student I", father_name: "—", programme: "Pre-Medical", class_label: "2nd Year", obtained: 476, total: 550, percent: 86.5, grade: "A+" },
      { rank: 5, name: "SAMPLE Student J", father_name: "—", programme: "Arts", class_label: "2nd Year", obtained: 471, total: 550, percent: 85.6, grade: "A+" },
    ],
  },
];

// ---- Helpers ---------------------------------------------------------------

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  } catch {
    return d;
  }
}

export default async function AdminMeritListPage() {
  let schoolPubs: MeritPublication[] = DEMO_SCHOOL_MERIT_PUBS;
  let bisePubs: MeritPublication[] = DEMO_BISE_PUBS;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("merit_list_publications")
        .select("*")
        .order("year", { ascending: false })
        .order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        const rows = data as any[];
        schoolPubs = rows
          .filter((r) => r.scope === "class" || r.scope === "school")
          .map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            scope: r.scope,
            class_label: r.class_label ?? null,
            programme: r.programme ?? "All",
            exam_type: r.exam_type ?? "Annual",
            is_published: r.is_published ?? false,
            published_at: r.published_at ?? null,
            total_students: r.total_students ?? 0,
            passing_count: r.passing_count ?? 0,
            highest_percentage: Number(r.highest_percentage ?? 0),
            average_percentage: Number(r.average_percentage ?? 0),
            entries: Array.isArray(r.entries) ? r.entries : [],
          }));
        bisePubs = rows
          .filter((r) => r.scope === "school-bise")
          .map((r) => ({
            id: r.id,
            title: r.title,
            year: r.year,
            scope: r.scope,
            class_label: r.class_label ?? null,
            programme: r.programme ?? "All",
            exam_type: r.exam_type ?? "Annual",
            is_published: r.is_published ?? false,
            published_at: r.published_at ?? null,
            total_students: r.total_students ?? 0,
            passing_count: r.passing_count ?? 0,
            highest_percentage: Number(r.highest_percentage ?? 0),
            average_percentage: Number(r.average_percentage ?? 0),
            entries: Array.isArray(r.entries) ? r.entries : [],
          }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const totalSchoolPubs = schoolPubs.length;
  const publishedSchoolPubs = schoolPubs.filter((p) => p.is_published).length;
  const totalBisePubs = bisePubs.length;
  const publishedBisePubs = bisePubs.filter((p) => p.is_published).length;
  const allPubs = [...schoolPubs, ...bisePubs];
  const allStudents = allPubs.reduce((s, p) => s + p.total_students, 0);
  const allPassed = allPubs.reduce((s, p) => s + p.passing_count, 0);
  const overallPassRate = allStudents > 0 ? Math.round((allPassed / allStudents) * 1000) / 10 : 0;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Merit List"
        desc="School-level (send-up & monthly) and BISE Peshawar intermediate merit publications. Both classes carry a maximum of 550 marks per the BISE intermediate scheme."
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full">
              <Download className="mr-1.5 h-4 w-4" aria-hidden /> Export Latest
            </Button>
            <Button className="h-11 rounded-full font-semibold">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Generate School Merit
            </Button>
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="School Merit Publications"
          value={`${publishedSchoolPubs}/${totalSchoolPubs}`}
          hint="Published / total"
          icon={Trophy}
          accent="gold"
        />
        <StatCard
          label="BISE Publications"
          value={`${publishedBisePubs}/${totalBisePubs}`}
          hint="Awaiting board results / total"
          icon={Building2}
          accent="primary"
        />
        <StatCard
          label="Students Covered"
          value={allStudents.toLocaleString()}
          hint="Across all publications"
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard
          label="Overall Pass Rate"
          value={`${overallPassRate}%`}
          hint={`${allPassed.toLocaleString()} of ${allStudents.toLocaleString()} passed`}
          icon={Trophy}
          accent="success"
        />
      </StatGrid>

      <div className="mb-5 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">Both 1st Year and 2nd Year carry a maximum of 550 marks</span>{" "}
          under the BISE intermediate scheme of studies. Percentages shown reflect marks obtained out of 550.
        </p>
      </div>

      <Tabs defaultValue="school">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="school">School Merit</TabsTrigger>
          <TabsTrigger value="bise">BISE Merit</TabsTrigger>
        </TabsList>

        {/* ============== SCHOOL MERIT ============== */}
        <TabsContent value="school">
          <div className="space-y-5">
            {schoolPubs.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No school merit publications yet"
                description="Generate the first merit list from the latest send-up examination marks."
              />
            ) : (
              schoolPubs.map((p) => (
                <SectionCard
                  key={p.id}
                  title={p.title}
                  description={`${p.class_label ?? "School"} · ${p.programme === "All" ? "All programmes" : p.programme} · ${p.exam_type} ${p.year}`}
                  actions={
                    <div className="flex items-center gap-3">
                      <Label htmlFor={`pub-${p.id}`} className="text-xs text-muted-foreground">
                        {p.is_published ? "Published" : "Draft"}
                      </Label>
                      <Switch id={`pub-${p.id}`} defaultChecked={p.is_published} aria-label="Toggle publication" />
                    </div>
                  }
                >
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Total Students</p>
                      <p className="font-display text-xl font-bold tabular-nums">{p.total_students}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Passed</p>
                      <p className="font-display text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {p.passing_count}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Highest</p>
                      <p className="font-display text-xl font-bold tabular-nums text-gold-strong">
                        {p.highest_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="font-display text-xl font-bold tabular-nums">{p.average_percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Programme</TableHead>
                        <TableHead className="text-right">Obtained</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Percent</TableHead>
                        <TableHead>Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.entries.slice(0, 5).map((e) => (
                        <TableRow key={e.rank}>
                          <TableCell>
                            <Badge variant="secondary" className="bg-gold/15 text-gold-strong">#{e.rank}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{e.name}</TableCell>
                          <TableCell className="text-sm">{e.programme}</TableCell>
                          <TableCell className="text-right tabular-nums">{e.obtained}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{e.total}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums">{e.percent.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                              {e.grade}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Published: <span className="font-medium text-foreground">{formatDate(p.published_at)}</span></span>
                    <Button asChild variant="ghost" size="sm" className="h-8">
                      <Link href={`/results/merit-list?pub=${p.id}`}>
                        <Eye className="mr-1 h-3.5 w-3.5" aria-hidden /> Preview on public site
                      </Link>
                    </Button>
                  </div>
                </SectionCard>
              ))
            )}
          </div>
        </TabsContent>

        {/* ============== BISE MERIT ============== */}
        <TabsContent value="bise">
          <SectionCard
            title="BISE Peshawar — Intermediate Results"
            description="Annual board results are fetched from the Board of Intermediate and Secondary Education Peshawar once published. Use the button below to trigger the import."
            actions={
              <Button className="h-11 rounded-full font-semibold">
                <Building2 className="mr-1.5 h-4 w-4" aria-hidden /> Fetch BISE Results
              </Button>
            }
          >
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="font-display text-sm font-bold">About BISE Peshawar Intermediate Results</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Annual results for both 1st Year (XI) and 2nd Year (XII) are released by the{" "}
                  <a
                    href="https://www.bisep.edu.pk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline"
                  >
                    Board of Intermediate and Secondary Education Peshawar
                  </a>{" "}
                  approximately 90 days after the examinations. The fetch button here triggers the supervised import
                  pipeline that pulls subject-wise marks into the <code className="font-mono">board_results</code> table.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Maximum Marks (1st Year)</p>
                <p className="font-display text-xl font-bold tabular-nums">550</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Maximum Marks (2nd Year)</p>
                <p className="font-display text-xl font-bold tabular-nums">550</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Combined Intermediate</p>
                <p className="font-display text-xl font-bold tabular-nums">1100</p>
              </div>
            </div>
          </SectionCard>

          <div className="mt-5 space-y-5">
            {bisePubs.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No BISE publications yet"
                description="Fetch the latest board results to generate the BISE merit publication."
              />
            ) : (
              bisePubs.map((p) => (
                <SectionCard
                  key={p.id}
                  title={p.title}
                  description={`${p.class_label ?? "School"} · ${p.exam_type} ${p.year}`}
                  actions={
                    <Badge variant="outline" className={
                      p.is_published
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    }>
                      {p.is_published ? "Published" : "Awaiting results"}
                    </Badge>
                  }
                >
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Total Students</p>
                      <p className="font-display text-xl font-bold tabular-nums">{p.total_students}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Passed</p>
                      <p className="font-display text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {p.passing_count}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Highest</p>
                      <p className="font-display text-xl font-bold tabular-nums text-gold-strong">
                        {p.highest_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="font-display text-xl font-bold tabular-nums">{p.average_percentage.toFixed(1)}%</p>
                    </div>
                  </div>

                  {p.entries.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
                      No entries imported yet. Use the <span className="font-medium text-foreground">Fetch BISE Results</span> button above to start the import pipeline.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Programme</TableHead>
                          <TableHead className="text-right">Obtained</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Percent</TableHead>
                          <TableHead>Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.entries.slice(0, 5).map((e) => (
                          <TableRow key={e.rank}>
                            <TableCell>
                              <Badge variant="secondary" className="bg-primary/10 text-primary">#{e.rank}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{e.name}</TableCell>
                            <TableCell className="text-sm">{e.programme}</TableCell>
                            <TableCell className="text-right tabular-nums">{e.obtained}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{e.total}</TableCell>
                            <TableCell className="text-right font-bold tabular-nums">{e.percent.toFixed(1)}%</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                {e.grade}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </SectionCard>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
