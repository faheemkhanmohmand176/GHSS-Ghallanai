"use client";

import { useState } from "react";
import { CalendarDays, ClipboardList, Users, Percent, CheckCircle2 } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DEMO_TEACHER, DEMO_CLASS_ROSTER } from "@/content/portal";

const TABS = [
  { key: "home", label: "Home", href: "/portal/teacher", icon: CalendarDays },
  { key: "classes", label: "Classes", href: "/portal/teacher/classes", icon: Users },
  { key: "assignments", label: "Assignments", href: "/portal/teacher/assignments", icon: ClipboardList },
  { key: "gradebook", label: "Gradebook", href: "/portal/teacher/gradebook", icon: Percent },
];

/** Teacher portal — one-tap attendance for a class in under a minute (§7.3). */
export default function TeacherClasses() {
  const [roster, setRoster] = useState(DEMO_CLASS_ROSTER);
  const [selectedClass, setSelectedClass] = useState(DEMO_TEACHER.classes[0]);
  const [saved, setSaved] = useState(false);

  const presentCount = roster.filter((r) => r.present).length;

  function toggle(roll: number) {
    setRoster((r) => r.map((s) => (s.roll === roll ? { ...s, present: !s.present } : s)));
    setSaved(false);
  }

  function markAllPresent() {
    setRoster((r) => r.map((s) => ({ ...s, present: true })));
    setSaved(false);
  }

  function save() {
    // In production: optimistically writes through Supabase RLS to `attendance`
    // with offline queuing when connectivity drops (§7.3).
    setSaved(true);
    toast({
      title: "Attendance saved",
      description: `${selectedClass}: ${presentCount}/${roster.length} present. Percentages updated for students and parents.`,
    });
  }

  return (
    <PortalChrome
      title={DEMO_TEACHER.name}
      subtitle={`${DEMO_TEACHER.subject} · ${selectedClass}`}
      badge="Demo workspace"
      tabs={TABS}
    >
      <DemoBanner mode="Teacher portal" />

      {/* Class selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {DEMO_TEACHER.classes.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSelectedClass(c)}
            className={`h-10 rounded-full px-4 text-xs font-bold transition-colors ${
              selectedClass === c
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card hover:border-gold"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-small">
            <Users className="h-4 w-4 text-primary" aria-hidden />
            Attendance · {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "short" })}
          </CardTitle>
          <span className="text-xs font-bold text-muted-foreground">
            {presentCount}/{roster.length} present
          </span>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={markAllPresent} className="h-9 rounded-full">
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Mark all present
            </Button>
          </div>
          <ul className="divide-y divide-border/50">
            {roster.map((s) => (
              <li key={s.roll} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-small font-semibold">
                    <span className="mr-2 text-muted-foreground">{s.roll}.</span>
                    {s.name}
                  </p>
                </div>
                <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${s.name}`}>
                  <button
                    type="button"
                    onClick={() => !s.present && toggle(s.roll)}
                    aria-pressed={s.present}
                    className={`h-11 min-w-11 rounded-full px-4 text-xs font-bold transition-colors ${
                      s.present ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    P
                  </button>
                  <button
                    type="button"
                    onClick={() => s.present && toggle(s.roll)}
                    aria-pressed={!s.present}
                    className={`h-11 min-w-11 rounded-full px-4 text-xs font-bold transition-colors ${
                      !s.present ? "bg-destructive text-white" : "border border-border text-muted-foreground hover:border-destructive"
                    }`}
                  >
                    A
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button onClick={save} disabled={saved} className="mt-5 h-11 w-full rounded-full font-bold sm:w-auto sm:px-10">
            {saved ? "Saved ✓" : "Save attendance"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Two taps per absence — a class of 40 marks in under a minute. Attendance taps apply
            instantly (optimistic UI) and reconcile silently if connectivity drops (§9.4).
          </p>
        </CardContent>
      </Card>
    </PortalChrome>
  );
}
