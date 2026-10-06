import Link from "next/link";
import { UserCog, Plus, Search, MoreHorizontal, BookOpen, Award, Calendar } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid, EmptyState } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";
import { FACULTY } from "@/content/about";

interface TeacherRow {
  id: string;
  name: string;
  designation: string;
  qualification: string;
  subjects: string[];
  department: string;
  years: number;
  photo_url: string | null;
  is_active: boolean;
  display_order: number;
}

const DEMO_TEACHERS: TeacherRow[] = FACULTY.slice(0, 8).map((f, i) => ({
  id: f.id,
  name: f.name,
  designation: f.designation,
  qualification: f.qualification,
  subjects: f.subjects,
  department: f.department,
  years: f.years,
  photo_url: null,
  is_active: true,
  display_order: i + 1,
}));

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.toLowerCase() ?? "";
  const deptFilter = params.dept ?? "";
  const statusFilter = params.status ?? "";

  let teachers: TeacherRow[] = DEMO_TEACHERS;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("faculty")
        .select("*")
        .is("deleted_at", null)
        .order("display_order", { ascending: true })
        .order("years", { ascending: false });
      if (!error && data && data.length > 0) {
        teachers = (data as any[]).map((t) => ({
          id: t.id,
          name: t.name,
          designation: t.designation,
          qualification: t.qualification,
          subjects: t.subjects ?? [],
          department: t.department,
          years: t.years ?? 0,
          photo_url: t.photo_url ?? null,
          is_active: t.is_active ?? true,
          display_order: t.display_order ?? 0,
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const departments = Array.from(new Set(teachers.map((t) => t.department))).sort();

  const filtered = teachers.filter((t) => {
    if (q && !`${t.name} ${t.designation} ${t.subjects.join(" ")}`.toLowerCase().includes(q)) return false;
    if (deptFilter && t.department !== deptFilter) return false;
    if (statusFilter === "active" && !t.is_active) return false;
    if (statusFilter === "inactive" && t.is_active) return false;
    return true;
  });

  const activeCount = teachers.filter((t) => t.is_active).length;
  const deptCount = departments.length;
  const avgYears = teachers.length
    ? Math.round((teachers.reduce((s, t) => s + t.years, 0) / teachers.length) * 10) / 10
    : 0;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Teachers"
        desc="Manage the faculty directory: designations, qualifications, subject assignments and active status. Public directory at /about/faculty reads from the same register."
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full">
              Import Faculty
            </Button>
            <Button asChild className="h-11 rounded-full font-semibold">
              <Link href="/admin/teachers">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add Teacher
              </Link>
            </Button>
          </>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Teaching Staff"
          value={teachers.length}
          hint={`${activeCount} currently active`}
          icon={UserCog}
          accent="primary"
        />
        <StatCard
          label="Departments"
          value={deptCount}
          hint="Science · Computing · Humanities"
          icon={BookOpen}
          accent="gold"
        />
        <StatCard
          label="Avg. Experience"
          value={`${avgYears}y`}
          hint="Across active faculty"
          icon={Calendar}
          accent="primary"
        />
        <StatCard
          label="Senior Faculty (10y+)"
          value={teachers.filter((t) => t.years >= 10).length}
          hint="Tenured subject teachers"
          icon={Award}
          accent="gold"
        />
      </StatGrid>

      <SectionCard>
        <form className="mb-4 flex flex-wrap gap-3" method="get">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name, designation or subject…"
              className="h-11 pl-10"
              aria-label="Search teachers"
            />
          </div>
          <select
            name="dept"
            defaultValue={params.dept ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button type="submit" variant="outline" className="h-11">
            Apply
          </Button>
        </form>

        {filtered.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No teachers match the filters"
            description="Try clearing the search or selecting a different department."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {t.photo_url ? <AvatarImage src={t.photo_url} alt={t.name} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {initials(t.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight">{t.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{t.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t.designation}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.subjects.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="bg-primary/10 text-primary">
                          {s}
                        </Badge>
                      ))}
                      {t.subjects.length > 3 && (
                        <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                          +{t.subjects.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-gold/40 text-gold-strong">
                      {t.department}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-muted-foreground">
                    <span className="line-clamp-2">{t.qualification}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-semibold tabular-nums">{t.years}</span>
                    <span className="text-muted-foreground"> yrs</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        t.is_active
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : "border-muted-foreground/40 text-muted-foreground"
                      }
                    >
                      {t.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Actions for ${t.name}`}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <p className="mt-4 text-xs text-muted-foreground">
        <Label className="font-semibold text-foreground">Note:</Label>{" "}
        Faculty changes write through the <code className="font-mono">faculty</code> table under admin RLS with audit
        logging. The public directory at <Link href="/about/faculty" className="text-primary underline">/about/faculty</Link>{" "}
        refreshes within 60 seconds of any update.
      </p>
    </PageContainer>
  );
}
