"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Newspaper, Trophy, Plus, Pin, Zap, BarChart3 } from "lucide-react";
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
import { DataTable, Tabs } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { NOTICE_CATEGORIES, NEWS_CATEGORIES, ACHIEVEMENT_CATEGORIES, CLASS_LABELS } from "@/lib/constants";
import { NOTICES, NEWS, type Notice } from "@/content/news";
import { DEMO_ACHIEVEMENTS, type AchievementRow } from "@/content/demo-content";

/**
 * Announcements — three sections (Babi Khel): Notices (with urgency + polls),
 * News (with cover images) and Achievements. Publishing a notice or news
 * item rings the public notification bell through SQL triggers.
 */

interface PollOption { id: string; text: string; votes: number }

export default function AdminAnnouncementsPage() {
  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Announcements"
        desc="Notices, news stories and achievements — the publishing engine behind the homepage, the notice board and the notification bell."
      />
      <Tabs
        tabs={[
          { id: "notices", label: "Notices", icon: <Megaphone className="h-4 w-4" aria-hidden /> },
          { id: "news", label: "News", icon: <Newspaper className="h-4 w-4" aria-hidden /> },
          { id: "achievements", label: "Achievements", icon: <Trophy className="h-4 w-4" aria-hidden /> },
        ]}
      >
        {(active) =>
          active === "notices" ? <NoticesTab /> :
          active === "news" ? <NewsTab /> :
          <AchievementsTab />
        }
      </Tabs>
    </AdminChrome>
  );
}

/* -------------------------------- Notices -------------------------------- */

function NoticesTab() {
  const [rows, setRows] = useState<Notice[]>(NOTICES);
  const [editing, setEditing] = useState<(Partial<Notice> & { is_poll?: boolean; poll_options?: PollOption[]; poll_closes_at?: string | null; is_urgent?: boolean }) | null>(null);
  const [deleting, setDeleting] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data } = await sb.from("notices").select("*").order("pinned", { ascending: false }).order("date", { ascending: false }).limit(200);
    if (data) setRows(data as Notice[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save(row: Partial<Notice> & { is_poll?: boolean; poll_options?: PollOption[]; is_urgent?: boolean }) {
    if (!row.title?.trim() || !row.body?.trim()) {
      toast({ title: "Title and body are required.", variant: "destructive" });
      return;
    }
    const payload = {
      title: row.title.trim(),
      body: row.body.trim(),
      category: row.category ?? "general",
      date: row.date ?? new Date().toISOString().slice(0, 10),
      pinned: row.pinned ?? false,
      is_urgent: row.is_urgent ?? false,
      is_poll: row.is_poll ?? false,
      poll_options: row.is_poll ? (row.poll_options ?? []) : [],
      poll_closes_at: row.is_poll ? (row.poll_closes_at || null) : null,
      published: true,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("notices").upsert({ ...payload, id: row.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Publish failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [{ ...payload, id: row.id ?? `local-${Date.now()}` } as Notice, ...rs.filter((r) => r.id !== row.id)]);
    }
    setEditing(null);
    toast({ title: "Notice published", description: "Live on /notices within 60 seconds · bell notification sent." });
  }

  async function togglePin(n: Notice) {
    await save({ ...n, pinned: !n.pinned });
  }

  async function remove(n: Notice) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("notices").update({ published: false, deleted_at: new Date().toISOString() }).eq("id", n.id);
    setRows((rs) => rs.filter((r) => r.id !== n.id));
    toast({ title: "Notice archived", description: "Soft-deleted — recoverable for 90 days in production." });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ category: "general", pinned: false, is_urgent: false, is_poll: false })} className="button-press h-10 rounded-full font-bold">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New notice
        </Button>
      </div>
      <Card>
        <CardContent>
          <DataTable head={["Notice", "Category", "Date", "Flags", ""]}>
            {rows.map((n) => (
              <tr key={n.id} className="hover:bg-secondary/40">
                <td className="max-w-72 py-3 pr-4">
                  <p className="truncate text-small font-bold">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                </td>
                <td className="py-3 pr-4 text-xs capitalize text-muted-foreground">{n.category}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{n.date}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {n.pinned && <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold"><Pin className="mr-1 h-3 w-3" aria-hidden />Pinned</Badge>}
                    {n.is_urgent && <Badge variant="outline" className="border-destructive/50 text-destructive"><Zap className="mr-1 h-3 w-3" aria-hidden />Urgent</Badge>}
                    {n.is_poll && <Badge variant="outline" className="border-primary/50 text-primary"><BarChart3 className="mr-1 h-3 w-3" aria-hidden />Poll</Badge>}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => togglePin(n)} aria-label="Toggle pin" className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary">
                      <Pin className={`h-4 w-4 ${n.pinned ? "text-gold" : "text-muted-foreground"}`} aria-hidden />
                    </button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(n as typeof editing)} className="button-press h-9 rounded-full">Edit</Button>
                    <button type="button" onClick={() => setDeleting(n)} aria-label="Archive" className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">×</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      {/* Notice composer */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit notice" : "New notice"} wide>
        {editing && <NoticeForm form={editing} setForm={setEditing} onSave={() => save(editing)} />}
      </Dialog>

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)} title="Archive this notice?" desc={deleting?.title ?? ""} confirmLabel="Archive" />
    </div>
  );
}

