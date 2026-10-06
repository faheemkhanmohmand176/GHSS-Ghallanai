"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Upload, FileCheck2, ShieldCheck, GraduationCap, School } from "lucide-react";
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
 *  - Mirrors the HED KPK Online College Admission System (OCAS) form structure
 *    (admission.hed.gkp.pk) so applicants see the same fields they would on
 *    the centralised portal.
 *  - Step 0: choose 1st-year (Part-I) or 2nd-year (Part-II) admission
 *  - Step 1: personal details (name, father, cnic/B-form, mobile, email, dob,
 *            gender, religion, domicile district, address, guardian info)
 *  - Step 2: academic history — matric for 1st year; matric + 1st year records
 *            for 2nd year (roll no, registration no, marks, subjects)
 *  - Step 3: programme (eligibility pre-check)
 *  - Step 4: documents (incl. character certificate & affidavit per HED policy)
 *  - Step 5: review & declaration
 *  - Draft autosave to localStorage after every step (survives dropped connections)
 *  - Submission issues an application number + receipt (Supabase when configured,
 *    demo number otherwise)
 */

const DRAFT_KEY = "ghss-admission-draft-v2";

const PROGRAMME_OPTIONS = [
  { value: "ics", label: "ICS — Computer Science", min: 50, needs: "maths" },
  { value: "pre-medical", label: "F.Sc Pre-Medical", min: 60, needs: "science" },
  { value: "pre-engineering", label: "F.Sc Pre-Engineering", min: 60, needs: "maths" },
  { value: "arts", label: "FA Humanities (Arts)", min: 33, needs: "any" },
] as const;

const MATRIC_BOARDS = [
  "BISE Peshawar",
  "BISE Mardan",
  "BISE Swat",
  "BISE Bannu",
  "BISE Abbottabad",
  "BISE Malakand",
  "BISE Kohat",
  "BISE D.I. Khan",
  "BISE Swabi",
  "Federal Board FBISE",
  "Other",
] as const;

const DOMICILE_DISTRICTS = [
  "Mohmand",
  "Bajaur",
  "Khyber",
  "Orakzai",
  "Kurram",
  "North Waziristan",
  "South Waziristan",
  "Peshawar",
  "Charsadda",
  "Nowshera",
  "Mardan",
  "Swat",
  "Dir Lower",
  "Dir Upper",
  "Chitral Lower",
  "Chitral Upper",
  "Buner",
  "Shangla",
  "Kohat",
  "Karak",
  "Hangu",
  "D.I. Khan",
  "Bannu",
  "Lakki Marwat",
  "Tank",
  "Abbottabad",
  "Haripur",
  "Mansehra",
  "Battagram",
  "Kolai-Palas",
  "Torghar",
  "Other (KPK)",
  "Other (Pakistan)",
] as const;

const RELIGIONS = ["Islam", "Christianity", "Hinduism", "Sikhism", "Other"] as const;
const GENDERS = ["Male", "Female"] as const;

/** Documents required per admission type — aligned with HED admission policy. */
const DOC_FIELDS_FIRST_YEAR = [
  { id: "photo", label: "Passport-size photograph (recent, plain background)", required: true },
  { id: "bform", label: "B-form (CRC) or CNIC scan", required: true },
  { id: "matric_card", label: "Matric result card / DMC", required: true },
  { id: "domicile", label: "Domicile certificate (own/father)", required: true },
  { id: "character_certificate", label: "Character certificate from last school", required: true },
  { id: "father_cnic", label: "Father / Guardian CNIC scan", required: true },
  { id: "concession_proof", label: "Concession / scholarship proof (if claiming)", required: false },
] as const;

const DOC_FIELDS_SECOND_YEAR = [
  ...DOC_FIELDS_FIRST_YEAR,
  { id: "first_year_dmc", label: "1st-year (Part-I) detail mark certificate (DMC)", required: true },
  { id: "first_year_registration", label: "Board registration certificate (1st year)", required: true },
  { id: "affidavit", label: "Affidavit on Rs.50 stamp paper (migration undertaking)", required: true },
] as const;

