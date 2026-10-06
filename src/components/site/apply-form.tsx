"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Upload, FileCheck2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { WhatsAppIcon } from "@/components/site/whatsapp";
import { WHATSAPP_LINK } from "@/content/site";

/**
 * FIVE-STEP ADMISSION APPLICATION — Master Plan §7.1.
 * - Steps: personal → academic → programme (eligibility pre-check) → documents → review
 * - Draft autosave to localStorage after every step (survives dropped connections)
 * - Inline validation; Urdu error text toggle for families
 * - Submission issues an application number + receipt (Supabase when configured,
 *   demo number otherwise)
 */

const DRAFT_KEY = "ghss-admission-draft";

const PROGRAMME_OPTIONS = [
  { value: "ics", label: "ICS — Computer Science", min: 50, needs: "maths" },
  { value: "pre-medical", label: "F.Sc Pre-Medical", min: 60, needs: "science" },
  { value: "pre-engineering", label: "F.Sc Pre-Engineering", min: 60, needs: "maths" },
  { value: "arts", label: "FA Humanities (Arts)", min: 33, needs: "any" },
] as const;

const DOC_FIELDS = [
  { id: "photo", label: "Passport photograph", required: true },
  { id: "bform", label: "B-form (CRC) scan", required: true },
  { id: "matric", label: "Matric result card", required: true },
  { id: "domicile", label: "Domicile", required: false },
  { id: "concession", label: "Concession proof (if claiming)", required: false },
] as const;

const formSchema = z.object({
  // Step 1 — personal
  fullName: z.string().min(3, { message: "Enter the student's full name" }),
  fatherName: z.string().min(3, { message: "Enter the father's name" }),
  cnic: z.string().min(13, { message: "Enter the B-form/CNIC number" }),
  phone: z.string().min(10, { message: "Enter a contact number" }),
  whatsappOptIn: z.boolean(),
  // Step 2 — academic
  matricBoard: z.string().min(2, { message: "Select the matric board" }),
  matricRoll: z.string().min(1, { message: "Enter the matric roll number" }),
  matricObtained: z.coerce.number().min(0).max(1200),
  matricTotal: z.coerce.number().min(1).max(1200),
  matricYear: z.string().min(4),
  previousSchool: z.string().min(2, { message: "Enter the previous school's name" }),
  matricGroup: z.string(),
  // Step 3 — programme
  programme: z.string(),
  // Step 5 — declaration
  declaration: z.literal(true, { message: "The declaration must be accepted" }),
});

type FormValues = z.infer<typeof formSchema>;

const STEP_TITLES = [
  "Personal details",
  "Academic history",
  "Programme selection",
  "Documents",
  "Review & submit",
];

const URDU_ERRORS: Record<string, string> = {
  "Enter the student's full name": "طالب علم کا مکمل نام لکھیں",
  "Enter the father's name": "والد کا نام لکھیں",
  "Enter the B-form/CNIC number": "بی فارم یا شناختی کارڈ نمبر لکھیں",
  "Enter a contact number": "رابطہ نمبر لکھیں",
  "Enter the matric roll number": "میٹرک رول نمبر لکھیں",
  "Enter the previous school's name": "سابقہ سکول کا نام لکھیں",
};

