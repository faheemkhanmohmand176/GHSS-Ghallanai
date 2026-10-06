import Link from "next/link";
import { Users, Plus, Search, MoreHorizontal } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, EmptyState } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";

interface StudentRow {
  id: string;
  full_name: string;
  roll_no: string | null;
  admission_no: string | null;
  class_label: string;
  programme: string;
  guardian_name: string;
  guardian_phone: string;
  status: string;
}

const DEMO_STUDENTS: StudentRow[] = [
  { id: "1", full_name: "Abdul Rahman Khan", roll_no: "12-ICS-01", admission_no: "GHSS-2026-1001", class_label: "2nd Year", programme: "ics", guardian_name: "Mohammad Khan", guardian_phone: "+92-300-1234567", status: "active" },
  { id: "2", full_name: "Ayesha Bibi", roll_no: "12-PM-05", admission_no: "GHSS-2026-1002", class_label: "2nd Year", programme: "pre-medical", guardian_name: "Gul Rahman", guardian_phone: "+92-301-2345678", status: "active" },
  { id: "3", full_name: "Hassan Ali", roll_no: "11-PE-12", admission_no: "GHSS-2026-1003", class_label: "1st Year", programme: "pre-engineering", guardian_name: "Akbar Ali", guardian_phone: "+92-302-3456789", status: "active" },
  { id: "4", full_name: "Fatima Khan", roll_no: "11-AR-03", admission_no: "GHSS-2026-1004", class_label: "1st Year", programme: "arts", guardian_name: "Saeed Khan", guardian_phone: "+92-303-4567890", status: "active" },
  { id: "5", full_name: "Bilal Ahmed", roll_no: "12-ICS-08", admission_no: "GHSS-2026-1005", class_label: "2nd Year", programme: "ics", guardian_name: "Jamal Ahmed", guardian_phone: "+92-304-5678901", status: "graduated" },
];

const PROGRAMME_LABEL: Record<string, string> = {
  "ics": "ICS",
  "pre-medical": "Pre-Medical",
  "pre-engineering": "Pre-Engineering",
  "arts": "Arts",
};

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.toLowerCase() ?? "";
  const classFilter = params.class ?? "";
  const statusFilter = params.status ?? "";

  let students: StudentRow[] = DEMO_STUDENTS;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      let query = sb
        .from("students")
        .select(`
          id,
          admission_no,
          roll_no,
          status,
          guardian_name,
          guardian_phone,
          classes:classes!inner(year, programme)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        students = (data as any[]).map((s) => ({
          id: s.id,
          full_name: "—",
          roll_no: s.roll_no,
          admission_no: s.admission_no,
          class_label: s.classes?.year === 1 ? "1st Year" : "2nd Year",
          programme: s.classes?.programme ?? "",
          guardian_name: s.guardian_name,
          guardian_phone: s.guardian_phone,
          status: s.status,
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const filtered = students.filter((s) => {
    if (q && !`${s.full_name} ${s.roll_no} ${s.admission_no}`.toLowerCase().includes(q)) return false;
    if (classFilter && s.class_label !== classFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Students"
        desc="Manage the student register: enrolment, class assignment, guardian contact, status."
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full">
              Import CSV
            </Button>
            <Button className="h-11 rounded-full font-semibold">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add Student
            </Button>
          </>
        }
      />

      <SectionCard>
        <form className="mb-4 flex flex-wrap gap-3" method="get">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name, roll number, or admission number…"
              className="h-11 pl-10"
            />
          </div>
          <select
            name="class"
            defaultValue={params.class ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Classes</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button type="submit" variant="outline" className="h-11">
            Apply
          </Button>
        </form>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students match the filters"
            description="Try clearing the search or selecting a different class/status."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Roll No</TableHead>
                <TableHead>Admission No</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <p className="font-semibold">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.id}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.roll_no ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.admission_no ?? "—"}</TableCell>
                  <TableCell>{s.class_label}</TableCell>
                  <TableCell>{PROGRAMME_LABEL[s.programme] ?? s.programme}</TableCell>
                  <TableCell>
                    <p className="text-sm">{s.guardian_name}</p>
                    <p className="text-xs text-muted-foreground">{s.guardian_phone}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        s.status === "active"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : s.status === "graduated"
                            ? "border-primary/40 text-primary"
                            : "border-muted-foreground/40 text-muted-foreground"
                      }
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </PageContainer>
  );
}
