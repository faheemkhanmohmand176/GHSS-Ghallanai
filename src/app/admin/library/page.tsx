"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, BookOpen, Search, Download, Link2 } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { CLASS_LABELS, LIBRARY_CATEGORIES } from "@/lib/constants";
import { DEMO_LIBRARY, type LibraryFileRow } from "@/content/demo-content";

/** Library — the digital study shelf (files by link or upload). */
export default function AdminLibraryPage() {
  const [rows, setRows] = useState<LibraryFileRow[]>(DEMO_LIBRARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<LibraryFileRow> | null>(null);
  const [deleting, setDeleting] = useState<LibraryFileRow | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error } = await sb.from("library_files").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load library", description: error.message, variant: "destructive" });
    else setRows((data as LibraryFileRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = rows.filter(
    (f) =>
      (categoryFilter === "all" || f.category === categoryFilter) &&
      (!search || f.title.toLowerCase().includes(search.toLowerCase()) || (f.subject ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  async function save(row: Partial<LibraryFileRow>) {
    if (!row.title?.trim() || !row.file_url?.trim()) {
      toast({ title: "Title and file URL are required.", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(row.file_url.trim())) {
      toast({ title: "The file URL must start with http:// or https://", variant: "destructive" });
      return;
    }
    const payload: LibraryFileRow = {
      id: row.id ?? `demo-${Date.now()}`,
      title: row.title.trim(),
      description: row.description ?? null,
      category: row.category ?? "Other",
      class_label: row.class_label ?? "All",
      subject: row.subject ?? null,
      file_url: row.file_url.trim(),
      file_type: row.file_type ?? "LINK",
      file_size: row.file_size ?? null,
      cover_url: row.cover_url ?? null,
      download_count: row.download_count ?? 0,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, download_count, ...rest } = payload;
      void id; void download_count;
      const { error } = await sb.from("library_files").upsert({ ...rest, id: row.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [payload, ...rs.filter((r) => r.id !== payload.id)]);
    }
    setEditing(null);
    toast({ title: "File published", description: `${payload.title} — live on /library.` });
  }

  async function remove(f: LibraryFileRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("library_files").delete().eq("id", f.id);
    setRows((rs) => rs.filter((r) => r.id !== f.id));
    toast({ title: "File removed", description: f.title });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Library"
        desc="Past papers, books, notes and assignments. Paste a hosted file URL (Drive, Cloudinary, any CDN) — download counters move through an RPC."
        actions={
          <Button onClick={() => setEditing({ category: "Notes", class_label: "All", file_type: "LINK" })} className="button-press h-10 rounded-full font-bold">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add file
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or subject…" className="h-11 pl-10" aria-label="Search library" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 w-44" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {LIBRARY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-small text-muted-foreground">Loading library…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No files — add the first one.</p>
          ) : (
            <DataTable head={["File", "Class / Subject", "Category", "Downloads", ""]}>
              {visible.map((f) => (
                <tr key={f.id} className="hover:bg-secondary/40">
                  <td className="max-w-80 py-3 pr-4">
                    <p className="truncate text-small font-bold">{f.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.description ?? f.file_url}</p>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">
                    {f.class_label}
                    {f.subject ? ` · ${f.subject}` : ""}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="border-primary/40 text-primary">{f.category}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-small tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {f.download_count}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${f.title}`}
                        className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary"
                      >
                        <Link2 className="h-4 w-4" aria-hidden />
                      </a>
                      <Button variant="outline" size="sm" onClick={() => setEditing(f)} className="button-press h-9 rounded-full">Edit</Button>
                      <button type="button" onClick={() => setDeleting(f)} aria-label="Delete" className="button-press inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit file" : "Add file"} wide>
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Title *</Label>
              <Input className="h-11" value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Physics past papers — BISE 2025" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Description</Label>
              <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">File URL * (hosted file or Drive share link)</Label>
              <Input className="h-11" value={editing.file_url ?? ""} onChange={(e) => setEditing({ ...editing, file_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Category</Label>
                <Select value={editing.category ?? "Notes"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LIBRARY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Class</Label>
                <Select value={editing.class_label ?? "All"} onValueChange={(v) => setEditing({ ...editing, class_label: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All classes</SelectItem>
                    {CLASS_LABELS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Subject</Label>
                <Input className="h-11" value={editing.subject ?? ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Physics" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save(editing)} className="button-press h-10 rounded-full font-bold">
                <BookOpen className="mr-1.5 h-4 w-4" aria-hidden /> Publish file
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove(deleting)} title="Delete this file?" desc={deleting?.title ?? ""} confirmLabel="Delete file" />
    </AdminChrome>
  );
}
