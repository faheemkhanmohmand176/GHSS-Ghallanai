import type { Metadata } from "next";
import { Images, CalendarDays } from "lucide-react";
import { getGallery } from "@/lib/data";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Photo Gallery — GHSS Ghallanai",
  description:
    "Photo and video albums from GHSS Ghallanai — annual day, science fairs, sports and everyday campus life across the four intermediate programmes.",
};

export default async function GalleryPage() {
  const { albums, photos } = await getGallery();

  return (
    <>
      <PageHeader
        kicker="Campus life"
        title={<>Photo <span className="text-gold">gallery</span></>}
        lead="Albums from the annual day ceremony, science fairs, sports galas and everyday moments around the Ghallanai campus. Managed from the admin console's Gallery section."
        breadcrumbs={[{ name: "Gallery", href: "/gallery" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16" aria-label="Albums">
        {albums.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-12 text-center">
            <Images className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-small font-semibold">Albums are coming soon.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The office publishes event albums here after every function.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album, i) => {
              const albumPhotos = photos.filter((p) => p.album_id === album.id);
              return (
                <Reveal key={album.id} delay={i * 60}>
                  <article className="card-lift overflow-hidden rounded-2xl border border-border bg-card">
                    {album.cover_url || albumPhotos[0]?.photo_url ? (
                       
                      <img
                        src={album.cover_url ?? albumPhotos[0].photo_url}
                        alt={album.title}
                        className="aspect-[16/10] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] w-full items-center justify-center bg-primary-strong">
                        <Images className="h-10 w-10 text-gold/70" aria-hidden />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="text-small font-bold">{album.title}</h2>
                      {album.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {album.description}
                        </p>
                      )}
                      <p className="mt-3 text-xs font-semibold text-primary">
                        {albumPhotos.length > 0
                          ? `${albumPhotos.length} photo${albumPhotos.length === 1 ? "" : "s"}`
                          : "Photos coming soon"}
                      </p>
                    </div>
                    {albumPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-1 border-t border-border/60 p-1">
                        {albumPhotos.slice(0, 3).map((p) =>
                          p.media_type === "video" ? (
                            <div
                              key={p.id}
                              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-primary-strong"
                            >
                              <CalendarDays className="h-5 w-5 text-gold/70" aria-hidden />
                            </div>
                          ) : (
                             
                            <img
                              key={p.id}
                              src={p.photo_url}
                              alt={p.caption ?? album.title}
                              className="aspect-square w-full rounded-lg object-cover"
                              loading="lazy"
                            />
                          )
                        )}
                      </div>
                    )}
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
