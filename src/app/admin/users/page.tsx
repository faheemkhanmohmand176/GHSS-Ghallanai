"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, ShieldCheck, GraduationCap, Briefcase, Plus, Search } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser, getSession } from "@/lib/auth";
import { callRpc } from "@/lib/admin-data";

/**
 * Manage Users — profiles + roles (Babi Khel pattern):
 *  · list every profile with its role
 *  · Add Admin creates the auth account with a THROWAWAY client
 *    (persistSession:false) so the current admin's session is never
 *    replaced, then promotes the trigger-created profile row
 *  · deletes go through the admin_delete_user RPC (refuses self-delete)
 */

interface ProfileRow {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  phone: string | null;
  email?: string;
  created_at: string;
}

const ROLE_ICON = { student: GraduationCap, teacher: Briefcase, admin: ShieldCheck } as const;

const DEMO_USERS: ProfileRow[] = [
  { id: "u1", full_name: "Office Administrator", role: "admin", phone: null, created_at: new Date().toISOString() },
  { id: "u2", full_name: "Mr. Khan (Physics)", role: "teacher", phone: null, created_at: new Date().toISOString() },
  { id: "u3", full_name: "SAMPLE Student (2nd Yr PM-B)", role: "student", phone: null, created_at: new Date().toISOString() },
];

export default function AdminUsersPage() {
  const [rows, setRows] = useState<ProfileRow[]>(DEMO_USERS);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data } = await sb.from("profiles").select("id, full_name, role, phone, created_at").order("created_at", { ascending: false }).limit(200);
    setRows((data as ProfileRow[]) ?? []);
    const session = await getSession();
    if (session?.user) setMe(session.user.id);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = rows.filter((r) => !search || r.full_name.toLowerCase().includes(search.toLowerCase()));

  async function changeRole(row: ProfileRow, role: ProfileRow["role"]) {
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("profiles").update({ role, updated_at: new Date().toISOString() }).eq("id", row.id);
      if (error) {
        toast({ title: "Role change failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, role } : r)));
    toast({ title: `Role → ${role}`, description: `${row.full_name} — audit-logged.` });
  }

  async function addAdmin() {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      toast({ title: "Name, email and a 6+ character password are required.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setBusy(false);
      toast({ title: "Live mode required", description: "Configure Supabase env vars to create accounts.", variant: "destructive" });
      return;
    }
    try {
      // Throwaway client — never replaces the current admin's session
      const temp = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await temp.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), role: "admin" } },
      });
      if (error || !data.user) {
        toast({ title: "Account creation failed", description: error?.message ?? "Unknown error", variant: "destructive" });
        setBusy(false);
        return;
      }
      // Promote the trigger-created profile (retry: the trigger may lag)
      const sb = supabaseBrowser()!;
      let promoted = false;
      for (let i = 0; i < 6; i++) {
        const { error: upErr } = await sb
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name: form.full_name.trim(),
            role: "admin",
            phone: form.phone.trim() || null,
            updated_at: new Date().toISOString(),
          });
        if (!upErr) {
          promoted = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!promoted) {
        toast({
          title: "Account created but promotion pending",
          description: "The profile row did not appear in time — set the role manually in a moment.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Administrator added", description: `${form.full_name} can sign in at /admin/login.` });
      }
      setForm({ full_name: "", email: "", password: "", phone: "" });
      setAdding(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(row: ProfileRow) {
    if (row.id === me) {
      toast({ title: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    const sb = supabaseBrowser();
    if (sb) {
      const res = await callRpc("admin_delete_user", { p_target_user_id: row.id });
      if (!res.ok) {
        toast({ title: "Delete failed", description: res.error, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    }
    toast({ title: "Account deleted", description: `${row.full_name} — auth user + profile cascaded.` });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Manage Users"
        desc="Every authenticated human holds one profile row; the role gates the console. Admin grants are explicit, audit-logged, and deletions refuse self-removal."
        actions={
          <Button onClick={() => setAdding(true)} className="button-press h-10 rounded-full font-bold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add admin
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…" className="h-11 pl-10" aria-label="Search users" />
        </div>
        <Badge variant="outline" className="h-11 rounded-full border-primary/40 px-4 text-sm font-bold text-primary">
          <Users className="mr-1.5 h-4 w-4" aria-hidden /> {rows.filter((r) => r.role === "admin").length} admins / {rows.length} users
        </Badge>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading profiles…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No profiles match.</p>
          ) : (
            <DataTable head={["User", "Role", "Phone", "Joined", ""]}>
              {visible.map((u) => {
                const Icon = ROLE_ICON[u.role] ?? GraduationCap;
                return (
                  <tr key={u.id} className="hover:bg-secondary/40">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                          <Icon className="h-4.5 w-4.5 text-primary" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="text-small font-bold">
                            {u.full_name}
                            {u.id === me && (
                              <Badge variant="outline" className="ml-2 border-primary/40 px-1.5 text-[0.6rem] text-primary">You</Badge>
                            )}
                          </p>
                          {u.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {u.id === me ? (
                        <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">admin</Badge>
                      ) : (
                        <Select value={u.role} onValueChange={(v) => changeRole(u, v as ProfileRow["role"])}>
                          <SelectTrigger className="h-9 w-28 text-xs" aria-label={`Role for ${u.full_name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="teacher">teacher</SelectItem>
                            <SelectItem value="student">student</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{u.phone ?? "—"}</td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("en-PK")}</td>
                    <td className="py-3 text-right">
                      {u.id !== me && (
                        <button
                          type="button"
                          onClick={() => setDeleting(u)}
                          aria-label={`Delete ${u.full_name}`}
                          className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* Add admin dialog */}
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add administrator" desc="Creates the account with a throwaway session, then promotes its profile.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-small font-semibold">Full name *</Label>
            <Input className="h-11" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-small font-semibold">Email *</Label>
            <Input type="email" className="h-11" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-small font-semibold">Password * (min 6 characters)</Label>
            <Input type="text" className="h-11" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Temporary password — share it securely" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-small font-semibold">Phone (optional)</Label>
            <Input className="h-11" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <p className="text-xs text-muted-foreground">
            Your own session is never touched — the account is created through an isolated client and
            the profile is promoted afterwards.
          </p>
          <div className="flex justify-end">
            <Button onClick={addAdmin} disabled={busy} className="button-press h-10 rounded-full font-bold">
              <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> {busy ? "Creating…" : "Create admin"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeUser(deleting)}
        title="Delete this account?"
        desc={`${deleting?.full_name ?? ""} — the auth user and profile are removed together.`}
        confirmLabel="Delete account"
      />
    </AdminChrome>
  );
}
