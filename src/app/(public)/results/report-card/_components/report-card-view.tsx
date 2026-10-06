import { Award, GraduationCap } from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportCardActionBar } from "./action-bar";
import { programmeLabel, type ReportCard, type SubjectStatus } from "../_lib/demo";

interface ReportCardViewProps {
  result: ReportCard;
}

/** Returns the right badge classes for a subject status. */
function statusBadge(status: SubjectStatus): {
  className: string;
  label: string;
} {
  switch (status) {
    case "pass":
      return {
        className:
          "border-transparent bg-secondary text-primary [a&]:hover:bg-secondary/90",
        label: "PASS",
      };
    case "fail":
      return {
        className:
          "border-transparent bg-rose-600 text-white [a&]:hover:bg-rose-600/90",
        label: "FAIL",
      };
    case "absent":
      return {
        className:
          "border-transparent bg-amber-500 text-white [a&]:hover:bg-amber-500/90",
        label: "ABSENT",
      };
  }
}

/** Returns the grade display class — gold for A+, green for A, muted otherwise. */
function gradeClass(grade: string): string {
  if (grade === "A+") return "font-bold text-gold-strong dark:text-gold";
  if (grade === "A") return "font-bold text-primary";
  if (grade === "F" || grade === "Ab") return "font-bold text-destructive";
  return "font-semibold text-foreground";
}

/**
 * ReportCardView — the editorial A4-style report card itself.
 *
 * Green border, gold corner accents, school crest watermark, full
 * subject-wise marks table, summary stat band with the gold percentage,
 * position/compartments, and the print/share/new-search action bar.
 *
 * Server component — only the action bar is a small client island.
 */
export function ReportCardView({ result }: ReportCardViewProps) {
  const shareText = `${result.studentName} — ${result.examRollNo}: ${result.obtainedMarks}/${result.totalMarks} (${result.percentage.toFixed(1)}%, ${result.grade}) · ${result.examination} · GHSS Ghallanai`;
  const shareTitle = "GHSS Ghallanai Report Card";

  const publishedAt = new Date(result.publishedAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });

  return (
    <article className="report-card relative overflow-hidden rounded-2xl border-2 border-primary/70 bg-card shadow-sm print:border print:shadow-none">
      {/* Watermark crest — low-opacity, centred behind the body */}
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04] dark:opacity-[0.06]"
        aria-hidden
      >
        <CrestMark className="h-[55%] w-[55%]" />
      </span>

      {/* Header — gold accent strip + crest + meta */}
      <header className="relative border-b-2 border-primary/70 bg-gradient-to-br from-primary-strong to-primary px-6 py-6 text-[#FAFDF7] dark:from-[#0a1810] dark:to-[#12291b]">
        <span className="pointer-events-none absolute right-4 top-4 h-12 w-12 border-r-2 border-t-2 border-gold" aria-hidden />
        <span className="pointer-events-none absolute bottom-4 left-4 h-12 w-12 border-b-2 border-l-2 border-gold" aria-hidden />
        <div className="relative flex items-start gap-4">
          <CrestMark className="h-16 w-16 shrink-0" />
          <div className="flex-1">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">
              Government Higher Secondary School Ghallanai
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight md:text-3xl">
              Intermediate Report Card
            </h2>
            <p className="mt-1 text-small text-[#E8F5EC]/85">{result.examination}</p>
          </div>
          {result.grade === "A+" && (
            <span className="hidden items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-primary-strong sm:inline-flex">
              <Award className="h-3.5 w-3.5" aria-hidden /> Topper
            </span>
          )}
        </div>
      </header>

      {/* Student meta */}
      <div className="relative grid gap-px border-b border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Student Name" value={result.studentName} />
        <Meta label="Father's Name" value={result.fatherName || "—"} />
        <Meta label="Class / Programme" value={`${result.classLabel} · ${programmeLabel(result.programme)}`} />
        <Meta label="Exam Roll No" value={result.examRollNo} mono />
      </div>

      {/* Subject-wise marks table */}
      <div className="relative p-4 sm:p-6">
        <h3 className="mb-3 text-small font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Subject-wise Marks
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border bg-secondary/60 hover:bg-secondary/60">
                <TableHead className="h-11 px-4 font-bold text-foreground">Subject</TableHead>
                <TableHead className="h-11 px-4 text-right font-bold text-foreground">Total</TableHead>
                <TableHead className="h-11 px-4 text-right font-bold text-foreground">Obtained</TableHead>
                <TableHead className="h-11 px-4 text-center font-bold text-foreground">Grade</TableHead>
                <TableHead className="h-11 px-4 text-center font-bold text-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.subjects.map((s) => {
                const badge = statusBadge(s.status);
                return (
                  <TableRow key={s.subject} className="border-b border-border/50 last:border-0">
                    <TableCell className="px-4 py-3 font-medium">
                      {s.subject}
                      {s.practical && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 align-middle text-[0.65rem] font-semibold text-primary">
                          incl. practical
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                      {s.total}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">
                      {s.obtained}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <span className={gradeClass(s.grade)}>{s.grade}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <Badge variant="outline" className={badge.className}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="border-t-2 border-primary/50 bg-secondary/30 font-bold hover:bg-secondary/30">
                <TableCell className="px-4 py-3.5">Total</TableCell>
                <TableCell className="px-4 py-3.5 text-right tabular-nums">{result.totalMarks}</TableCell>
                <TableCell className="px-4 py-3.5 text-right text-primary tabular-nums">
                  {result.obtainedMarks}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-center" colSpan={2}>
                  {result.grade === "Compartment" ? (
                    <span className="text-destructive">Compartment</span>
                  ) : (
                    <span className={gradeClass(result.grade)}>{result.grade}</span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Summary stat band */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total Marks" value={`${result.obtainedMarks}/${result.totalMarks}`} />
          <Stat
            label="Percentage"
            value={`${result.percentage.toFixed(1)}%`}
            gold
          />
          <Stat label="Grade" value={result.grade} />
          <Stat
            label="Position"
            value={result.position ?? "—"}
            icon={result.position ? GraduationCap : undefined}
          />
        </div>

        {/* Compartment note (if any) */}
        {result.compartmentNote && (
          <div className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-small text-destructive">
            <strong>Note:</strong> {result.compartmentNote}
          </div>
        )}

        {/* Footer stamp */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Report card code:{" "}
            <span className="font-mono font-semibold text-foreground">
              {result.reportCardCode || "—"}
            </span>
          </span>
          <span>Published {publishedAt} · Asia/Karachi</span>
        </div>

        {/* Actions */}
        <ReportCardActionBar shareText={shareText} shareTitle={shareTitle} />

        <p className="mt-4 text-xs text-muted-foreground no-print">
          SAMPLE data — the exam branch imports official board results through the supervised
          pipeline on result day (Master Plan §7.2). Verify against the printed BISE result card.
        </p>
      </div>
    </article>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-card p-4 sm:p-5">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-lg font-bold leading-tight text-foreground ${
          mono ? "font-mono text-base" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  gold,
  icon: Icon,
}: {
  label: string;
  value: string;
  gold?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        gold
          ? "border-gold/50 bg-gold-soft/40 dark:bg-gold-soft/15"
          : "border-border bg-secondary/40"
      }`}
    >
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1.5 flex items-center justify-center gap-1.5 font-display text-2xl font-black ${
          gold ? "text-gold-strong dark:text-gold" : "text-primary"
        }`}
      >
        {Icon && <Icon className="h-5 w-5" aria-hidden />}
        {value}
      </p>
    </div>
  );
}
