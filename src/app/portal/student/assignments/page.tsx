"use client";

import { ClipboardList } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_ASSIGNMENTS } from "@/content/portal";
import { formatDate } from "@/content/site";

const TABS = [
  { key: "home", label: "Home", href: "/portal/student", icon: ClipboardList },
  { key: "assignments", label: "Assignments", href: "/portal/student/assignments", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: ClipboardList },
  { key: "results", label: "Results", href: "/portal/student/results", icon: ClipboardList },
  { key: "resources", label: "Library", href: "/portal/student/resources", icon: ClipboardList },
];

export default function StudentAssignments() {
  const groups = [
    { title: "Due", items: DEMO_ASSIGNMENTS.filter((a) => a.status === "pending") },
    { title: "Submitted — awaiting grade", items: DEMO_ASSIGNMENTS.filter((a) => a.status === "submitted") },
    { title: "Graded", items: DEMO_ASSIGNMENTS.filter((a) => a.status === "graded") },
  ];
  return (
    <PortalChrome title="Assignments" subtitle="Student workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Assignments" />
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-small">{g.title} ({g.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {g.items.length === 0 ? (
                <p className="text-small text-muted-foreground">Nothing here.</p>
              ) : (
                <ul className="space-y-3">
                  {g.items.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-small font-bold">{a.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.subject} · due {formatDate(a.due)}
                        </p>
                        {a.status === "graded" && (
                          <p className="mt-1 text-xs">
                            <span className="font-bold text-primary">{a.grade}</span>
                            <span className="text-muted-foreground"> — &ldquo;{a.remarks}&rdquo;</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            a.status === "pending"
                              ? "border-gold/50 text-gold-strong dark:text-gold"
                              : a.status === "submitted"
                                ? ""
                                : "border-primary/40 text-primary"
                          }
                        >
                          {a.status}
                        </Badge>
                        {a.status === "pending" && (
                          <button
                            type="button"
                            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90"
                          >
                            Attach submission
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </PortalChrome>
  );
}