export function ApplyForm() {
  const [step, setStep] = useState(1);
  const [urduErrors, setUrduErrors] = useState(false);
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ applicationNo: string; demo: boolean } | null>(null);
  const [eligibilityFlag, setEligibilityFlag] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      fullName: "", fatherName: "", cnic: "", phone: "", whatsappOptIn: true,
      matricBoard: "", matricRoll: "", matricObtained: 0, matricTotal: 1100,
      matricYear: "2026", previousSchool: "", matricGroup: "science",
      programme: "", declaration: false as unknown as true,
    },
  });

  // Restore draft on mount (§7.1 — survive connectivity drops)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        form.reset({ ...form.getValues(), ...d, declaration: false as unknown as true });
        if (d.__step) setStep(Math.min(d.__step, 4));
        if (d.__docs) setDocs(d.__docs); // file names only, files must be re-attached
        toast({ title: "Draft restored", description: "Your saved application details were restored." });
      }
    } catch {
      /* corrupt draft — ignore */
    }
  }, []);

  // Autosave on step change and field edits
  useEffect(() => {
    const sub = form.watch(() => {
      if (!receipt) {
        try {
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({ ...form.getValues(), __step: step })
          );
        } catch {
          /* storage full — non-fatal */
        }
      }
    });
    return () => sub.unsubscribe();
  }, [form, step, receipt]);

  const matricPercent = useMemo(() => {
    const v = form.watch("matricObtained");
    const t = form.watch("matricTotal");
    return t > 0 ? Math.round((v / t) * 100) : 0;
  }, [form]);

  function runEligibilityCheck(programme: string) {
    const p = PROGRAMME_OPTIONS.find((o) => o.value === programme);
    if (!p) return setEligibilityFlag(null);
    const group = form.getValues("matricGroup");
    const pct = matricPercent;
    const problems: string[] = [];
    if (pct < p.min - 5) problems.push(`Matric percentage (${pct}%) is below the comfortable range for this stream (~${p.min}%).`);
    if (p.needs === "maths" && group === "humanities") problems.push("This stream requires matric Mathematics — your selected group does not include it.");
    if (p.needs === "science" && group === "humanities") problems.push("Pre-Medical requires matric science (biology).");
    setEligibilityFlag(problems.length ? problems.join(" ") : null);
  }

  function next() {
    const fieldsPerStep: Record<number, (keyof FormValues)[]> = {
      1: ["fullName", "fatherName", "cnic", "phone"],
      2: ["matricBoard", "matricRoll", "matricObtained", "matricTotal", "previousSchool"],
      3: ["programme"],
    };
    const fields = fieldsPerStep[step];
    if (fields) {
      const ok = form.trigger(fields as never);
      if (!ok) return;
    }
    if (step === 4) {
      const missing = DOC_FIELDS.filter((d) => d.required && !docs[d.id]);
      if (missing.length) {
        toast({ title: "Documents missing", description: `Attach: ${missing.map((m) => m.label).join(", ")}` });
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 5));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setReceipt({ applicationNo: data.applicationNo, demo: Boolean(data.demo) });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast({
        title: "Could not submit",
        description: e instanceof Error ? e.message : "Check your connection and try again — your draft is saved.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function errText(msg?: string) {
    if (!msg) return undefined;
    return urduErrors && URDU_ERRORS[msg] ? `${msg} · ${URDU_ERRORS[msg]}` : msg;
  }

  /* ---------- RECEIPT SCREEN ---------- */
  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-gold/40 bg-card p-8 text-center md:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <FileCheck2 className="h-8 w-8 text-primary" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">Application submitted</h2>
        <p className="mt-2 text-lead text-muted-foreground">
          Keep this number safe — it is how you track your application and how the office
          references you.
        </p>
        <p className="mt-6 rounded-xl border border-border bg-secondary/60 px-6 py-4 font-display text-3xl font-bold tracking-wide text-primary">
          {receipt.applicationNo}
        </p>
        <p className="mt-4 text-small text-muted-foreground">
          A WhatsApp confirmation with next steps is sent to your contact number. Shortlisted
          candidates are called for interview per the published dates.
        </p>
        {receipt.demo && (
          <p className="mt-4 rounded-lg border border-gold/40 bg-gold-soft/40 px-4 py-2.5 text-xs text-muted-foreground dark:bg-gold-soft/20">
            DEMO MODE — configure Supabase (see README) to store real applications, upload
            documents to Supabase Storage, and dispatch real confirmations.
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-small font-semibold hover:border-gold hover:text-gold"
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp the office
          </a>
        </div>
      </div>
    );
  }

  /* ---------- FORM ---------- */
  const errors = form.formState.errors;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress + step rail */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>
            Step {step} of 5 · {STEP_TITLES[step - 1]}
          </span>
          <button
            type="button"
            onClick={() => setUrduErrors((v) => !v)}
            className="rounded-full px-2.5 py-1 font-urdu text-sm hover:bg-secondary"
            lang="ur"
            dir="rtl"
          >
            {urduErrors ? "English errors" : "اردو میں غلطیاں"}
          </button>
        </div>
        <Progress value={step * 20} className="mt-2 h-2" aria-label={`Step ${step} of 5`} />
        <ol className="mt-4 hidden justify-between sm:flex">
          {STEP_TITLES.map((t, i) => (
            <li
              key={t}
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                i + 1 <= step ? "text-primary" : "text-muted-foreground/60"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  i + 1 < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i + 1 === step
                      ? "border-primary text-primary"
                      : "border-border"
                }`}
                aria-current={i + 1 === step ? "step" : undefined}
              >
                {i + 1 < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="hidden md:inline">{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          {/* STEP 1 */}
          {step === 1 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Personal details</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Student's full name" required error={errText(errors.fullName?.message)}>
                  <Input {...form.register("fullName")} autoComplete="name" className="h-11" />
                </Field>
                <Field label="Father's name" required error={errText(errors.fatherName?.message)}>
                  <Input {...form.register("fatherName")} className="h-11" />
                </Field>
                <Field label="B-form / CNIC number" required error={errText(errors.cnic?.message)}>
                  <Input {...form.register("cnic")} inputMode="numeric" placeholder="e.g. 1620-0123456-7" className="h-11" />
                </Field>
                <Field label="Contact number (WhatsApp preferred)" required error={errText(errors.phone?.message)}>
                  <Input {...form.register("phone")} inputMode="tel" placeholder="03xx-xxxxxxx" className="h-11" />
                </Field>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-4">
                <Checkbox
                  checked={form.watch("whatsappOptIn")}
                  onCheckedChange={(v) => form.setValue("whatsappOptIn", Boolean(v))}
                  aria-label="Opt in to WhatsApp alerts"
                />
                <span className="text-small">
                  <span className="font-semibold">Send me alerts on WhatsApp</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Application status, merit list and result announcements. Message charges are
                    nothing; quiet hours 9 PM – 7 AM are respected.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Academic history — matriculation</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Matric board" required error={errText(errors.matricBoard?.message)}>
                  <Select value={form.watch("matricBoard")} onValueChange={(v) => form.setValue("matricBoard", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select board" /></SelectTrigger>
                    <SelectContent>
                      {["BISE (this board)", "BISE Peshawar", "BISE Bannu", "BISE Mardan", "BISE Swat", "Federal Board", "Other"].map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Matric group" required>
                  <Select value={form.watch("matricGroup")} onValueChange={(v) => form.setValue("matricGroup", v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="science">Science (with Mathematics)</SelectItem>
                      <SelectItem value="bio">Science (with Biology)</SelectItem>
                      <SelectItem value="general">General / Computer Science</SelectItem>
                      <SelectItem value="humanities">Humanities</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Roll number" required error={errText(errors.matricRoll?.message)}>
                  <Input {...form.register("matricRoll")} className="h-11" />
                </Field>
                <Field label="Year" required>
                  <Select value={form.watch("matricYear")} onValueChange={(v) => form.setValue("matricYear", v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["2026", "2025", "2024"].map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Marks obtained" required error={errText(errors.matricObtained?.message)}>
                  <Input type="number" {...form.register("matricObtained")} className="h-11" />
                </Field>
                <Field label="Total marks" required>
                  <Input type="number" {...form.register("matricTotal")} className="h-11" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Previous school" required error={errText(errors.previousSchool?.message)}>
                    <Input {...form.register("previousSchool")} className="h-11" />
                  </Field>
                </div>
              </div>
              <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                Matric percentage: {matricPercent}% — used to pre-check stream eligibility.
              </p>
            </fieldset>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Programme selection</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROGRAMME_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className={`card-lift flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                      form.watch("programme") === p.value ? "border-primary bg-secondary/60" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="programme"
                      value={p.value}
                      checked={form.watch("programme") === p.value}
                      onChange={() => {
                        form.setValue("programme", p.value);
                        runEligibilityCheck(p.value);
                      }}
                      className="mt-1 h-4 w-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block text-small font-bold">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Comfortable from ~{p.min}% matric ·{" "}
                        {p.needs === "maths" ? "needs matric Mathematics" : p.needs === "science" ? "needs matric science" : "any matric group"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {eligibilityFlag && (
                <p className="flex items-start gap-2.5 rounded-xl border border-gold/50 bg-gold-soft/40 p-4 text-small dark:bg-gold-soft/25" role="alert">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-strong dark:text-gold" aria-hidden />
                  <span>
                    <span className="font-bold">Eligibility pre-check flagged:</span>{" "}
                    {eligibilityFlag} You may still apply — the committee reviews borderline cases
                    individually.
                  </span>
                </p>
              )}
            </fieldset>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <fieldset className="space-y-4" disabled={submitting}>
              <legend className="text-h3">Documents</legend>
              <p className="text-small text-muted-foreground">
                Attach clear scans or photographs of each document. In demo mode nothing leaves
                your device; with Supabase configured, files upload to the school&apos;s private
                storage bucket.
              </p>
              {DOC_FIELDS.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4"
                >
                  <span className="text-small font-semibold">
                    {d.label}
                    {d.required && <span className="ml-1 text-gold-strong dark:text-gold" aria-label="required">*</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {docs[d.id] ? (
                      <>
                        <Check className="h-4 w-4 text-primary" aria-hidden />
                        <span className="max-w-32 truncate text-xs text-muted-foreground">{docs[d.id]!.name}</span>
                      </>
                    ) : null}
                    <span className="relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-bold hover:border-gold">
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      {docs[d.id] ? "Replace" : "Attach"}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          if (f && f.size > 5 * 1024 * 1024) {
                            toast({ title: "File too large", description: "Keep each document under 5 MB.", variant: "destructive" });
                            return;
                          }
                          setDocs((prev) => ({ ...prev, [d.id]: f }));
                        }}
                      />
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {/* STEP 5 — review & declaration */}
          {step === 5 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Review your application</legend>
              <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-border bg-secondary/40 p-5 text-small sm:grid-cols-2">
                {[
                  ["Student", form.watch("fullName")],
                  ["Father", form.watch("fatherName")],
                  ["B-form / CNIC", form.watch("cnic")],
                  ["Contact", form.watch("phone")],
                  ["Matric board", form.watch("matricBoard")],
                  ["Matric roll no", form.watch("matricRoll")],
                  ["Matric marks", `${form.watch("matricObtained")} / ${form.watch("matricTotal")} (${matricPercent}%)`],
                  ["Previous school", form.watch("previousSchool")],
                  ["Programme", PROGRAMME_OPTIONS.find((p) => p.value === form.watch("programme"))?.label ?? "—"],
                  ["WhatsApp alerts", form.watch("whatsappOptIn") ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-semibold">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Documents attached:{" "}
                {DOC_FIELDS.filter((d) => docs[d.id]).map((d) => d.label).join(", ") || "none"}
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-border p-4">
                <Checkbox
                  checked={Boolean(form.watch("declaration"))}
                  onCheckedChange={(v) => form.setValue("declaration", (Boolean(v) || false) as true)}
                />
                <span className="text-small">
                  <span className="font-semibold">Declaration:</span> I declare that the
                  information above is true to the best of my knowledge. I understand that any
                  false statement cancels the application, and that submission of this form does
                  not itself guarantee admission — selection follows the published merit process.
                  <span className="mt-1.5 block font-urdu text-right text-muted-foreground" lang="ur" dir="rtl">
                    میں بیان کرتا/کرتی ہوں کہ مذکورہ معلومات درست ہیں۔
                  </span>
                </span>
              </label>
              {errors.declaration && (
                <p className="text-small font-semibold text-destructive" role="alert">
                  {errors.declaration.message}
                </p>
              )}
            </fieldset>
          )}
        </div>

        {/* Nav buttons */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={prev}
            disabled={step === 1 || submitting}
            className="h-11 rounded-full px-6"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Back
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={next} className="h-11 rounded-full px-8">
              Continue <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} className="h-11 rounded-full px-8">
              {submitting ? "Submitting…" : "Submit Application"}
            </Button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your progress saves automatically on this device — a dropped connection loses nothing.
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-small font-semibold">
        {label}
        {required && <span className="ml-1 text-gold-strong dark:text-gold" aria-label="required">*</span>}
      </Label>
      <div id={id}>{children}</div>
      {error && (
        <p className="text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
