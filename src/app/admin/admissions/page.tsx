"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, ClipboardList, Settings2, X } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { callRpc } from "@/lib/admin-data";
import { ADMISSION_STATUSES, ADMISSION_STATUS_META, CLASS_LABELS } from "@/lib/constants";
import { DEMO_ADMISSIONS_QUEUE } from "@/content/portal";

/**
 * Admission — Babi Khel pattern: clickable stat cards, filter bar, the
 * 6-status machine (received → review → shortlisted → offered → admitted /
 * rejected) executed through the update_admission_status RPC (atomic,
 * audit-logged, writes admission_status_history), plus the admission window
 * settings panel from the College Setting row.
 */

interface AdmissionRow {
  id: string;
  application_no: string;
  admission_type: string;
  programme: string;
  full_name: string;
  father_name: string;
  cnic: string;
  phone: string;
  matric_roll: string;
  matric_obtained: number;
  matric_total: number;
  matric_year: string;
  previous_school: string;
  status: string;
  decision_note: string | null;
  created_at: string;
}

const STATUS_FLOW: Record<string, string[]> = {
  received: ["review", "rejected"],
  review: ["shortlisted", "rejected"],
  shortlisted: ["offered", "rejected"],
  offered: ["admitted", "rejected"],
  admitted: [],
  rejected: ["review"],
};

