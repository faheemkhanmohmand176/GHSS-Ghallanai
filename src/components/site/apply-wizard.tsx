"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  UserCircle2, ShieldCheck, GraduationCap, FileCheck2, Send, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Hash, Loader2, Copy, RefreshCw, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Nationality = "Pakistani" | "Afghani";
type Gender = "Male" | "Female" | "Other";
type Programme = "ics" | "pre-medical" | "pre-engineering" | "arts";
type ClassYear = "1st Year" | "2nd Year";
type Quota =
  | "open_merit" | "local" | "employee" | "sports"
  | "special_person" | "minority" | "afghan" | "meritorious";

const PROGRAMME_INFO: Record<Programme, { label: string; tagline: string }> = {
  "ics": { label: "ICS — Computer Science", tagline: "For future software engineers, data scientists and IT professionals" },
  "pre-medical": { label: "FSc Pre-Medical", tagline: "The path to MBBS, BDS, pharmacy and the life sciences" },
  "pre-engineering": { label: "FSc Pre-Engineering", tagline: "Foundation for engineering, architecture and the physical sciences" },
  "arts": { label: "FA Humanities", tagline: "Civics, education and history — for civil servants, teachers and lawyers" },
};

const QUOTA_INFO: Record<Quota, { label: string; desc: string; percent: string }> = {
  open_merit: { label: "Open Merit", desc: "Pakistani citizens on merit basis — 40% of seats", percent: "40%" },
  local: { label: "Local Quota", desc: "Domiciled in Mohmand / parent serving in district — 45% of seats", percent: "45%" },
  employee: { label: "College Employee", desc: "Children of in-service or retired HED KPK staff — 6%", percent: "6%" },
  sports: { label: "Sports Quota", desc: "Provincial sports quota — 5% (certificate + trial marks)", percent: "5%" },
  special_person: { label: "Special Person", desc: "Disability certificate required — 2%", percent: "2%" },
  minority: { label: "Minority", desc: "Provincial minority quota — 2%", percent: "2%" },
  afghan: { label: "Afghan Quota", desc: "Afghan citizens with NOC from Afghan Commissionerate — 1 seat per faculty", percent: "1 seat" },
  meritorious: { label: "Meritorious", desc: "10% of seats held 15 days for provincial meritorious candidates", percent: "10%" },
};

const STORAGE_KEY = "ghss-apply-2026-27";

interface FormData {
  // Step 1
  nationality: Nationality;
  cnic: string;
  afghanCard: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  mathCaptcha: string;
  // Step 2
  matricBoard: string;
  matricRoll: string;
  matricYear: string;
  matricTotal: string;
  matricObtained: string;
  matricGroup: string;
  matricPercentage: number;
  boardVerified: boolean;
  // Step 3
  fullName: string;
  fatherName: string;
  fatherCnic: string;
  dob: string;
  gender: Gender;
  domicileDistrict: string;
  permanentAddress: string;
  mailingAddress: string;
  // Step 4
  classYear: ClassYear;
  programme: Programme;
  quota: Quota;
  isHafizEQuran: boolean;
  gapYears: string;
  subjectCombo: string[];
  declaration: boolean;
}

const initialData: FormData = {
  nationality: "Pakistani",
  cnic: "", afghanCard: "", mobile: "", password: "", confirmPassword: "", mathCaptcha: "",
  matricBoard: "", matricRoll: "", matricYear: "", matricTotal: "", matricObtained: "", matricGroup: "", matricPercentage: 0, boardVerified: false,
  fullName: "", fatherName: "", fatherCnic: "", dob: "", gender: "Male", domicileDistrict: "Mohmand", permanentAddress: "", mailingAddress: "",
  classYear: "1st Year", programme: "pre-medical", quota: "open_merit", isHafizEQuran: false, gapYears: "0", subjectCombo: [], declaration: false,
};

