"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { EVENT_TYPES, EVENT_TYPE_META } from "@/lib/constants";
import { DEMO_EVENTS, type EventRow } from "@/content/demo-content";

/** Event Calendar — school_events CRUD with per-row publish toggles. */
export default function AdminEventsPage() {
  const [rows, setRows] = useState<EventRow[]>(DEMO_EVENTS);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EventRow> | null>(null);
  const [deleting, setDeleting] = useState<EventRow | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 10;

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error } = await sb.from("school_events").select("*").order("start_date", { ascending: true });
    if (error) toast({ title: "Could not load events", description: error.message, variant: "destructive" });
    else setRows((data as EventRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function save(row: Partial<EventRow>) {
    if (!row.title?.trim() || !row.start_date) {
      toast({ title: "Title and start date are required.", variant: "destructive" });
      return;
    }
    const payload: EventRow = {
      id: row.id ?? `demo-${Date.now()}`,
      title: row.title.trim(),
      description: row.description ?? null,
      event_type: row.event_type ?? "general",
      start_date: row.start_date,
      end_date: row.end_date || null,
      is_published: row.is_published ?? true,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, ...rest } = payload;
      void id;
      const { error } = await sb.from("school_events").upsert({ ...rest, id: row.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [...rs.filter((r) => r.id !== payload.id), payload].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    }
    setEditing(null);
    toast({ title: "Event saved", description: payload.is_published ? "Published — the bell rang for visitors." : "Saved as hidden." });
  }

  async function togglePublish(row: EventRow) {
    await save({ ...row, is_published: !row.is_published });
  }

  async function remove(row: EventRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("school_events").delete().eq("id", row.id);
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast({ title: "Event deleted", description: row.title });
  }

  const visible = rows.slice(page * perPage, page * perPage + perPage);
  const pages = Math.max(1, Math.ceil(rows.length / perPage));

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Event Calendar"
        desc="Exams, holidays, PTMs and school functions. Published events appear on the public /calendar page with an .ics download."
        actions={
          <Button onClick={() => setEditing({ event_type: "general", is_published: true, start_date: new Date().toISOString().slice(0, 10) })} className="button-press h-10 rounded-full font-bold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add event
          </Button>
        }
      />

      {loading ? (
        <p className="py-8 text-center text-small text-muted-foreground">Loading events…</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-small text-muted-foreground">No events — add the first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => {
            const meta = EVENT_TYPE_META[e.event_type] ?? EVENT_TYPE_META.general;
            return (
              <Card key={e.id} className="card-lift">
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="shrink-0 rounded-xl border border-border bg-secondary/50 px-4 py-2 text-center">
                    <p className="text-[0.6rem] font-bold uppercase text-muted-foreground">
                      {new Date(e.start_date + "T00:00:00").toLocaleDateString("en-PK", { month: "short" })}
                    </p>
                    <p className="font-display text-xl font-bold text-primary">{new Date(e.start_date + "T00:00:00").getDate()}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[0.65rem] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</p>
                    <p className="mt-0.5 text-small font-bold">{e.title}</p>
                    {e.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.start_date}{e.end_date ? ` → ${e.end_date}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={e.is_published} onCheckedChange={() => togglePublish(e)} aria-label={`Publish ${e.title}`} />
                    <Button variant="outline" size="sm" onClick={() => setEditing(e)} className="button-press h-9 rounded-full">Edit</Button>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      aria-label={`Delete ${e.title}`}
                      className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      ×
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page" className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full border border-border disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-xs font-semibold text-muted-foreground">Page {page + 1} of {pages}</span>
          <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} aria-label="Next page" className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full border border-border disabled:opacity-40">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit event" : "Add event"}>
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Title *</Label>
              <Input className="h-11" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Send-up exams begin" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Type</Label>
                <Select value={editing.event_type ?? "general"} onValueChange={(v) => setEditing({ ...editing, event_type: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{EVENT_TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Start date *</Label>
                <Input type="date" className="h-11" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">End date (optional)</Label>
                <Input type="date" className="h-11" value={editing.end_date ?? ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Description</Label>
              <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
              <span className="text-small font-semibold">Published (visible on /calendar)</span>
              <Switch checked={editing.is_published ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_published: v })} aria-label="Event published" />
            </label>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">
                <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden /> Save event
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        title="Delete this event?"
        desc={deleting?.title ?? ""}
        confirmLabel="Delete event"
      />
    </AdminChrome>
  );
}
