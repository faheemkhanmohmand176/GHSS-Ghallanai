import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { PRINCIPAL_MESSAGE } from "@/content/about";

export const metadata: Metadata = {
  title: "Principal's Message",
  description:
    "A message from the Principal of Government Higher Secondary School Ghallanai.",
};

export default function PrincipalPage() {
  return (
    <>
      <PageHeader
        kicker="Leadership"
        title={<>A word from the <span className="text-gold">Principal</span></>}
        lead="The standard the school sets for itself, in the Principal's own words."
        breadcrumbs={[
          { name: "About", href: "/about" },
          { name: "Principal's Message", href: "/about/principal" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {/* Principal's message panel */}
          <Reveal>
            <article className="h-full rounded-2xl border border-border bg-card p-6 md:p-10">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-2xl font-bold text-primary"
                >
                  P
                </span>
                <div>
                  <p className="text-base font-bold">{PRINCIPAL_MESSAGE.name} (SAMPLE)</p>
                  <p className="text-small text-muted-foreground">{PRINCIPAL_MESSAGE.title}</p>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground/90">
                {PRINCIPAL_MESSAGE.message.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
                {PRINCIPAL_MESSAGE.tenure}
              </p>
            </article>
          </Reveal>
        </div>
      </section>
    </>
  );
}