const STEPS = [
  { num: 1, label: "Create Account", icon: UserCircle2, desc: "Nationality, CNIC/Form-B, mobile, password" },
  { num: 2, label: "Board Verification", icon: ShieldCheck, desc: "Matric board + roll + year → BISE verification" },
  { num: 3, label: "Personal Information", icon: FileCheck2, desc: "Name, father, DOB, gender, address" },
  { num: 4, label: "Academic & Programme", icon: GraduationCap, desc: "Programme, subjects, quota, declarations" },
];

// Subject combinations per programme/year (mirrors programme_subjects seed)
const SUBJECTS_BY_PROGRAMME: Record<Programme, Record<ClassYear, { name: string; compulsory: boolean }[]>> = {
  "pre-medical": {
    "1st Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Islamiat", compulsory: true },
      { name: "Biology", compulsory: false },
      { name: "Chemistry", compulsory: false },
      { name: "Physics", compulsory: false },
    ],
    "2nd Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Pak Studies", compulsory: true },
      { name: "Biology", compulsory: false },
      { name: "Chemistry", compulsory: false },
      { name: "Physics", compulsory: false },
    ],
  },
  "pre-engineering": {
    "1st Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Islamiat", compulsory: true },
      { name: "Mathematics", compulsory: false },
      { name: "Physics", compulsory: false },
      { name: "Chemistry", compulsory: false },
    ],
    "2nd Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Pak Studies", compulsory: true },
      { name: "Mathematics", compulsory: false },
      { name: "Physics", compulsory: false },
      { name: "Chemistry", compulsory: false },
    ],
  },
  "ics": {
    "1st Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Islamiat", compulsory: true },
      { name: "Computer Science", compulsory: false },
      { name: "Mathematics", compulsory: false },
      { name: "Physics", compulsory: false },
    ],
    "2nd Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Pak Studies", compulsory: true },
      { name: "Computer Science", compulsory: false },
      { name: "Mathematics", compulsory: false },
      { name: "Physics", compulsory: false },
    ],
  },
  "arts": {
    "1st Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Islamiat", compulsory: true },
      { name: "Civics", compulsory: false },
      { name: "Education", compulsory: false },
      { name: "General History", compulsory: false },
    ],
    "2nd Year": [
      { name: "English", compulsory: true },
      { name: "Urdu", compulsory: true },
      { name: "Pak Studies", compulsory: true },
      { name: "Civics", compulsory: false },
      { name: "Education", compulsory: false },
      { name: "General History", compulsory: false },
    ],
  },
};

const PAKISTANI_DISTRICTS = [
  "Mohmand","Peshawar","Charsadda","Mardan","Swabi","Nowshera","Kohat","Bannu","Dera Ismail Khan",
  "Abbottabad","Mansehra","Haripur","Buner","Swat","Dir Lower","Dir Upper","Malakand","Bajaur",
  "Khyber","Orakzai","Kurram","North Waziristan","South Waziristan","Lakki Marwat","Tank","Karak","Hangu","Other",
];

