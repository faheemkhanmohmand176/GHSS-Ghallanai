interface Item { label: string; value: React.ReactNode; wide?: boolean }

/**
 * Centered label/value tiles. Replaces the old left/right rows that broke
 * on narrow screens: label sits above the value, both centered, long
 * values wrap inside their own tile.
 */
export default function AdmissionInfoGrid({ items, cols = 2 }: { items: Item[]; cols?: 1 | 2 }) {
  return (
    <div className={`grid gap-2.5 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>
      {items.map((it) => (
        <div
          key={it.label}
          className={`flex min-w-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-center ${it.wide && cols === 2 ? "sm:col-span-2" : ""}`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{it.label}</span>
          <span className="mt-0.5 max-w-full break-words text-[13.5px] font-semibold leading-snug text-foreground">
            {it.value === "" || it.value === null || it.value === undefined ? "N/A" : it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