function NoticeForm({
  form, setForm, onSave,
}: {
  form: Partial<Notice> & { is_poll?: boolean; poll_options?: PollOption[]; is_urgent?: boolean; poll_closes_at?: string | null };
  setForm: (f: any) => void;
  onSave: () => void;
}) {
  const options = form.poll_options ?? [];
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-small font-semibold">Title *</Label>
        <Input className="h-11" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Category</Label>
          <Select value={form.category ?? "general"} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTICE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Date</Label>
          <Input type="date" className="h-11" value={form.date ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-small font-semibold">Body *</Label>
        <Textarea rows={4} value={form.body ?? ""} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
          <span className="text-small font-semibold">Pin to top</span>
          <Switch checked={form.pinned ?? false} onCheckedChange={(v) => setForm({ ...form, pinned: v })} aria-label="Pin" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
          <span className="text-small font-semibold">Mark urgent</span>
          <Switch checked={form.is_urgent ?? false} onCheckedChange={(v) => setForm({ ...form, is_urgent: v })} aria-label="Urgent" />
        </label>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
        <span className="text-small font-semibold">
          Attach a poll
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">One vote per device, RPC-guarded</span>
        </span>
        <Switch checked={form.is_poll ?? false} onCheckedChange={(v) => setForm({ ...form, is_poll: v, poll_options: v && options.length === 0 ? [{ id: "opt-1", text: "", votes: 0 }, { id: "opt-2", text: "", votes: 0 }] : options })} aria-label="Attach poll" />
      </label>
      {form.is_poll && (
        <div className="space-y-2 rounded-xl border border-border p-3.5">
          <Label className="text-small font-semibold">Poll options (2–6)</Label>
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <Input
                className="h-10"
                value={o.text}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = { ...o, text: e.target.value };
                  setForm({ ...form, poll_options: next });
                }}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, poll_options: options.filter((x) => x.id !== o.id) })}
                disabled={options.length <= 2}
                aria-label={`Remove option ${i + 1}`}
                className="button-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border disabled:opacity-40"
              >
                ×
              </button>
            </div>
          ))}
          {options.length < 6 && (
            <Button variant="outline" size="sm" onClick={() => setForm({ ...form, poll_options: [...options, { id: `opt-${Date.now()}`, text: "", votes: 0 }] })} className="button-press h-9 rounded-full">
              Add option
            </Button>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Poll closes at (optional)</Label>
            <Input type="datetime-local" className="h-10" value={form.poll_closes_at ?? ""} onChange={(e) => setForm({ ...form, poll_closes_at: e.target.value })} />
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={onSave} className="button-press h-10 rounded-full font-bold">
          <Megaphone className="mr-1.5 h-4 w-4" aria-hidden /> Publish notice
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- News ---------------------------------- */

interface NewsRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  cover_url: string | null;
  date: string;
  reading_minutes: number | null;
  published: boolean;
}

function NewsTab() {
  const [rows, setRows] = useState<NewsRow[]>(
    NEWS.map((n) => ({
      id: n.id,
      slug: n.slug,
      title: n.title,
      excerpt: n.excerpt,
      body: n.body,
      category: n.category,
      cover_url: null,
      date: n.date,
      reading_minutes: n.readingMinutes ?? 3,
      published: true,
    }))
  );
  const [editing, setEditing] = useState<Partial<NewsRow> | null>(null);
  const [deleting, setDeleting] = useState<NewsRow | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data } = await sb.from("news_posts").select("*").order("date", { ascending: false }).limit(200);
    if (data) setRows(data as NewsRow[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save(row: Partial<NewsRow>) {
    if (!row.title?.trim() || !row.excerpt?.trim()) {
      toast({ title: "Title and excerpt are required.", variant: "destructive" });
      return;
    }
    const payload = {
      slug: row.slug?.trim() || row.title!.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `news-${Date.now()}`,
      title: row.title.trim(),
      excerpt: row.excerpt.trim(),
      body: row.body ?? row.excerpt?.trim() ?? "",
      category: row.category ?? "Institution",
      cover_url: row.cover_url || null,
      date: row.date ?? new Date().toISOString().slice(0, 10),
      reading_minutes: row.reading_minutes ?? 3,
      published: row.published ?? true,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("news_posts").upsert({ ...payload, id: row.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [{ id: row.id ?? `demo-${Date.now()}`, ...payload } as NewsRow, ...rs.filter((r) => r.id !== row.id)]);
    }
    setEditing(null);
    toast({ title: "News saved", description: payload.published ? "Live on the homepage + notices page." : "Saved as draft." });
  }

  async function remove(n: NewsRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("news_posts").update({ published: false, deleted_at: new Date().toISOString() }).eq("id", n.id);
    setRows((rs) => rs.filter((r) => r.id !== n.id));
    toast({ title: "News archived" });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ category: "Institution", published: true, date: new Date().toISOString().slice(0, 10) })} className="button-press h-10 rounded-full font-bold">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New story
        </Button>
      </div>
      <Card>
        <CardContent>
          <DataTable head={["Story", "Category", "Date", "Status", ""]}>
            {rows.map((n) => (
              <tr key={n.id} className="hover:bg-secondary/40">
                <td className="max-w-80 py-3 pr-4">
                  <p className="truncate text-small font-bold">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.excerpt}</p>
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{n.category}</td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">{n.date}</td>
                <td className="py-3 pr-4">
                  <Badge variant="outline" className={n.published ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" : ""}>
                    {n.published ? "Published" : "Draft"}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setEditing(n)} className="button-press h-9 rounded-full">Edit</Button>
                    <button type="button" onClick={() => setDeleting(n)} aria-label="Archive" className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">×</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit story" : "New story"} wide>
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Title *</Label>
              <Input className="h-11" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Excerpt * (shows on the homepage)</Label>
              <Textarea rows={2} value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Full story</Label>
              <Textarea rows={5} value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Category</Label>
                <Select value={editing.category ?? "Institution"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEWS_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Date</Label>
                <Input type="date" className="h-11" value={editing.date ?? ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-small font-semibold">Cover image URL</Label>
                <Input className="h-11" value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} placeholder="https://…/photo.jpg" />
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3">
              <span className="text-small font-semibold">Published</span>
              <Switch checked={editing.published ?? true} onCheckedChange={(v) => setEditing({ ...editing, published: v })} aria-label="Published" />
            </label>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">
                <Newspaper className="mr-1.5 h-4 w-4" aria-hidden /> Save story
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)} title="Archive this story?" desc={deleting?.title ?? ""} confirmLabel="Archive" />
    </div>
  );
}

