import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Download, FileText, GraduationCap, Library } from "lucide-react";
import { getLibraryFiles } from "@/lib/data";
import { LIBRARY_CATEGORIES } from "@/lib/constants";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { DownloadButton } from "@/components/site/library-download";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Digital Library — GHSS Ghallanai",
  description:
    "Past papers, books, notes and assignments for ICS, Pre-Medical, Pre-Engineering and Arts — free study material from the GHSS Ghallanai digital library.",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = category && LIBRARY_CATEGORIES.includes(category as (typeof LIBRARY_CATEGORIES)[number]) ? category : undefined;
  const files = await getLibraryFiles(active);

  return (
    <>
      <PageHeader
        kicker="Study material"
        title={<>Digital <span className="text-gold">library</span></>}
        lead="Past papers, books, notes and assignments organised by class and subject — free for every student of the school, on any phone."
        breadcrumbs={[{ name: "Library", href: "/library" }]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16" aria-label="Library files">
        {/* Category filter pills */}
        <div className="scroll-thin mb-6 flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/library"
            className={`button-press inline-flex h-10 shrink-0 items-center rounded-full px-4 text-small font-semibold ${
              !active ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
            }`}
          >
            All
          </Link>
          {LIBRARY_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/library?category=${encodeURIComponent(c)}`}
              className={`button-press inline-flex h-10 shrink-0 items-center rounded-full px-4 text-small font-semibold ${
                active === c ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>

        {files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-12 text-center">
            <Library className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-small font-semibold">Nothing in this shelf yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Teachers upload material from the admin console as the session progresses.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {files.map((f, i) => (
              <Reveal key={f.id} delay={i * 50}>
                <article className="card-lift flex h-full flex-col rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-secondary">
                      {f.category === "Past Papers" ? (
                        <FileText className="h-5.5 w-5.5 text-primary" aria-hidden />
                      ) : f.category === "Books" ? (
                        <BookOpen className="h-5.5 w-5.5 text-primary" aria-hidden />
                      ) : (
                        <GraduationCap className="h-5.5 w-5.5 text-primary" aria-hidden />
                      )}
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                      {f.category}
                    </span>
                  </div>
                  <h2 className="mt-4 text-small font-bold leading-snug">{f.title}</h2>
                  {f.description && (
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {f.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{f.class_label}</span>
                    {f.subject ? ` · ${f.subject}` : ""}
                    {f.download_count > 0 ? ` · ${f.download_count} downloads` : ""}
                  </p>
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <DownloadButton fileId={f.id} url={f.file_url} title={f.title} />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
