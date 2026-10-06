import Link from "next/link";
import { Calendar, Hash, User } from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import { Button } from "@/components/ui/button";
import { DownloadSlipButton } from "./download-slip-button";
import type { ExamRollNumber } from "../_lib/demo";

interface RollSlipProps {
  slip: ExamRollNumber;
  sessionTitle: string;
  generatedAt: string;
}

const PROGRAMME_LABEL: Record<string, string> = {
  ics: "ICS — Computer Science",
  "pre-medical": "Pre-Medical (F.Sc)",
  "pre-engineering": "Pre-Engineering (F.Sc)",
  arts: "Arts (Humanities)",
};

/**
 * RollSlip — premium admit-card display, modelled on a real BISE
 * intermediate exam roll number slip. School crest header, student
 * identification grid, big gold exam roll number, generated-at stamp.
 *
 * Server component — the only interactivity is the Download button
 * (a tiny client island) and the cross-link to the report-card lookup.
 */
export function RollSlip({ slip, sessionTitle, generatedAt }: RollSlipProps) {
  return (
    <article className="roll-slip-print overflow-hidden rounded-2xl border border-gold/50 bg-card shadow-sm">
      {/* Header — institutional crest + gold accents */}
      <header className="relative border-b border-border bg-gradient-to-br from-primary-strong to-primary px-6 py-6 text-[#FAFDF7] dark:from-[#0a1810] dark:to-[#12291b]">
        <span
          className="pointer-events-none absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-gold/70"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute bottom-4 left-4 h-10 w-10 border-b-2 border-l-2 border-gold/70"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <CrestMark className="h-14 w-14 shrink-0" />
          <div className="flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gold">
              Government Higher Secondary School Ghallanai
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
              Examination Roll Slip
            </h2>
            <p className="mt-1 text-small text-[#E8F5EC]/85">{sessionTitle}</p>
          </div>
        </div>
      </header>

      {/* Body — student identification grid */}
      <div className="p-6 md:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Student Name" icon={User}>
            <p className="font-display text-lg font-bold text-foreground">{slip.student_name}</p>
          </Field>
          <Field label="Father's Name">
            <p className="font-display text-lg font-bold text-foreground">
              {slip.father_name || "—"}
            </p>
          </Field>
          <Field label="Class">
            <p className="text-base font-semibold text-foreground">{slip.class_label}</p>
          </Field>
          <Field label="Programme">
            <p className="text-base font-semibold text-foreground">
              {PROGRAMME_LABEL[slip.programme] ?? slip.programme}
            </p>
          </Field>
          <Field label="Class Roll No">
            <p className="font-mono text-base font-semibold text-foreground">
              {slip.class_roll_no || "—"}
            </p>
          </Field>
          <Field label="Serial No">
            <p className="font-mono text-base font-semibold text-foreground">
              #{slip.serial_number.toString().padStart(3, "0")}
            </p>
          </Field>
        </div>

        {/* Exam roll number — the hero element */}
        <div className="mt-6 rounded-xl border-2 border-gold/60 bg-gold-soft/40 p-6 text-center dark:bg-gold-soft/15">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold-strong dark:text-gold">
            Exam Roll Number
          </p>
          <p className="mt-2 font-display text-5xl font-black tracking-[0.04em] text-primary-strong dark:text-gold">
            {slip.exam_roll_no}
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
            Carry this number to every examination paper. Verify the spelling of your name on the
            answer sheet before the paper begins.
          </p>
        </div>

        {/* Footer — generated-at timestamp + session ID */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Generated {generatedAt} · Asia/Karachi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5" aria-hidden />
            Session ref {slip.session_id.slice(0, 12)}
          </span>
        </div>

        {/* Action bar — print/share + cross-link to report card */}
        <div className="no-print mt-6 flex flex-wrap gap-2">
          <DownloadSlipButton />
          <Button asChild variant="outline" className="h-11 rounded-full font-semibold">
            <Link
              href={`/results/report-card?rollNo=${encodeURIComponent(slip.exam_roll_no)}`}
              prefetch
            >
              View Report Card →
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