/* ----------------------------- Achievements ------------------------------ */

function AchievementsTab() {
  const [rows, setRows] = useState<AchievementRow[]>(DEMO_ACHIEVEMENTS);
  const [editing, setEditing] = useState<Partial<AchievementRow> | null>(null);
  const [deleting, setDeleting] = useState<AchievementRow | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data } = await sb.from("achievements").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setRows(data as AchievementRow[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save(row: Partial<AchievementRow>) {
    if (!row.title?.trim()) {
      toast({ title: "Title is required.", variant: "destructive" });
      return;
    }
    const payload: AchievementRow = {
      id: row.id ?? `demo-${Date.now()}`,
      title: row.title.trim(),
      description: row.description ?? null,
      student_name: row.student_name ?? null,
      class_label: row.class_label ?? null,
      year: row.year ?? new Date().getFullYear(),
      category: row.category ?? "Academic",
      image_url: row.image_url ?? null,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, ...rest } = payload;
      void id;
      const { error } = await sb.from("achievements").upsert({ ...rest, id: row.id });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [payload, ...rs.filter((r) => r.id !== payload.id)]);
    }
    setEditing(null);
    toast({ title: "Achievement saved", description: "Shows in the homepage “Our Pride” section." });
  }

  async function remove(a: AchievementRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("achievements").delete().eq("id", a.id);
    setRows((rs) => rs.filter((r) => r.id !== a.id));
    toast({ title: "Achievement removed" });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ category: "Academic", year: new Date().getFullYear() })} className="button-press h-10 rounded-full font-bold">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add achievement
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <Card key={a.id} className="card-lift">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">{a.category}</Badge>
                <span className="text-xs font-bold text-muted-foreground">{a.year}</span>
              </div>
              <p className="mt-2.5 text-small font-bold leading-snug">{a.title}</p>
              {a.student_name && (
                <p className="mt-1 text-xs font-semibold text-primary">
                  {a.student_name}{a.class_label ? ` · ${a.class_label}` : ""}
                </p>
              )}
              {a.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>}
              <div className="mt-3 flex justify-end gap-1.5 border-t border-border/60 pt-3">
                <Button variant="outline" size="sm" onClick={() => setEditing(a)} className="button-press h-9 rounded-full">Edit</Button>
                <button type="button" onClick={() => setDeleting(a)} aria-label="Delete" className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">×</button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit achievement" : "Add achievement"}>
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Title *</Label>
              <Input className="h-11" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Board position — Pre-Medical" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Description</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Student name</Label>
                <Input className="h-11" value={editing.student_name ?? ""} onChange={(e) => setEditing({ ...editing, student_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Class</Label>
                <Select value={editing.class_label ?? "none"} onValueChange={(v) => setEditing({ ...editing, class_label: v === "none" ? null : v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {CLASS_LABELS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Year</Label>
                <Input type="number" className="h-11" value={editing.year ?? new Date().getFullYear()} onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Category</Label>
                <Select value={editing.category ?? "Academic"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACHIEVEMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Image URL (optional)</Label>
              <Input className="h-11" value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">
                <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> Save achievement
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)} title="Delete this achievement?" desc={deleting?.title ?? ""} />
    </div>
  );
}
