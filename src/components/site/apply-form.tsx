"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Upload, FileCheck2, ShieldCheck,
  GraduationCap, School, AlertTriangle, Lock,
} from "lucide-react";
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
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";
import {
  PROVINCES, BOARDS_BY_PROVINCE, getDistrictsForProvince,
  getTehsilsForDistrict, getUnionCouncilsForTehsil,
  EXAM_SESSIONS, PASSING_YEARS, MATRIC_STUDY_GROUPS,
  RELIGIONS, GENDERS, BLOOD_GROUPS,
  PROGRAMME_OPTIONS, SHIFTS,
  DOC_FIELDS_FIRST_YEAR, DOC_FIELDS_SECOND_YEAR,
} from "@/content/hed-data";

/**
 * FIVE-STEP ADMISSION APPLICATION — mirrors the HED KPK OCAS form structure
 * captured live from https://admission.hed.gkp.pk on 2026-10-06.
 *
 *  - Step 0: Admission type (1st-year / 2nd-year)
 *  - Step 1: Matric academic history (board verification style)
 *  - Step 2: Personal details (HED-aligned: blood group, mother, photo, etc.)
 *  - Step 3: Programme selection (eligibility pre-check)
 *  - Step 4: Documents (incl. character certificate & affidavit per HED policy)
 *  - Step 5: Review, declaration & confirm dialog (info locks after submit)
 *
 *  - Draft autosave to localStorage after every step (survives dropped connections)
 *  - Submission issues an application number + receipt (Supabase when configured,
 *    demo number otherwise)
 *
 * NOTE on confirm dialog: HED shows "Please make sure you entered correct
 * information, you will not be able to change it. Click cancel to review."
 * We mirror this with a JavaScript confirm before the final submit.
 */

const DRAFT_KEY = "ghss-admission-draft-v3";

// ---------------------------------------------------------------------------
// ZOD SCHEMA — all fields validated, mirroring HED rules
// ---------------------------------------------------------------------------
const CNIC_REGEX = /^[0-9]{13}$/;
const MOBILE_REGEX = /^03[0-9]{9}$/;

const formSchema = z.object({
  // Step 0 — admission type
  admissionType: z.enum(["first_year", "second_year"]),
  shift: z.enum(["morning", "evening"]).default("morning"),

  // Step 1 — matric academic history
  matricExamPassed: z.string().default("SSC"),
  matricStudyGroup: z.string().min(1, { message: "Select a study group" }),
  matricProvince: z.string().min(1, { message: "Select province of board" }),
  matricBoard: z.string().min(1, { message: "Select the matric board" }),
  matricSession: z.enum(["annual", "supplementary", "other"]),
  matricYear: z.string().min(4, { message: "Select passing year" }),
  matricRoll: z.string().min(1, { message: "Enter the matric roll number" }).max(30),
  matricObtained: z.coerce.number().min(0).max(1500),
  matricTotal: z.coerce.number().min(1).max(1500),
  hafizQuran: z.boolean().default(false),
  instituteProvince: z.string().min(1, { message: "Select school province" }),
  instituteDistrict: z.string().min(1, { message: "Select school district" }),
  instituteName: z.string().min(2, { message: "Enter the previous school's name" }).max(160),

  // 2nd-year academic records (validated in next() when second_year)
  firstYearRoll: z.string().optional(),
  firstYearRegistrationNo: z.string().optional(),
  firstYearObtained: z.coerce.number().min(0).max(1500).optional(),
  firstYearTotal: z.coerce.number().min(1).max(1500).optional(),
  firstYearYear: z.string().optional(),
  firstYearSubjects: z.string().optional(),

  // Step 2 — personal details (HED-aligned)
  fullName: z.string().min(3, { message: "Enter the student's full name" }).max(120),
  fatherName: z.string().min(3, { message: "Enter the father's name" }).max(120),
  dobYear: z.string().min(1, { message: "Select year of birth" }),
  dobMonth: z.string().min(1, { message: "Select month of birth" }),
  dobDay: z.string().min(1, { message: "Select day of birth" }),
  email: z.string().email({ message: "Enter a valid email address" }).max(120).or(z.literal("")),
  mobile: z.string().regex(MOBILE_REGEX, { message: "Enter mobile in 03XXXXXXXXX format" }),
  religion: z.string().min(1, { message: "Select religion" }),
  cnic: z.string().regex(CNIC_REGEX, { message: "CNIC must be exactly 13 digits without dashes" }),
  nationality: z.enum(["Pakistani", "Afghani"]).default("Pakistani"),
  afghaniProvince: z.string().optional(),
  landline: z.string().optional(),
  domicileProvince: z.string().min(1, { message: "Select domicile province" }),
  domicileDistrict: z.string().min(1, { message: "Select domicile district" }),
  domicileTehsil: z.string().min(1, { message: "Select domicile tehsil" }),
  domicileUnionCouncil: z.string().min(1, { message: "Select union council" }),
  gender: z.string().min(1, { message: "Select gender" }),
  bloodGroup: z.string().min(1, { message: "Select blood group" }),
  fatherCnic: z.string().regex(CNIC_REGEX, { message: "Father CNIC must be 13 digits without dashes" }),
  fatherMobile: z.string().regex(MOBILE_REGEX, { message: "Enter father's mobile in 03XXXXXXXXX format" }),
  motherName: z.string().min(3, { message: "Enter mother's name" }).max(120),
  motherCnic: z.string().regex(CNIC_REGEX, { message: "Mother CNIC must be 13 digits without dashes" }),
  mailingAddress: z.string().min(5, { message: "Enter your mailing address" }).max(300),
  whatsappOptIn: z.boolean(),

  // Step 3 — programme
  programme: z.string(),

  // Step 5 — declaration
  declaration: z.literal(true, { message: "The declaration must be accepted" }),
  infoLocked: z.literal(true, { message: "You must acknowledge the lock" }),
}).refine((v) => v.matricObtained <= v.matricTotal, {
  message: "Obtained marks cannot exceed total",
  path: ["matricObtained"],
}).refine((v) => v.admissionType !== "second_year" || (
  Boolean(v.firstYearRoll) && Boolean(v.firstYearRegistrationNo) &&
  v.firstYearObtained !== undefined && v.firstYearTotal !== undefined
), {
  message: "2nd-year applicants must provide 1st-year roll, registration and marks",
  path: ["firstYearRoll"],
}).refine((v) => v.admissionType !== "second_year" ||
  (v.firstYearObtained ?? 0) <= (v.firstYearTotal ?? 1), {
  message: "1st-year obtained marks cannot exceed total",
  path: ["firstYearObtained"],
});

