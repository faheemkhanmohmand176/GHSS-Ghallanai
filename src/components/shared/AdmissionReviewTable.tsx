import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PencilLine } from "lucide-react";

export interface ReviewRow { label: string; value: ReactNode; wide?: boolean }

interface Props {
  title: string;
  icon?: ReactNode;
  rows: ReviewRow[];
  /** Optional small "Edit" link shown in the header (only before final submit). */
  editTo?: string;
  onEdit?: () => void;
}

/**
 * Premium review table — thin hairline grid, label cell + value cell, everything
 * centered. One pair per line on phones, two pairs per line from `sm` up.
 * Wide rows (addresses, institute names) always take a full line, and the
 * layout is pre-computed so no empty "holes" ever appear.
 */
export default function AdmissionReviewTable({ title, icon, rows, editTo, onEdit }: Props) {
  // Pack rows into lines of 1 or 2 pairs.
  const lines: ReviewRow[][] = [];
  let pending: ReviewRow | null = null;
  for (const r of rows) {
    if (r.wide) {
      if (pending) { lines.push([pending]); pending = null; }
      lines.push([r]);
    } else if (pending) {
      lines.push([pending, r]); pending = null;
    } else {
      pending = r;
    }
  }
  if (pending) lines.push([pending]);

  const show = (v: ReactNode) => (v === "" || v === null || v === undefined ? "N/A" : v);

  const editCls =
    "inline-flex h-6 items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-white/20";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <header className="relative flex items-center justify-center bg-gradient-to-r from-primary to-primary/90 px-3 py-2.5 text-primary-foreground">
        <h3 className="flex items-center gap-2 font-heading text-[13px] font-semibold uppercase tracking-[0.14em]">
          {icon}
          {title}
        </h3>
        {(editTo || onEdit) && (
          editTo ? (
            <Link to={editTo} className={`${editCls} absolute right-2.5`}><PencilLine className="h-3 w-3" /> Edit</Link>
          ) : (
            <button type="button" onClick={onEdit} className={`${editCls} absolute right-2.5`}><PencilLine className="h-3 w-3" /> Edit</button>
          )
        )}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      </header>

      <div role="table" aria-label={title}>
        {lines.map((line, i) => (
          <div
            key={i}
            role="row"
            className={`grid ${line.length === 2 ? "sm:grid-cols-2" : ""} ${i > 0 ? "border-t border-border/60" : ""}`}
          >
            {line.map((r, j) => (
              <div
                key={r.label}
                className={`grid grid-cols-[40%_60%] ${j === 1 ? "border-t border-border/60 sm:border-l sm:border-t-0" : ""} ${line.length === 1 ? "sm:grid-cols-[20%_80%]" : ""}`}
              >
                <div
                  role="rowheader"
                  className="flex items-center justify-center border-r border-border/60 bg-primary/[0.05] px-2 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted-foreground"
                >
                  {r.label}
                </div>
                <div
                  role="cell"
                  className="flex min-w-0 items-center justify-center px-2.5 py-2 text-center text-[13px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
                >
                  {show(r.value)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
