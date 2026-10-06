"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, CheckCircle2, BookOpen, LogOut, Megaphone, Percent } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEMO_STUDENT, DEMO_TIMETABLE, DEMO_ASSIGNMENTS,
} from "@/content/portal";
import { formatDate } from "@/content/site";

const TABS = [
  { key: "home", label: "Home", href: "/portal/student", icon: CalendarDays },
  { key: "assignments", label: "Assignments", href: "/portal/student/assignments", icon: ClipboardList },
  { key: "attendance", label: "Attendance", href: "/portal/student/attendance", icon: CheckCircle2 },
  { key: "results", label: "Results", href: "/portal/student/results", icon: Percent },
  { key: "resources", label: "Library", href: "/portal/student/resources", icon: BookOpen },
];

/** Student portal — dashboard of today's work (§7.3). */
export default function StudentHome({ notices }: { notices: { id: string; title: string; date: string; category: string }[] }) {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon-first
  const today = DEMO_TIMETABLE[todayIdx] ?? DEMO_TIMETABLE[0];
  const pending = DEMO_ASSIGNMENTS.filter((a) => a.status === "pending");
  const ungraded = DEMO_ASSIGNMENTS.filter((a) => a.status === "submitted");

  return (
    <PortalChrome
      title={DEMO_STUDENT.name}
      subtitle={`${DEMO_STUDENT.class} · Section ${DEMO_STUDENT.section} · Roll ${DEMO_STUDENT.rollNo}`}
      badge="Demo workspace"
      tabs={TABS}
    >
      <DemoBanner mode="Student portal" />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Attendance ring (percentage) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <Percent className="h-4 w-4 text-primary" aria-hidden /> Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-4xl font-bold text-primary">{DEMO_STUDENT.attendancePercent}%</p>
            <Progress value={DEMO_STUDENT.attendancePercent} className="mt-3 h-2" aria-label={`Attendance ${DEMO_STUDENT.attendancePercent} percent`} />
            <p className="mt-2 text-xs text-muted-foreground">
              {DEMO_STUDENT.attendancePercent >= 75
                ? "Above the 75% board requirement — keep it up."
                : "Below 75% — parents are alerted at this threshold."}
            </p>
          </CardContent>
        </Card>

        {/* Today's timetable */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden /> Today · {today.day}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {today.periods.map((p, i) => (
                <li key={i} className="rounded-lg bg-secondary/60 px-3 py-2.5 text-xs font-semibold">
                  <span className="text-muted-foreground">P{i + 1}</span> · {p}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Assignments due */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-small text-muted-foreground">Nothing pending — all caught up.</p>
            ) : (
              <ul className="space-y-2.5">
                {pending.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-small font-semibold">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.subject} · due {formatDate(a.due)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-gold/50 text-gold-strong dark:text-gold">Due</Badge>
                  </li>
                ))}
              </ul>
            )}
            {ungraded.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {ungraded.length} submitted · awaiting grading
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-4 h-9 rounded-full">
              <Link href="/portal/student/assignments">Open assignments</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Notices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden /> Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {notices.slice(0, 3).map((n) => (
                <li key={n.id} className="border-b border-border/50 pb-2.5 last:border-0">
                  <p className="text-small font-semibold leading-snug">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(n.date)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button asChild variant="ghost" className="h-10 rounded-full text-muted-foreground">
          <Link href="/login">
            <LogOut className="mr-1.5 h-4 w-4" aria-hidden /> Sign out
          </Link>
        </Button>
      </div>
    </PortalChrome>
  );
}
