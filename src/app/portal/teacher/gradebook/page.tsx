"use client";

import { CalendarDays, ClipboardList, Users, Percent, Download } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEMO_GRADEBOOK } from "@/content/portal";

const TABS = [
  { key: "home", label: "Home", href: "/portal/teacher", icon: CalendarDays },
  { key: "classes", label: "Classes", href: "/portal/teacher/classes", icon: Users },
  { key: "assignments", label: "Assignments", href: "/portal/teacher/assignments", icon: ClipboardList },
  { key: "gradebook", label: "Gradebook", href: "/portal/teacher/gradebook", icon: Percent },
];

/** Gradebook grid with auto-computed aggregates + CSV export (§7.3). */
export default function TeacherGradebook() {
  function exportCsv() {
    const rows = [
      ["Roll", "Name", "Monthly Test 1", "Monthly Test 2", "Send-up", "Aggregate"],
      ...DEMO_GRADEBOOK.map((g) => [g.roll, g.name, g.mt1, g.mt2, g.sendup, g.total]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gradebook.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalChrome title="Gradebook" subtitle="Teacher workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Gradebook" />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-small">1st Year Pre-Engineering A · Physics</CardTitle>
          <Button onClick={exportCsv} variant="outline" size="sm" className="h-9 rounded-full">
            <Download className="mr-1.5 h-4 w-4" aria-hidden /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-4 font-semibold">Roll</th>
                  <th className="py-2.5 pr-4 font-semibold">Student</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">MT-1 /25</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">MT-2 /25</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Send-up /85</th>
                  <th className="py-2.5 text-right font-semibold">Aggregate</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_GRADEBOOK.map((g) => (
                  <tr key={g.roll} className="border-b border-border/40 last:border-0">
                    <td className="py-3 pr-4 font-semibold">{g.roll}</td>
                    <td className="py-3 pr-4">{g.name}</td>
                    <td className="py-3 pr-4 text-right">{g.mt1}</td>
                    <td className="py-3 pr-4 text-right">{g.mt2}</td>
                    <td className="py-3 pr-4 text-right">{g.sendup}</td>
                    <td className="py-3 text-right font-bold text-primary">{g.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Aggregates auto-compute from the marks tables; CSV export downloads the same grid.
            In production, marks entered here flow into the same schema the student portal reads
            (§7.3) — one source of truth.
          </p>
        </CardContent>
      </Card>
    </PortalChrome>
  );
}