export default function AdminAdmissionsPage() {
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<AdmissionRow | null>(null);
  const [note, setNote] = useState("");
  const [settings, setSettings] = useState({ admission_open: true, admission_session: "2026-27", admission_deadline: "", admission_banner: "" });
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setRows(
        DEMO_ADMISSIONS_QUEUE.map((d, i) => ({
          id: `demo-${i}`,
          application_no: d.no,
          admission_type: "first_year",
          programme: d.programme.toLowerCase().replace("pre-", "pre-"),
          full_name: d.name,
          father_name: "SAMPLE Father",
          cnic: "XXXXX-XXXXXXX-X",
          phone: "+92-3XX-XXXXXXX",
          matric_roll: "SAMPLE-ROLL",
          matric_obtained: Math.round(Number(d.percent.replace("%", "")) * 5.5),
          matric_total: 550,
          matric_year: "2026",
          previous_school: "SAMPLE School",
          status: d.status,
          decision_note: d.flags || null,
          created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
        }))
      );
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from("admissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast({ title: "Could not load applications", description: error.message, variant: "destructive" });
    else setRows((data as AdmissionRow[]) ?? []);
    const { data: s } = await sb.from("school_settings").select("admission_open, admission_session, admission_deadline, admission_banner").eq("id", 1).maybeSingle();
    if (s) setSettings(s as typeof settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Total", value: rows.length, status: "all" },
      { label: "Received", value: rows.filter((r) => r.status === "received").length, status: "received" },
      { label: "In review", value: rows.filter((r) => ["review", "shortlisted"].includes(r.status)).length, status: "review" },
      { label: "Admitted", value: rows.filter((r) => r.status === "admitted").length, status: "admitted" },
      { label: "Rejected", value: rows.filter((r) => r.status === "rejected").length, status: "rejected" },
    ],
    [rows]
  );

  const visible = rows.filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      (programmeFilter === "all" || a.programme.includes(programmeFilter)) &&
      (search === "" ||
        a.full_name.toLowerCase().includes(search.toLowerCase()) ||
        a.application_no.toLowerCase().includes(search.toLowerCase()) ||
        a.phone.includes(search))
  );

  async function advance(row: AdmissionRow, next: string) {
    const sb = supabaseBrowser();
    if (sb) {
      const res = await callRpc<{ to: string }>("update_admission_status", {
        p_admission_id: row.id,
        p_new_status: next,
        p_note: note.trim() || null,
      });
      if (!res.ok) {
        toast({ title: "Status change failed", description: res.error, variant: "destructive" });
        return;
      }
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: next, decision_note: note.trim() || r.decision_note } : r)));
    if (detail?.id === row.id) setDetail({ ...detail, status: next });
    setNote("");
    toast({
      title: `Status → ${next}`,
      description: `${row.application_no} (${row.full_name}) — audit row + history entry written.`,
    });
  }

  async function saveSettings() {
    const sb = supabaseBrowser();
    if (!sb) {
      toast({ title: "Admission window updated (demo)" });
      return;
    }
    const { error } = await sb.from("school_settings").upsert({ id: 1, ...settings, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: "Could not save window", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Admission window saved", description: "Homepage CTA + header ribbon update within a minute." });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Admission"
        desc="The application review queue. Status moves run through an atomic RPC that writes the decision, its note and an immutable history row."
        actions={
          <Button variant="outline" onClick={() => setShowSettings(true)} className="button-press h-10 rounded-full">
            <Settings2 className="mr-1.5 h-4 w-4" aria-hidden /> Admission window
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <button
            key={s.status}
            type="button"
            onClick={() => setFilter(s.status)}
            aria-pressed={filter === s.status}
            className={`button-press rounded-xl border p-4 text-left transition-colors ${
              filter === s.status ? "border-primary/50 bg-secondary" : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary tabular-nums">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, application no or phone…"
            className="h-11 pl-10"
            aria-label="Search applications"
          />
        </div>
        <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
          <SelectTrigger className="h-11 w-52" aria-label="Filter by programme"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programmes</SelectItem>
            {["ics", "pre-medical", "pre-engineering", "arts"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading applications…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No applications match these filters.</p>
          ) : (
            <DataTable head={["Applicant", "Programme", "Matric", "Applied", "Status", ""]}>
              {visible.map((a) => {
                const meta = ADMISSION_STATUS_META[a.status] ?? { label: a.status, tone: "" };
                const pct = a.matric_total > 0 ? Math.round((a.matric_obtained / a.matric_total) * 100) : 0;
                return (
                  <tr key={a.id} className="transition-colors hover:bg-secondary/40">
                    <td className="py-3 pr-4">
                      <p className="text-small font-bold">{a.full_name}</p>
                      <p className="text-xs text-muted-foreground">{a.application_no} · {a.admission_type === "second_year" ? "2nd Year" : "1st Year"}</p>
                    </td>
                    <td className="py-3 pr-4 capitalize text-small">{a.programme.replace("-", " ")}</td>
                    <td className="py-3 pr-4 text-small tabular-nums">
                      {a.matric_obtained}/{a.matric_total} <span className="text-xs text-muted-foreground">({pct}%)</span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-PK")}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => { setDetail(a); setNote(a.decision_note ?? ""); }} className="button-press h-9 rounded-full">
                        View <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detail !== null} onClose={() => setDetail(null)} title={detail?.full_name ?? ""} desc={detail?.application_no} wide>
        {detail && (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Father's name", detail.father_name],
                ["CNIC", detail.cnic],
                ["Phone", detail.phone],
                ["Matric roll", detail.matric_roll],
                ["Matric marks", `${detail.matric_obtained} / ${detail.matric_total} (${detail.matric_year})`],
                ["Previous school", detail.previous_school],
                ["Programme", detail.programme.replace("-", " ")],
                ["Applied", new Date(detail.created_at).toLocaleString("en-PK")],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5">
                  <dt className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 text-small font-semibold capitalize">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Decision note (visible to the applicant)</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Documents verified; interview Thursday 10 AM." />
            </div>

            <div>
              <p className="mb-2 text-small font-bold">Move status</p>
              <div className="flex flex-wrap gap-2">
                {(STATUS_FLOW[detail.status] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">This application is closed — {ADMISSION_STATUS_META[detail.status]?.label}.</p>
                )}
                {(STATUS_FLOW[detail.status] ?? []).map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => advance(detail, next)}
                    className={`button-press h-10 rounded-full px-5 text-small font-bold ${
                      next === "rejected"
                        ? "border border-destructive/50 text-destructive hover:bg-destructive/10"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    {ADMISSION_STATUS_META[next]?.label ?? next}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Admission window dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} title="Admission window" desc="Drives the homepage CTA, header ribbon and apply gate.">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <span className="text-small font-semibold">Admissions open</span>
            <Switch checked={settings.admission_open} onCheckedChange={(v) => setSettings((s) => ({ ...s, admission_open: v }))} aria-label="Admissions open" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Session year</Label>
              <Input className="h-11" value={settings.admission_session} onChange={(e) => setSettings((s) => ({ ...s, admission_session: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Last date</Label>
              <Input type="date" className="h-11" value={settings.admission_deadline ?? ""} onChange={(e) => setSettings((s) => ({ ...s, admission_deadline: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-small font-semibold">Banner message</Label>
            <Textarea rows={2} value={settings.admission_banner ?? ""} onChange={(e) => setSettings((s) => ({ ...s, admission_banner: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSettings} className="button-press h-10 rounded-full font-bold">Save window</Button>
          </div>
        </div>
      </Dialog>
    </AdminChrome>
  );
}
