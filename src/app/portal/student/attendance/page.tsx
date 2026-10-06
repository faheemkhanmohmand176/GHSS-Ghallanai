"use client";

import { ClipboardList, CheckCircle2 } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEMO_ATTENDANCE_LOG, DEMO_STUDENT } from "@/content/portal";
import { formatDate } from "@/content/site";

const TABS = [
  { key: "home", label: "Home", href: "/portal/student", icon: CheckCircle2 },
  { key: "assignments", label: "Assignments", href: "/portal/student/assignments", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: CheckCircle2 },
  { key: "results", label: "Results", href: "/portal/student/results", icon: CheckCircle2 },
  { key: "resources", label: "Library", href: "/portal/student/resources", icon: CheckCircle2 },
];

const STATUS = {
  p: { label: "Present", cls: "text-primary", dot: "bg-primary" },
  a: { label: "Absent", cls: "text-destructive", dot: "bg-destructive" },
  l: { label: "Leave", cls: "text-gold-strong dark:text-gold", dot: "bg-gold" },
} as const;

export default function StudentAttendance() {
  const present = DEMO_ATTENDANCE_LOG.filter((d) => d.status === "p").length;
  const pct = Math.round((present / DEMO_ATTENDANCE_LOG.length) * 100);

  return (
    <PortalChrome title="Attendance" subtitle="Student workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Attendance" />
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">This month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-bold text-primary">{pct}%</p>
            <Progress value={pct} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {present}/{DEMO_ATTENDANCE_LOG.length} days present · board requires 75%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Daily log</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {DEMO_ATTENDANCE_LOG.map((d) => {
                const s = STATUS[d.status];
                return (
                  <li key={d.date} className="flex items-center justify-between py-2.5">
                    <span className="text-small font-semibold">{formatDate(d.date)}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${s.cls}`}>
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PortalChrome>
  );
}
