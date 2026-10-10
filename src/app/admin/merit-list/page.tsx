"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trophy, Printer, Trash2, Sparkles, Search } from "lucide-react";
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
import { supabaseBrowser } from "@/lib/auth";
import { downloadCsv } from "@/lib/constants";
import { MERIT_LIST } from "@/content/results";

/**
 * Merit List — GHSS's row-per-entry model (session × programme × merit_no ×
 * version) with publish toggling per version, "generate from applications"
 * (admitted/shortlisted ordered by matric %), print export and CSV.
 */

interface MeritRow {
  id: string;
  session_year: string;
  programme: string;
  merit_no: number;
  application_no: string;
  name: string;
  matric_percent: string;
  test_score: string | null;
  status: string;
  version: string;
  published: boolean;
}

const PROGRAMMES = ["ics", "pre-medical", "pre-engineering", "arts"] as const;

export default function AdminMeritListPage() {
  const [rows, setRows] = useState<MeritRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState("2026-27");
  const [programme, setProgramme] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<MeritRow> | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setRows(
        MERIT_LIST.map((m, i) => ({
          id: `demo-${i}`,
          session_year: "2026-27",
          programme: m.programme,
          merit_no: m.meritNo,
          application_no: m.applicationNo,
          name: m.name,
          matric_percent: m.matricPercent,
          test_score: m.testScore ?? null,
          status: m.status,
          version: "v1.0",
          published: true,
        }))
      );
      setLoading(false);
      return;
    }
    let q = sb.from("merit_lists").select("*").order("merit_no");
    if (session) q = q.eq("session_year", session);
    if (programme !== "all") q = q.eq("programme", programme);
    const { data, error } = await q;
    if (error) toast({ title: "Could not load merit list", description: error.message, variant: "destructive" });
    else setRows((data as MeritRow[]) ?? []);
    setLoading(false);
  }, [session, programme]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const nextNo = useMemo(() => (rows.length > 0 ? Math.max(...rows.map((r) => r.merit_no)) + 1 : 1), [rows]);
  const allPublished = rows.length > 0 && rows.every((r) => r.published);

  async function save(row: Partial<MeritRow>) {
    if (!row.name?.trim() || !row.merit_no) {
      toast({ title: "Name and merit number are required.", variant: "destructive" });
      return;
    }
    const payload = {
      session_year: row.session_year ?? session,
      programme: row.programme ?? (programme === "all" ? "ics" : programme),
      merit_no: Number(row.merit_no),
      application_no: row.application_no ?? `GHSS-${new Date().getFullYear()}-${String(nextNo).padStart(4, "0")}`,
      name: row.name.trim(),
      matric_percent: row.matric_percent ?? "",
      test_score: row.test_score ?? null,
      status: row.status ?? "Admitted",
      version: row.version ?? "v1.0",
      published: row.published ?? false,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("merit_lists").upsert({ ...payload, id: row.id ?? undefined });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [...rs.filter((r) => r.id !== row.id), { id: row.id ?? `demo-${Date.now()}`, ...payload } as MeritRow].sort((a, b) => a.merit_no - b.merit_no));
    }
    setEditing(null);
    toast({ title: "Merit entry saved", description: `#${payload.merit_no} — ${payload.name}` });
  }

  async function togglePublish(publish: boolean) {
    const sb = supabaseBrowser();
    if (sb) {
      let q = sb.from("merit_lists").update({ published: publish, published_at: new Date().toISOString() });
      if (session) q = q.eq("session_year", session);
      if (programme !== "all") q = q.eq("programme", programme);
      const { error } = await q;
      if (error) {
        toast({ title: "Publish failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setRows((rs) => rs.map((r) => ({ ...r, published: publish })));
    toast({
      title: publish ? "Merit list published" : "Merit list hidden",
      description: publish ? "/results/merit-list is live — the bell rang for every family waiting." : "Rows kept, hidden from the public page.",
    });
  }

  async function generateFromAdmissions() {
    const sb = supabaseBrowser();
    if (!sb) {
      toast({ title: "Generation needs live mode", description: "Connect Supabase to generate from applications.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    let q = sb.from("admissions").select("application_no, full_name, matric_obtained, matric_total, programme").in("status", ["admitted", "offered", "shortlisted"]);
    if (programme !== "all") q = q.eq("programme", programme);
    const { data, error } = await q;
    if (error || !data || data.length === 0) {
      toast({ title: "Nothing to generate", description: error?.message ?? "No admitted/shortlisted applications for this filter.", variant: "destructive" });
      setGenerating(false);
      return;
    }
    const entries = (data as { application_no: string; full_name: string; matric_obtained: number; matric_total: number; programme: string }[])
      .sort((a, b) => b.matric_obtained / Math.max(1, b.matric_total) - a.matric_obtained / Math.max(1, a.matric_total))
      .map((a, i) => ({
        session_year: session,
        programme: a.programme,
        merit_no: i + 1,
        application_no: a.application_no,
        name: a.full_name,
        matric_percent: `${((a.matric_obtained / Math.max(1, a.matric_total)) * 100).toFixed(1)}%`,
        status: "Admitted",
        version: "v1.0",
        published: false,
      }));
    const { error: upErr } = await sb.from("merit_lists").upsert(entries);
    setGenerating(false);
    if (upErr) {
      toast({ title: "Generation failed", description: upErr.message, variant: "destructive" });
      return;
    }
    await load();
    toast({ title: "Merit list generated", description: `${entries.length} entries from applications — review, then publish.` });
  }

  async function clear() {
    const sb = supabaseBrowser();
    if (sb) {
      let q = sb.from("merit_lists").delete();
      if (session) q = q.eq("session_year", session);
      if (programme !== "all") q = q.eq("programme", programme);
      await q;
    }
    setRows([]);
    toast({ title: "Merit list cleared", description: "Entries for this filter deleted (audit-logged)." });
  }

  function exportCsv() {
    downloadCsv(`ghss-merit-${session}-${programme}.csv`, [
      ["Merit No", "Name", "Application No", "Matric %", "Test", "Status", "Version"],
      ...rows.map((r) => [r.merit_no, r.name, r.application_no, r.matric_percent, r.test_score ?? "", r.status, r.version]),
    ]);
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Merit List"
        desc="Session-wise position holders per programme. Generate from applications, hand-tune, then publish — snapshots are versioned."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={generateFromAdmissions} disabled={generating} className="button-press h-10 rounded-full">
              <Sparkles className={`mr-1.5 h-4 w-4 ${generating ? "animate-pulse" : ""}`} aria-hidden /> Generate from applications
            </Button>
            <Button onClick={() => setEditing({ session_year: session, programme: programme === "all" ? "ics" : programme, merit_no: nextNo })} className="button-press h-10 rounded-full font-bold">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add entry
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={session} onChange={(e) => setSession(e.target.value)} className="h-11 w-32" aria-label="Session year" placeholder="2026-27" />
        <Select value={programme} onValueChange={setProgramme}>
          <SelectTrigger className="h-11 w-44" aria-label="Programme"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programmes</SelectItem>
            {PROGRAMMES.map((p) => (
              <SelectItem key={p} value={p}>{p.replace("-", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={allPublished ? "outline" : "default"} onClick={() => togglePublish(!allPublished)} className="button-press h-11 rounded-full font-bold">
          <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> {allPublished ? "Unpublish" : "Publish list"}
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="button-press h-11 rounded-full">
          <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
        </Button>
        <Button variant="outline" onClick={exportCsv} className="button-press h-11 rounded-full">Export CSV</Button>
        <Button variant="outline" onClick={() => setConfirmClear(true)} className="button-press h-11 rounded-full text-destructive hover:bg-destructive/10">
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Clear
        </Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading merit list…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">
              No entries — generate from applications or add by hand.
            </p>
          ) : (
            <DataTable head={["#", "Name", "Application", "Matric %", "Status", ""]}>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="py-3 pr-4 font-display text-base font-bold text-gold-strong dark:text-gold tabular-nums">{r.merit_no}</td>
                  <td className="py-3 pr-4 text-small font-semibold">{r.name}</td>
                  <td className="py-3 pr-4 text-xs font-mono text-muted-foreground">{r.application_no}</td>
                  <td className="py-3 pr-4 text-small tabular-nums">{r.matric_percent}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className={r.published ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" : ""}>
                      {r.published ? "Published" : "Hidden"}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)} className="button-press h-9 rounded-full">Edit</Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit entry" : "Add merit entry"}>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Merit number</Label>
                <Input type="number" className="h-11" value={editing.merit_no ?? nextNo} onChange={(e) => setEditing({ ...editing, merit_no: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Name *</Label>
                <Input className="h-11" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Application no</Label>
                <Input className="h-11" value={editing.application_no ?? ""} onChange={(e) => setEditing({ ...editing, application_no: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Matric %</Label>
                <Input className="h-11" value={editing.matric_percent ?? ""} onChange={(e) => setEditing({ ...editing, matric_percent: e.target.value })} placeholder="89.1%" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Programme</Label>
                <Select value={editing.programme ?? "ics"} onValueChange={(v) => setEditing({ ...editing, programme: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROGRAMMES.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Status</Label>
                <Select value={editing.status ?? "Admitted"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Admitted", "Waitlisted", "Rejected"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">Save entry</Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
        title="Clear this merit list?"
        desc="All entries for the selected session and programme will be deleted."
        confirmLabel="Delete entries"
      />
    </AdminChrome>
  );
}
