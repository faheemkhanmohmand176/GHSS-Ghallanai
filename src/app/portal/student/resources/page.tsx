"use client";

import { ClipboardList, CheckCircle2, Download, FileText } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_RESOURCES } from "@/content/portal";

const TABS = [
  { key: "home", label: "Home", href: "/portal/student", icon: CheckCircle2 },
  { key: "assignments", label: "Assignments", href: "/portal/student/assignments", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: CheckCircle2 },
  { key: "results", label: "Results", href: "/portal/student/results", icon: CheckCircle2 },
  { key: "resources", label: "Library", href: "/portal/student/resources", icon: CheckCircle2 },
];

/** Resource library organised by subject — read in-app, download for offline (§7.3). */
export default function StudentResources() {
  const subjects = [...new Set(DEMO_RESOURCES.map((r) => r.subject))];
  return (
    <PortalChrome title="Library" subtitle="Student workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Resource library" />
      <div className="space-y-4">
        {subjects.map((sub) => (
          <Card key={sub}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-small">
                <FileText className="h-4 w-4 text-primary" aria-hidden /> {sub}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/50">
                {DEMO_RESOURCES.filter((r) => r.subject === sub).map((r) => (
                  <li key={r.title} className="flex items-center justify-between gap-3 py-3">
                    <p className="min-w-0 text-small font-semibold">{r.title}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline">{r.type}</Badge>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden /> Download
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalChrome>
  );
}
