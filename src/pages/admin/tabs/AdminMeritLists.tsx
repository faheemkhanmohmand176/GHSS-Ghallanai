/**
 * AdminMeritLists — Merit List management for-mirror Inter admission
 * system (migration 20_inter_admission_hed_mirror.sql).
 *
 * • Generate a merit list for one program + quota from the FEE-PAID
 *   applications (inter_admin_merit_generate) — net marks = SSC obtained
 *   + 20 if Hafiz e Quran, sorted descending.
 * • Publish / unpublish (inter_admin_merit_publish) — published lists show
 *   on the public Admission page, and the listed applicants are moved to
 *   "Merit Listed" automatically (unpublishing reverts them).
 * • Delete drafts (inter_admin_merit_delete — published lists must be
 *   unpublished first).
 * • Preview published lists (inter_merit_list_view — the same table the
 *   public sees).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { markMeritBust } from "@/lib/publicData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Trophy, Loader2, Eye, Trash2, Globe, GlobeLock, Zap, ScanSearch,
} from "lucide-react";
import toast from "react-hot-toast";
import { MeritTitleBlock, MeritDates, MeritInstructions } from "@/components/shared/MeritListSheet";

interface AdminMeritList {
  id: string; program: string; quota: string; list_no: number; title: string;
  is_published: boolean; published_at: string | null; created_at: string;
  admission_start_date: string | null; admission_last_date: string | null;
  no_of_applicants: number; listed_count?: number; not_listed_count?: number;
}

interface AutoProgramRow {
  program_id: number; program: string; seats: number; taken: number; seats_left: number;
  eligible: number; selected: number; waiting: number; unpaid: number; cutoff: number | null;
}
interface AutoResult { ok: boolean; dry_run: boolean; published: boolean; lists: number; selected: number; not_listed: number; programs: AutoProgramRow[]; }


interface MeritEntry {
  id?: string;
  position: number; tracking_id: string; name: string; father_name: string;
  total_marks: number; obtained_marks: number; net_marks: number;
  percentage: number; remarks: string | null; is_listed?: boolean;
}

export default function AdminMeritLists() {
  const qc = useQueryClient();
  const [viewId, setViewId] = useState<string | null>(null);

  // ── one-click auto merit (all programs, by sanctioned seats) ─────────
  const [autoOpen, setAutoOpen] = useState(false);
  const [aListNo, setAListNo] = useState(1);
  const [aStart, setAStart] = useState("");
  const [aLast, setALast] = useState("");
  const [aInstructions, setAInstructions] = useState("");
  const [aPublish, setAPublish] = useState(false);
  const [aPreview, setAPreview] = useState<AutoResult | null>(null);

  const programsQ = useQuery({
    queryKey: ["inter-admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_programs_list");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Array<{ id: number; name: string; seats: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const listsQ = useQuery({
    queryKey: ["inter-admin-merit-lists"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_merit_lists");
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; lists?: AdminMeritList[] };
      if (d?.ok === false) throw new Error(d?.error || "Admin access required.");
      return d?.lists ?? [];
    },
  });

  const viewQ = useQuery({
    queryKey: ["inter-admin-merit-view", viewId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_merit_view", {
        p_merit_list_id: viewId,
      });
      if (error) throw error;
      return data as {
        ok: boolean;
        list?: { title: string; instructions: string | null };
        entries?: MeritEntry[];
      };
    },
    enabled: Boolean(viewId),
    staleTime: 60 * 1000,
  });

  // ── inline remark editor (inter_admin_merit_entry_remark) ────────────
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});

  const saveRemark = useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks: string }) => {
      const { data, error } = await supabase.rpc("inter_admin_merit_entry_remark", {
        p_entry_id: id, p_remarks: remarks,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: () => {
      toast.success("Remark updated.");
      qc.invalidateQueries({ queryKey: ["inter-admin-merit-view", viewId] });
      qc.invalidateQueries({ queryKey: ["inter-merit-view"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () => {
    markMeritBust(); // public page must not read a pre-publish CDN copy
    qc.invalidateQueries({ queryKey: ["inter-admin-merit-lists"] });
    qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
    qc.invalidateQueries({ queryKey: ["inter-merit-public"] });
  };

  const runAuto = useMutation({
    mutationFn: async (dry: boolean) => {
      const { data, error } = await supabase.rpc("inter_admin_merit_auto", {
        p_list_no: aListNo,
        p_admission_start_date: aStart || null,
        p_admission_last_date: aLast || null,
        p_instructions: aInstructions.trim() || null,
        p_publish: aPublish,
        p_dry_run: dry,
        p_program_id: null,
      });
      if (error) throw error;
      const d = data as AutoResult & { error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Auto merit failed.");
      return { d, dry };
    },
    onSuccess: ({ d, dry }) => {
      setAPreview(d);
      if (!dry) {
        toast.success(`Done: ${d.selected} Merit Listed, ${d.not_listed} Not Merit Listed${d.published ? ", published" : ""}.`);
        invalidate();
        qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
        setAutoOpen(false);   // done → the page closes by itself
        setAPreview(null);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      const { data, error } = await supabase.rpc("inter_admin_merit_publish", {
        p_merit_list_id: id, p_published: published,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: (_d, v) => {
      toast.success(v.published ? "Merit list published, it is now visible on the public Admission page." : "Merit list unpublished.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("inter_admin_merit_delete", {
        p_merit_list_id: id,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Delete failed.");
      return d;
    },
    onSuccess: () => { toast.success("Draft merit list deleted."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const lists: AdminMeritList[] = listsQ.data ?? [];

  const publishingId = publish.isPending ? publish.variables?.id : null;
  function togglePublish(m: AdminMeritList) {
    if (!m.is_published && !window.confirm(
      `Publish ${m.program} list #${m.list_no}?\n\nIt becomes public, and its ${m.no_of_applicants} fee-paid applicant(s) are marked "Merit Listed".`,
    )) return;
    publish.mutate({ id: m.id, published: !m.is_published });
  }
  const ListActions = ({ m }: { m: AdminMeritList }) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px]" onClick={() => setViewId(m.id)}>
        <Eye className="w-3 h-3" /> View
      </Button>
      <Button size="sm" variant={m.is_published ? "outline" : "default"} className="h-7 px-2.5 text-[11.5px]"
        disabled={publish.isPending} onClick={() => togglePublish(m)}>
        {publishingId === m.id
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : m.is_published ? <GlobeLock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
        {m.is_published ? "Unpublish" : "Publish"}
      </Button>
      {!m.is_published && (
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px] text-red-600 border-red-200 hover:bg-red-500/5"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Delete the draft merit list for ${m.program}?`)) remove.mutate(m.id);
          }}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      )}
    </div>
  );
  const StatusPill = ({ m }: { m: AdminMeritList }) => (
    <Badge variant="secondary" className={
      m.is_published ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    }>
      {m.is_published ? `Published ${m.published_at ?? ""}` : "Draft"}
    </Badge>
  );
  const sel = "h-10 rounded-xl border border-input bg-background px-3 text-sm w-full";

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card className="overflow-hidden border-gold/40 bg-gradient-to-br from-primary/[0.06] via-card to-gold/[0.08] shadow-card">
        <CardContent className="flex flex-col items-center gap-3 p-4 text-center sm:p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <Zap className="h-5 w-5 text-gold" strokeWidth={1.6} />
          </span>
          <div>
            <h3 className="font-heading text-[17px] font-bold text-foreground sm:text-lg">One-Click Merit List</h3>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
              Ranks every fee-paid applicant (online + walk-in) of all programs by marks and
              selects the top ones up to the seats fixed in Programs &amp; Seats.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button className="h-10 rounded-full px-5 text-[13px] font-bold" onClick={() => {
              const published = lists.filter((l) => l.is_published).map((l) => l.list_no);
              setAListNo(published.length ? Math.max(...published) + 1 : 1);
              setAPreview(null); setAutoOpen(true);
            }}>
              <Zap className="w-4 h-4" /> Auto Merit List (All Programs)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      <Card className="border-border/80">
        <CardContent className="p-0">
          {listsQ.isLoading ? (
            <div className="p-5 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : lists.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No merit list generated yet.</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Click <span className="font-semibold">Auto Merit List (All Programs)</span>. Every fee-paid
                applicant (online + walk-in) is ranked by net marks (SSC obtained + 20 if Hafiz e Quran)
                and the seats of each program decide who is Merit Listed.
              </p>
            </div>
          ) : (
            <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/60">
              {lists.map((m) => (
                <div key={m.id} className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                  <p className="text-[14px] font-semibold text-foreground">{m.program}</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    List #{m.list_no} · {m.listed_count ?? m.no_of_applicants} listed · {m.not_listed_count ?? 0} not listed
                  </p>
                  <StatusPill m={m} />
                  <div className="mt-1"><ListActions m={m} /></div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px] min-w-[860px]">
                <thead className="bg-muted/60 border-b border-border">
                  <tr>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Program</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">List #</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Listed / Not</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Dates</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Status</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((m) => (
                    <tr key={m.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="text-center align-middle px-4 py-3 font-semibold text-foreground">{m.program}</td>
                      <td className="text-center align-middle px-4 py-3">{m.list_no}</td>
                      <td className="text-center align-middle px-4 py-3 font-semibold">{m.listed_count ?? m.no_of_applicants} / {m.not_listed_count ?? 0}</td>
                      <td className="text-center align-middle px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {m.admission_start_date ?? "N/A"} → {m.admission_last_date ?? "N/A"}
                      </td>
                      <td className="text-center align-middle px-4 py-3"><StatusPill m={m} /></td>
                      <td className="text-center align-middle px-4 py-3"><ListActions m={m} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── One-click auto merit dialog ──────────────────────────────── */}
      <Dialog open={autoOpen} onOpenChange={(o) => !o && setAutoOpen(false)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-center"><Zap className="h-5 w-5 text-gold" /> One-Click Merit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">List No.</Label>
                <Input type="number" min={1} value={aListNo} onChange={(e) => { setAListNo(Math.max(1, Number(e.target.value) || 1)); setAPreview(null); }} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">Start Date</Label>
                <Input type="date" value={aStart} onChange={(e) => setAStart(e.target.value)} className="h-10 px-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold">Last Date</Label>
                <Input type="date" value={aLast} onChange={(e) => setALast(e.target.value)} className="h-10 px-2" />
              </div>
            </div>
            <Textarea rows={2} value={aInstructions} onChange={(e) => setAInstructions(e.target.value)}
              placeholder="Instructions shown with the lists (optional, a standard set is used if empty)" className="text-[13px]" />

            <label className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-[12.5px]">
              <input type="checkbox" checked={aPublish} onChange={(e) => setAPublish(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span><span className="font-semibold text-foreground">Publish immediately.</span> <span className="text-muted-foreground">Lists go public right away, with Merit Listed and Not Merit Listed students. Leave off to check them as drafts first.</span></span>
            </label>

            {/* Result / preview */}
            {aPreview && (
              <div className="space-y-2">
                <p className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-gold-strong dark:text-gold">
                  {aPreview.dry_run ? "Preview (nothing saved yet)" : "Done"}
                </p>
                {aPreview.programs.map((r) => (
                  <div key={r.program_id} className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-bold text-foreground">{r.program}</p>
                      <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
                        {r.selected} / {r.seats_left} seats
                      </Badge>
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
                      {[
                        ["Seats", r.seats],
                        ["Eligible", r.eligible],
                        ["Not Listed", r.waiting],
                        ["Cut-off", r.cutoff ?? "—"],
                      ].map(([l, v]) => (
                        <div key={String(l)} className="rounded-lg bg-muted/50 px-1 py-1">
                          <p className="text-[13px] font-bold leading-none text-foreground">{v}</p>
                          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</p>
                        </div>
                      ))}
                    </div>
                    {r.seats === 0 && <p className="mt-1.5 text-[11.5px] text-amber-700 dark:text-amber-400">No seats set for this program. Set them in Programs &amp; Seats.</p>}
                    {r.unpaid > 0 && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{r.unpaid} application{r.unpaid === 1 ? "" : "s"} with unpaid fee are not included.</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" className="h-11 font-semibold" disabled={runAuto.isPending} onClick={() => runAuto.mutate(true)}>
                {runAuto.isPending && runAuto.variables === true ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />} Preview
              </Button>
              <Button className="h-11 font-bold" disabled={runAuto.isPending}
                onClick={() => {
                  if (window.confirm(`Create merit list #${aListNo} for ALL programs now?\n\nApplicants inside the seats become "Merit Listed", the others "Not Merit Listed"${aPublish ? ", and the lists are published publicly" : ""}. Old lists of this number are replaced.`)) runAuto.mutate(false);
                }}>
                {runAuto.isPending && runAuto.variables === false ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Generate All
              </Button>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Ranking: SSC obtained marks + 20 for Hafiz-e-Quran, ties go to the earlier application.
              Every fee-paid applicant appears in the list: inside the seats = Merit Listed, the rest = Not Merit Listed.
              Running the same list number again replaces the old lists, so nothing is duplicated.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── View published list ──────────────────────────────────────── */}
      <Dialog open={Boolean(viewId)} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="sr-only">{viewQ.data?.list?.title ?? "Merit List"}</DialogTitle>
          </DialogHeader>
          {viewQ.isLoading ? (
            <div className="space-y-2.5 py-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
          ) : viewQ.data?.ok ? (
            <div className="space-y-3">
            <MeritTitleBlock title={viewQ.data.list?.title ?? "Merit List"} />
            <MeritDates
              start={lists.find((l) => l.id === viewId)?.admission_start_date}
              last={lists.find((l) => l.id === viewId)?.admission_last_date}
            />
            <p className="text-center text-[11px] text-muted-foreground">
              Remarks are editable (e.g. “2 Session(s) Missed”), they appear on the public merit list.
            </p>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {(viewQ.data.entries ?? []).map((e) => {
                const key = e.id ?? e.tracking_id;
                const draft = remarkDraft[key];
                const dirty = draft !== undefined && draft !== (e.remarks ?? "");
                return (
                  <div key={key} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
                    <p className="text-[13px] font-semibold text-foreground">#{e.position} · {e.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">S/O {e.father_name}</p>
                    <p className="mt-0.5 font-mono text-[11.5px] font-semibold text-primary">{e.tracking_id}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {e.obtained_marks}/{e.total_marks} · Net <strong className="text-foreground">{e.net_marks}</strong> · <strong className="text-primary">{e.percentage}%</strong>
                    </p>
                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      <input
                        value={draft ?? e.remarks ?? ""}
                        onChange={(ev) => setRemarkDraft((r) => ({ ...r, [key]: ev.target.value }))}
                        placeholder="Remarks"
                        className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-center text-[12px]"
                        aria-label={`Remarks for ${e.name}`}
                      />
                      {dirty && e.id && (
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-[11px] font-semibold"
                          disabled={saveRemark.isPending}
                          onClick={() => saveRemark.mutate({ id: e.id!, remarks: draft })}>Save</Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {(viewQ.data.entries ?? []).length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No entries — no fee-paid applicant matched this program and quota.</p>
              )}
            </div>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">#</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Tracking ID</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Name</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Father</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Total</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Obtained</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Net</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">%</th>
                    <th className="text-center align-middle px-2.5 py-2.5 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewQ.data.entries ?? []).map((e) => {
                    const key = e.id ?? e.tracking_id;
                    const draft = remarkDraft[key];
                    const dirty = draft !== undefined && draft !== (e.remarks ?? "");
                    return (
                    <tr key={e.tracking_id} className="border-t border-border">
                      <td className="text-center align-middle px-2.5 py-2.5">{e.position}</td>
                      <td className="text-center align-middle px-2.5 py-2.5 font-mono font-semibold">{e.tracking_id}</td>
                      <td className="text-center align-middle px-2.5 py-2.5 font-semibold text-foreground">{e.name}</td>
                      <td className="text-center align-middle px-2.5 py-2.5">{e.father_name}</td>
                      <td className="text-center align-middle px-2.5 py-2.5">{e.total_marks}</td>
                      <td className="text-center align-middle px-2.5 py-2.5">{e.obtained_marks}</td>
                      <td className="text-center align-middle px-2.5 py-2.5 font-semibold">{e.net_marks}</td>
                      <td className="text-center align-middle px-2.5 py-2.5 font-semibold text-primary">{e.percentage}%</td>
                      <td className="text-center align-middle px-2.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={draft ?? e.remarks ?? ""}
                            onChange={(ev) => setRemarkDraft((r) => ({ ...r, [key]: ev.target.value }))}
                            placeholder="N/A"
                            className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-[12px]"
                            aria-label={`Remarks for ${e.name}`}
                          />
                          {dirty && e.id && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] font-semibold"
                              disabled={saveRemark.isPending}
                              onClick={() => saveRemark.mutate({ id: e.id!, remarks: draft })}>
                              {saveRemark.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MeritInstructions text={viewQ.data.list?.instructions} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Merit list not available.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