export function ApplyWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | { token: string; fee: number }>(null);
  const [copied, setCopied] = useState(false);

  // Math captcha: generate once on mount
  const [captcha] = useState(() => ({
    a: Math.floor(Math.random() * 8) + 2,
    b: Math.floor(Math.random() * 8) + 2,
  }));
  const expectedCaptcha = captcha.a + captcha.b;

  // Load from localStorage on mount (autosave)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({ ...initialData, ...parsed, mathCaptcha: "" });
      }
    } catch { /* ignore */ }
  }, []);

  // Autosave on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  // ---- validation per step ----
  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (data.nationality === "Pakistani") {
        if (!/^\d{13}$/.test(data.cnic)) errs.cnic = "CNIC must be 13 digits without dashes (e.g. 16202xxxxxxx7).";
      } else {
        if (!data.afghanCard || data.afghanCard.length < 6) errs.afghanCard = "Enter a valid Afghan Card or Passport number.";
      }
      if (!/^03\d{9}$/.test(data.mobile)) errs.mobile = "Mobile must be in 03XXXXXXXXX format (11 digits).";
      if (data.password.length < 8) errs.password = "Password must be at least 8 characters.";
      if (data.password !== data.confirmPassword) errs.confirmPassword = "Passwords do not match.";
      if (data.mathCaptcha !== String(expectedCaptcha)) errs.mathCaptcha = `Incorrect answer. Hint: ${captcha.a} + ${captcha.b} = ?`;
    }
    if (s === 2) {
      if (!data.matricBoard.trim()) errs.matricBoard = "Select your matriculation board.";
      if (!/^\d{4,8}$/.test(data.matricRoll)) errs.matricRoll = "Enter a valid roll number (4-8 digits).";
      if (!data.matricYear || parseInt(data.matricYear) < 2018 || parseInt(data.matricYear) > 2026) errs.matricYear = "Year must be 2018-2026.";
      const total = parseInt(data.matricTotal);
      const obtained = parseInt(data.matricObtained);
      if (!total || total < 500 || total > 1200) errs.matricTotal = "Total marks must be 500-1200.";
      if (!obtained || obtained < 0 || obtained > total) errs.matricObtained = "Obtained must be 0 to total.";
    }
    if (s === 3) {
      if (data.fullName.trim().length < 3) errs.fullName = "Enter your full name (at least 3 characters).";
      if (data.fatherName.trim().length < 3) errs.fatherName = "Enter father/guardian name.";
      if (!/^\d{13}$/.test(data.fatherCnic)) errs.fatherCnic = "Father CNIC must be 13 digits without dashes.";
      if (!data.dob) errs.dob = "Enter your date of birth.";
      else {
        const age = (Date.now() - new Date(data.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (data.gender === "Male" && age > 19) errs.dob = "Male candidates for 1st Year must be under 19 (HED policy). Apply for age relaxation with the Principal if older.";
      }
      if (!data.permanentAddress.trim()) errs.permanentAddress = "Enter your permanent address.";
    }
    if (s === 4) {
      if (data.subjectCombo.length < 6) errs.subjectCombo = "Select all 6 subjects (3 compulsory + 3 elective).";
      if (!data.declaration) errs.declaration = "You must accept the declaration to submit.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => Math.min(4, s + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Step 2 "Verify" button (mock BISE verification) ----
  function verifyBoard() {
    const total = parseInt(data.matricTotal);
    const obtained = parseInt(data.matricObtained);
    if (!total || !obtained || obtained > total) {
      setErrors((e) => ({ ...e, matricObtained: "Enter valid marks first." }));
      return;
    }
    const pct = Math.round((obtained / total) * 1000) / 10;
    set("matricPercentage", pct);
    set("boardVerified", true);
    setErrors((e) => ({ ...e, matricObtained: "" }));
  }

  // ---- Step 4 — toggle subject selection (compulsory are auto-selected) ----
  function toggleSubject(name: string) {
    const subjects = SUBJECTS_BY_PROGRAMME[data.programme][data.classYear];
    const subj = subjects.find((s) => s.name === name);
    if (!subj || subj.compulsory) return;
    setData((d) => {
      const has = d.subjectCombo.includes(name);
      let next = has ? d.subjectCombo.filter((s) => s !== name) : [...d.subjectCombo, name];
      // Limit to 3 electives
      const electives = subjects.filter((s) => !s.compulsory);
      if (!has && next.filter((n) => !subjects.find((s) => s.name === n && s.compulsory)).length > 3) {
        return d;
      }
      return { ...d, subjectCombo: next };
    });
  }

  // When programme/year changes, reset subject combo to compulsory only
  useEffect(() => {
    const subjects = SUBJECTS_BY_PROGRAMME[data.programme][data.classYear];
    const compulsory = subjects.filter((s) => s.compulsory).map((s) => s.name);
    setData((d) => ({ ...d, subjectCombo: compulsory }));
  }, [data.programme, data.classYear]);

  // ---- Submit ----
  async function submit() {
    if (!validateStep(4)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Step 1
          nationality: data.nationality,
          cnic: data.cnic || data.afghanCard,
          afghanCard: data.afghanCard || null,
          mobile: data.mobile,
          password: data.password,
          // Step 2
          matricBoard: data.matricBoard,
          matricRoll: data.matricRoll,
          matricYear: data.matricYear,
          matricObtained: parseInt(data.matricObtained),
          matricTotal: parseInt(data.matricTotal),
          matricGroup: data.matricGroup,
          // Step 3
          fullName: data.fullName,
          fatherName: data.fatherName,
          cnic: data.fatherCnic, // existing API expects `cnic` = father's CNIC (legacy)
          fatherCnic: data.fatherCnic,
          phone: data.mobile,
          whatsappOptIn: true,
          // Step 4
          programme: data.programme,
          classYear: data.classYear,
          quota: data.quota,
          isHafizEQuran: data.isHafizEQuran,
          gapYears: parseInt(data.gapYears) || 0,
          subjectCombination: data.subjectCombo,
          previousSchool: data.matricBoard,
          declaration: data.declaration,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Submission failed.");
      setSubmitted({ token: json.applicationNo, fee: 100 });
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Success screen ----------
  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border-2 border-emerald-500/30 bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={2} aria-hidden />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Application submitted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your application has been received. Save your tracking token below — you will need it to
          check your status and pay the Rs {submitted.fee} processing fee at the college office.
        </p>
        <div className="my-6 rounded-xl border border-gold/40 bg-gold-soft/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tracking Token
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Hash className="h-5 w-5 text-gold-strong" aria-hidden />
            <span className="font-display text-2xl font-bold tracking-wider text-foreground">
              {submitted.token}
            </span>
            <Button
              variant="ghost" size="icon" className="h-9 w-9"
              onClick={() => { navigator.clipboard.writeText(submitted.token); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <ol className="space-y-3 text-left text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <span>Take this token to the college office with Rs {submitted.fee} (cash) to pay the processing fee per programme applied.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <span>Visit <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">/admissions/track</code> or click below to follow your application status in real time.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            <span>Watch the merit list at <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">/results/merit-list</code> — published after the admission window closes.</span>
          </li>
        </ol>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button asChild className="h-11 rounded-full font-semibold">
            <a href="/admissions/track">Track Application</a>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full">
            <a href="/">Return Home</a>
          </Button>
        </div>
      </div>
    );
  }

  // ---------- Wizard ----------
  return (
    <div className="mx-auto max-w-3xl">
      {/* Stepper */}
      <ol className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((s) => {
          const active = step === s.num;
          const done = step > s.num;
          const Icon = s.icon;
          return (
            <li
              key={s.num}
              className={cn(
                "relative rounded-xl border p-3 transition-all",
                active ? "border-primary bg-primary/5" : done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground"
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                </span>
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} aria-hidden />
              </div>
              <p className={cn("mt-2 text-xs font-bold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/80 hidden sm:block">
                {s.desc}
              </p>
            </li>
          );
        })}
      </ol>

      {/* Step body card */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <StepHeader num={1} title="Create Account" desc="Enter your nationality, CNIC/Form-B and mobile number. Your mobile cannot be changed later — it carries your fee-payment receipts and all admission SMS alerts." />

            <div>
              <Label className="text-sm font-semibold">Nationality *</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["Pakistani", "Afghani"] as const).map((n) => (
                  <button
                    key={n} type="button" onClick={() => set("nationality", n)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      data.nationality === n ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"
                    )}
                  >
                    <span className="block text-sm font-bold">{n}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {n === "Pakistani" ? "CNIC / Form-B (13 digits)" : "Afghan Card / Passport"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {data.nationality === "Pakistani" ? (
              <Field label="CNIC / Form-B Number *" error={errors.cnic}>
                <Input
                  value={data.cnic}
                  onChange={(e) => set("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="0000000000000" inputMode="numeric" className="font-mono"
                />
                <p className="text-xs text-muted-foreground">13 digits, no dashes (e.g. 1620212345671).</p>
              </Field>
            ) : (
              <Field label="Afghan Card / Passport Number *" error={errors.afghanCard}>
                <Input
                  value={data.afghanCard}
                  onChange={(e) => set("afghanCard", e.target.value.slice(0, 30))}
                  placeholder="Enter Afghan Card or Passport number"
                />
              </Field>
            )}

            <Field label="Mobile Number *" error={errors.mobile}>
              <Input
                value={data.mobile}
                onChange={(e) => set("mobile", e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="03XXXXXXXXX" inputMode="tel" className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Must be in 03XXXXXXXXX format. Used for fee payment and all SMS alerts.
              </p>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password *" error={errors.password}>
                <Input
                  type="password" value={data.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Confirm Password *" error={errors.confirmPassword}>
                <Input
                  type="password" value={data.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="Re-enter password"
                />
              </Field>
            </div>

            <Field label={`Math Verification: ${captcha.a} + ${captcha.b} = ?`} error={errors.mathCaptcha}>
              <Input
                value={data.mathCaptcha}
                onChange={(e) => set("mathCaptcha", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Enter the result" inputMode="numeric" className="font-mono max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">Solve the simple math problem to confirm you are human.</p>
            </Field>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <StepHeader num={2} title="Board Verification" desc="Enter your matriculation board details. We will compute your percentage which is used in the merit list." />

            <Field label="Matriculation Board *" error={errors.matricBoard}>
              <Select value={data.matricBoard} onValueChange={(v) => set("matricBoard", v)}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select board" /></SelectTrigger>
                <SelectContent>
                  {["BISE Peshawar","BISE Mardan","BISE Swat","BISE Abbottabad","BISE Bannu","BISE Kohat","BISE Malakand","BISE Charsadda","BISE Bajaur","BISE Mohmand","Federal Board FBISE","Karachi Board","Lahore Board","Other"].map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Matric Roll Number *" error={errors.matricRoll}>
                <Input
                  value={data.matricRoll}
                  onChange={(e) => set("matricRoll", e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="123456" inputMode="numeric" className="font-mono"
                />
              </Field>
              <Field label="Passing Year *" error={errors.matricYear}>
                <Input
                  value={data.matricYear}
                  onChange={(e) => set("matricYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2026" inputMode="numeric" className="font-mono"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Total Marks *" error={errors.matricTotal}>
                <Input
                  value={data.matricTotal}
                  onChange={(e) => set("matricTotal", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1100" inputMode="numeric" className="font-mono"
                />
              </Field>
              <Field label="Obtained Marks *" error={errors.matricObtained}>
                <Input
                  value={data.matricObtained}
                  onChange={(e) => set("matricObtained", e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="950" inputMode="numeric" className="font-mono"
                />
              </Field>
              <Field label="Group">
                <Select value={data.matricGroup} onValueChange={(v) => set("matricGroup", v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Science / Arts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="Arts">Arts / General</SelectItem>
                    <SelectItem value="Computer Science">Computer Science</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={verifyBoard} variant="outline" className="h-11 rounded-full">
                <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Verify & Calculate
              </Button>
              {data.boardVerified && (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verified · {data.matricPercentage}%
                </Badge>
              )}
            </div>

            {data.boardVerified && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Verification successful</p>
                <p className="mt-1 text-muted-foreground">
                  Your computed matric percentage is <strong className="text-foreground">{data.matricPercentage}%</strong>.
                  This will be used in the merit calculation along with your quota and Hafiz-e-Quran status.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <StepHeader num={3} title="Personal Information" desc="Tell us who you are. The principal and admission committee verify these against your documents at interview." />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name *" error={errors.fullName}>
                <Input value={data.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="As per matric certificate" />
              </Field>
              <Field label="Father / Guardian Name *" error={errors.fatherName}>
                <Input value={data.fatherName} onChange={(e) => set("fatherName", e.target.value)} placeholder="Father's full name" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Father / Guardian CNIC *" error={errors.fatherCnic}>
                <Input
                  value={data.fatherCnic}
                  onChange={(e) => set("fatherCnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  placeholder="0000000000000" inputMode="numeric" className="font-mono"
                />
              </Field>
              <Field label="Date of Birth *" error={errors.dob}>
                <Input type="date" value={data.dob} onChange={(e) => set("dob", e.target.value)} />
              </Field>
            </div>

            <Field label="Gender *">
              <div className="grid grid-cols-3 gap-2">
                {(["Male", "Female", "Other"] as const).map((g) => (
                  <button
                    key={g} type="button" onClick={() => set("gender", g)}
                    className={cn(
                      "rounded-lg border p-3 text-sm font-semibold transition-all",
                      data.gender === g ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {data.gender === "Male" && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Male candidates for 1st Year must be under 19 (HED KPK policy).
                </p>
              )}
            </Field>

            <Field label="Domicile District *">
              <Select value={data.domicileDistrict} onValueChange={(v) => set("domicileDistrict", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAKISTANI_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Local quota (45% of seats) is reserved for Mohmand-domiciled candidates.
              </p>
            </Field>

            <Field label="Permanent Address *" error={errors.permanentAddress}>
              <Textarea
                value={data.permanentAddress}
                onChange={(e) => set("permanentAddress", e.target.value)}
                placeholder="Village, Mohallah, Tehsil, District" rows={2}
              />
            </Field>

            <Field label="Mailing Address (if different)">
              <Textarea
                value={data.mailingAddress}
                onChange={(e) => set("mailingAddress", e.target.value)}
                placeholder="Where admission letter should be posted" rows={2}
              />
            </Field>
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div className="space-y-5">
            <StepHeader num={4} title="Academic & Programme" desc="Choose your class, programme, quota and subjects. Review the declaration, then submit." />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class Year *">
                <div className="grid grid-cols-2 gap-2">
                  {(["1st Year", "2nd Year"] as const).map((c) => (
                    <button
                      key={c} type="button" onClick={() => set("classYear", c)}
                      className={cn(
                        "rounded-lg border p-3 text-sm font-semibold transition-all",
                        data.classYear === c ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Programme *">
                <Select value={data.programme} onValueChange={(v) => set("programme", v as Programme)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROGRAMME_INFO) as Programme[]).map((p) => (
                      <SelectItem key={p} value={p}>{PROGRAMME_INFO[p].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="font-display text-sm font-bold">{PROGRAMME_INFO[data.programme].label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{PROGRAMME_INFO[data.programme].tagline}</p>
            </div>

            <Field label="Quota *">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(QUOTA_INFO) as Quota[]).map((q) => (
                  <button
                    key={q} type="button" onClick={() => set("quota", q)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      data.quota === q ? "border-gold bg-gold-soft/30 ring-1 ring-gold" : "border-border hover:bg-secondary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{QUOTA_INFO[q].label}</span>
                      <Badge variant="outline" className="border-gold/40 text-gold-strong">{QUOTA_INFO[q].percent}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{QUOTA_INFO[q].desc}</p>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Subject Combination *">
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-border">
                  {SUBJECTS_BY_PROGRAMME[data.programme][data.classYear].map((subj) => {
                    const checked = subj.compulsory || data.subjectCombo.includes(subj.name);
                    return (
                      <label
                        key={subj.name}
                        className={cn(
                          "flex items-center gap-2 bg-card p-3 cursor-pointer",
                          subj.compulsory ? "opacity-70" : "",
                          checked && !subj.compulsory ? "ring-1 ring-inset ring-primary" : ""
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={subj.compulsory}
                          onCheckedChange={() => toggleSubject(subj.name)}
                        />
                        <span className="text-sm">{subj.name}</span>
                        {subj.compulsory && <Badge variant="outline" className="ml-auto text-[10px]">Compulsory</Badge>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Compulsory subjects are auto-selected. Choose any 3 electives to complete the combination.
                Selected: <strong>{data.subjectCombo.length}/6</strong>
              </p>
              {errors.subjectCombo && <p className="text-xs text-destructive">{errors.subjectCombo}</p>}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hafiz-e-Quran (+20 marks)">
                <label className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
                  <Checkbox
                    checked={data.isHafizEQuran}
                    onCheckedChange={(v) => set("isHafizEQuran", v === true)}
                  />
                  <span className="text-sm">I am Hafiz-e-Quran (certificate required at interview)</span>
                </label>
              </Field>
              <Field label="Gap Years (-5 marks per year)" error={errors.gapYears}>
                <Select value={data.gapYears} onValueChange={(v) => set("gapYears", v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["0", "1", "2", "3"].map((y) => <SelectItem key={y} value={y}>{y} year{y === "1" ? "" : "s"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">0 if you passed matric this year.</p>
              </Field>
            </div>

            <Field label="Declaration *" error={errors.declaration}>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <Checkbox
                  checked={data.declaration}
                  onCheckedChange={(v) => set("declaration", v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I declare that all information provided is true and accurate to the best of my knowledge.
                  I understand that providing false information will result in cancellation of admission
                  at any stage. I agree to abide by the HED KPK Admission Policy and college rules.
                  I also consent to processing of my data for admission purposes per the privacy policy.
                </span>
              </label>
            </Field>

            {/* Summary */}
            <div className="rounded-xl border border-gold/40 bg-gold-soft/20 p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-gold-strong" /> Application Summary
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Applicant</dt><dd className="font-medium">{data.fullName || "—"}</dd>
                <dt className="text-muted-foreground">CNIC/Form-B</dt><dd className="font-mono">{data.cnic || data.afghanCard || "—"}</dd>
                <dt className="text-muted-foreground">Mobile</dt><dd className="font-mono">{data.mobile || "—"}</dd>
                <dt className="text-muted-foreground">Matric %</dt><dd className="font-medium">{data.boardVerified ? `${data.matricPercentage}%` : "Pending"}</dd>
                <dt className="text-muted-foreground">Programme</dt><dd className="font-medium">{PROGRAMME_INFO[data.programme].label}</dd>
                <dt className="text-muted-foreground">Quota</dt><dd className="font-medium">{QUOTA_INFO[data.quota].label}</dd>
                <dt className="text-muted-foreground">Class</dt><dd className="font-medium">{data.classYear}</dd>
                <dt className="text-muted-foreground">Subjects</dt><dd className="font-medium">{data.subjectCombo.length}/6 selected</dd>
                <dt className="text-muted-foreground">Hafiz-e-Quran</dt><dd className="font-medium">{data.isHafizEQuran ? "Yes (+20 marks)" : "No"}</dd>
                <dt className="text-muted-foreground">Fee</dt><dd className="font-medium">Rs 100 (payable at college office)</dd>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={prev} disabled={step === 1} className="h-11 rounded-full">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden /> Back
          </Button>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          {step < 4 ? (
            <Button type="button" onClick={next} className="h-11 rounded-full font-semibold">
              Next <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={submitting} className="h-11 rounded-full font-semibold">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-1 h-4 w-4" aria-hidden />}
              {submitting ? "Submitting…" : "Submit Application"}
            </Button>
          )}
        </div>

        {errors.submit && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {errors.submit}
          </p>
        )}

        {/* Help line */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Stuck on a step? WhatsApp the admission office at{" "}
          <a href="https://wa.me/923001234567" className="font-semibold text-primary hover:underline">
            +92-300-1234567
          </a>{" "}
          during office hours.
        </p>
      </div>

      {/* Reset form link */}
      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => { if (confirm("Clear all saved progress?")) { localStorage.removeItem(STORAGE_KEY); setData(initialData); setStep(1); } }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" /> Clear saved progress
        </button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
    </div>
  );
}

function StepHeader({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-strong">Step {num}</p>
      <h2 className="mt-1 font-display text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
