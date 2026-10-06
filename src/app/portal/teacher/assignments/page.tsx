"use client";

import { useState } from "react";
import { CalendarDays, ClipboardList, Users, Percent } from "lucide-react";
import { PortalChrome, DemoBanner } from "@/components/site/portal-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { DEMO_TEACHER } from "@/content/portal";

const TABS = [
  { key: "home", label: "Home", href: "/portal/teacher", icon: CalendarDays },
  { key: "classes", label: "Classes", href: "/portal/teacher/classes", icon: Users },
  { key: "assignments", label: "Assignments", href: "/portal/teacher/assignments", icon: ClipboardList },
  { key: "gradebook", label: "Gradebook", href: "/portal/teacher/gradebook", icon: Percent },
];

/** Assignment creation with due date and attachment (§7.3 Table 8). */
export default function TeacherAssignments() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [due, setDue] = useState("");
  const [created, setCreated] = useState<string[]>([]);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !due) {
      toast({ title: "Title and due date are required.", variant: "destructive" });
      return;
    }
    setCreated((c) => [title, ...c]);
    setTitle("");
    setBrief("");
    setDue("");
    toast({
      title: "Assignment posted",
      description: "Students receive it in their assignments tab; in-app notification dispatched (§7.6).",
    });
  }

  return (
    <PortalChrome title="Assignments" subtitle="Teacher workspace" badge="Demo workspace" tabs={TABS}>
      <DemoBanner mode="Assignment creation" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Create assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="a-title" className="text-small font-semibold">Title *</Label>
                <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="Chapter 12 numericals" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="a-class" className="text-small font-semibold">Class</Label>
                  <Select defaultValue={DEMO_TEACHER.classes[0]}>
                    <SelectTrigger id="a-class" className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEMO_TEACHER.classes.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-due" className="text-small font-semibold">Due date *</Label>
                  <Input id="a-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-brief" className="text-small font-semibold">Brief</Label>
                <Textarea id="a-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="Instructions for students…" />
              </div>
              <Button type="submit" className="h-11 rounded-full font-bold">Post assignment</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Posted this session</CardTitle>
          </CardHeader>
          <CardContent>
            {created.length === 0 ? (
              <p className="text-small text-muted-foreground">
                Assignments you post appear here with submission counts and grading actions
                (download submissions, grade with remarks — §7.3).
              </p>
            ) : (
              <ul className="space-y-2.5">
                {created.map((t, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-border/50 pb-2.5 last:border-0">
                    <span className="text-small font-semibold">{t}</span>
                    <span className="text-xs text-muted-foreground">0 submissions</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalChrome>
  );
}
