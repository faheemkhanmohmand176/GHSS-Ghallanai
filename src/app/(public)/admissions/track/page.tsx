"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Loader2, AlertCircle, Hash, CheckCircle2, Clock, FileText,
  Award, Send, ArrowRight, RefreshCw, Calendar, MapPin, GraduationCap,
  User, Phone, Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status =
  | "received" | "review" | "board_verified" | "shortlisted"
  | "fee_pending" | "fee_paid" | "documents_pending"
  | "offered" | "admitted" | "rejected";

const STATUS_META: Record<Status, { label: string; color: string; desc: string }> = {
  received: { label: "Received", color: "border-muted-foreground/40 text-muted-foreground", desc: "Your application has been received and is awaiting fee payment at the college office." },
  review: { label: "Under Review", color: "border-amber-500/40 text-amber-600 dark:text-amber-400", desc: "Fee received. The admission committee is verifying your documents." },
  board_verified: { label: "Board Verified", color: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400", desc: "Your matriculation board result has been verified." },
  shortlisted: { label: "Shortlisted", color: "border-primary/40 text-primary", desc: "You have been shortlisted for admission. Watch for the merit list." },
  fee_pending: { label: "Fee Pending", color: "border-amber-500/40 text-amber-600 dark:text-amber-400", desc: "Pay the Rs 100 processing fee at the college office to proceed." },
  fee_paid: { label: "Fee Paid", color: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400", desc: "Processing fee paid. Your application is now under review." },
  documents_pending: { label: "Documents Pending", color: "border-rose-500/40 text-rose-600 dark:text-rose-400", desc: "Please submit the missing documents at the college office." },
  offered: { label: "Offered", color: "border-gold/50 text-gold-strong", desc: "A seat has been offered to you. Confirm by paying the admission fee." },
  admitted: { label: "Admitted", color: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400", desc: "Congratulations! You are now admitted to GHSS Ghallanai." },
  rejected: { label: "Rejected", color: "border-destructive/40 text-destructive", desc: "Your application was not selected. You may re-apply next session." },
};

const STATUS_FLOW: Status[] = [
  "received", "fee_pending", "fee_paid", "review", "board_verified",
  "shortlisted", "offered", "admitted",
];

const PROGRAMME_LABEL: Record<string, string> = {
  "ics": "ICS — Computer Science",
  "pre-medical": "FSc Pre-Medical",
  "pre-engineering": "FSc Pre-Engineering",
  "arts": "FA Humanities",
};

const QUOTA_LABEL: Record<string, string> = {
  open_merit: "Open Merit",
  local: "Local Quota (Mohmand)",
  employee: "College Employee",
  sports: "Sports Quota",
  special_person: "Special Person",
  minority: "Minority",
  afghan: "Afghan Quota",
  meritorious: "Meritorious",
};

interface TimelineEntry {
  from_status: Status | null;
  to_status: Status;
  note: string;
  actor_role: string | null;
  created_at: string;
}

interface Application {
  application_no: string;
  programme: string;
  full_name: string;
  father_name: string;
  status: Status;
  class_year: string;
  quota: string;
  is_hafiz_e_quran: boolean;
  gap_years: number;
  subject_combination: string[];
  fee_amount: number;
  fee_paid: boolean;
  fee_paid_at: string | null;
  submitted_at: string;
  updated_at: string;
  matric_board: string;
  matric_year: string;
  matric_obtained: number;
  matric_total: number;
  matric_group: string;
}

export default function TrackPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ application: Application; timeline: TimelineEntry[]; demo?: boolean } | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Enter your tracking token.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admissions/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Lookup failed.");
      setResult({ application: json.application, timeline: json.timeline ?? [], demo: json.demo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setToken("");
    setResult(null);
    setError(null);
  }

  return (
    <>
      <PageHeader
        kicker="Admissions · Track"
        title={<>Track your <span className="text-gold">application</span></>}
        lead="Enter your tracking token (issued when you submitted your application) to see the real-time status of your application, your timeline, and the next steps."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Track Application", href: "/admissions/track" },
        ]}
      />

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        {/* Search form */}
        {!result && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <form onSubmit={onSearch} className="space-y-4">
              <div>
                <Label htmlFor="token" className="text-sm font-semibold">Application Tracking Token *</Label>
                <div className="relative mt-1.5">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    placeholder="GHSS-2026-00123"
                    className="h-12 pl-10 font-mono tracking-wide"
                    autoComplete="off"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The token was issued on the final step of your application (e.g. <code className="rounded bg-secondary px-1 font-mono">GHSS-2026-00123</code>).
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-full font-semibold">
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Search className="mr-1.5 h-4 w-4" aria-hidden />}
                {loading ? "Looking up…" : "Track Application"}
              </Button>
            </form>

            <div className="mt-6 rounded-xl border border-gold/30 bg-gold-soft/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-strong">Demo Tokens</p>
              <p className="mt-1 text-xs text-muted-foreground">Try one of these sample tokens to preview the tracking experience:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["GHSS-2026-10001", "GHSS-2026-10002", "GHSS-2026-10003"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToken(t)}
                    className="rounded-md border border-border bg-card px-2 py-1 font-mono text-xs hover:border-gold"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Don&apos;t have a token yet?{" "}
              <Link href="/admissions/apply" className="font-semibold text-primary hover:underline">
                Apply online
              </Link>{" "}
              ·{" "}
              <Link href="/admissions" className="font-semibold text-primary hover:underline">
                Admission rules
              </Link>
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-5">
            {/* Status hero */}
            <div className={cn(
              "rounded-2xl border-2 p-6 sm:p-8",
              result.application.status === "admitted" ? "border-emerald-500/50 bg-emerald-500/5"
                : result.application.status === "offered" ? "border-gold/50 bg-gold-soft/20"
                : result.application.status === "rejected" ? "border-destructive/50 bg-destructive/5"
                : "border-border bg-card"
            )}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Application Status</p>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                    {STATUS_META[result.application.status].label}
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    {STATUS_META[result.application.status].desc}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tracking Token</p>
                  <p className="font-mono text-sm font-semibold tracking-wide">{result.application.application_no}</p>
                  {result.demo && (
                    <Badge variant="outline" className="mt-1 border-gold/40 text-gold-strong text-[10px]">DEMO</Badge>
                  )}
                </div>
              </div>

              {/* Status flow tracker */}
              <ol className="mt-6 grid grid-cols-4 gap-1 sm:grid-cols-8">
                {STATUS_FLOW.map((s, i) => {
                  const currentIdx = STATUS_FLOW.indexOf(result.application.status);
                  const done = i <= currentIdx && currentIdx >= 0;
                  const isCurrent = s === result.application.status;
                  return (
                    <li key={s} className="text-center">
                      <div className={cn(
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold",
                        isCurrent ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : done ? "bg-emerald-500 text-white"
                          : "bg-secondary text-muted-foreground"
                      )}>
                        {done && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <p className={cn("mt-1 text-[10px] leading-tight", isCurrent || done ? "text-foreground font-medium" : "text-muted-foreground/70")}>
                        {STATUS_META[s].label}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Application details */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Personal */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <User className="h-4 w-4 text-primary" /> Applicant Details
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Name" value={result.application.full_name} />
                  <Row label="Father" value={result.application.father_name} />
                  <Row label="Class" value={result.application.class_year} />
                  <Row label="Programme" value={PROGRAMME_LABEL[result.application.programme] ?? result.application.programme} />
                  <Row label="Quota" value={QUOTA_LABEL[result.application.quota] ?? result.application.quota} />
                  <Row label="Hafiz-e-Quran" value={result.application.is_hafiz_e_quran ? "Yes (+20 marks)" : "No"} />
                  {result.application.gap_years > 0 && (
                    <Row label="Gap Years" value={`${result.application.gap_years} year${result.application.gap_years === 1 ? "" : "s"} (-${result.application.gap_years * 5} marks)`} />
                  )}
                </dl>
              </div>

              {/* Academic + Fee */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <GraduationCap className="h-4 w-4 text-primary" /> Academic & Fee
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Matric Board" value={result.application.matric_board} />
                  <Row label="Matric Year" value={result.application.matric_year} />
                  <Row label="Matric Marks" value={`${result.application.matric_obtained} / ${result.application.matric_total} (${Math.round((result.application.matric_obtained / result.application.matric_total) * 1000) / 10}%)`} />
                  <Row label="Group" value={result.application.matric_group} />
                  <Row label="Subjects" value={`${result.application.subject_combination.length} subjects`} />
                  <Row label="Processing Fee" value={`Rs ${result.application.fee_amount}`} />
                  <Row
                    label="Fee Paid"
                    value={
                      result.application.fee_paid
                        ? `Yes · ${result.application.fee_paid_at ? new Date(result.application.fee_paid_at).toLocaleDateString("en-PK") : ""}`
                        : "Pending — pay at college office"
                    }
                  />
                </dl>
              </div>
            </div>

            {/* Subject combination */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <FileText className="h-4 w-4 text-primary" /> Subject Combination
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.application.subject_combination.map((s) => (
                  <Badge key={s} variant="outline" className="border-primary/30">{s}</Badge>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Clock className="h-4 w-4 text-primary" /> Status Timeline
              </h3>
              <ol className="mt-4 space-y-0">
                {result.timeline.length === 0 && (
                  <p className="text-sm text-muted-foreground">No status updates yet.</p>
                )}
                {result.timeline.map((t, i) => (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < result.timeline.length - 1 && (
                      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
                    )}
                    <span className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      i === result.timeline.length - 1 ? "bg-primary text-primary-foreground"
                        : "bg-emerald-500 text-white"
                    )}>
                      {i === result.timeline.length - 1 ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={STATUS_META[t.to_status].color}>
                          {STATUS_META[t.to_status].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        {t.actor_role && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            by {t.actor_role}
                          </span>
                        )}
                      </div>
                      {t.note && <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Next steps */}
            <div className="rounded-xl border-2 border-gold/40 bg-gold-soft/20 p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Award className="h-4 w-4 text-gold-strong" /> What happens next?
              </h3>
              <NextSteps status={result.application.status} feePaid={result.application.fee_paid} />
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={reset} variant="outline" className="h-11 rounded-full">
                <RefreshCw className="mr-1.5 h-4 w-4" /> Track another token
              </Button>
              <Button asChild className="h-11 rounded-full font-semibold">
                <Link href="/results/merit-list">
                  <ArrowRight className="mr-1.5 h-4 w-4" /> View Merit List
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function NextSteps({ status, feePaid }: { status: Status; feePaid: boolean }) {
  const steps: { title: string; desc: string; icon: typeof Wallet }[] = [];
  if (status === "received" && !feePaid) {
    steps.push({ title: "Pay Processing Fee", desc: "Take your token to the college office with Rs 100 cash per application. The cashier will record the payment and your status will update to 'Fee Paid'.", icon: Wallet });
  }
  if (status === "fee_paid" || status === "review" || status === "board_verified") {
    steps.push({ title: "Document Verification", desc: "Bring original CNIC/Form-B, matric certificate, domicile and 4 passport-size photos to the admission office between 9 AM – 1 PM, Mon–Sat.", icon: FileText });
  }
  if (status === "shortlisted") {
    steps.push({ title: "Watch the Merit List", desc: "The merit list will be published at /results/merit-list on the announced date. If your name appears, you'll be called for interview.", icon: Award });
  }
  if (status === "offered") {
    steps.push({ title: "Confirm Your Seat", desc: "Pay the admission fee (tuition + lab + library + exam = ~Rs 2,500) within 3 days to confirm your seat, otherwise it goes to the next candidate.", icon: Wallet });
  }
  if (status === "admitted") {
    steps.push({ title: "Welcome to GHSS Ghallanai!", desc: "Visit the college on the first day of session with your fee receipt. Classes begin as per the academic calendar.", icon: GraduationCap });
  }
  if (steps.length === 0) {
    steps.push({ title: "Await Update", desc: "Your application is being processed. You'll receive an SMS at the mobile number you registered. Check back here for the latest status.", icon: Clock });
  }
  return (
    <ol className="mt-3 space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold-strong">
            <s.icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{i + 1}. {s.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
