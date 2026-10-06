"use client";

import { CalendarDays, ClipboardList, Users, Percent, Plus, Download } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { DEMO_TEACHER, DEMO_GRADEBOOK } from "@/content/portal";

const TABS = [
  { key: "home", label: "Home", href: "/portal/teacher", icon: CalendarDays },
  { key: "classes", label: "Classes", href: "/portal/teacher/classes", icon: Users },
  { key: "assignments", label: "Assignments", href: "/portal/teacher/assignments", icon: ClipboardList },
  { key: "gradebook", label: "Gradebook", href: "/portal/teacher/gradebook", icon: Percent },
];

/** Teacher dashboard: classes today + quick actions (§7.3). */
export default function TeacherHome() {
  return (
    <PortalChrome title={DEMO_TEACHER.name} subtitle={`${DEMO_TEACHER.subject} department`} badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Teacher portal" />
      <div className="grid gap-4 md:grid-cols-3">
        {DEMO_TEACHER.classes.map((c, i) => (
          <Card key={c} className="card-lift">
            <CardHeader className="pb-2">
              <CardTitle className="text-small">{c}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {["Periods 1-2", "Periods 3-4", "Periods 5-6"][i]} · today
              </p>
              <Button
                onClick={() => { window.location.href = "/portal/teacher/classes"; }}
                variant="outline"
                size="sm"
                className="mt-3 h-9 rounded-full"
              >
                Take attendance
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Leave applications, notice drafting for admin approval, and the monthly attendance export
        are specified in the plan (§7.3) and arrive with the Supabase integration.
      </p>
    </PortalChrome>
  );
}
