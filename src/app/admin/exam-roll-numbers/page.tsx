import { Hash, Plus, Download, Clock, Calendar, GraduationCap, FileText, Info } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid, EmptyState } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";

// ---- Types -----------------------------------------------------------------

interface ExamRollSession {
  id: string;
  title: string;
  exam_year: number;
  exam_term: "Annual-I" | "Annual-II" | "Supply";
  classes: string[];
  starting_number: number;
  is_published: boolean;
  publish_at: string | null;
  countdown_label: string;
  created_at: string;
}

interface ExamRollNumber {
  id: string;
  student_name: string;
  father_name: string;
  class_label: string;
  programme: string;
  class_roll_no: string;
  exam_roll_no: string;
  serial_number: number;
}

// ---- Demo data -------------------------------------------------------------

const DEMO_SESSIONS: ExamRollSession[] = [
  {
    id: "ers1",
    title: "Annual Examination 2026 — Send-up",
    exam_year: 2026,
    exam_term: "Annual-I",
    classes: ["1st Year", "2nd Year"],
    starting_number: 100000,
    is_published: false,
    publish_at: "2026-10-20T10:00:00Z",
    countdown_label: "Roll numbers will be published in",
    created_at: "2026-09-25T08:00:00Z",
  },
  {
    id: "ers2",
    title: "Annual Examination 2025 — Board",
    exam_year: 2025,
    exam_term: "Annual-I",
    classes: ["2nd Year"],
    starting_number: 95000,
    is_published: true,
    publish_at: "2025-10-15T10:00:00Z",
    countdown_label: "Roll numbers will be published in",
    created_at: "2025-09-20T08:00:00Z",
  },
];

const DEMO_ROLLS_1ST_YEAR: ExamRollNumber[] = [
  { id: "rn1", student_name: "Abdul Rahman Khan", father_name: "Mohammad Khan", class_label: "1st Year", programme: "ics", class_roll_no: "11-ICS-01", exam_roll_no: "100001", serial_number: 1 },
  { id: "rn2", student_name: "Ayesha Bibi", father_name: "Gul Rahman", class_label: "1st Year", programme: "pre-medical", class_roll_no: "11-PM-05", exam_roll_no: "100002", serial_number: 2 },
  { id: "rn3", student_name: "Hassan Ali", father_name: "Akbar Ali", class_label: "1st Year", programme: "pre-engineering", class_roll_no: "11-PE-12", exam_roll_no: "100003", serial_number: 3 },
  { id: "rn4", student_name: "Fatima Khan", father_name: "Saeed Khan", class_label: "1st Year", programme: "arts", class_roll_no: "11-AR-03", exam_roll_no: "100004", serial_number: 4 },
  { id: "rn5", student_name: "Bilal Ahmed", father_name: "Jamal Ahmed", class_label: "1st Year", programme: "ics", class_roll_no: "11-ICS-08", exam_roll_no: "100005", serial_number: 5 },
  { id: "rn6", student_name: "Zainab Bibi", father_name: "Rahim Khan", class_label: "1st Year", programme: "pre-medical", class_roll_no: "11-PM-09", exam_roll_no: "100006", serial_number: 6 },
  { id: "rn7", student_name: "Usman Khan", father_name: "Bakht Khan", class_label: "1st Year", programme: "pre-engineering", class_roll_no: "11-PE-04", exam_roll_no: "100007", serial_number: 7 },
  { id: "rn8", student_name: "Maryam Bibi", father_name: "Fazal Khan", class_label: "1st Year", programme: "arts", class_roll_no: "11-AR-07", exam_roll_no: "100008", serial_number: 8 },
];

const DEMO_ROLLS_2ND_YEAR: ExamRollNumber[] = [
  { id: "rn9", student_name: "Sana Khan", father_name: "Karim Khan", class_label: "2nd Year", programme: "pre-medical", class_roll_no: "12-PM-01", exam_roll_no: "100101", serial_number: 101 },
  { id: "rn10", student_name: "Imran Ali", father_name: "Akram Ali", class_label: "2nd Year", programme: "pre-engineering", class_roll_no: "12-PE-02", exam_roll_no: "100102", serial_number: 102 },
  { id: "rn11", student_name: "Khadija Bibi", father_name: "Noor Muhammad", class_label: "2nd Year", programme: "ics", class_roll_no: "12-ICS-03", exam_roll_no: "100103", serial_number: 103 },
  { id: "rn12", student_name: "Tariq Khan", father_name: "Shah Khan", class_label: "2nd Year", programme: "arts", class_roll_no: "12-AR-04", exam_roll_no: "100104", serial_number: 104 },
  { id: "rn13", student_name: "Sadia Bibi", father_name: "Hidayat Khan", class_label: "2nd Year", programme: "pre-medical", class_roll_no: "12-PM-06", exam_roll_no: "100105", serial_number: 105 },
  { id: "rn14", student_name: "Asad Ali", father_name: "Gul Khan", class_label: "2nd Year", programme: "pre-engineering", class_roll_no: "12-PE-07", exam_roll_no: "100106", serial_number: 106 },
];

