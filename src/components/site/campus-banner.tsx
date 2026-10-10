import { Reveal } from "./reveal";

/**
 * CampusBanner — full-bleed photo card shown only when the College Setting
 * provides a banner_url. Graceful: no URL, no section (demo mode).
 */
export function CampusBanner({ url, eyebrow = "Campus · Mohmand" }: { url?: string | null; eyebrow?: string }) {
  if (!url) return null;
  return (
    <section aria-label="Campus banner" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 md:pt-20">
      <Reveal>
        <figure className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
          { }
          <img
            src={url}
            alt="The GHSS Ghallanai campus"
            className="h-64 w-full object-cover sm:h-80 md:h-96"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-strong/80 via-primary-strong/25 to-transparent" aria-hidden />
          <figcaption className="absolute bottom-0 left-0 p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">{eyebrow}</p>
            <p className="mt-1 max-w-md font-display text-xl font-bold text-white sm:text-2xl">
              A place shaped by the hills, made for learners.
            </p>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}
