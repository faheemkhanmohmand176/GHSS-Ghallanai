"use client";

import { ClipboardList, CheckCircle2 } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INTERNAL_MARKS } from "@/content/portal";
import { BOARD_RESULTS } from "@/content/results";

const TABS = [
  { key: "home", label: "Home", href: "/portal/student", icon: CheckCircle2 },
  { key: "assignments", label: "Assignments", href: "/portal/student/assignments", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: CheckCircle2 },
  { key: "results", label: "Results", href: "/portal/student/results", icon: CheckCircle2 },
  { key: "resources", label: "Library", href: "/portal/student/resources", icon: CheckCircle2 },
];

/** Internal test history and board results side by side (§7.2). */
export default function StudentResults() {
  const board = BOARD_RESULTS[0];
  return (
    <PortalChrome title="Results" subtitle="Student workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Results" />
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Board result · Annual {board.year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="font-display text-3xl font-bold text-primary">
                {board.percentage} <span className="text-base font-semibold text-muted-foreground">{board.grade}</span>
              </p>
              <p className="text-small text-muted-foreground">
                {board.obtained}/{board.total} marks
                {board.position && ` · ${board.position}`}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-semibold">Subject</th>
                  <th className="py-2 text-right font-semibold">Obtained</th>
                  <th className="py-2 text-right font-semibold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {board.subjects.map((s) => (
                  <tr key={s.subject} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 font-medium">{s.subject}</td>
                    <td className="py-2.5 text-right">{s.obtained}/{s.total}</td>
                    <td className="py-2.5 text-right font-semibold">{s.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Internal test history</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-semibold">Test</th>
                  <th className="py-2 font-semibold">Subject</th>
                  <th className="py-2 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_INTERNAL_MARKS.map((m, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5">{m.test}</td>
                    <td className="py-2.5 text-muted-foreground">{m.subject}</td>
                    <td className="py-2.5 text-right font-semibold text-primary">{m.obtained}/{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </PortalChrome>
  );
}
