"use client";

import { useState } from "react";
import { Users, ShieldCheck, GraduationCap, Briefcase, KeyRound } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Users & roles (§7.5/§8.6): profiles with role enum (student, teacher, admin),
 * session revocation, annual leavers de-provisioning runbook reference.
 */
const DEMO_USERS = [
  { name: "SAMPLE Student (2nd Yr PM-B)", role: "student", email: "student@example.edu.pk", status: "active" },
  { name: "Mr. Khan (Physics)", role: "teacher", email: "khan@example.edu.pk", status: "active" },
  { name: "Office Administrator", role: "admin", email: "admin@example.edu.pk", status: "active" },
  { name: "SAMPLE Student (1st Yr ICS)", role: "student", email: "s2@example.edu.pk", status: "suspended" },
];

const ROLE_ICON = { student: GraduationCap, teacher: Briefcase, admin: ShieldCheck } as const;

export default function AdminUsers() {
  const [users, setUsers] = useState(DEMO_USERS);

  function revoke(name: string) {
    setUsers((u) => u.map((x) => (x.name === name ? { ...x, status: "revoked" } : x)));
    toast({ title: "Session revoked", description: `${name} — forces re-authentication on next visit (§11.3).` });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Users & roles"
        desc="Every authenticated human holds one profile row; the role gates every portal route. Admin grants are explicit and audit-logged; nothing is implicit."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-small">
            <Users className="h-4 w-4 text-primary" aria-hidden /> Profiles ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">User</th>
                  <th className="py-3 pr-4 font-semibold">Role</th>
                  <th className="py-3 pr-4 font-semibold">Email</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const Icon = ROLE_ICON[u.role as keyof typeof ROLE_ICON];
                  return (
                    <tr key={u.email} className="border-b border-border/40 last:border-0">
                      <td className="py-3.5 pr-4 font-semibold">{u.name}</td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="h-4 w-4 text-primary" aria-hidden />
                          <Badge variant="outline">{u.role}</Badge>
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-mono text-xs text-muted-foreground">{u.email}</td>
                      <td className="py-3.5 pr-4">
                        <Badge
                          variant="outline"
                          className={u.status === "active" ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"}
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => revoke(u.name)}
                          disabled={u.status === "revoked"}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-bold hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden /> Revoke session
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Role changes require a typed confirmation in production; the annual leavers&apos;
            de-provisioning runbook is documented in the handover pack (§8.6, §15).
          </p>
        </CardContent>
      </Card>
    </AdminChrome>
  );
}