const PROGRAMME_LABEL: Record<string, string> = {
  "ics": "ICS",
  "pre-medical": "Pre-Medical",
  "pre-engineering": "Pre-Engineering",
  "arts": "Arts",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function formatCountdown(target: string | null) {
  if (!target) return "Not scheduled";
  const targetDate = new Date(target).getTime();
  const now = Date.now();
  if (targetDate <= now) return "Ready to publish";
  const diff = targetDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${hours}h ${minutes}m`;
}

export default async function AdminExamRollNumbersPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const params = await searchParams;
  const selectedSessionId = params.session ?? "ers1";

  let sessions: ExamRollSession[] = DEMO_SESSIONS;
  let rolls1stYear: ExamRollNumber[] = DEMO_ROLLS_1ST_YEAR;
  let rolls2ndYear: ExamRollNumber[] = DEMO_ROLLS_2ND_YEAR;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data: sessionData, error: sessionErr } = await sb
        .from("exam_roll_sessions")
        .select("*")
        .order("exam_year", { ascending: false })
        .order("created_at", { ascending: false });
      if (!sessionErr && sessionData && sessionData.length > 0) {
        sessions = (sessionData as any[]).map((s) => ({
          id: s.id,
          title: s.title,
          exam_year: s.exam_year,
          exam_term: s.exam_term ?? "Annual-I",
          classes: s.classes ?? ["1st Year", "2nd Year"],
          starting_number: s.starting_number ?? 100000,
          is_published: s.is_published ?? false,
          publish_at: s.publish_at ?? null,
          countdown_label: s.countdown_label ?? "Roll numbers will be published in",
          created_at: s.created_at ?? "",
        }));

        // Fetch rolls for the selected session
        const liveSessionId = sessions.find((s) => s.id === selectedSessionId)?.id ?? sessions[0]?.id;
        if (liveSessionId) {
          const { data: rollData, error: rollErr } = await sb
            .from("exam_roll_numbers")
            .select("*")
            .eq("session_id", liveSessionId)
            .order("class_label", { ascending: true })
            .order("serial_number", { ascending: true });
          if (!rollErr && rollData && rollData.length > 0) {
            const rolls = (rollData as any[]).map((r) => ({
              id: r.id,
              student_name: r.student_name,
              father_name: r.father_name ?? "—",
              class_label: r.class_label,
              programme: r.programme ?? "—",
              class_roll_no: r.class_roll_no ?? "—",
              exam_roll_no: r.exam_roll_no,
              serial_number: r.serial_number ?? 0,
            }));
            rolls1stYear = rolls.filter((r) => r.class_label === "1st Year");
            rolls2ndYear = rolls.filter((r) => r.class_label === "2nd Year");
          }
        }
      }
    } catch {
      /* fall back to demo */
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0];
  const totalRolls = rolls1stYear.length + rolls2ndYear.length;
  const publishedSessions = sessions.filter((s) => s.is_published).length;
  const scheduledSessions = sessions.filter((s) => !s.is_published && s.publish_at).length;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Exam Roll Numbers"
        desc="Create examination sessions, generate sequential roll numbers per class (1st Year → 2nd Year) and publish on a countdown schedule."
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full">
              <Download className="mr-1.5 h-4 w-4" aria-hidden /> Download PDF
            </Button>
            <Button className="h-11 rounded-full font-semibold">
              <Hash className="mr-1.5 h-4 w-4" aria-hidden /> Generate
            </Button>
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Sessions"
          value={sessions.length}
          hint={`${publishedSessions} published · ${scheduledSessions} scheduled`}
          icon={Calendar}
          accent="primary"
        />
        <StatCard
          label="Rolls Generated"
          value={totalRolls}
          hint="Across both classes"
          icon={Hash}
          accent="gold"
        />
        <StatCard
          label="1st Year Rolls"
          value={rolls1stYear.length}
          hint={`Starting at ${selectedSession?.starting_number ?? 100000}`}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard
          label="2nd Year Rolls"
          value={rolls2ndYear.length}
          hint="Sequential continuation"
          icon={GraduationCap}
          accent="gold"
        />
      </StatGrid>

      <Tabs defaultValue="sessions">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="rolls">Generated Rolls</TabsTrigger>
        </TabsList>

        {/* ============ Sessions tab ============ */}
        <TabsContent value="sessions">
          <SectionCard
            title="Exam Roll Sessions"
            description="Each session holds a sequential roll-number range starting at the configured starting number. 1st Year comes first, followed by 2nd Year."
            actions={
              <Button className="h-11 rounded-full font-semibold">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Create Session
              </Button>
            }
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No sessions yet"
                description="Create the first exam roll session to begin generating sequential roll numbers."
              />
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      s.is_published
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : s.publish_at
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-base font-bold">{s.title}</p>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {s.exam_term}
                          </Badge>
                          <Badge variant="outline" className="border-gold/40 text-gold-strong">
                            {s.exam_year}
                          </Badge>
                          {s.is_published ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                              Published
                            </Badge>
                          ) : s.publish_at ? (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Scheduled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5" aria-hidden /> Start:{" "}
                            <span className="font-mono font-semibold text-foreground">{s.starting_number}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5" aria-hidden /> Classes:{" "}
                            <span className="font-medium text-foreground">{s.classes.join(", ")}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" aria-hidden /> Created:{" "}
                            <span className="font-medium text-foreground">{formatDate(s.created_at)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label htmlFor={`pub-${s.id}`} className="text-xs text-muted-foreground">
                          {s.is_published ? "Live" : "Hidden"}
                        </Label>
                        <Switch id={`pub-${s.id}`} defaultChecked={s.is_published} aria-label="Toggle publication" />
                      </div>
                    </div>

                    {/* Countdown card */}
                    {s.publish_at && !s.is_published && (
                      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {s.countdown_label}
                        </div>
                        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                          {formatCountdown(s.publish_at)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Scheduled for {formatDate(s.publish_at)}
                        </p>
                      </div>
                    )}

                    {s.is_published && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        Published on {formatDate(s.publish_at)} — rolls are visible to students via the public roll-number lookup.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ============ Generated Rolls tab ============ */}
        <TabsContent value="rolls">
          <SectionCard
            title={`Generated Rolls — ${selectedSession?.title ?? "—"}`}
            description={`Session starting at ${selectedSession?.starting_number ?? 100000}. 1st Year rolls come first, 2nd Year rolls continue sequentially.`}
            actions={
              <form method="get" className="flex items-center gap-2">
                <select
                  name="session"
                  defaultValue={selectedSessionId}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  aria-label="Select session"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" className="h-11">Load</Button>
              </form>
            }
          >
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
              <Info className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Numbering scheme:</span>{" "}
                1st Year rolls begin at <span className="font-mono font-semibold text-foreground">{selectedSession?.starting_number ?? 100000}</span>{" "}
                and continue sequentially. 2nd Year rolls continue from the last 1st Year serial — no gaps, no duplicates per session.
              </p>
            </div>

            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              1st Year ({rolls1stYear.length} students)
            </h3>
            <RollsTable rolls={rolls1stYear} />

            <h3 className="mb-3 mt-6 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              2nd Year ({rolls2ndYear.length} students)
            </h3>
            <RollsTable rolls={rolls2ndYear} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function RollsTable({ rolls }: { rolls: ExamRollNumber[] }) {
  if (rolls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No rolls generated yet for this class.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Father's Name</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Programme</TableHead>
          <TableHead>Class Roll No</TableHead>
          <TableHead className="text-right">Exam Roll No</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rolls.map((r, idx) => (
          <TableRow key={r.id}>
            <TableCell className="text-muted-foreground tabular-nums">{idx + 1}</TableCell>
            <TableCell className="font-semibold">{r.student_name}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.father_name}</TableCell>
            <TableCell>
              <Badge variant="outline" className="border-primary/40 text-primary">{r.class_label}</Badge>
            </TableCell>
            <TableCell className="text-sm">{PROGRAMME_LABEL[r.programme] ?? r.programme}</TableCell>
            <TableCell className="font-mono text-xs">{r.class_roll_no}</TableCell>
            <TableCell className="text-right">
              <Badge variant="secondary" className="bg-gold/15 font-mono text-gold-strong">
                {r.exam_roll_no}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
