import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: "primary" | "gold" | "success" | "warning" | "danger" | "neutral";
  trend?: { direction: "up" | "down" | "flat"; value: string };
  className?: string;
}

const ACCENT_TONES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  gold: "bg-gold/15 text-gold-strong",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  neutral: "bg-secondary text-foreground",
};

const TREND_TONES = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  flat: "text-muted-foreground",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", TREND_TONES[trend.direction])}>
              {trend.direction === "up" && "↑"}
              {trend.direction === "down" && "↓"}
              {trend.direction === "flat" && "→"}
              {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", ACCENT_TONES[accent])}>
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  actions,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6",
        className
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <p className="font-display text-base font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
