"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Images, ChevronLeft, ArrowLeft, Link2 } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { DEMO_ALBUMS, DEMO_PHOTOS, type GalleryAlbum, type GalleryPhoto } from "@/content/demo-content";

/**
 * Gallery — albums + photos (Babi Khel pattern): album grid → album detail
 * with add-by-URL photos (image or video link), captions and deletes.
 */
export default function AdminGalleryPage() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>(DEMO_ALBUMS);
  const [photos, setPhotos] = useState<GalleryPhoto[]>(DEMO_PHOTOS);
  const [loading, setLoading] = useState(true);
  const [openAlbum, setOpenAlbum] = useState<GalleryAlbum | null>(null);
  const [newAlbum, setNewAlbum] = useState<Partial<GalleryAlbum> | null>(null);
  const [newPhoto, setNewPhoto] = useState<{ photo_url: string; caption: string; media_type: "image" | "video" } | null>(null);
  const [deleting, setDeleting] = useState<GalleryAlbum | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const [a, p] = await Promise.all([
      sb.from("gallery_albums").select("*").order("created_at", { ascending: false }),
      sb.from("gallery_photos").select("*").order("created_at", { ascending: false }),
    ]);
    setAlbums((a.data as GalleryAlbum[]) ?? []);
    setPhotos((p.data as GalleryPhoto[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function createAlbum() {
    if (!newAlbum?.title?.trim()) {
      toast({ title: "Album title is required.", variant: "destructive" });
      return;
    }
    const payload: GalleryAlbum = {
      id: newAlbum.id ?? `demo-${Date.now()}`,
      title: newAlbum.title.trim(),
      description: newAlbum.description ?? null,
      cover_url: newAlbum.cover_url || null,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, ...rest } = payload;
      void id;
      const { error } = await sb.from("gallery_albums").upsert({ ...rest, id: newAlbum.id, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Could not create album", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setAlbums((as) => [payload, ...as]);
    }
    setNewAlbum(null);
    toast({ title: "Album created", description: payload.title });
  }

  async function deleteAlbum(album: GalleryAlbum) {
    const sb = supabaseBrowser();
    if (sb) {
      await sb.from("gallery_photos").delete().eq("album_id", album.id);
      await sb.from("gallery_albums").delete().eq("id", album.id);
    }
    setAlbums((as) => as.filter((a) => a.id !== album.id));
    setPhotos((ps) => ps.filter((p) => p.album_id !== album.id));
    toast({ title: "Album deleted", description: `${album.title} and its photos (audit-logged).` });
  }

  async function addPhoto() {
    if (!newPhoto || !openAlbum || !newPhoto.photo_url.trim()) {
      toast({ title: "Photo URL is required.", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\//i.test(newPhoto.photo_url.trim())) {
      toast({ title: "The URL must start with http:// or https://", variant: "destructive" });
      return;
    }
    const payload: GalleryPhoto = {
      id: `demo-${Date.now()}`,
      album_id: openAlbum.id,
      photo_url: newPhoto.photo_url.trim(),
      caption: newPhoto.caption.trim() || null,
      media_type: newPhoto.media_type,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("gallery_photos").insert({ album_id: payload.album_id, photo_url: payload.photo_url, caption: payload.caption, media_type: payload.media_type });
      if (error) {
        toast({ title: "Could not add photo", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setPhotos((ps) => [payload, ...ps]);
    }
    setNewPhoto(null);
    toast({ title: "Photo added", description: `${openAlbum.title} — ${payload.media_type}` });
  }

  async function removePhoto(p: GalleryPhoto) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("gallery_photos").delete().eq("id", p.id);
    setPhotos((ps) => ps.filter((x) => x.id !== p.id));
    toast({ title: "Photo removed" });
  }

  const albumPhotos = openAlbum ? photos.filter((p) => p.album_id === openAlbum.id) : [];

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Gallery"
        desc="Photo albums and videos from school life. Paste hosted image/video URLs — albums cascade-delete their photos."
        actions={
          !openAlbum && (
            <Button onClick={() => setNewAlbum({})} className="button-press h-10 rounded-full font-bold">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> New album
            </Button>
          )
        }
      />

      {loading ? (
        <p className="py-8 text-center text-small text-muted-foreground">Loading gallery…</p>
      ) : openAlbum ? (
        /* ---- Album detail ---- */
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => setOpenAlbum(null)} className="button-press h-10 rounded-full">
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> All albums
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 text-primary">{albumPhotos.length} items</Badge>
              <Button onClick={() => setNewPhoto({ photo_url: "", caption: "", media_type: "image" })} className="button-press h-10 rounded-full font-bold">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add photo / video
              </Button>
            </div>
          </div>

          <Card>
            <CardContent>
              <p className="text-small font-bold">{openAlbum.title}</p>
              {openAlbum.description && <p className="mt-0.5 text-xs text-muted-foreground">{openAlbum.description}</p>}
              {albumPhotos.length === 0 ? (
                <p className="py-8 text-center text-small text-muted-foreground">No photos yet — add the first one.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {albumPhotos.map((p) => (
                    <figure key={p.id} className="group relative overflow-hidden rounded-xl border border-border">
                      {p.media_type === "video" ? (
                        <div className="flex aspect-square items-center justify-center bg-primary-strong">
                          <Link2 className="h-8 w-8 text-gold/70" aria-hidden />
                        </div>
                      ) : (
                         
                        <img src={p.photo_url} alt={p.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                      )}
                      {p.caption && (
                        <figcaption className="absolute inset-x-0 bottom-0 truncate bg-primary-strong/75 px-2.5 py-1.5 text-[0.65rem] font-semibold text-white">
                          {p.caption}
                        </figcaption>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(p)}
                        aria-label="Remove photo"
                        className="button-press absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-destructive opacity-0 shadow transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        ×
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ---- Album grid ---- */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.length === 0 && (
            <p className="py-8 text-center text-small text-muted-foreground sm:col-span-2 lg:col-span-3">No albums — create the first one.</p>
          )}
          {albums.map((a) => {
            const count = photos.filter((p) => p.album_id === a.id).length;
            return (
              <Card key={a.id} className="card-lift">
                <button type="button" onClick={() => setOpenAlbum(a)} className="block w-full text-left" aria-label={`Open ${a.title}`}>
                  <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-primary-strong">
                    {(a.cover_url || photos.find((p) => p.album_id === a.id)?.photo_url) && (
                       
                      <img
                        src={a.cover_url ?? photos.find((p) => p.album_id === a.id)!.photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-primary-strong/40">
                      <Images className="h-9 w-9 text-gold/80" aria-hidden />
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-small font-bold">{a.title}</p>
                    {a.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.description}</p>}
                    <p className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">{count} item{count === 1 ? "" : "s"}</span>
                      <span className="text-xs font-bold text-primary">Open →</span>
                    </p>
                  </div>
                </button>
                <div className="border-t border-border/60 p-3">
                  <Button variant="outline" size="sm" onClick={() => setDeleting(a)} className="button-press h-8 rounded-full text-destructive hover:bg-destructive/10">
                    Delete album
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New album dialog */}
      <Dialog open={newAlbum !== null} onClose={() => setNewAlbum(null)} title="New album">
        {newAlbum && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Title *</Label>
              <Input className="h-11" value={newAlbum.title ?? ""} onChange={(e) => setNewAlbum({ ...newAlbum, title: e.target.value })} placeholder="Annual Day 2026" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Description</Label>
              <Textarea rows={2} value={newAlbum.description ?? ""} onChange={(e) => setNewAlbum({ ...newAlbum, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Cover image URL (optional)</Label>
              <Input className="h-11" value={newAlbum.cover_url ?? ""} onChange={(e) => setNewAlbum({ ...newAlbum, cover_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="flex justify-end">
              <Button onClick={createAlbum} className="button-press h-10 rounded-full font-bold">Create album</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Add photo dialog */}
      <Dialog open={newPhoto !== null} onClose={() => setNewPhoto(null)} title="Add photo or video" desc={openAlbum?.title}>
        {newPhoto && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Media type</Label>
              <Select value={newPhoto.media_type} onValueChange={(v) => setNewPhoto({ ...newPhoto, media_type: v as "image" | "video" })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image (photo URL)</SelectItem>
                  <SelectItem value="video">Video (embed URL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">URL *</Label>
              <Input className="h-11" value={newPhoto.photo_url} onChange={(e) => setNewPhoto({ ...newPhoto, photo_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Caption</Label>
              <Input className="h-11" value={newPhoto.caption} onChange={(e) => setNewPhoto({ ...newPhoto, caption: e.target.value })} />
            </div>
            {newPhoto.photo_url && /^https?:\/\//i.test(newPhoto.photo_url) && newPhoto.media_type === "image" && (
               
              <img src={newPhoto.photo_url} alt="Preview" className="max-h-48 w-full rounded-xl border border-border object-cover" />
            )}
            <div className="flex justify-end">
              <Button onClick={addPhoto} className="button-press h-10 rounded-full font-bold">Add to album</Button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} onConfirm={() => deleting && deleteAlbum(deleting)} title="Delete this album?" desc={`${deleting?.title ?? ""} — all its photos go with it.`} confirmLabel="Delete album" />
    </AdminChrome>
  );
}