type FormValues = z.infer<typeof formSchema>;

const STEP_TITLES = [
  "Admission type",
  "Matric academic record",
  "Personal details",
  "Programme selection",
  "Documents",
  "Review & submit",
];

const URDU_ERRORS: Record<string, string> = {
  "Enter the student's full name": "طالب علم کا مکمل نام لکھیں",
  "Enter the father's name": "والد کا نام لکھیں",
  "CNIC must be exactly 13 digits without dashes": "شناختی کارڈ 13 ہندسی، بغیر ڈیش",
  "Enter mobile in 03XXXXXXXXX format": "موبائل 03XXXXXXXXX فارمیٹ میں",
  "Enter a valid email address": "ای میل درست لکھیں",
  "Enter mother's name": "والدہ کا نام لکھیں",
  "Father CNIC must be 13 digits without dashes": "والد کا شناختی کارڈ 13 ہندسی",
  "Mother CNIC must be 13 digits without dashes": "والدہ کا شناختی کارڈ 13 ہندسی",
  "Enter father's mobile in 03XXXXXXXXX format": "والد کا موبائل 03XXXXXXXXX",
  "Enter your mailing address": "اپنا ڈاک کا پتہ لکھیں",
  "Select religion": "مذہب منتخب کریں",
  "Select gender": "جنس منتخب کریں",
  "Select blood group": "بلڈ گروپ منتخب کریں",
  "Select domicile province": "ڈومیسائل صوبہ منتخب کریں",
  "Select domicile district": "ڈومیسائل ضلع منتخب کریں",
  "Select domicile tehsil": "ڈومیسائل تحصیل منتخب کریں",
  "Select union council": "یونین کونسل منتخب کریں",
  "Enter the matric roll number": "میٹرک رول نمبر لکھیں",
  "Select the matric board": "میٹرک بورڈ منتخب کریں",
  "Select a study group": "سٹڈی گروپ منتخب کریں",
  "Select province of board": "بورڈ کا صوبہ منتخب کریں",
  "Select passing year": "پاسنگ سال منتخب کریں",
  "Enter the previous school's name": "سابقہ سکول کا نام لکھیں",
  "Select school province": "سکول کا صوبہ منتخب کریں",
  "Select school district": "سکول کا ضلع منتخب کریں",
};