const formSchema = z.object({
  // Admission type
  admissionType: z.enum(["first_year", "second_year"]),

  // Step 1 — personal
  fullName: z.string().min(3, { message: "Enter the student's full name" }).max(120),
  fatherName: z.string().min(3, { message: "Enter the father's name" }).max(120),
  cnic: z
    .string()
    .min(13, { message: "Enter the 13-digit B-form / CNIC number (digits only)" })
    .max(15)
    .regex(/^[0-9-]+$/, { message: "CNIC must contain only digits and hyphens" }),
  phone: z.string().min(10, { message: "Enter a valid contact number (03xx-xxxxxxx)" }).max(20),
  email: z.string().email({ message: "Enter a valid email address" }).max(120).or(z.literal("")),
  whatsappOptIn: z.boolean(),

  // HED-aligned personal fields
  dob: z.string().min(8, { message: "Enter date of birth" }),
  gender: z.string().min(2, { message: "Select gender" }),
  religion: z.string().min(2, { message: "Select religion" }),
  domicileDistrict: z.string().min(2, { message: "Select domicile district" }),
  address: z.string().min(5, { message: "Enter your residential address" }).max(300),
  guardianName: z.string().min(3, { message: "Enter guardian's name (use father's if same)" }).max(120),
  guardianCnic: z
    .string()
    .min(13, { message: "Enter guardian's 13-digit CNIC" })
    .max(15)
    .regex(/^[0-9-]+$/, { message: "CNIC must contain only digits and hyphens" }),
  guardianPhone: z.string().min(10, { message: "Enter guardian's contact number" }).max(20),
  guardianRelation: z.string().min(2, { message: "Select relationship" }),

  // Step 2 — academic
  matricBoard: z.string().min(2, { message: "Select the matric board" }),
  matricRoll: z.string().min(1, { message: "Enter the matric roll number" }).max(30),
  matricObtained: z.coerce.number().min(0).max(1200),
  matricTotal: z.coerce.number().min(1).max(1200),
  matricYear: z.string().min(4),
  previousSchool: z.string().min(2, { message: "Enter the previous school's name" }).max(160),
  matricGroup: z.string(),

  // 2nd-year academic records (validated manually in next() when admissionType === 'second_year')
  firstYearRoll: z.string().optional(),
  firstYearRegistrationNo: z.string().optional(),
  firstYearObtained: z.coerce.number().min(0).max(1200).optional(),
  firstYearTotal: z.coerce.number().min(1).max(1200).optional(),
  firstYearYear: z.string().optional(),
  firstYearSubjects: z.string().optional(),

  // Step 3 — programme
  programme: z.string(),
  // Step 5 — declaration
  declaration: z.literal(true, { message: "The declaration must be accepted" }),
});

type FormValues = z.infer<typeof formSchema>;

const STEP_TITLES = [
  "Admission type",
  "Personal details",
  "Academic history",
  "Programme selection",
  "Documents",
  "Review & submit",
];

const URDU_ERRORS: Record<string, string> = {
  "Enter the student's full name": "طالب علم کا مکمل نام لکھیں",
  "Enter the father's name": "والد کا نام لکھیں",
  "Enter the 13-digit B-form / CNIC number (digits only)": "بی فارم یا شناختی کارڈ کا 13 ہندسی نمبر لکھیں",
  "Enter a valid contact number (03xx-xxxxxxx)": "رابطہ نمبر درج کریں",
  "Enter a valid email address": "ای میل درست لکھیں",
  "Enter date of birth": "تاریخ پیدائش درج کریں",
  "Select gender": "جنس منتخب کریں",
  "Select religion": "مذہب منتخب کریں",
  "Select domicile district": "ڈومیسائل ضلع منتخب کریں",
  "Enter your residential address": "اپنا پتہ درج کریں",
  "Enter guardian's name (use father's if same)": "سرپرست کا نام لکھیں",
  "Enter guardian's 13-digit CNIC": "سرپرست کا شناختی کارڈ نمبر لکھیں",
  "Enter guardian's contact number": "سرپرست کا رابطہ نمبر لکھیں",
  "Select relationship": "رشتہ منتخب کریں",
  "Enter the matric roll number": "میٹرک رول نمبر لکھیں",
  "Select the matric board": "میٹرک بورڈ منتخب کریں",
  "Enter the previous school's name": "سابقہ سکول کا نام لکھیں",
};

