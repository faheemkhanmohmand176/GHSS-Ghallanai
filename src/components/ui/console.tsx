"use client";

/**
 * Tabs + Skeleton + DataTable — tiny dependency-free console primitives.
 */
import { useState, type ReactNode } from "react";

export function Tabs({
  tabs,
  children,
}: {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  children: (active: string) => ReactNode;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div>
      <div role="tablist" aria-label="Sections" className="scroll-thin mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`button-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-small font-semibold transition-colors ${
              active === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground/75 hover:bg-secondary"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children(active)}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-secondary ${className}`} />;
}

export function DataTable({
  head,
  children,
  minWidth = "40rem",
}: {
  head: string[];
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={h + i} className={`py-3 pr-4 font-semibold ${i === head.length - 1 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}
