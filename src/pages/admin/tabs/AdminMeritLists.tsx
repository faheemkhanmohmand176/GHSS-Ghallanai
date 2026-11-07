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
import { QUOTA_LABEL } from "@/lib/interAdmission";
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
  Trophy, Loader2, Plus, Eye, Trash2, Globe, GlobeLock,
} from "lucide-react";
import toast from "react-hot-toast";
import { MeritTitleBlock, MeritDates, MeritInstructions } from "@/components/shared/MeritListSheet";

interface AdminMeritList {
  id: string; program: string; quota: string; list_no: number; title: string;
  is_published: boolean; published_at: string | null; created_at: string;
  admission_start_date: string | null; admission_last_date: string | null;
  no_of_applicants: number;
}

const QUOTA_OPTIONS = Object.entries(QUOTA_LABEL);
const quotaKey = (q: string) => q.toLowerCase().replace(/ /g, "_");

interface MeritEntry {
  id?: string;
  position: number; tracking_id: string; name: string; father_name: string;
  total_marks: number; obtained_marks: number; net_marks: number;
  percentage: number; remarks: string | null;
}

export default function AdminMeritLists() {
  const qc = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  // ── generate form state ──────────────────────────────────────────────
  const [gProgram, setGProgram] = useState<number | "">("");
  const [gQuota, setGQuota] = useState("open_merit");
  const [gListNo, setGListNo] = useState(1);
  const [gStart, setGStart] = useState("");
  const [gLast, setGLast] = useState("");
  const [gInstructions, setGInstructions] = useState("");

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
    qc.invalidateQueries({ queryKey: ["inter-admin-merit-lists"] });
    qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
    qc.invalidateQueries({ queryKey: ["inter-merit-public"] });
  };

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_merit_generate", {
        p_program_id: gProgram,
        p_quota: gQuota,
        p_list_no: gListNo,
        p_admission_start_date: gStart || null,
        p_admission_last_date: gLast || null,
        p_instructions: gInstructions.trim() || null,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; entries?: number };
      if (d?.ok === false) throw new Error(d?.error || "Generation failed.");
      return d;
    },
    onSuccess: (d) => {
      toast.success(`Merit list generated, ${d?.entries ?? 0} entr${d?.entries === 1 ? "y" : "ies"}. Review it below, then publish.`);
      setGenOpen(false);
      setGStart(""); setGLast(""); setGInstructions("");
      invalidate();
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

  // Next list number for a program + quota (1st, 2nd, 3rd provisional …).
  function nextListNo(programId: number | "", quota: string) {
    const name = (programsQ.data ?? []).find((p) => p.id === programId)?.name;
    if (!name) return 1;
    const nos = lists.filter((l) => l.program === name && quotaKey(l.quota) === quota).map((l) => l.list_no);
    return nos.length ? Math.max(...nos) + 1 : 1;
  }

  const publishingId = publish.isPending ? publish.variables?.id : null;
  function togglePublish(m: AdminMeritList) {
    if (!m.is_published && !window.confirm(
      `Publish ${m.program} (${QUOTA_LABEL[quotaKey(m.quota)] ?? m.quota}) list #${m.list_no}?\n\nIt becomes public, and its ${m.no_of_applicants} fee-paid applicant(s) are marked "Merit Listed".`,
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
            if (window.confirm(`Delete the draft merit list for ${m.program} (${m.quota})?`)) remove.mutate(m.id);
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
      <div className="flex items-center justify-center">
        <Button size="sm" className="h-9 rounded-full text-[12.5px] font-semibold" onClick={() => setGenOpen(true)}>
          <Plus className="w-4 h-4" /> Generate Merit List
        </Button>
      </div>

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
                Click <span className="font-semibold">Generate Merit List</span>, the list is built from
                fee-paid applications of the chosen program and quota, ordered by net marks
                (SSC obtained + 20 if Hafiz e Quran).
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
                    {QUOTA_LABEL[quotaKey(m.quota)] ?? m.quota} · List #{m.list_no} · {m.no_of_applicants} applicant{m.no_of_applicants === 1 ? "" : "s"}
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
                    <th className="text-center align-middle px-4 py-3 font-semibold">Quota</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">List #</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Applicants</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Dates</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Status</th>
                    <th className="text-center align-middle px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((m) => (
                    <tr key={m.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="text-center align-middle px-4 py-3 font-semibold text-foreground">{m.program}</td>
                      <td className="text-center align-middle px-4 py-3">{QUOTA_LABEL[m.quota.toLowerCase().replace(/ /g, "_")] ?? m.quota}</td>
                      <td className="text-center align-middle px-4 py-3">{m.list_no}</td>
                      <td className="text-center align-middle px-4 py-3 font-semibold">{m.no_of_applicants}</td>
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

      {/* ── Generate dialog ──────────────────────────────────────────── */}
      <Dialog open={genOpen} onOpenChange={(o) => !o && setGenOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Merit List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Program <span className="text-red-500">*</span></Label>
                <select className={sel} value={gProgram} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ""; setGProgram(v); setGListNo(nextListNo(v, gQuota)); }}>
                  <option value="">Select Program</option>
                  {(programsQ.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Quota <span className="text-red-500">*</span></Label>
                <select className={sel} value={gQuota} onChange={(e) => { setGQuota(e.target.value); setGListNo(nextListNo(gProgram, e.target.value)); }}>
                  {QUOTA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">List Number <span className="text-red-500">*</span></Label>
              <Input type="number" min={1} value={gListNo} onChange={(e) => setGListNo(Math.max(1, Number(e.target.value) || 1))} className="h-10" />
              <p className="text-[11px] text-muted-foreground">1 = “1st Provisional”, 2 = “2nd”, 3 = “3rd” ….</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Admission Start Date</Label>
                <Input type="date" value={gStart} onChange={(e) => setGStart(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Admission Last Date</Label>
                <Input type="date" value={gLast} onChange={(e) => setGLast(e.target.value)} className="h-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">Instructions (shown with the published list)</Label>
              <Textarea rows={3} value={gInstructions} onChange={(e) => setGInstructions(e.target.value)}
                placeholder="Printed copy of online admission form;&#10;Original documents for verification;&#10;Fee submission at the college office…" />
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">
              Only applications with <span className="font-semibold text-foreground">Paid</span> processing fee are
              included. Entries are ordered by net marks (SSC obtained + 20 if Hafiz e Quran).
              The list is created as a <span className="font-semibold text-foreground">Draft</span>, publish it
              when ready to show it publicly.
            </div>
            <Button className="w-full h-11 font-semibold" disabled={generate.isPending || !gProgram}
              onClick={() => generate.mutate()}>
              {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Generate Merit List
            </Button>
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
