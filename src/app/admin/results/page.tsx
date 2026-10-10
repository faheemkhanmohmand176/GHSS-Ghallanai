"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Trophy, Search, CalendarClock, FileSpreadsheet, Trash2, Plus } from "lucide-react";
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
import { BOARD_RESULTS } from "@/content/results";

/**
 * Manage Results — board_results CRUD with the Babi Khel publish model:
 * { published, publish_at } + scheduled countdown + CSV import/export.
 * Publishing a class flips `published` for the filtered set and rings the
 * notification bell through the on_results_notify trigger.
 */

interface ResultRow {
  id: string;
  roll_no: string;
  year: number;
  programme: string;
  student_name: string;
  father_name: string | null;
  subjects_json: { subject: string; total: number; obtained: number; grade: string }[];
  total: number;
  obtained: number;
  percentage: number;
  grade: string;
  position: string | null;
  published: boolean;
  publish_at: string | null;
}

const PROGRAMMES = ["ics", "pre-medical", "pre-engineering", "arts"] as const;

export default function AdminResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [programme, setProgramme] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<ResultRow> | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setRows(
        BOARD_RESULTS.map((r) => ({
          id: `demo-${r.rollNo}`,
          roll_no: r.rollNo,
          year: r.year,
          programme: r.programme,
          student_name: r.studentName,
          father_name: r.fatherName ?? null,
          subjects_json: r.subjects as ResultRow["subjects_json"],
          total: r.total,
          obtained: r.obtained,
          percentage: Number(r.percentage),
          grade: r.grade,
          position: r.position ?? null,
          published: true,
          publish_at: null,
        }))
      );
      setLoading(false);
      return;
    }
    let q = sb.from("board_results").select("*").order("roll_no").limit(500);
    if (year) q = q.eq("year", Number(year));
    if (programme !== "all") q = q.eq("programme", programme);
    const { data, error } = await q;
    if (error) toast({ title: "Could not load results", description: error.message, variant: "destructive" });
    else setRows((data as ResultRow[]) ?? []);
    setLoading(false);
  }, [year, programme]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = rows.filter((r) => !search || r.roll_no.toLowerCase().includes(search.toLowerCase()) || r.student_name.toLowerCase().includes(search.toLowerCase()));

  const stats = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.percentage >= 40).length;
    const avg = total > 0 ? rows.reduce((a, r) => a + r.percentage, 0) / total : 0;
    const unpublished = rows.filter((r) => !r.published).length;
    return { total, passed, avg, unpublished };
  }, [rows]);

  async function saveRow(row: Partial<ResultRow>) {
    if (!row.roll_no?.trim() || !row.student_name?.trim()) {
      toast({ title: "Roll number and student name are required.", variant: "destructive" });
      return;
    }
    const payload = {
      roll_no: row.roll_no.trim(),
      year: Number(row.year ?? year),
      programme: row.programme ?? "ics",
      student_name: row.student_name.trim(),
      father_name: row.father_name ?? null,
      subjects_json: row.subjects_json ?? [],
      total: Number(row.total ?? 0),
      obtained: Number(row.obtained ?? 0),
      percentage: Number(row.percentage ?? 0),
      grade: row.grade ?? "A",
      position: row.position ?? null,
      published: row.published ?? false,
      publish_at: row.publish_at ?? null,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("board_results").upsert(payload);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      setRows((rs) => [{ id: `demo-${Date.now()}`, ...payload } as ResultRow, ...rs.filter((r) => r.roll_no !== payload.roll_no)]);
    }
    await load();
    setEditing(null);
    toast({ title: "Result saved", description: `${payload.roll_no} — ${payload.student_name}` });
  }

  async function publishAll(publish: boolean, at?: string) {
    const sb = supabaseBrowser();
    if (sb) {
      const patch = publish
        ? { published: true, publish_at: at ?? new Date().toISOString() }
        : { published: false, publish_at: null };
      let q = sb.from("board_results").update(patch);
      if (year) q = q.eq("year", Number(year));
      if (programme !== "all") q = q.eq("programme", programme);
      const { error } = await q;
      if (error) {
        toast({ title: "Publish failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        published: publish,
        publish_at: publish ? (at ?? new Date().toISOString()) : null,
      }))
    );
    toast({
      title: publish ? "Results published" : "Results unpublished",
      description: publish
        ? "/results/lookup live · the header bell rang · WhatsApp broadcast queued."
        : "Rows hidden from public lookup — data kept.",
    });
  }

  async function clearClass() {
    const sb = supabaseBrowser();
    if (sb) {
      let q = sb.from("board_results").delete();
      if (year) q = q.eq("year", Number(year));
      if (programme !== "all") q = q.eq("programme", programme);
      await q;
    }
    setRows([]);
    toast({ title: "Class cleared", description: "All rows for this filter were deleted (audit-logged)." });
  }

  function exportCsv() {
    downloadCsv(`ghss-results-${programme}-${year}.csv`, [
      ["Roll No", "Student", "Father", "Programme", "Year", "Obtained", "Total", "Percentage", "Grade", "Position", "Published"],
      ...visible.map((r) => [
        r.roll_no, r.student_name, r.father_name ?? "", r.programme, r.year,
        r.obtained, r.total, r.percentage, r.grade, r.position ?? "", r.published ? "yes" : "no",
      ]),
    ]);
    toast({ title: "CSV exported", description: `${visible.length} rows — opens directly in Excel.` });
  }

  function parseImport() {
    // CSV: roll_no,student_name,father_name,obtained,total,grade,position
    const lines = importText.trim().split(/\r?\n/).filter(Boolean);
    const parsed: Partial<ResultRow>[] = [];
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      if (cols.length < 5) continue;
      if (/roll/i.test(cols[0])) continue; // header
      const obtained = Number(cols[3]);
      const total = Number(cols[4]);
      parsed.push({
        roll_no: cols[0],
        student_name: cols[1],
        father_name: cols[2] || null,
        obtained,
        total,
        percentage: total > 0 ? Number(((obtained / total) * 100).toFixed(2)) : 0,
        grade: cols[5] || (obtained / Math.max(1, total) >= 0.8 ? "A+" : obtained / Math.max(1, total) >= 0.7 ? "A" : "B"),
        position: cols[6] || null,
        year: Number(year),
        programme: programme === "all" ? "ics" : programme,
        subjects_json: [],
        published: false,
        publish_at: null,
      });
    }
    if (parsed.length === 0) {
      toast({ title: "Nothing to import", description: "Expected: roll,name,father,obtained,total per row.", variant: "destructive" });
      return;
    }
    setImportOpen(false);
    setImportText("");
    saveMany(parsed);
  }

  async function saveMany(batch: Partial<ResultRow>[]) {
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("board_results").upsert(batch.map((b) => ({ ...b, id: undefined })));
      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      setRows((rs) => [...batch.map((b, i) => ({ id: `demo-import-${Date.now()}-${i}`, ...b }) as ResultRow), ...rs]);
    }
    await load();
    toast({ title: "Import complete", description: `${batch.length} result rows saved as unpublished.` });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Manage Results"
        desc="Board result rows with the publish model: mark rows, then flip them live instantly or on a schedule — the homepage countdown strip follows publish_at."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="button-press h-10 rounded-full">
              <Upload className="mr-1.5 h-4 w-4" aria-hidden /> Import CSV
            </Button>
            <Button variant="outline" onClick={exportCsv} className="button-press h-10 rounded-full">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden /> Export
            </Button>
            <Button onClick={() => setEditing({})} className="button-press h-10 rounded-full font-bold">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add result
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Rows", value: stats.total },
          { label: "Passed (≥40%)", value: stats.passed },
          { label: "Average", value: `${stats.avg.toFixed(1)}%` },
          { label: "Unpublished", value: stats.unpublished },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + publish controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roll no or name…" className="h-11 pl-10" aria-label="Search results" />
        </div>
        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-11 w-24" aria-label="Year" />
        <Select value={programme} onValueChange={setProgramme}>
          <SelectTrigger className="h-11 w-44" aria-label="Programme"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programmes</SelectItem>
            {PROGRAMMES.map((p) => (
              <SelectItem key={p} value={p}>{p.replace("-", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setConfirmPublish(true)} className="button-press h-11 rounded-full font-bold">
          <Trophy className="mr-1.5 h-4 w-4" aria-hidden /> Publish
        </Button>
        <Button variant="outline" onClick={() => publishAll(false)} className="button-press h-11 rounded-full">
          Unpublish
        </Button>
        <Button variant="outline" onClick={() => setConfirmClear(true)} className="button-press h-11 rounded-full text-destructive hover:bg-destructive/10">
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Clear
        </Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading results…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No rows for this filter — add or import results.</p>
          ) : (
            <DataTable head={["Roll", "Student", "Marks", "Grade", "Status", ""]}>
              {visible.slice(0, 100).map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                  <td className="py-3 pr-4 font-mono text-small font-bold">{r.roll_no}</td>
                  <td className="py-3 pr-4">
                    <p className="text-small font-semibold">{r.student_name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{r.programme.replace("-", " ")} · {r.year}</p>
                  </td>
                  <td className="py-3 pr-4 text-small tabular-nums">
                    {r.obtained}/{r.total} <span className="text-xs text-muted-foreground">({r.percentage}%)</span>
                  </td>
                  <td className="py-3 pr-4"><Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">{r.grade}</Badge></td>
                  <td className="py-3 pr-4">
                    {r.published ? (
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">Published</Badge>
                    ) : r.publish_at ? (
                      <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">
                        <CalendarClock className="mr-1 h-3 w-3" aria-hidden /> {new Date(r.publish_at).toLocaleDateString("en-PK")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Hidden</Badge>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)} className="button-press h-9 rounded-full">Edit</Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          {visible.length > 100 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Showing the first 100 of {visible.length} rows — narrow the filter to see more.</p>
          )}
        </CardContent>
      </Card>

      {/* Publish dialog */}
      <Dialog open={confirmPublish} onClose={() => setConfirmPublish(false)} title="Publish results" desc="Flip the filtered set live — instantly or on a schedule.">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={() => { publishAll(true); setConfirmPublish(false); }} className="button-press h-11 flex-1 rounded-full font-bold">
              Publish now
            </Button>
          </div>
          <div className="space-y-1.5 border-t border-border pt-4">
            <Label className="text-small font-semibold">Or schedule for later</Label>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-11" />
            <p className="text-xs text-muted-foreground">
              The homepage shows a gold countdown strip until this moment; rows flip live automatically
              when it passes (publish_at on the row).
            </p>
            <Button
              variant="outline"
              disabled={!scheduleAt}
              onClick={() => { publishAll(true, new Date(scheduleAt).toISOString()); setConfirmPublish(false); }}
              className="button-press h-11 w-full rounded-full"
            >
              <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden /> Schedule publish
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Clear confirm */}
      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearClass}
        title="Delete the filtered class?"
        desc={`All rows for ${programme === "all" ? "every programme" : programme} ${year} will be permanently deleted.`}
        confirmLabel="Delete rows"
      />

      {/* Import dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title="Import CSV" desc="One row per student — roll,name,father,obtained,total,grade,position">
        <div className="space-y-3">
          <textarea
            rows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={"GH-12-101,Ayesha Khan,Father Khan,456,550,A+,1st\nGH-12-102,Bilal Ahmed,..."}
            className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary/50"
            aria-label="CSV text"
          />
          <p className="text-xs text-muted-foreground">
            Rows arrive unpublished — review them, then use Publish. Duplicates on (roll, year, programme) update in place.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportText("")} className="button-press h-10 rounded-full">Clear</Button>
            <Button onClick={parseImport} className="button-press h-10 rounded-full font-bold">Import rows</Button>
          </div>
        </div>
      </Dialog>

      {/* Edit dialog */}
      <ResultEditDialog row={editing} onClose={() => setEditing(null)} onSave={saveRow} year={year} programme={programme} />
    </AdminChrome>
  );
}

function ResultEditDialog({
  row, onClose, onSave, year, programme,
}: {
  row: Partial<ResultRow> | null;
  onClose: () => void;
  onSave: (row: Partial<ResultRow>) => void;
  year: string;
  programme: string;
}) {
  const [form, setForm] = useState<Partial<ResultRow>>({});
  useEffect(() => {
    const t = setTimeout(() => setForm(row ?? {}), 0);
    return () => clearTimeout(t);
  }, [row]);
  if (row === null) return null;

  const set = (k: keyof ResultRow, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  function autoPct() {
    const obtained = Number(form.obtained ?? 0);
    const total = Number(form.total ?? 0);
    if (total > 0) set("percentage", Number(((obtained / total) * 100).toFixed(2)));
  }

  return (
    <Dialog open onClose={onClose} title={row.id ? `Edit ${row.roll_no}` : "Add result"} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Roll number *</Label>
          <Input className="h-11" value={form.roll_no ?? ""} onChange={(e) => set("roll_no", e.target.value)} placeholder="GH-12-101" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Student name *</Label>
          <Input className="h-11" value={form.student_name ?? ""} onChange={(e) => set("student_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Father&apos;s name</Label>
          <Input className="h-11" value={form.father_name ?? ""} onChange={(e) => set("father_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Programme</Label>
          <Select value={form.programme ?? (programme === "all" ? "ics" : programme)} onValueChange={(v) => set("programme", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROGRAMMES.map((p) => (
                <SelectItem key={p} value={p}>{p.replace("-", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Year</Label>
          <Input type="number" className="h-11" value={form.year ?? Number(year)} onChange={(e) => set("year", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Position / distinction</Label>
          <Input className="h-11" value={form.position ?? ""} onChange={(e) => set("position", e.target.value)} placeholder="1st in school" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Obtained marks</Label>
          <Input type="number" className="h-11" value={form.obtained ?? ""} onChange={(e) => { set("obtained", Number(e.target.value)); setTimeout(autoPct, 0); }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Total marks</Label>
          <Input type="number" className="h-11" value={form.total ?? ""} onChange={(e) => { set("total", Number(e.target.value)); setTimeout(autoPct, 0); }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Percentage (auto)</Label>
          <Input type="number" step="0.01" className="h-11" value={form.percentage ?? ""} onChange={(e) => set("percentage", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Grade</Label>
          <Input className="h-11" value={form.grade ?? ""} onChange={(e) => set("grade", e.target.value)} placeholder="A+" />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} className="button-press h-10 rounded-full">Cancel</Button>
        <Button onClick={() => onSave(form)} className="button-press h-10 rounded-full font-bold">Save result</Button>
      </div>
    </Dialog>
  );
}
