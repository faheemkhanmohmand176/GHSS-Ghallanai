import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { PRINCIPAL_MESSAGE } from "@/content/about";

export const metadata: Metadata = {
  title: "Principal's Message",
  description:
    "A message from the Principal of Government Higher Secondary School Ghallanai — in English and Urdu.",
};

export default function PrincipalPage() {
  return (
    <>
      <PageHeader
        kicker="Leadership"
        title={<>A word from the <span className="text-gold">Principal</span></>}
        lead="The standard the school sets for itself, in the Principal's own words — presented in English and Urdu side by side, as the community reads both."
        breadcrumbs={[
          { name: "About", href: "/about" },
          { name: "Principal's Message", href: "/about/principal" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* English panel */}
          <Reveal>
            <article className="h-full rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary font-display text-2xl font-bold text-primary"
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

          {/* Urdu panel — Nastaliq, RTL (§5.4, §11.2) */}
          <Reveal delay={80}>
            <article className="h-full rounded-2xl border border-gold/30 bg-card p-6 md:p-8" dir="rtl" lang="ur">
              <div className="flex flex-row-reverse items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft font-urdu text-2xl font-bold text-gold-strong dark:text-gold"
                >
                  م
                </span>
                <div>
                  <p className="font-urdu text-xl font-bold leading-loose">پرنسپل کا پیغام</p>
                  <p className="font-urdu text-small leading-loose text-muted-foreground">
                    {PRINCIPAL_MESSAGE.title}
                  </p>
                </div>
              </div>
              <p className="urdu-body mt-6 text-foreground/90">{PRINCIPAL_MESSAGE.messageUrdu}</p>
            </article>
          </Reveal>
        </div>
      </section>
    </>
  );
}
