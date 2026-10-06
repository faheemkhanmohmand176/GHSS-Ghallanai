import { CalendarDays, Building2, Info } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/supabase";
import { TimetableGrid, type TimetableSlot } from "@/components/admin/timetable-grid";

interface TimetableRow {
  day: string;
  period_number: number;
  subject: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
  room: string;
  meet_link?: string;
}

const PROGRAMMES = [
  { value: "ics", label: "ICS — Computer Science" },
  { value: "pre-medical", label: "Pre-Medical" },
  { value: "pre-engineering", label: "Pre-Engineering" },
  { value: "arts", label: "Arts (FA)" },
];

// Demo: 1st Year ICS — 6 periods of subjects per day Mon-Sat
const DEMO_TIMETABLE: TimetableRow[] = (() => {
  const schedule: Record<string, [string, string, string][]> = {
    Mon: [
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Urdu", "Abdul Wahab", "Room 12"],
      ["Islamiat", "Fazal Rahman", "Room 12"],
      ["Pak Studies", "Fazal Rahman", "Room 12"],
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
    ],
    Tue: [
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Urdu", "Abdul Wahab", "Room 12"],
      ["Islamiat", "Fazal Rahman", "Room 12"],
      ["Pak Studies", "Fazal Rahman", "Room 12"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
    ],
    Wed: [
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Test", "Ihsanullah Khan", "Room 12"],
      ["Urdu", "Abdul Wahab", "Room 12"],
      ["Islamiat", "Fazal Rahman", "Room 12"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
    ],
    Thu: [
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["Pak Studies", "Fazal Rahman", "Room 12"],
      ["Urdu", "Abdul Wahab", "Room 12"],
      ["Islamiat", "Fazal Rahman", "Room 12"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
    ],
    Fri: [
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["Urdu", "Abdul Wahab", "Room 12"],
      ["Pak Studies", "Fazal Rahman", "Room 12"],
      ["Islamiat", "Fazal Rahman", "Room 12"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
    ],
    Sat: [
      ["Mathematics", "Rehmat Ali", "Room 12"],
      ["Computer Science", "Taj Muhammad", "Lab 1"],
      ["English", "Ihsanullah Khan", "Room 12"],
      ["Test", "Rehmat Ali", "Room 12"],
      ["Library", "—", "Library"],
      ["Library", "—", "Library"],
      ["Sports", "—", "Ground"],
      ["Sports", "—", "Ground"],
    ],
  };

  const periodTimes: [string, string][] = [
    ["08:00", "08:45"],
    ["08:45", "09:30"],
    ["09:30", "10:15"],
    ["10:15", "11:00"],
    ["11:00", "11:45"],
    ["11:45", "12:30"],
    ["12:30", "01:15"],
    ["01:15", "02:00"],
  ];

  const rows: TimetableRow[] = [];
  for (const day of Object.keys(schedule)) {
    schedule[day].forEach((p, i) => {
      rows.push({
        day,
        period_number: i + 1,
        subject: p[0],
        teacher_name: p[1],
        start_time: periodTimes[i][0],
        end_time: periodTimes[i][1],
        room: p[2],
        meet_link: undefined,
      });
    });
  }
  return rows;
})();

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; programme?: string }>;
}) {
  const params = await searchParams;
  const selectedClass = params.class ?? "1st Year";
  const selectedProgramme = params.programme ?? "ics";

  let timetableRows: TimetableRow[] = DEMO_TIMETABLE;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("timetables")
        .select("*")
        .eq("class_label", selectedClass)
        .eq("programme", selectedProgramme)
        .order("day", { ascending: true })
        .order("period_number", { ascending: true });
      if (!error && data && data.length > 0) {
        timetableRows = (data as any[]).map((r) => ({
          day: r.day,
          period_number: r.period_number,
          subject: r.subject,
          teacher_name: r.teacher_name ?? "—",
          start_time: r.start_time ?? "",
          end_time: r.end_time ?? "",
          room: r.room ?? "",
          meet_link: r.meet_link,
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const slots: TimetableSlot[] = timetableRows.map((r) => ({
    day: r.day,
    period: r.period_number,
    subject: r.subject,
    teacher_name: r.teacher_name,
    start_time: r.start_time,
    end_time: r.end_time,
    room: r.room,
    meet_link: r.meet_link,
  }));

  const totalPeriods = timetableRows.length;
  const filledPeriods = timetableRows.filter((r) => r.subject && r.subject !== "—" && r.subject !== "Library" && r.subject !== "Sports").length;
  const uniqueTeachers = Array.from(new Set(timetableRows.map((r) => r.teacher_name).filter((n) => n && n !== "—"))).length;
  const uniqueRooms = Array.from(new Set(timetableRows.map((r) => r.room).filter((r) => r && r !== "—"))).length;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Timetable"
        desc="Six-day weekly grid (Mon-Sat) with eight periods each. Tap any cell to edit subject, teacher, time slot, room or online meeting link."
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Total Periods"
          value={totalPeriods}
          hint="Across the active weekly grid"
          icon={CalendarDays}
          accent="primary"
        />
        <StatCard
          label="Taught Periods"
          value={filledPeriods}
          hint="Excluding library/sports"
          icon={CalendarDays}
          accent="gold"
        />
        <StatCard
          label="Teachers Assigned"
          value={uniqueTeachers}
          hint="Distinct faculty in this grid"
          icon={Building2}
          accent="primary"
        />
        <StatCard
          label="Rooms Used"
          value={uniqueRooms}
          hint="Including labs"
          icon={Building2}
          accent="gold"
        />
      </StatGrid>

      <SectionCard
        title="Class Selector"
        description="Switch the timetable view between classes and programmes. Use the form below to change class."
      >
        <form className="flex flex-wrap gap-3" method="get">
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
              {PROGRAMMES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="h-11 self-end rounded-full font-semibold">
            Load Timetable
          </Button>
        </form>
      </SectionCard>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">School day:</span> 8:00 AM to 2:00 PM, Monday to Saturday.
          Each period is 45 minutes. Library and Sports periods are scheduled as the last two periods of each day.
        </p>
      </div>

      <SectionCard
        title={`${selectedClass} · ${selectedProgramme.toUpperCase()} Weekly Grid`}
        description="Tap any cell to edit. Changes are staged locally until you press Save Changes at the bottom."
        className="mt-5"
        actions={
          <Badge variant="outline" className="border-primary/40 text-primary">
            {filledPeriods} / {totalPeriods} filled
          </Badge>
        }
      >
        <TimetableGrid slots={slots} classLabel={selectedClass} programme={selectedProgramme} />
      </SectionCard>
    </PageContainer>
  );
}
