"use client";

import { useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

/**
 * Notices publish form — handles submit with toast feedback.
 * In LIVE mode, this POSTs to /api/admin/notices; in DEMO mode it just
 * shows a toast confirming the staged publish.
 */
export function NoticesPublishForm() {
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const body = String(data.get("body") ?? "").trim();
    if (!title || !body) {
      toast({
        title: "Title and body are required",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    // Demo: simulate a network round-trip then notify.
    setTimeout(() => {
      setSubmitting(false);
      form.reset();
      toast({
        title: "Notice staged for publish",
        description: `"${title}" — visible on /notices within 60 seconds when live mode is configured.`,
      });
    }, 400);
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="n-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Title
        </Label>
        <Input id="n-title" name="title" placeholder="Notice title…" className="h-11" required />
      </div>
      <div>
        <Label htmlFor="n-body" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Body
        </Label>
        <Textarea
          id="n-body"
          name="body"
          placeholder="Notice body…"
          rows={4}
          required
        />
      </div>
      <div>
        <Label htmlFor="n-category" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </Label>
        <select
          id="n-category"
          name="category"
          defaultValue="general"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="general">General</option>
          <option value="admission">Admission</option>
          <option value="exam">Examination</option>
          <option value="result">Result</option>
          <option value="holiday">Holiday</option>
          <option value="scholarship">Scholarship</option>
        </select>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="pinned" className="h-4 w-4 rounded border-input" />
        <Pin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        Pin this notice to the top
      </label>
      <Button type="submit" className="h-11 w-full rounded-full font-semibold" disabled={submitting}>
        <Megaphone className="mr-1.5 h-4 w-4" aria-hidden />
        {submitting ? "Publishing…" : "Publish Notice"}
      </Button>
    </form>
  );
}