export function ApplyForm() {
  const [step, setStep] = useState(0);
  const [urduErrors, setUrduErrors] = useState(false);
  const [docs, setDocs] = useState<Record<string, File | null>>({});
  const [applicantPhoto, setApplicantPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [receipt, setReceipt] = useState<{ applicationNo: string; demo: boolean } | null>(null);
  const [eligibilityFlag, setEligibilityFlag] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    mode: "onTouched",
    defaultValues: {
      admissionType: "first_year",
      shift: "morning",
      matricExamPassed: "SSC",
      matricStudyGroup: "",
      matricProvince: "",
      matricBoard: "",
      matricSession: "annual",
      matricYear: "2025",
      matricRoll: "",
      matricObtained: 0,
      matricTotal: 1100,
      hafizQuran: false,
      instituteProvince: "",
      instituteDistrict: "",
      instituteName: "",
      firstYearRoll: "",
      firstYearRegistrationNo: "",
      firstYearObtained: 0,
      firstYearTotal: 550,
      firstYearYear: "2024",
      firstYearSubjects: "",
      fullName: "",
      fatherName: "",
      dobYear: "",
      dobMonth: "",
      dobDay: "",
      email: "",
      mobile: "",
      religion: "islam",
      cnic: "",
      nationality: "Pakistani",
      afghaniProvince: "",
      landline: "",
      domicileProvince: "",
      domicileDistrict: "",
      domicileTehsil: "",
      domicileUnionCouncil: "",
      gender: "",
      bloodGroup: "",
      fatherCnic: "",
      fatherMobile: "",
      motherName: "",
      motherCnic: "",
      mailingAddress: "",
      whatsappOptIn: true,
      programme: "",
      declaration: false as unknown as true,
      infoLocked: false as unknown as true,
    },
  });

  // Restore draft on mount (survive connectivity drops)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        form.reset({ ...form.getValues(), ...d, declaration: false as unknown as true, infoLocked: false as unknown as true });
        if (typeof d.__step === "number") setStep(Math.min(d.__step, 5));
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
  const matricProvince = form.watch("matricProvince");
  const instituteProvince = form.watch("instituteProvince");
  const instituteDistrict = form.watch("instituteDistrict");
  const domicileProvince = form.watch("domicileProvince");
  const domicileDistrict = form.watch("domicileDistrict");
  const domicileTehsil = form.watch("domicileTehsil");
  const nationality = form.watch("nationality");

  const docFields = admissionType === "second_year" ? DOC_FIELDS_SECOND_YEAR : DOC_FIELDS_FIRST_YEAR;

  // When matric province changes, reset board (HED behaviour: filtered dropdown)
  useEffect(() => {
    if (matricProvince) {
      const validBoards = BOARDS_BY_PROVINCE[matricProvince] ?? [];
      const currentBoard = form.getValues("matricBoard");
      if (currentBoard && !validBoards.find(b => b.value === currentBoard)) {
        form.setValue("matricBoard", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matricProvince]);

  // When institute province changes, reset district
  useEffect(() => {
    if (instituteProvince) {
      const validDistricts = getDistrictsForProvince(instituteProvince);
      if (!validDistricts.includes(form.getValues("instituteDistrict") as never)) {
        form.setValue("instituteDistrict", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instituteProvince]);

  // When domicile province changes, reset district + tehsil + UC
  useEffect(() => {
    if (domicileProvince) {
      const validDistricts = getDistrictsForProvince(domicileProvince);
      if (!validDistricts.includes(form.getValues("domicileDistrict") as never)) {
        form.setValue("domicileDistrict", "");
        form.setValue("domicileTehsil", "");
        form.setValue("domicileUnionCouncil", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domicileProvince]);

  // When domicile district changes, reset tehsil + UC
  useEffect(() => {
    if (domicileDistrict) {
      const validTehsils = getTehsilsForDistrict(domicileDistrict);
      if (!validTehsils.includes(form.getValues("domicileTehsil"))) {
        form.setValue("domicileTehsil", "");
        form.setValue("domicileUnionCouncil", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domicileDistrict]);

  // When domicile tehsil changes, reset UC
  useEffect(() => {
    if (domicileTehsil) {
      const validUCs = getUnionCouncilsForTehsil(domicileDistrict, domicileTehsil);
      if (!validUCs.includes(form.getValues("domicileUnionCouncil"))) {
        form.setValue("domicileUnionCouncil", "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domicileTehsil, domicileDistrict]);

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

  function computeGrade(pct: number): string {
    if (pct >= 80) return "A1";
    if (pct >= 70) return "A";
    if (pct >= 60) return "B";
    if (pct >= 50) return "C";
    if (pct >= 40) return "D";
    if (pct >= 33) return "E";
    return "F";
  }

  function runEligibilityCheck(programme: string) {
    const p = PROGRAMME_OPTIONS.find((o) => o.value === programme);
    if (!p) return setEligibilityFlag(null);
    const group = form.getValues("matricStudyGroup");
    const pct = matricPercent;
    const problems: string[] = [];
    if (pct < p.min - 5) problems.push(`Matric percentage (${pct}%) is below the comfortable range for this stream (~${p.min}%).`);
    if (p.needs === "maths" && group === "4") problems.push("This stream requires matric Mathematics — your selected Arts group does not include it.");
    if (p.needs === "science" && group === "4") problems.push("Pre-Medical requires matric science (biology).");
    setEligibilityFlag(problems.length ? problems.join(" ") : null);
  }

  const totalSteps = 6; // 0..5
  async function next() {
    const fieldsPerStep: Record<number, (keyof FormValues)[]> = {
      0: ["admissionType", "shift"],
      1: admissionType === "second_year"
        ? ["matricStudyGroup", "matricProvince", "matricBoard", "matricSession", "matricYear", "matricRoll", "matricObtained", "matricTotal", "instituteProvince", "instituteDistrict", "instituteName", "firstYearRoll", "firstYearRegistrationNo", "firstYearObtained", "firstYearTotal"]
        : ["matricStudyGroup", "matricProvince", "matricBoard", "matricSession", "matricYear", "matricRoll", "matricObtained", "matricTotal", "instituteProvince", "instituteDistrict", "instituteName"],
      2: ["fullName", "fatherName", "dobYear", "dobMonth", "dobDay", "mobile", "religion", "cnic", "domicileProvince", "domicileDistrict", "domicileTehsil", "domicileUnionCouncil", "gender", "bloodGroup", "fatherCnic", "fatherMobile", "motherName", "motherCnic", "mailingAddress"],
      3: ["programme"],
    };
    const fields = fieldsPerStep[step];
    if (fields && fields.length > 0) {
      const ok = await form.trigger(fields as never);
      if (!ok) return;
    }
    if (step === 2 && !applicantPhoto) {
      toast({ title: "Photo required", description: "Please upload a passport-size photo on the personal details step." });
      return;
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
      // Build the meta payload (HED-aligned extra fields stored as JSONB)
      const meta = {
        email: data.email ?? "",
        dob: `${data.dobYear}-${data.dobMonth.padStart(2, "0")}-${data.dobDay.padStart(2, "0")}`,
        gender: data.gender,
        religion: data.religion,
        nationality: data.nationality,
        afghani_province: data.afghaniProvince ?? "",
        landline: data.landline ?? "",
        domicile_province: data.domicileProvince,
        domicile_district: data.domicileDistrict,
        domicile_tehsil: data.domicileTehsil,
        domicile_union_council: data.domicileUnionCouncil,
        blood_group: data.bloodGroup,
        father_cnic: data.fatherCnic,
        father_mobile: data.fatherMobile,
        mother_name: data.motherName,
        mother_cnic: data.motherCnic,
        guardian_address: data.mailingAddress,
        hafiz_quran: data.hafizQuran,
        shift: data.shift,
        matric_session: data.matricSession,
        matric_study_group: data.matricStudyGroup,
        matric_grade: computeGrade(matricPercent),
        matric_percent: matricPercent,
        first_year_roll: data.firstYearRoll ?? "",
        first_year_registration_no: data.firstYearRegistrationNo ?? "",
        first_year_obtained: data.firstYearObtained ?? 0,
        first_year_total: data.firstYearTotal ?? 0,
        first_year_year: data.firstYearYear ?? "",
        first_year_subjects: data.firstYearSubjects ?? "",
        first_year_percent: firstYearPercent,
        first_year_grade: data.firstYearObtained ? computeGrade(firstYearPercent) : "",
      };

      const payload = {
        admissionType: data.admissionType,
        fullName: data.fullName,
        fatherName: data.fatherName,
        cnic: data.cnic,
        phone: data.mobile,
        whatsappOptIn: data.whatsappOptIn,
        matricBoard: data.matricBoard,
        matricRoll: data.matricRoll,
        matricObtained: data.matricObtained,
        matricTotal: data.matricTotal,
        matricYear: data.matricYear,
        matricGroup: data.matricStudyGroup,
        previousSchool: data.instituteName,
        programme: data.programme,
        declaration: data.declaration,
        meta,
      };

      const res = await fetch("/api/admissions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Submission failed");

      if (isSupabaseConfigured() && result.applicationId) {
        const sb = getSupabaseBrowser();
        // Upload applicant photo separately
        if (applicantPhoto) {
          const safePhotoName = applicantPhoto.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const photoPath = `${result.applicationNo}/photo-${crypto.randomUUID()}-${safePhotoName}`;
          const photoUpload = await sb.storage.from("admission-docs").upload(photoPath, applicantPhoto, { contentType: applicantPhoto.type || undefined, upsert: false });
          if (!photoUpload.error) {
            await sb.from("admissions").update({ applicant_photo_path: photoPath }).eq("id", result.applicationId);
          }
        }
        // Upload documents
        const uploaded: { doc_type: string; storage_path: string }[] = [];
        for (const doc of docFields) {
          const file = docs[doc.id];
          if (!file) continue;
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const storagePath = `${result.applicationNo}/${doc.id}-${crypto.randomUUID()}-${safeName}`;
          const upload = await sb.storage.from("admission-docs").upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
          if (upload.error) throw new Error(`Could not upload ${doc.label}. Keep ${result.applicationNo} and contact the office.`);
          uploaded.push({ doc_type: doc.id, storage_path: storagePath });
        }
        if (uploaded.length) {
          const { error: docError } = await sb.from("admission_docs").insert(uploaded.map((doc) => ({ ...doc, admission_id: result.applicationId })));
          if (docError) throw new Error(`Application saved, but document records could not be completed. Keep ${result.applicationNo} and contact the office.`);
        }
      }
      setReceipt({ applicationNo: result.applicationNo, demo: Boolean(result.demo) });
      try {
        const existing = JSON.parse(localStorage.getItem("ghss-demo-applications") ?? "[]");
        existing.push({ applicationNo: result.applicationNo, ...payload, createdAt: new Date().toISOString() });
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
      setConfirmingSubmit(false);
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
    <div className="mx-auto max-w-3xl">
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

      <form onSubmit={form.handleSubmit((v) => {
        // HED-style confirm dialog before final submit
        if (!confirmingSubmit) {
          setConfirmingSubmit(true);
          return;
        }
        onSubmit(v);
      })} noValidate>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 md:p-8">
          {/* STEP 0 — Admission type */}
          {step === 0 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Admission type &amp; shift</legend>
              <p className="text-small text-muted-foreground">
                Are you joining the school in the first year (Part-I) after matric, or
                transferring in for the second year (Part-II)? The form adjusts the
                academic and document sections to match. Select your preferred shift too.
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
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Preferred shift" required>
                  <Select value={form.watch("shift")} onValueChange={(v) => form.setValue("shift", v as "morning" | "evening")}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                Selected: {admissionType === "first_year" ? "1st year (Part-I) admission" : "2nd year (Part-II) admission — transfer applicant"} · {form.watch("shift") === "morning" ? "Morning shift" : "Evening shift"}
              </p>
            </fieldset>
          )}

          {/* STEP 1 — Matric academic history (board verification style) */}
          {step === 1 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Academic history — matriculation</legend>
              <p className="text-small text-muted-foreground">
                Enter your matric (SSC) details exactly as on your result card. Select province
                first, then board — the board list filters by province (HED behaviour). Marks
                obtained and total are required.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Last exam passed" required>
                  <Select value={form.watch("matricExamPassed")} onValueChange={(v) => form.setValue("matricExamPassed", v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SSC">SSC (Matric)</SelectItem>
                      <SelectItem value="HSC">HSC (Intermediate)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Matric study group" required error={errText(errors.matricStudyGroup?.message)}>
                  <Select value={form.watch("matricStudyGroup")} onValueChange={(v) => form.setValue("matricStudyGroup", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select study group" /></SelectTrigger>
                    <SelectContent>
                      {MATRIC_STUDY_GROUPS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Board province" required error={errText(errors.matricProvince?.message)}>
                  <Select value={form.watch("matricProvince")} onValueChange={(v) => form.setValue("matricProvince", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Matric board" required error={errText(errors.matricBoard?.message)}>
                  <Select value={form.watch("matricBoard")} onValueChange={(v) => form.setValue("matricBoard", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={matricProvince ? "Select board" : "Select province first"} /></SelectTrigger>
                    <SelectContent>
                      {(BOARDS_BY_PROVINCE[matricProvince] ?? []).map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Exam session" required>
                  <Select value={form.watch("matricSession")} onValueChange={(v) => form.setValue("matricSession", v as never)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXAM_SESSIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Passing year" required error={errText(errors.matricYear?.message)}>
                  <Select value={form.watch("matricYear")} onValueChange={(v) => form.setValue("matricYear", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {PASSING_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Roll number" required error={errText(errors.matricRoll?.message)}>
                  <Input {...form.register("matricRoll")} inputMode="numeric" maxLength={10} className="h-11" />
                </Field>
                <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const boardValue = form.watch("matricBoard");
                      const session = form.watch("matricSession");
                      const year = form.watch("matricYear");
                      const roll = form.watch("matricRoll");
                      const studyGroup = form.watch("matricStudyGroup");
                      if (!boardValue || !session || !year || !roll) {
                        toast({ title: "Missing fields", description: "Please select study group, board, session, year, and enter roll number before fetching.", variant: "destructive" });
                        return;
                      }
                      // Map our study group value to HED board_class
                      // (we use "SSC" for matric — captured from HED).
                      try {
                        toast({ title: "Fetching result from board…", description: "This may take a few seconds." });
                        const res = await fetch("/api/admissions/verify-board", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            exam_boards_universities_id: boardValue,
                            board_class: "SSC",
                            board_year: year,
                            board_session: session.charAt(0).toUpperCase() + session.slice(1),
                            highest_exam_roll_number: roll,
                          }),
                        });
                        const result = await res.json();
                        if (result.status === true && result.data) {
                          const d = result.data;
                          form.setValue("matricObtained", Number(d.obtained_marks ?? d.highest_exam_marks_obtained ?? 0), { shouldValidate: true });
                          form.setValue("matricTotal", Number(d.total_marks ?? d.highest_exam_marks_total ?? 1100), { shouldValidate: true });
                          // Pre-fill personal info fields if empty (mirrors HED "Process with Board Data")
                          if (d.student_name && !form.getValues("fullName")) form.setValue("fullName", d.student_name);
                          if (d.father_name && !form.getValues("fatherName")) form.setValue("fatherName", d.father_name);
                          if (d.date_of_birth) {
                            const dob = new Date(d.date_of_birth);
                            if (!isNaN(dob.getTime())) {
                              form.setValue("dobYear", String(dob.getUTCFullYear()));
                              form.setValue("dobMonth", String(dob.getUTCMonth() + 1));
                              form.setValue("dobDay", String(dob.getUTCDate()));
                            }
                          }
                          if (d.school_name && !form.getValues("instituteName")) form.setValue("instituteName", d.school_name);
                          if (d.domicile_district) {
                            form.setValue("domicileDistrict", d.domicile_district);
                          }
                          toast({
                            title: "Board record found ✓",
                            description: `${d.student_name} — ${d.obtained_marks}/${d.total_marks} (${d.grade}). Fields auto-filled.${result.demo ? " (DEMO mode)" : ""}`,
                          });
                        } else {
                          toast({
                            title: "Board record not found",
                            description: result.message ?? "Please enter marks manually.",
                            variant: "destructive",
                          });
                        }
                      } catch (e) {
                        toast({
                          title: "Could not fetch board data",
                          description: e instanceof Error ? e.message : "Please enter marks manually.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="h-11 rounded-full"
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" aria-hidden /> FETCH DATA
                  </Button>
                  <span className="text-xs text-muted-foreground pb-2">
                    Mirrors the HED OCAS feature — fetches the student record from the BISE board API and auto-fills marks, name, father's name, DOB, and school.
                  </span>
                </div>
                <Field label="Marks obtained" required error={errText(errors.matricObtained?.message)}>
                  <Input type="number" {...form.register("matricObtained")} inputMode="numeric" className="h-11" />
                </Field>
                <Field label="Total marks" required>
                  <Input type="number" {...form.register("matricTotal")} inputMode="numeric" className="h-11" />
                </Field>
                <Field label="Hafiz-e-Quran" required>
                  <label className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-4 py-2.5">
                    <Checkbox
                      checked={form.watch("hafizQuran")}
                      onCheckedChange={(v) => form.setValue("hafizQuran", Boolean(v))}
                    />
                    <span className="text-small font-semibold">Yes, I am a Hafiz-e-Quran</span>
                  </label>
                </Field>
                <Field label="School province" required error={errText(errors.instituteProvince?.message)}>
                  <Select value={form.watch("instituteProvince")} onValueChange={(v) => form.setValue("instituteProvince", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="School district" required error={errText(errors.instituteDistrict?.message)}>
                  <Select value={form.watch("instituteDistrict")} onValueChange={(v) => form.setValue("instituteDistrict", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={instituteProvince ? "Select district" : "Select province first"} /></SelectTrigger>
                    <SelectContent>
                      {getDistrictsForProvince(instituteProvince).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="School name" required error={errText(errors.instituteName?.message)}>
                    <Input {...form.register("instituteName")} className="h-11" placeholder="Previous school / college name" />
                  </Field>
                </div>
              </div>
              <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                Matric percentage: {matricPercent}% — Grade: {computeGrade(matricPercent)}
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
                          {PASSING_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Subjects studied in 1st year">
                      <Input {...form.register("firstYearSubjects")} placeholder="e.g. Physics, Chemistry, Maths, English, Urdu, Islamiyat" className="h-11" />
                    </Field>
                  </div>
                  <p className="rounded-lg bg-secondary px-4 py-3 text-small font-semibold text-primary">
                    1st-year percentage: {firstYearPercent}% — Grade: {computeGrade(firstYearPercent)}
                  </p>
                </>
              )}
            </fieldset>
          )}

          {/* STEP 2 — Personal details (HED-aligned) */}
          {step === 2 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Personal details</legend>
              <p className="text-small text-muted-foreground">
                Mirrors the HED personal profile form. Once submitted, this information is
                locked — please review carefully. CNIC must be 13 digits without dashes.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Student's full name" required error={errText(errors.fullName?.message)}>
                  <Input {...form.register("fullName")} autoComplete="name" className="h-11" />
                </Field>
                <Field label="Father's name" required error={errText(errors.fatherName?.message)}>
                  <Input {...form.register("fatherName")} className="h-11" />
                </Field>
                <Field label="Date of birth — Year" required error={errText(errors.dobYear?.message)}>
                  <Select value={form.watch("dobYear")} onValueChange={(v) => form.setValue("dobYear", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 26 }, (_, i) => 2012 - i).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth — Month" required error={errText(errors.dobMonth?.message)}>
                  <Select value={form.watch("dobMonth")} onValueChange={(v) => form.setValue("dobMonth", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>
                      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth — Day" required error={errText(errors.dobDay?.message)}>
                  <Select value={form.watch("dobDay")} onValueChange={(v) => form.setValue("dobDay", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Day" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Gender" required error={errText(errors.gender?.message)}>
                  <Select value={form.watch("gender")} onValueChange={(v) => form.setValue("gender", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Religion" required error={errText(errors.religion?.message)}>
                  <Select value={form.watch("religion")} onValueChange={(v) => form.setValue("religion", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select religion" /></SelectTrigger>
                    <SelectContent>
                      {RELIGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Blood group" required error={errText(errors.bloodGroup?.message)}>
                  <Select value={form.watch("bloodGroup")} onValueChange={(v) => form.setValue("bloodGroup", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select blood group" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="CNIC / Form-B (own)" required error={errText(errors.cnic?.message)}>
                  <Input
                    {...form.register("cnic")}
                    inputMode="numeric"
                    placeholder="0000000000000"
                    maxLength={13}
                    className="h-11 font-mono"
                    onChange={(e) => form.setValue("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  />
                </Field>
                <Field label="Nationality" required>
                  <Select value={form.watch("nationality")} onValueChange={(v) => form.setValue("nationality", v as never)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pakistani">Pakistani</SelectItem>
                      <SelectItem value="Afghani">Afghani</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {nationality === "Afghani" && (
                  <Field label="Afghan province" required>
                    <Input {...form.register("afghaniProvince")} placeholder="e.g. Nangarhar, Kabul" className="h-11" />
                  </Field>
                )}
                <Field label="Mobile number" required error={errText(errors.mobile?.message)}>
                  <Input
                    {...form.register("mobile")}
                    inputMode="tel"
                    placeholder="03XXXXXXXXX"
                    maxLength={11}
                    className="h-11"
                    onChange={(e) => form.setValue("mobile", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  />
                </Field>
                <Field label="Landline number" error={errText(errors.landline?.message)}>
                  <Input {...form.register("landline")} inputMode="tel" placeholder="091-XXXXXXX" className="h-11" />
                </Field>
                <Field label="Email address" error={errText(errors.email?.message)}>
                  <Input {...form.register("email")} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-11" />
                </Field>
                <Field label="Father's CNIC" required error={errText(errors.fatherCnic?.message)}>
                  <Input
                    {...form.register("fatherCnic")}
                    inputMode="numeric"
                    placeholder="0000000000000"
                    maxLength={13}
                    className="h-11 font-mono"
                    onChange={(e) => form.setValue("fatherCnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  />
                </Field>
                <Field label="Father's mobile" required error={errText(errors.fatherMobile?.message)}>
                  <Input
                    {...form.register("fatherMobile")}
                    inputMode="tel"
                    placeholder="03XXXXXXXXX"
                    maxLength={11}
                    className="h-11"
                    onChange={(e) => form.setValue("fatherMobile", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  />
                </Field>
                <Field label="Mother's name" required error={errText(errors.motherName?.message)}>
                  <Input {...form.register("motherName")} className="h-11" />
                </Field>
                <Field label="Mother's CNIC" required error={errText(errors.motherCnic?.message)}>
                  <Input
                    {...form.register("motherCnic")}
                    inputMode="numeric"
                    placeholder="0000000000000"
                    maxLength={13}
                    className="h-11 font-mono"
                    onChange={(e) => form.setValue("motherCnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                  />
                </Field>
              </div>

              <hr className="border-border/70" />
              <h3 className="text-small font-bold uppercase tracking-wide text-muted-foreground">Domicile cascade (province → district → tehsil → union council)</h3>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Domicile province" required error={errText(errors.domicileProvince?.message)}>
                  <Select value={form.watch("domicileProvince")} onValueChange={(v) => form.setValue("domicileProvince", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      {PROVINCES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Domicile district" required error={errText(errors.domicileDistrict?.message)}>
                  <Select value={form.watch("domicileDistrict")} onValueChange={(v) => form.setValue("domicileDistrict", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={domicileProvince ? "Select district" : "Select province first"} /></SelectTrigger>
                    <SelectContent>
                      {getDistrictsForProvince(domicileProvince).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tehsil" required error={errText(errors.domicileTehsil?.message)}>
                  <Select value={form.watch("domicileTehsil")} onValueChange={(v) => form.setValue("domicileTehsil", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={domicileDistrict ? "Select tehsil" : "Select district first"} /></SelectTrigger>
                    <SelectContent>
                      {getTehsilsForDistrict(domicileDistrict).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Union council / Neighborhood" required error={errText(errors.domicileUnionCouncil?.message)}>
                  <Select value={form.watch("domicileUnionCouncil")} onValueChange={(v) => form.setValue("domicileUnionCouncil", v)}>
                    <SelectTrigger className="h-11"><SelectValue placeholder={domicileTehsil ? "Select union council" : "Select tehsil first"} /></SelectTrigger>
                    <SelectContent>
                      {getUnionCouncilsForTehsil(domicileDistrict, domicileTehsil).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Mailing / postal address" required error={errText(errors.mailingAddress?.message)}>
                    <Input {...form.register("mailingAddress")} autoComplete="street-address" placeholder="House, street, area, city" className="h-11" />
                  </Field>
                </div>
              </div>

              <hr className="border-border/70" />
              <h3 className="text-small font-bold uppercase tracking-wide text-muted-foreground">Passport-size photograph</h3>
              <PhotoUploadField value={applicantPhoto} onChange={setApplicantPhoto} />

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
                <DocUploadField
                  key={d.id}
                  label={d.label}
                  required={d.required}
                  file={docs[d.id] ?? null}
                  onChange={(f) => setDocs((prev) => ({ ...prev, [d.id]: f }))}
                />
              ))}
            </fieldset>
          )}

          {/* STEP 5 — Review & declaration */}
          {step === 5 && (
            <fieldset className="space-y-5" disabled={submitting}>
              <legend className="text-h3">Review your application</legend>
              <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-border bg-secondary/40 p-5 text-small sm:grid-cols-2">
                {[
                  ["Admission type", admissionType === "first_year" ? "1st year (Part-I)" : "2nd year (Part-II)"],
                  ["Shift", form.watch("shift") === "morning" ? "Morning" : "Evening"],
                  ["Student", form.watch("fullName")],
                  ["Father", form.watch("fatherName")],
                  ["Mother", form.watch("motherName")],
                  ["Date of birth", `${form.watch("dobDay")}/${form.watch("dobMonth")}/${form.watch("dobYear")}`],
                  ["Gender", form.watch("gender")],
                  ["Religion", form.watch("religion")],
                  ["Blood group", form.watch("bloodGroup")],
                  ["CNIC", form.watch("cnic")],
                  ["Nationality", form.watch("nationality")],
                  ["Mobile", form.watch("mobile")],
                  ["Email", form.watch("email") || "—"],
                  ["Father's CNIC", form.watch("fatherCnic")],
                  ["Father's mobile", form.watch("fatherMobile")],
                  ["Mother's CNIC", form.watch("motherCnic")],
                  ["Domicile", `${form.watch("domicileDistrict")}, ${form.watch("domicileTehsil")}, ${form.watch("domicileUnionCouncil")}`],
                  ["Mailing address", form.watch("mailingAddress")],
                  ["Matric board", form.watch("matricBoard")],
                  ["Matric roll no", form.watch("matricRoll")],
                  ["Matric marks", `${form.watch("matricObtained")} / ${form.watch("matricTotal")} (${matricPercent}% · ${computeGrade(matricPercent)})`],
                  ["Previous school", form.watch("instituteName")],
                  ["Hafiz-e-Quran", form.watch("hafizQuran") ? "Yes" : "No"],
                  ...(admissionType === "second_year" ? ([
                    ["1st-year roll no", form.watch("firstYearRoll") || "—"],
                    ["1st-year reg. no", form.watch("firstYearRegistrationNo") || "—"],
                    ["1st-year marks", `${form.watch("firstYearObtained")} / ${form.watch("firstYearTotal")} (${firstYearPercent}% · ${computeGrade(firstYearPercent)})`],
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
                {applicantPhoto ? " · Photo attached" : " · Photo missing"}
              </p>
              <label className="flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-soft/30 p-4 dark:bg-gold-soft/20">
                <Checkbox
                  checked={Boolean(form.watch("infoLocked"))}
                  onCheckedChange={(v) => form.setValue("infoLocked", (Boolean(v) || false) as true)}
                />
                <span className="text-small">
                  <span className="font-semibold flex items-center gap-1.5"><Lock className="h-4 w-4" aria-hidden /> Information lock acknowledgement</span>
                  <span className="mt-1 block text-muted-foreground">
                    I understand that, like the HED portal, the personal information above will be
                    <strong> locked after submission</strong> and cannot be changed without
                    contacting the school office. I have reviewed every field.
                  </span>
                  <span className="mt-1.5 block font-urdu text-right text-muted-foreground" lang="ur" dir="rtl">
                    میں سمجھتا/سمجھتی ہوں کہ جمع کرنے کے بعد معلومات تبدیل نہیں کی جا سکتیں۔
                  </span>
                </span>
              </label>
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
              {(errors.declaration || errors.infoLocked) && (
                <p className="text-small font-semibold text-destructive" role="alert">
                  {errors.declaration?.message ?? errors.infoLocked?.message}
                </p>
              )}
              {confirmingSubmit && (
                <p className="flex items-start gap-2.5 rounded-xl border border-gold/60 bg-gold-soft/50 p-4 text-small dark:bg-gold-soft/30" role="alert">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-strong dark:text-gold" aria-hidden />
                  <span>
                    <span className="font-bold">Final confirmation required.</span> Click
                    &quot;Submit Application&quot; again to confirm. Once submitted, your
                    personal information will be locked.
                  </span>
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
              {submitting ? "Submitting…" : confirmingSubmit ? "Confirm & Submit" : "Submit Application"}
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

function DocUploadField({
  label,
  required,
  file,
  onChange,
}: {
  label: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-small font-semibold">
        {label}
        {required && <span className="ml-1 text-gold-strong dark:text-gold" aria-label="required">*</span>}
      </span>
      <span className="flex items-center gap-2">
        {file ? (
          <>
            <Check className="h-4 w-4 text-primary" aria-hidden />
            <span className="max-w-32 truncate text-xs text-muted-foreground">{file.name}</span>
          </>
        ) : null}
        <span className="relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-bold hover:border-gold">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {file ? "Replace" : "Attach"}
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
              onChange(f);
            }}
          />
        </span>
      </span>
    </label>
  );
}

function PhotoUploadField({
  value,
  onChange,
}: {
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {previewUrl ? (
        <img src={previewUrl} alt="Photo preview" className="h-24 w-20 rounded-lg border border-border object-cover" />
      ) : (
        <div className="flex h-24 w-20 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 text-center text-xs text-muted-foreground">
          No photo
        </div>
      )}
      <label className="relative inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-5 text-small font-bold hover:border-gold">
        <Upload className="h-4 w-4" aria-hidden />
        {value ? "Replace photo" : "Upload photo"}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 5 * 1024 * 1024) {
              toast({ title: "Photo too large", description: "Keep the photo under 5 MB.", variant: "destructive" });
              return;
            }
            onChange(f);
          }}
        />
      </label>
    </div>
  );
}
