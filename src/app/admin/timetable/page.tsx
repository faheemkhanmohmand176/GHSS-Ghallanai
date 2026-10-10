"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Save, Printer, Trash2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { CLASS_LABELS, DAYS, PERIODS } from "@/lib/constants";

/**
 * TimeTable — the weekly grid editor (Babi Khel pattern): class picker,
 * Mon–Sat × 8 periods, cell editor with subject/teacher/times/room/meet
 * link, live teacher-conflict detection across classes, save (replace
 * class rows atomically), clear and print.
 */

interface Cell {
  [key: string]: unknown;
  class_label: string;
  day: string;
  period_number: number;
  subject: string;
  teacher: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  meet_link: string | null;
}

type Grid = Record<string, Cell | undefined>; // `${day}#${period}`

export default function AdminTimetablePage() {
  const [classLabel, setClassLabel] = useState<string>(CLASS_LABELS[0]);
  const [grid, setGrid] = useState<Grid>({});
  const [allRows, setAllRows] = useState<Cell[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ day: string; period: number; cell: Cell | null } | null>(null);
  const [day, setDay] = useState<(typeof DAYS)[number]>(DAYS[0]); // mobile day picker
  const [confirmClear, setConfirmClear] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const [tt, t] = await Promise.all([
      sb.from("timetables").select("*"),
      sb.from("teachers").select("full_name").eq("is_active", true).order("display_order"),
    ]);
    setAllRows((tt.data as Cell[]) ?? []);
    setTeachers(((t.data as { full_name: string }[]) ?? []).map((x) => x.full_name));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Grid for the selected class: live rows first, local edits layered on top
  useEffect(() => {
    const t = setTimeout(() => {
      const g: Grid = {};
      for (const row of allRows.filter((r) => r.class_label === classLabel)) {
        g[`${row.day}#${row.period_number}`] = row;
      }
      setGrid((prev) => {
        const merged: Grid = { ...g };
        // keep local dirty edits for this class
        for (const [k, v] of Object.entries(prev)) {
          if (v?.class_label === classLabel && (v as Cell & { __local?: boolean }).__local) merged[k] = v;
        }
        return merged;
      });
      setDirty(false);
    }, 0);
    return () => clearTimeout(t);
  }, [classLabel, allRows]);

  // Teacher conflicts across all classes (same day + period)
  const conflicts = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of allRows) {
      if (!r.teacher) continue;
      const key = `${r.teacher}|${r.day}|${r.period_number}`;
      map.set(key, [...(map.get(key) ?? []), r.class_label]);
    }
    return [...map.entries()].filter(([, classes]) => classes.length > 1);
  }, [allRows]);

  const conflictFor = (day: string, period: number) =>
    conflicts.filter(([key]) => key.includes(`|${day}|${period}`)).length;

  function setCell(dayName: string, period: number, cell: Cell | null) {
    setGrid((g) => {
      const next = { ...g };
      if (cell) next[`${dayName}#${period}`] = { ...cell, __local: true } as Cell & { __local?: boolean };
      else delete next[`${dayName}#${period}`];
      return next;
    });
    setDirty(true);
  }

  async function saveGrid() {
    const cells = Object.entries(grid)
      .map(([k, v]) => (v ? { ...v, class_label: classLabel } : null))
      .filter(Boolean)
      .map((c) => {
        const rest = c as Cell;
        return {
          class_label: rest.class_label,
          day: rest.day,
          period_number: Number(rest.period_number),
          subject: rest.subject,
          teacher: rest.teacher || null,
          start_time: rest.start_time || null,
          end_time: rest.end_time || null,
          room: rest.room || null,
          meet_link: rest.meet_link || null,
        };
      });

    const sb = supabaseBrowser();
    if (sb) {
      // Replace this class's rows in one transaction-ish sequence
      const { error: delErr } = await sb.from("timetables").delete().eq("class_label", classLabel);
      if (delErr) {
        toast({ title: "Save failed", description: delErr.message, variant: "destructive" });
        return;
      }
      if (cells.length > 0) {
        const { error: insErr } = await sb.from("timetables").insert(cells);
        if (insErr) {
          toast({ title: "Save failed", description: insErr.message, variant: "destructive" });
          return;
        }
      }
      await load();
    } else {
      setAllRows((rs) => [...rs.filter((r) => r.class_label !== classLabel), ...cells.map((c) => ({ ...c } as Cell))]);
    }
    setDirty(false);
    toast({
      title: "Timetable saved",
      description: `${classLabel} — ${cells.length} periods across the week.`,
    });
  }

  async function clearGrid() {
    const sb = supabaseBrowser();
    if (sb) await sb.from("timetables").delete().eq("class_label", classLabel);
    setAllRows((rs) => rs.filter((r) => r.class_label !== classLabel));
    setGrid({});
    setDirty(false);
    toast({ title: "Timetable cleared", description: `${classLabel} — all periods removed.` });
  }

  const dayIndex = DAYS.indexOf(day);

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="TimeTable"
        desc="The weekly grid per class — Monday to Saturday, eight periods. Live teacher-conflict detection keeps one teacher out of two rooms at once."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveGrid} disabled={!dirty} className="button-press h-10 rounded-full font-bold">
              <Save className="mr-1.5 h-4 w-4" aria-hidden /> {dirty ? "Save timetable" : "Saved"}
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="button-press h-10 rounded-full">
              <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
            </Button>
            <Button variant="outline" onClick={() => setConfirmClear(true)} className="button-press h-10 rounded-full text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden /> Clear
            </Button>
          </div>
        }
      />

      {/* Class picker */}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
        <div className="scroll-thin mb-4 flex gap-2 overflow-x-auto pb-1">
        {CLASS_LABELS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setClassLabel(c)}
            aria-pressed={classLabel === c}
            className={`button-press h-10 shrink-0 rounded-full px-4 text-small font-semibold ${
              classLabel === c ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
            }`}
          >
            {c}
          </button>
          ))}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/50 bg-gold-soft/30 px-4 py-3 dark:bg-gold-soft/15">
          <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-gold-strong dark:text-gold" aria-hidden />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-gold-strong dark:text-gold">
              {conflicts.length} teacher conflict{conflicts.length === 1 ? "" : "s"} across classes
            </p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {conflicts.slice(0, 4).map(([key, classes]) => {
                const [teacher, d, p] = key.split("|");
                return (
                  <li key={key}>
                    {teacher} · {d} P{p} → {classes.join(" + ")}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Mobile day picker */}
      <div className="mb-3 flex items-center justify-between gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDay(DAYS[Math.max(0, dayIndex - 1)])}
          aria-label="Previous day"
          className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full border border-border"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="scroll-thin flex gap-1.5 overflow-x-auto">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              aria-pressed={day === d}
              className={`button-press h-10 shrink-0 rounded-full px-3.5 text-xs font-bold ${
                day === d ? "bg-primary text-primary-foreground" : "border border-border"
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDay(DAYS[Math.min(DAYS.length - 1, dayIndex + 1)])}
          aria-label="Next day"
          className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full border border-border"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Grid */}
      <Card>
        <CardContent>
          {/* Desktop: full week */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[7rem_repeat(6,minmax(0,1fr))] gap-1.5">
              <div />
              {DAYS.map((d) => (
                <p key={d} className="flex h-10 items-center justify-center rounded-lg bg-secondary text-xs font-bold uppercase tracking-wide text-primary">
                  {d.slice(0, 3)}
                </p>
              ))}
              {PERIODS.map((p) => (
                <div key={p} className="contents">
                  <div className="flex h-20 items-center justify-center rounded-lg bg-primary-strong text-small font-bold text-gold dark:bg-[#0a1810]">
                    P{p}
                  </div>
                  {DAYS.map((d) => {
                    const cell = grid[`${d}#${p}`];
                    const cf = conflictFor(d, p);
                    return (
                      <button
                        key={`${d}-${p}`}
                        type="button"
                        onClick={() => setEditing({ day: d, period: p, cell: cell ?? null })}
                        className={`button-press group relative h-20 rounded-lg border p-1.5 text-left transition-colors ${
                          cell
                            ? cell.__local
                              ? "border-primary/60 bg-secondary"
                              : "border-border bg-card hover:border-primary/40"
                            : "border-dashed border-border/70 hover:border-primary/40 hover:bg-secondary/50"
                        } ${cf > 0 ? "!border-gold/70" : ""}`}
                        aria-label={`${d} period ${p}${cell ? `: ${cell.subject}` : " — empty"}`}
                      >
                        {cell ? (
                          <>
                            <p className="truncate text-[0.7rem] font-bold leading-tight">{cell.subject}</p>
                            {cell.teacher && <p className="truncate text-[0.62rem] text-muted-foreground">{cell.teacher}</p>}
                            <p className="mt-0.5 truncate text-[0.6rem] text-muted-foreground/80">
                              {cell.start_time ?? ""}{cell.room ? ` · ${cell.room}` : ""}
                            </p>
                            {cf > 0 && (
                              <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[0.55rem] font-bold text-[#1A2E22]">
                                !
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[0.65rem] text-muted-foreground/60 group-hover:text-primary">+ add</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: one day at a time */}
          <div className="space-y-2 lg:hidden">
            {PERIODS.map((p) => {
              const cell = grid[`${day}#${p}`];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setEditing({ day, period: p, cell: cell ?? null })}
                  className={`button-press flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${
                    cell ? "border-border bg-card" : "border-dashed border-border/70"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-strong text-small font-bold text-gold dark:bg-[#0a1810]">
                    {p}
                  </span>
                  <span className="min-w-0 flex-1">
                    {cell ? (
                      <>
                        <span className="block truncate text-small font-bold">{cell.subject}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {cell.teacher ?? "—"} · {cell.start_time ?? ""} {cell.room ? `· ${cell.room}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Empty — tap to add</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {Object.keys(grid).length} periods scheduled for {classLabel}
            {dirty && <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">unsaved</Badge>}
          </p>
        </CardContent>
      </Card>

      {/* Cell editor */}
      <CellEditor
        state={editing}
        teachers={teachers}
        onClose={() => setEditing(null)}
        onSave={(cell) => {
          if (editing) setCell(editing.day, editing.period, cell);
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) setCell(editing.day, editing.period, null);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearGrid}
        title="Clear this timetable?"
        desc={`Every period of ${classLabel} will be removed.`}
        confirmLabel="Clear periods"
      />
    </AdminChrome>
  );
}

function CellEditor({
  state, teachers, onClose, onSave, onDelete,
}: {
  state: { day: string; period: number; cell: Cell | null } | null;
  teachers: string[];
  onClose: () => void;
  onSave: (cell: Cell) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<Cell | null>(null);
  useEffect(() => {
    if (!state) return;
    const t = setTimeout(() => {
      setForm(
        state.cell ?? {
          class_label: "",
          day: state.day,
          period_number: state.period,
          subject: "",
          teacher: "",
          start_time: "",
          end_time: "",
          room: "",
          meet_link: "",
        }
      );
    }, 0);
    return () => clearTimeout(t);
  }, [state]);

  if (state === null || form === null) return null;
  const set = (k: keyof Cell, v: string) => setForm({ ...form, [k]: v });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${state.day} · Period ${state.period}`}
      desc={state.cell ? "Edit or remove this period." : "Add a subject to this period."}
      footer={
        <>
          {state.cell && (
            <Button variant="outline" onClick={onDelete} className="button-press h-10 rounded-full text-destructive hover:bg-destructive/10">
              Remove period
            </Button>
          )}
          <Button
            onClick={() => {
              if (!form.subject.trim()) {
                toast({ title: "Subject is required.", variant: "destructive" });
                return;
              }
              onSave({ ...form, subject: form.subject.trim() });
            }}
            className="button-press h-10 rounded-full font-bold"
          >
            Save period
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-small font-semibold">Subject *</Label>
          <Input className="h-11" value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Physics" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Teacher</Label>
          <Input
            className="h-11"
            list="ghss-teachers"
            value={form.teacher ?? ""}
            onChange={(e) => set("teacher", e.target.value)}
            placeholder="Select or type…"
          />
          <datalist id="ghss-teachers">
            {teachers.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Room</Label>
          <Input className="h-11" value={form.room ?? ""} onChange={(e) => set("room", e.target.value)} placeholder="Lab 2" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Start time</Label>
          <Input type="time" className="h-11" value={form.start_time ?? ""} onChange={(e) => set("start_time", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">End time</Label>
          <Input type="time" className="h-11" value={form.end_time ?? ""} onChange={(e) => set("end_time", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-small font-semibold">Online class link (optional)</Label>
          <Input className="h-11" value={form.meet_link ?? ""} onChange={(e) => set("meet_link", e.target.value)} placeholder="https://meet.google.com/…" />
        </div>
      </div>
    </Dialog>
  );
}
