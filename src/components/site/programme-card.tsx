import Link from "next/link";
import { ChevronRight, FlaskConical, Code2, Cog, Feather } from "lucide-react";
import type { Programme } from "@/content/programmes";
import { Reveal } from "./reveal";

const ICONS = {
  code: Code2,
  flask: FlaskConical,
  gear: Cog,
  quill: Feather,
} as const;

/** Programme card — duotone treatment: green glyph + gold detail (§5.5). */
export function ProgrammeCard({ p, index = 0 }: { p: Programme; index?: number }) {
  const Icon = ICONS[p.icon];
  const subjectCount = new Set(p.subjects.map((s) => s.subject.split(" /")[0])).size;
  return (
    <Reveal delay={index * 60}>
      <Link
        href={`/academics/${p.slug}`}
        className="card-lift group flex h-full flex-col rounded-xl border border-border bg-card p-6 focus-visible:border-gold"
      >
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} aria-hidden />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-card bg-gold" aria-hidden />
        </span>
        <h3 className="mt-4 text-h3">{p.shortName}</h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-gold">{p.accentWord}</p>
        <p className="mt-3 flex-1 text-small leading-relaxed text-muted-foreground">{p.promise}</p>
        <p className="mt-4 text-xs font-medium text-muted-foreground">{subjectCount} subjects · 2 years · BISE</p>
        <span className="mt-4 inline-flex items-center gap-1 text-small font-semibold text-primary">
          Explore the programme
          <ChevronRight
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </Link>
    </Reveal>
  );
}
