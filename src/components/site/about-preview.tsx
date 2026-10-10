import Link from "next/link";
import { ArrowRight, MapPin, Phone, Mail, TrendingUp, Award } from "lucide-react";
import type { SchoolSettingsRow } from "@/content/demo-content";
import { Reveal } from "./reveal";
import { Button } from "@/components/ui/button";

/**
 * AboutPreview — principal card + contact chips + floating stat cards
 * (Babi Khel homepage feature, GHSS-adapted).
 */
export function AboutPreview({ settings }: { settings: SchoolSettingsRow }) {
  const established = settings.established_year ?? 2005;
  return (
    <section aria-labelledby="about-preview" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        {/* Text side */}
        <Reveal>
          <div>
            <p className="kicker">About the school</p>
            <h2 id="about-preview" className="mt-3 text-h2 font-display font-bold">
              Building future leaders since <span className="text-gold">{established}</span>
            </h2>
            <p className="mt-4 text-lead leading-relaxed text-muted-foreground">
              {settings.about_text ??
                settings.description ??
                "A government higher secondary school serving Mohmand District with four intermediate streams, published results and a merit-led admission policy."}
            </p>
            <ul className="mt-6 space-y-2.5">
              <li className="flex items-center gap-2.5 text-small text-foreground/85">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <MapPin className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <span className="min-w-0">{settings.address}</span>
              </li>
              <li className="flex items-center gap-2.5 text-small text-foreground/85">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Phone className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <span>{settings.phone}</span>
              </li>
              <li className="flex items-center gap-2.5 text-small text-foreground/85">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                  <Mail className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <span className="truncate">{settings.email}</span>
              </li>
            </ul>
            <Button asChild variant="outline" className="mt-7 h-11 rounded-full px-7 font-semibold">
              <Link href="/about">
                Learn more <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </Reveal>

        {/* Principal card + floating stats */}
        <Reveal delay={120}>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="card-lift overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              {settings.principal_photo_url ? (
                 
                <img
                  src={settings.principal_photo_url}
                  alt={settings.principal_name ?? "The Principal"}
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[4/5] w-full items-center justify-center bg-primary-strong">
                  <span aria-hidden className="font-display text-6xl font-bold text-gold">
                    {(settings.principal_name ?? "P")
                      .split(" ")
                      .filter(Boolean)
                      .slice(-2)
                      .map((w) => w[0])
                      .join("")}
                  </span>
                </div>
              )}
              <div className="p-5">
                <p className="text-small font-bold">{settings.principal_name ?? "The Principal"}</p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  Principal, GHSS Ghallanai
                </p>
                {settings.principal_message && (
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    “{settings.principal_message}”
                  </p>
                )}
              </div>
            </div>

            {/* Floating stat cards */}
            <div className="absolute -left-4 -bottom-5 hidden rounded-xl border border-border bg-background p-3.5 shadow-xl sm:block">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden /> Pass rate
              </p>
              <p className="mt-0.5 font-display text-xl font-bold text-primary">
                {settings.pass_percentage ?? 92}%
              </p>
            </div>
            <div className="absolute -right-4 -top-5 hidden rounded-xl border border-gold/40 bg-gold-soft/50 p-3.5 shadow-xl dark:bg-gold-soft/20 sm:block">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-gold-strong dark:text-gold" aria-hidden /> Board results
              </p>
              <p className="mt-0.5 font-display text-xl font-bold text-gold-strong dark:text-gold">
                {settings.board_results ?? "A+"}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
