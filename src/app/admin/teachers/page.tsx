"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { DEMO_TEACHERS, type TeacherRow } from "@/content/demo-content";

/**
 * Manage Teachers — CRUD over the `teachers` table (Babi Khel pattern):
 * photo/qualification/experience, display order, active toggle. The public
 * faculty directory + homepage strip + timetable dropdowns read this table.
 */
export default function AdminTeachersPage() {
  const [rows, setRows] = useState<TeacherRow[]>(DEMO_TEACHERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<TeacherRow> | null>(null);
  const [deleting, setDeleting] = useState<TeacherRow | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error } = await sb.from("teachers").select("*").order("display_order");
    if (error) toast({ title: "Could not load teachers", description: error.message, variant: "destructive" });
    else setRows((data as TeacherRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = rows.filter(
    (t) =>
      !search ||
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.qualification ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function save(row: Partial<TeacherRow>) {
    if (!row.full_name?.trim() || !row.subject?.trim()) {
      toast({ title: "Name and subject are required.", variant: "destructive" });
      return;
    }
    const payload: TeacherRow = {
      id: row.id ?? `demo-${Date.now()}`,
      full_name: row.full_name.trim(),
      subject: row.subject.trim(),
      qualification: row.qualification ?? null,
      experience: row.experience ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      bio: row.bio ?? null,
      photo_url: row.photo_url ?? null,
      display_order: Number(row.display_order ?? rows.length + 1),
      is_active: row.is_active ?? true,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, ...rest } = payload;
      void id;
      const { error } = await sb.from("teachers").upsert({ ...rest, id: row.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [...rs.filter((r) => r.id !== payload.id), payload].sort((a, b) => a.display_order - b.display_order));
    }
    setEditing(null);
    toast({ title: "Teacher saved", description: `${payload.full_name} — ${payload.subject}` });
  }

  async function remove(row: TeacherRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("teachers").delete().eq("id", row.id);
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast({ title: "Teacher removed", description: `${row.full_name} (audit-logged)` });
  }

  async function toggleActive(row: TeacherRow) {
    await save({ ...row, is_active: !row.is_active });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Manage Teachers"
        desc="The faculty directory behind the public Teachers page, the homepage strip and the timetable teacher dropdowns."
        actions={
          <Button onClick={() => setEditing({ is_active: true, display_order: rows.length + 1 })} className="button-press h-10 rounded-full font-bold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add teacher
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, subject or qualification…" className="h-11 pl-10" aria-label="Search teachers" />
        </div>
        <Badge variant="outline" className="h-11 rounded-full border-primary/40 px-4 text-sm font-bold text-primary">
          <Users className="mr-1.5 h-4 w-4" aria-hidden />
          {rows.filter((r) => r.is_active).length} active / {rows.length} total
        </Badge>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading teachers…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No teachers match — add the first one.</p>
          ) : (
            <DataTable head={["Teacher", "Subject", "Contact", "Order", "Status", ""]}>
              {visible.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/40">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {t.photo_url ? (
                         
                        <img src={t.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-strong text-xs font-bold text-gold">
                          {t.full_name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("")}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-small font-bold">{t.full_name}</p>
                        <p className="text-xs text-muted-foreground">{t.qualification ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-small font-semibold text-primary">{t.subject}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">
                    {t.phone ?? t.email ?? "—"}
                    {t.experience ? <span className="block">{t.experience}</span> : null}
                  </td>
                  <td className="py-3 pr-4 text-small tabular-nums">{t.display_order}</td>
                  <td className="py-3 pr-4">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} aria-label={`Toggle ${t.full_name}`} />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditing(t)} className="button-press h-9 rounded-full">Edit</Button>
                      <button
                        type="button"
                        onClick={() => setDeleting(t)}
                        aria-label={`Remove ${t.full_name}`}
                        className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.full_name}` : "Add teacher"} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Full name *</Label>
                <Input className="h-11" value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Subject *</Label>
                <Input className="h-11" value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Physics" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Qualification</Label>
                <Input className="h-11" value={editing.qualification ?? ""} onChange={(e) => setEditing({ ...editing, qualification: e.target.value })} placeholder="M.Sc Physics" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Experience</Label>
                <Input className="h-11" value={editing.experience ?? ""} onChange={(e) => setEditing({ ...editing, experience: e.target.value })} placeholder="12 years" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Phone</Label>
                <Input className="h-11" value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Email</Label>
                <Input type="email" className="h-11" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Photo URL</Label>
                <Input className="h-11" value={editing.photo_url ?? ""} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} placeholder="https://…/photo.jpg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Display order</Label>
                <Input type="number" className="h-11" value={editing.display_order ?? 1} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Short bio</Label>
              <Textarea rows={2} value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
              <span className="text-small font-semibold">Active (visible on the public site)</span>
              <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} aria-label="Teacher active" />
            </label>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">Save teacher</Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Remove this teacher?"
        desc={`${deleting?.full_name ?? ""} disappears from the directory immediately (audit-logged).`}
        confirmLabel="Remove teacher"
      />
    </AdminChrome>
  );
}