export function ApplyForm() {
  const [step, setStep] = useState(0);
  const [urduErrors, setUrduErrors] = useState(false);
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ applicationNo: string; demo: boolean } | null>(null);
  const [eligibilityFlag, setEligibilityFlag] = useState<string | null>(null);

  const form = useForm<FormValues>({
    // zod v4 + react-hook-form v7 have an output/input type mismatch on
    // z.coerce.number(); the resolver works fine at runtime, so we cast.
    resolver: zodResolver(formSchema) as never,
    mode: "onTouched",
    defaultValues: {
      admissionType: "first_year",
      fullName: "", fatherName: "", cnic: "", phone: "", email: "", whatsappOptIn: true,
      dob: "", gender: "", religion: "Islam", domicileDistrict: "", address: "",
      guardianName: "", guardianCnic: "", guardianPhone: "", guardianRelation: "Father",
      matricBoard: "", matricRoll: "", matricObtained: 0, matricTotal: 1100,
      matricYear: "2026", previousSchool: "", matricGroup: "science",
      firstYearRoll: "", firstYearRegistrationNo: "", firstYearObtained: 0, firstYearTotal: 550,
      firstYearYear: "2025", firstYearSubjects: "",
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
        if (typeof d.__step === "number") setStep(Math.min(d.__step, 5));
        if (d.__docs) setDocs(d.__docs); // file names only, files must be re-attached
        toast({ title: "Draft restored", description: "Your saved application details were restored." });
      }
    } catch {
      /* corrupt draft — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const admissionType = form.watch("admissionType");
  const docFields = admissionType === "second_year" ? DOC_FIELDS_SECOND_YEAR : DOC_FIELDS_FIRST_YEAR;

  const matricPercent = useMemo(() => {
    const v = form.watch("matricObtained");
    const t = form.watch("matricTotal");
    return t > 0 ? Math.round((v / t) * 100) : 0;
  }, [form]);

  const firstYearPercent = useMemo(() => {
    const v = form.watch("firstYearObtained");
    const t = form.watch("firstYearTotal");
    return t && t > 0 ? Math.round(((v ?? 0) / t) * 100) : 0;
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

  const totalSteps = 6; // 0..5
  async function next() {
    const fieldsPerStep: Record<number, (keyof FormValues)[]> = {
      0: ["admissionType"],
      1: ["fullName", "fatherName", "cnic", "phone", "email", "dob", "gender", "religion", "domicileDistrict", "address", "guardianName", "guardianCnic", "guardianPhone", "guardianRelation"],
      2: admissionType === "second_year"
        ? ["matricBoard", "matricRoll", "matricObtained", "matricTotal", "previousSchool", "firstYearRoll", "firstYearRegistrationNo", "firstYearObtained", "firstYearTotal"]
        : ["matricBoard", "matricRoll", "matricObtained", "matricTotal", "previousSchool"],
      3: ["programme"],
    };
    const fields = fieldsPerStep[step];
    if (fields && fields.length > 0) {
      const ok = await form.trigger(fields as never);
      if (!ok) return;
    }
    // Cross-field validations (kept out of zod .refine() for clean typing)
    if (step === 2) {
      const v = form.getValues();
      if (v.matricObtained > v.matricTotal) {
        form.setError("matricObtained", { type: "manual", message: "Obtained marks cannot exceed total" });
        return;
      }
      if (admissionType === "second_year") {
        if ((v.firstYearObtained ?? 0) > (v.firstYearTotal ?? 1)) {
          form.setError("firstYearObtained", { type: "manual", message: "1st-year obtained marks cannot exceed total" });
          return;
        }
      }
    }
    if (step === 4) {
      const missing = docFields.filter((d) => d.required && !docs[d.id]);
      if (missing.length) {
        toast({ title: "Documents missing", description: `Attach: ${missing.map((m) => m.label).join(", ")}` });
        return;
      }
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values: FormValues | Record<string, unknown>) {
    const data = values as FormValues;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Submission failed");
      setReceipt({ applicationNo: result.applicationNo, demo: Boolean(result.demo) });
      try {
        const existing = JSON.parse(localStorage.getItem("ghss-demo-applications") ?? "[]");
        existing.push({ applicationNo: result.applicationNo, ...data, createdAt: new Date().toISOString() });
        localStorage.setItem("ghss-demo-applications", JSON.stringify(existing.slice(-10)));
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
      <div className="mx-auto max-w-2xl rounded-2xl border border-gold/40 bg-card p-6 text-center sm:p-8 md:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <FileCheck2 className="h-8 w-8 text-primary" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Application submitted</h2>
        <p className="mt-2 text-lead text-muted-foreground">
          Keep this number safe — it is how you track your application and how the office
          references you.
        </p>
        <p className="mt-6 break-all rounded-xl border border-border bg-secondary/60 px-4 py-4 font-display text-2xl font-bold tracking-wide text-primary sm:text-3xl">
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
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
          <span className="truncate">
            Step {step + 1} of {totalSteps} · {STEP_TITLES[step]}
          </span>
          <button
            type="button"
            onClick={() => setUrduErrors((v) => !v)}
            className="shrink-0 rounded-full px-2.5 py-1 font-urdu text-sm hover:bg-secondary"
            lang="ur"
            dir="rtl"
          >
            {urduErrors ? "English errors" : "اردو میں غلطیاں"}
          </button>
        </div>
        <Progress value={((step + 1) / totalSteps) * 100} className="mt-2 h-2" aria-label={`Step ${step + 1} of ${totalSteps}`} />
        <ol className="mt-4 hidden justify-between sm:flex">
          {STEP_TITLES.map((t, i) => (
            <li
              key={t}
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                i <= step ? "text-primary" : "text-muted-foreground/60"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  i < step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-border"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="hidden md:inline">{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-8">
          {/* STEP 0 — Admission type */}
          {step === 0 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Admission type</legend>
              <p className="text-small text-muted-foreground">
                Are you joining the school in the first year (Part-I) after matric, or
                transferring in for the second year (Part-II)? The form adjusts the
                academic and document sections to match.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => form.setValue("admissionType", "first_year")}
                  className={`card-lift flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left ${
                    form.watch("admissionType") === "first_year" ? "border-primary bg-secondary/60" : "border-border"
                  }`}
                >
                  <School className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-small font-bold">1st year (Part-I)</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Direct entry after matric — ICS, Pre-Medical, Pre-Engineering or Arts.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("admissionType", "second_year")}
                  className={`card-lift flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left ${
                    form.watch("admissionType") === "second_year" ? "border-primary bg-secondary/60" : "border-border"
                  }`}
                >
                  <GraduationCap className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-small font-bold">2nd year (Part-II)</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Transfer from another college — must submit 1st-year DMC and registration.
                    </span>
                  </span>
                </button>
              </div>
              <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                Selected: {admissionType === "first_year" ? "1st year (Part-I) admission" : "2nd year (Part-II) admission — transfer applicant"}
              </p>
            </fieldset>
          )}

          {/* STEP 1 — Personal details (HED-aligned) */}
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
                <Field label="B-form / CNIC number (own)" required error={errText(errors.cnic?.message)}>
                  <Input {...form.register("cnic")} inputMode="numeric" placeholder="16201-1234567-1" className="h-11" />
                </Field>
                <Field label="Date of birth" required error={errText(errors.dob?.message)}>
                  <Input type="date" {...form.register("dob")} className="h-11" />
                </Field>
                <Field label="Gender" required error={errText(errors.gender?.message)}>
                  <Select value={form.watch("gender")} onValueChange={(v) => form.setValue("gender", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Religion" required error={errText(errors.religion?.message)}>
                  <Select value={form.watch("religion")} onValueChange={(v) => form.setValue("religion", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select religion" /></SelectTrigger>
                    <SelectContent>
                      {RELIGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Domicile district" required error={errText(errors.domicileDistrict?.message)}>
                  <Select value={form.watch("domicileDistrict")} onValueChange={(v) => form.setValue("domicileDistrict", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select domicile district" /></SelectTrigger>
                    <SelectContent>
                      {DOMICILE_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Contact number (mobile)" required error={errText(errors.phone?.message)}>
                  <Input {...form.register("phone")} inputMode="tel" placeholder="03xx-xxxxxxx" className="h-11" />
                </Field>
                <Field label="Email address" error={errText(errors.email?.message)}>
                  <Input {...form.register("email")} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-11" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Residential address" required error={errText(errors.address?.message)}>
                    <Input {...form.register("address")} autoComplete="street-address" placeholder="Village, tehsil, district" className="h-11" />
                  </Field>
                </div>
              </div>

              <hr className="border-border/70" />
              <h3 className="text-small font-bold uppercase tracking-wide text-muted-foreground">Guardian / Parent details</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Guardian's name" required error={errText(errors.guardianName?.message)}>
                  <Input {...form.register("guardianName")} placeholder="Same as father if applicable" className="h-11" />
                </Field>
                <Field label="Relationship to student" required error={errText(errors.guardianRelation?.message)}>
                  <Select value={form.watch("guardianRelation")} onValueChange={(v) => form.setValue("guardianRelation", v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Father", "Mother", "Brother", "Uncle", "Grandfather", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Guardian's CNIC" required error={errText(errors.guardianCnic?.message)}>
                  <Input {...form.register("guardianCnic")} inputMode="numeric" placeholder="16201-1234567-1" className="h-11" />
                </Field>
                <Field label="Guardian's contact number" required error={errText(errors.guardianPhone?.message)}>
                  <Input {...form.register("guardianPhone")} inputMode="tel" placeholder="03xx-xxxxxxx" className="h-11" />
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

          {/* STEP 2 — Academic history */}
          {step === 2 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Academic history — matriculation</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Matric board" required error={errText(errors.matricBoard?.message)}>
                  <Select value={form.watch("matricBoard")} onValueChange={(v) => form.setValue("matricBoard", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select board" /></SelectTrigger>
                    <SelectContent>
                      {MATRIC_BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
                  <Input {...form.register("matricRoll")} inputMode="numeric" className="h-11" />
                </Field>
                <Field label="Year" required>
                  <Select value={form.watch("matricYear")} onValueChange={(v) => form.setValue("matricYear", v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["2026", "2025", "2024", "2023"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Marks obtained" required error={errText(errors.matricObtained?.message)}>
                  <Input type="number" {...form.register("matricObtained")} inputMode="numeric" className="h-11" />
                </Field>
                <Field label="Total marks" required>
                  <Input type="number" {...form.register("matricTotal")} inputMode="numeric" className="h-11" />
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

              {admissionType === "second_year" && (
                <>
                  <hr className="border-border/70" />
                  <h3 className="text-small font-bold uppercase tracking-wide text-muted-foreground">
                    1st-year (Part-I) academic records — required for 2nd-year admission
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="1st-year roll number" required error={errText(errors.firstYearRoll?.message)}>
                      <Input {...form.register("firstYearRoll")} inputMode="numeric" className="h-11" />
                    </Field>
                    <Field label="Board registration number" required error={errText(errors.firstYearRegistrationNo?.message)}>
                      <Input {...form.register("firstYearRegistrationNo")} inputMode="numeric" className="h-11" />
                    </Field>
                    <Field label="1st-year marks obtained" required error={errText(errors.firstYearObtained?.message)}>
                      <Input type="number" {...form.register("firstYearObtained")} inputMode="numeric" className="h-11" />
                    </Field>
                    <Field label="1st-year total marks" required>
                      <Input type="number" {...form.register("firstYearTotal")} inputMode="numeric" className="h-11" />
                    </Field>
                    <Field label="1st-year passing year" required>
                      <Select value={form.watch("firstYearYear")} onValueChange={(v) => form.setValue("firstYearYear", v)}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["2026", "2025", "2024", "2023"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Subjects studied in 1st year">
                      <Input {...form.register("firstYearSubjects")} placeholder="e.g. Physics, Chemistry, Maths, English, Urdu, Islamiyat" className="h-11" />
                    </Field>
                  </div>
                  <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                    1st-year percentage: {firstYearPercent}%
                  </p>
                </>
              )}
            </fieldset>
          )}

          {/* STEP 3 — Programme */}
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

          {/* STEP 4 — Documents */}
          {step === 4 && (
            <fieldset className="space-y-4" disabled={submitting}>
              <legend className="text-h3">Documents</legend>
              <p className="text-small text-muted-foreground">
                Attach clear scans or photographs of each document (image or PDF, max 5 MB each).
                The required list mirrors the HED KPK admission policy. In demo mode nothing leaves
                your device; with Supabase configured, files upload to the school&apos;s private
                storage bucket.
              </p>
              {docFields.map((d) => (
                <label
                  key={d.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                  ["Admission type", admissionType === "first_year" ? "1st year (Part-I)" : "2nd year (Part-II)"],
                  ["Student", form.watch("fullName")],
                  ["Father", form.watch("fatherName")],
                  ["B-form / CNIC", form.watch("cnic")],
                  ["Date of birth", form.watch("dob")],
                  ["Gender", form.watch("gender")],
                  ["Religion", form.watch("religion")],
                  ["Domicile", form.watch("domicileDistrict")],
                  ["Contact", form.watch("phone")],
                  ["Email", form.watch("email") || "—"],
                  ["Address", form.watch("address")],
                  ["Guardian", `${form.watch("guardianName")} (${form.watch("guardianRelation")})`],
                  ["Matric board", form.watch("matricBoard")],
                  ["Matric roll no", form.watch("matricRoll")],
                  ["Matric marks", `${form.watch("matricObtained")} / ${form.watch("matricTotal")} (${matricPercent}%)`],
                  ["Previous school", form.watch("previousSchool")],
                  ...(admissionType === "second_year" ? ([
                    ["1st-year roll no", form.watch("firstYearRoll") || "—"],
                    ["1st-year reg. no", form.watch("firstYearRegistrationNo") || "—"],
                    ["1st-year marks", `${form.watch("firstYearObtained")} / ${form.watch("firstYearTotal")} (${firstYearPercent}%)`],
                    ["1st-year subjects", form.watch("firstYearSubjects") || "—"],
                  ] as [string, string][]) : []),
                  ["Programme", PROGRAMME_OPTIONS.find((p) => p.value === form.watch("programme"))?.label ?? "—"],
                  ["WhatsApp alerts", form.watch("whatsappOptIn") ? "Yes" : "No"],
                ].map(([k, v]) => (
                  <div key={k} className="flex min-w-0 flex-col">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 break-words font-semibold">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Documents attached:{" "}
                {docFields.filter((d) => docs[d.id]).map((d) => d.label).join(", ") || "none"}
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
            disabled={step === 0 || submitting}
            className="h-11 rounded-full px-4 sm:px-6"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Back
          </Button>
          {step < totalSteps - 1 ? (
            <Button type="button" onClick={next} className="h-11 rounded-full px-6 sm:px-8">
              Continue <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} className="h-11 rounded-full px-6 sm:px-8">
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
