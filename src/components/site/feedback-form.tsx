"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

/**
 * Feedback & complaint form (§6.7) — files into the admin dashboard
 * with an acknowledgment. Supabase when configured; demo acknowledges otherwise.
 */
export function FeedbackForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", type: "feedback", message: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: "Missing details", description: "Your name and the message are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send");
      setDone(data.reference);
    } catch (e) {
      toast({
        title: "Could not send",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gold/40 bg-card p-8 text-center">
        <h3 className="font-display text-xl font-bold">Feedback received</h3>
        <p className="mt-2 text-small text-muted-foreground">
          Reference <span className="font-bold text-primary">{done}</span>. Every submission is
          acknowledged and tracked by the principal&apos;s office — expect a response within
          working days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 md:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fb-name" className="text-small font-semibold">Your name *</Label>
          <Input
            id="fb-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb-phone" className="text-small font-semibold">Phone / WhatsApp</Label>
          <Input
            id="fb-phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            inputMode="tel"
            className="h-11"
          />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="fb-type" className="text-small font-semibold">Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
            <SelectTrigger id="fb-type" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feedback">Feedback / suggestion</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
              <SelectItem value="admission">Admission question</SelectItem>
              <SelectItem value="result">Result question</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="fb-msg" className="text-small font-semibold">Message *</Label>
          <Textarea
            id="fb-msg"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            rows={5}
            className="resize-y"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-full text-base font-bold sm:w-auto sm:px-10">
        <Send className="mr-1.5 h-4 w-4" aria-hidden />
        {loading ? "Sending…" : "Send to the office"}
      </Button>
    </form>
  );
}
