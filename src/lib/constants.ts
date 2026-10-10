/**
 * ADMIN CONSOLE CONSTANTS — mirrors the SQL CHECK constraints in
 * supabase/migrations/0006_admin_console_tables.sql. Keep both in sync.
 */

export const CLASS_LABELS = [
  "1st Year — Arts",
  "1st Year — Pre-Engineering",
  "1st Year — Pre-Medical",
  "1st Year — ICS",
  "2nd Year — Arts",
  "2nd Year — Pre-Engineering",
  "2nd Year — Pre-Medical",
  "2nd Year — ICS",
] as const;

export type ClassLabel = (typeof CLASS_LABELS)[number];

export const CLASS_SHORT: Record<string, string> = Object.fromEntries(
  CLASS_LABELS.map((c) => [c, c.replace(" — ", " ")])
);

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const FEE_TYPES = [
  "tuition", "lab", "library", "transport", "exam",
  "admission", "migration", "board", "other",
] as const;

export const FEE_FREQUENCIES = ["monthly", "quarterly", "annual", "one_time"] as const;

export const PAYMENT_METHODS = ["cash", "bank", "online", "cheque", "jazzcash", "easypaisa"] as const;

export const EVENT_TYPES = ["exam", "holiday", "ptm", "sports", "results", "general"] as const;

export const EVENT_TYPE_META: Record<string, { label: string; color: string }> = {
  exam: { label: "Exam", color: "text-amber-700 dark:text-amber-400" },
  holiday: { label: "Holiday", color: "text-emerald-700 dark:text-emerald-400" },
  ptm: { label: "Parent-Teacher Meeting", color: "text-sky-700 dark:text-sky-400" },
  sports: { label: "Sports", color: "text-orange-700 dark:text-orange-400" },
  results: { label: "Results", color: "text-primary" },
  general: { label: "General", color: "text-muted-foreground" },
};

export const LIBRARY_CATEGORIES = [
  "Past Papers", "Books", "Notes", "Assignments", "Admission", "Other",
] as const;

export const ACHIEVEMENT_CATEGORIES = ["Academic", "Sports", "Art", "Science", "Other"] as const;

export const NOTICE_CATEGORIES = [
  "admission", "exam", "result", "scholarship", "holiday", "general",
] as const;

export const NEWS_CATEGORIES = ["Achievement", "Academic", "Guidance", "Institution"] as const;

export const ADMISSION_STATUSES = [
  "received", "review", "shortlisted", "offered", "admitted", "rejected",
] as const;

export const ADMISSION_STATUS_META: Record<string, { label: string; tone: string }> = {
  received: { label: "Received", tone: "border-border" },
  review: { label: "Under review", tone: "border-gold/50 text-gold-strong dark:text-gold" },
  shortlisted: { label: "Shortlisted", tone: "border-sky-500/50 text-sky-700 dark:text-sky-400" },
  offered: { label: "Offered", tone: "border-primary/50 text-primary" },
  admitted: { label: "Admitted", tone: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Not eligible", tone: "border-destructive/50 text-destructive" },
};

export const VOUCHER_STATUSES = ["unpaid", "partial", "paid", "overdue", "waived"] as const;

export const VOUCHER_STATUS_META: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "border-border text-muted-foreground" },
  partial: { label: "Partial", tone: "border-gold/50 text-gold-strong dark:text-gold" },
  paid: { label: "Paid", tone: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" },
  overdue: { label: "Overdue", tone: "border-destructive/50 text-destructive" },
  waived: { label: "Waived", tone: "border-sky-500/50 text-sky-700 dark:text-sky-400" },
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Money formatter for the fee engine. */
export function fmtMoney(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n ?? 0);
  return `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(v)}`;
}

/** Deterministic voucher numbers: VCH-YYYYMM-XXXX. */
export function newVoucherNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VCH-${stamp}-${rand}`;
}

/** CSV download helper (Excel-compatible export without any dependency). */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
