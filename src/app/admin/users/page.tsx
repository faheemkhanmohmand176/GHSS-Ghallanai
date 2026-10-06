import { Users, UserPlus, Search, ShieldCheck, GraduationCap, Briefcase, MoreHorizontal, KeyRound } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid, EmptyState } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";

// ---- Types -----------------------------------------------------------------

type Role = "admin" | "teacher" | "student";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "revoked";
  created_at: string;
}

// ---- Demo data -------------------------------------------------------------

const DEMO_PROFILES: ProfileRow[] = [
  { id: "u1", full_name: "Office Administrator", email: "admin@ghssghallanai.edu.pk", role: "admin", status: "active", created_at: "2024-08-12T08:00:00Z" },
  { id: "u2", full_name: "Mr. Taj Muhammad (Computer Science)", email: "taj.muhammad@ghssghallanai.edu.pk", role: "admin", status: "active", created_at: "2024-09-01T08:00:00Z" },
  { id: "u3", full_name: "Mr. Ihsanullah Khan (English)", email: "ihsanullah@ghssghallanai.edu.pk", role: "admin", status: "active", created_at: "2024-09-05T08:00:00Z" },
  { id: "u4", full_name: "Mr. Muhammad Yousaf Khan (Physics)", email: "yousaf.khan@ghssghallanai.edu.pk", role: "teacher", status: "active", created_at: "2024-09-10T08:00:00Z" },
  { id: "u5", full_name: "Mr. Rehmat Ali (Mathematics)", email: "rehmat.ali@ghssghallanai.edu.pk", role: "teacher", status: "active", created_at: "2024-09-12T08:00:00Z" },
  { id: "u6", full_name: "SAMPLE Student (2nd Year PM-B)", email: "student@ghssghallanai.edu.pk", role: "student", status: "active", created_at: "2025-12-01T08:00:00Z" },
  { id: "u7", full_name: "SAMPLE Student (1st Year ICS)", email: "s2@ghssghallanai.edu.pk", role: "student", status: "suspended", created_at: "2025-12-03T08:00:00Z" },
];

// ---- Helpers ---------------------------------------------------------------

const ROLE_CONFIG: Record<Role, { icon: typeof ShieldCheck; label: string; tone: string }> = {
  admin: { icon: ShieldCheck, label: "Admin", tone: "border-primary/40 text-primary" },
  teacher: { icon: Briefcase, label: "Teacher", tone: "border-gold/40 text-gold-strong" },
  student: { icon: GraduationCap, label: "Student", tone: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
};

const STATUS_TONE: Record<ProfileRow["status"], string> = {
  active: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  suspended: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  revoked: "border-rose-500/40 text-rose-600 dark:text-rose-400",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

function formatDate(d: string) {
  try {
    return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  } catch {
    return d;
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.toLowerCase() ?? "";
  const roleFilter = params.role ?? "";

  let profiles: ProfileRow[] = DEMO_PROFILES;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("profiles")
        .select("id, full_name, role, created_at, deleted_at")
        .order("created_at", { ascending: false });
      if (!error && data && data.length > 0) {
        // We don't have email directly on profiles — read it from auth via admin API in production.
        // For the demo + RLS admin path we leave the email blank; the demo data above carries it.
        profiles = (data as any[]).map((p) => ({
          id: p.id,
          full_name: p.full_name ?? "Unnamed",
          email: "",
          role: (p.role as Role) ?? "student",
          status: p.deleted_at ? "revoked" : "active",
          created_at: p.created_at ?? "",
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const filtered = profiles.filter((p) => {
    if (q && !`${p.full_name} ${p.email}`.toLowerCase().includes(q)) return false;
    if (roleFilter && p.role !== roleFilter) return false;
    return true;
  });

  const adminCount = profiles.filter((p) => p.role === "admin").length;
  const teacherCount = profiles.filter((p) => p.role === "teacher").length;
  const studentCount = profiles.filter((p) => p.role === "student").length;
  const activeCount = profiles.filter((p) => p.status === "active").length;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Users & Roles"
        desc="Every authenticated human holds one profile row; the role gates every portal route. Admin grants are explicit and audit-logged — nothing is implicit."
        actions={
          <Button className="h-11 rounded-full font-semibold">
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden /> Add Admin
          </Button>
        }
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Total Profiles"
          value={profiles.length}
          hint={`${activeCount} currently active`}
          icon={Users}
          accent="primary"
        />
        <StatCard
          label="Administrators"
          value={adminCount}
          hint="Full admin dashboard access"
          icon={ShieldCheck}
          accent="primary"
        />
        <StatCard
          label="Teachers"
          value={teacherCount}
          hint="Teacher portal access"
          icon={Briefcase}
          accent="gold"
        />
        <StatCard
          label="Students"
          value={studentCount}
          hint="Student portal access"
          icon={GraduationCap}
          accent="success"
        />
      </StatGrid>

      <SectionCard>
        <form className="mb-4 flex flex-wrap gap-3" method="get">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={params.q}
              placeholder="Search by name or email…"
              className="h-11 pl-10"
              aria-label="Search users"
            />
          </div>
          <select
            name="role"
            defaultValue={params.role ?? ""}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
          <Button type="submit" variant="outline" className="h-11">
            Apply
          </Button>
        </form>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No profiles match the filters"
            description="Try clearing the search or selecting a different role."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const cfg = ROLE_CONFIG[u.role];
                const Icon = cfg.icon;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className={`text-xs font-bold ${
                            u.role === "admin"
                              ? "bg-primary text-primary-foreground"
                              : u.role === "teacher"
                                ? "bg-gold/15 text-gold-strong"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {initials(u.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight">{u.full_name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{u.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.tone}>
                        <Icon className="mr-1 h-3 w-3" aria-hidden /> {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {u.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[u.status]}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.created_at ? formatDate(u.created_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={`Revoke session for ${u.full_name}`}
                          title="Revoke session"
                        >
                          <KeyRound className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={`More actions for ${u.full_name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <p className="mt-4 text-xs text-muted-foreground">
        Role changes require a typed confirmation in production; the annual leavers&apos; de-provisioning
        runbook is documented in the handover pack. Revoking a session forces re-authentication on the
        user&apos;s next visit.
      </p>
    </PageContainer>
  );
}
