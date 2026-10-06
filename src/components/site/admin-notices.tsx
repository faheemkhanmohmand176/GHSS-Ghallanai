"use client";

import { useState } from "react";
import { Pin, Plus, Megaphone, Trash2, Eye } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { Notice } from "@/content/news";
import { formatDate } from "@/content/site";

/** Notices manager — publish in under five minutes (§7.5). */
export default function AdminNotices({ initial }: { initial: Notice[] }) {
  const [notices, setNotices] = useState(initial);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [pinned, setPinned] = useState(false);

  function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and body are required.", variant: "destructive" });
      return;
    }
    const notice: Notice = {
      id: `local-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      category: category as Notice["category"],
      date: new Date().toISOString().slice(0, 10),
      pinned,
    };
    setNotices((n) => [notice, ...n]);
    setTitle("");
    setBody("");
    setPinned(false);
    toast({
      title: "Notice published",
      description: "Live on /notices within 60 seconds · WhatsApp broadcast queued (§7.6).",
    });
  }

  function togglePin(id: string) {
    setNotices((n) => n.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
  }

  function remove(id: string) {
    // Soft-delete with 90-day recovery in production (§7.5)
    setNotices((n) => n.filter((x) => x.id !== id));
    toast({ title: "Archived", description: "Soft-deleted — recoverable for 90 days in production." });
  }

  return (
    <AdminChrome>
      <div className="p-4 sm:p-6 lg:p-8">
      <AdminDemoBanner />
      <AdminTitle
        title="Notices"
        desc="The publish flow behind the under-five-minutes KPI: write, preview, publish — the public site and WhatsApp broadcast follow automatically."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        {/* Composer */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <Plus className="h-4 w-4 text-primary" aria-hidden /> New notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={publish} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="n-title" className="text-small font-semibold">Title *</Label>
                <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11" placeholder="e.g. Send-up exam schedule announced" />
                <p className="urdu-body text-right text-xs text-muted-foreground" dir="rtl" lang="ur">
                  عنوان لکھیں
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="n-cat" className="text-small font-semibold">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="n-cat" className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["admission", "exam", "result", "scholarship", "holiday", "general"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
                  <span className="text-small font-semibold">
                    Pin to top
                    <span className="mt-0.5 block text-xs text-muted-foreground" dir="rtl" lang="ur">اوپر لگائیں</span>
                  </span>
                  <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Pin notice" />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="n-body" className="text-small font-semibold">Body *</Label>
                <Textarea id="n-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="The notice text families will read…" />
              </div>
              <Button type="submit" className="h-11 w-full rounded-full font-bold sm:w-auto sm:px-10">
                <Megaphone className="mr-1.5 h-4 w-4" aria-hidden /> Publish notice
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Published notices ({notices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-[32rem] divide-y divide-border/50 overflow-y-auto scroll-thin">
              {notices.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-small font-bold">{n.title}</span>
                      {n.pinned && (
                        <Badge variant="outline" className="border-gold/50 text-gold-strong dark:text-gold">
                          <Pin className="mr-1 h-3 w-3" aria-hidden /> Pinned
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(n.date)} · {n.category}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{n.body}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePin(n.id)}
                      aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
                    >
                      <Pin className={`h-4 w-4 ${n.pinned ? "text-gold" : "text-muted-foreground"}`} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label={`Archive ${n.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      </div>
    </AdminChrome>
  );
}
