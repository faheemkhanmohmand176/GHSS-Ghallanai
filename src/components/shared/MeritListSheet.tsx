/**
 * Shared presentation pieces for a merit list: a centered, parsed title block,
 * an "Important Dates" strip and a numbered "Instructions" card.
 * Used by the public Admission page and the admin Merit Lists preview.
 */
import { CalendarDays, CalendarCheck2, ListChecks } from "lucide-react";

// "1st Provisional Merit list for session 2026 [College] Program (Quota)"
function parseTitle(title: string) {
  const m = title.match(/^(.+?)\s+for\s+(session\s+\d{4})\s*\[(.+?)\]\s*(.+)$/i);
  if (!m) return null;
  const cap = (s: string) => s.replace(/\bmerit list\b/i, "Merit List").replace(/^session/i, "Session");
  return { heading: cap(m[1]), session: cap(m[2]), school: m[3].trim(), program: m[4].trim() };
}

export function MeritTitleBlock({ title }: { title: string }) {
  const t = parseTitle(title);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-primary/[0.07] via-card to-card px-4 pb-4 pt-5 text-center">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-400" />
      {t ? (
        <>
          <span className="inline-block rounded-full bg-primary px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
            {t.heading}
          </span>
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            for {t.session}
          </p>
          <h3 className="mt-2 font-heading text-[17px] font-bold leading-snug text-foreground">{t.school}</h3>
          <div className="mx-auto my-2.5 h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <span className="inline-block rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[12.5px] font-bold text-primary">
            {t.program}
          </span>
        </>
      ) : (
        <h3 className="font-heading text-[16px] font-bold leading-snug text-foreground">{title}</h3>
      )}
    </div>
  );
}

export function MeritDates({ start, last }: { start?: string | null; last?: string | null }) {
  if (!start && !last) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { icon: CalendarDays, label: "Admission Start", value: start },
        { icon: CalendarCheck2, label: "Last Date", value: last },
      ].map((d) => (
        <div key={d.label} className="rounded-xl border border-gold/35 bg-gold/5 px-2 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <d.icon className="h-3 w-3 text-gold" /> {d.label}
          </p>
          <p className="mt-1 text-[13px] font-bold text-foreground">{d.value ?? "N/A"}</p>
        </div>
      ))}
    </div>
  );
}

export function MeritInstructions({ text }: { text?: string | null }) {
  const items = (text ?? "")
    .split(/\n+/)
    .map((l) => l.trim().replace(/[;.]+$/, "").trim())
    .filter(Boolean);
  if (!items.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-center gap-1.5 border-b border-border/70 bg-primary/[0.06] px-3 py-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground">Instructions</p>
      </div>
      <ol className="space-y-2 px-3.5 py-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2.5 text-left text-[12.5px] leading-snug text-muted-foreground">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10.5px] font-bold text-primary">
              {i + 1}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
