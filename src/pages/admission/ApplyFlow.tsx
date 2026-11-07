/**
 * ApplyFlow — the applicant's application journey:
 *   1. Application form   (program → quota → conditional quota criteria →
 *                          declaration → Submit Application)
 *   2. Confirm Admission Request (full review + fee + Go Back / Submit)
 *   3. After Submit — ONE screen: tracking ID + payment reference, Fee Challan /
 *      Application PDF downloads on top, then Pay Online / Manual, then
 *      "Pay Later · Go to Dashboard". Nothing here navigates by accident.
 *
 * EDITING: only possible BEFORE the final Submit (Edit Application on the Confirm
 * step, or the per-section Edit links). After Submit the application is locked.
 *
 * Validation messages: Open Merit blocked for local-UC applicants,
 * duplicate-application block, overage notices and similar eligibility rules.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2, Send, ChevronLeft, Wallet, AlertCircle, CheckCircle2,
  Printer, Landmark, Info, PencilLine, FileText, UserRound, BookOpen, ClipboardList, ShieldCheck, LayoutDashboard,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionReviewTable from "@/components/shared/AdmissionReviewTable";
import AdmissionSessionRetry from "@/components/shared/AdmissionSessionRetry";
import OnlinePayPanel from "@/components/shared/OnlinePayPanel";
import { useAdmissionSettings, cycleLabel } from "@/hooks/useAdmission";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";
import { downloadFeeChallan, downloadApplicationForm } from "@/lib/admissionPdf";
import AdmissionStepper from "@/components/shared/AdmissionStepper";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import Turnstile from "@/components/shared/Turnstile";
import { clearDraft, getWip, setWip } from "@/lib/admissionDraft";
import {
  interApi, setToken, isAdmissionNetworkError, QUOTAS, QUOTA_LABEL, LOCAL_CRITERIA, SPORT_CERTIFICATES,
  DISABILITY_TYPES, ADMISSION_MESSAGES, COLLEGE_NAME, STUDY_LEVEL,
  formatCnic, formatDateLong, DISTRICTS,
} from "@/lib/interAdmission";

type Step = "form" | "confirm" | "done";

interface Criteria {
  criteria: string;            // local_quota: domicile_of_area | father_serve_area
  parent_department: string;
  parent_serving_district: string;
  payslip_notice: boolean;
  sport_certificate: string;
  nature_of_disability: string;
  declaration: boolean;
}

const EMPTY_CRITERIA: Criteria = {
  criteria: "", parent_department: "", parent_serving_district: "",
  payslip_notice: false, sport_certificate: "", nature_of_disability: "",
  declaration: false,
};

/** swal-style dialog */
function SwalDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-card rounded-2xl shadow-2xl border border-border max-w-sm w-full p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-sm font-semibold text-foreground leading-relaxed">{message}</p>
        <Button onClick={onClose} className="mt-5 h-10 px-8 font-semibold bg-red-500 hover:bg-red-600">OK</Button>
      </motion.div>
    </div>
  );
}

export default function ApplyFlow() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?edit=<id> → edit an existing UNPAID application instead of creating a new one.
  // The tracking id and payment reference are preserved by the RPC.
  const editId = searchParams.get("edit");
  const isEditing = Boolean(editId);
  // Editing needs the private session of an already-submitted application;
  // a NEW application runs from the on-device draft (no account, no login).
  const { session, loading, token, isDraft, refresh, netError } = useInterSession({ requireToken: isEditing });
  // True while a brand-new application is still only a draft on this device:
  // nothing is in the database until the captcha-verified Submit on the
  // confirm step.
  const draftMode = isDraft && !isEditing;
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  // If the site has no Turnstile key the gateway skips the check, so the
  // Submit button must not wait for a token that can never arrive.
  const turnstileRequired = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);
  const handleTurnstileToken = useCallback((t: string) => setTurnstileToken(t), []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(""), []);

  const [step, setStep] = useState<Step>("form");
  const { data: admSettings } = useAdmissionSettings();
  const PROCESSING_FEE = admSettings?.processing_fee ?? 100;
  const ADMISSION_CYCLE = cycleLabel(admSettings);
  const [programId, setProgramId] = useState<number | "">("");
  const [quota, setQuota] = useState<string>("");
  const [criteria, setCriteria] = useState<Criteria>(EMPTY_CRITERIA);
  const [subjectGroup, setSubjectGroup] = useState<string>("");
  const [dialog, setDialog] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quotaChecking, setQuotaChecking] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ application_id: string; tracking_id: string } | null>(null);
  const [payResult, setPayResult] = useState<{ token: string; deadline: string; tracking_id: string } | null>(null);

  // ── Programs from RPC ─────────────────────────────────────────────────
  // SAME query key as the public admission page ("inter-programs-public") —
  // previously this page used "inter-programs", so every applicant's visit
  // issued a SECOND identical fetch (double CDN hit + double fallback query
  // when the function is cold). One key, one fetch, shared cache.
  const { data: programsData } = useQuery({
    queryKey: ["inter-programs-public"],
    queryFn: () => interApi.programsList() as Promise<unknown>,
    staleTime: ADMISSION_CLIENT_CACHE.programsStaleMs,
  });
  const programs = useMemo(() => {
    const d = programsData as unknown as Array<{
      id: number; name: string; seats: number;
      subject_groups?: Array<{ id: number; name: string }>;
    }> | null;
    return Array.isArray(d) ? d : [];
  }, [programsData]);

  const program = programs.find((p) => p.id === programId);

  // ── Autosave of the half-filled application form (new applications only) ──
  const [wipReady, setWipReady] = useState(false);
  useEffect(() => {
    if (!draftMode) return;
    const w = getWip<{ programId: number | ""; quota: string; criteria: Criteria; subjectGroup: string }>("apply");
    if (w) {
      setProgramId(w.programId ?? "");
      setQuota(w.quota ?? "");
      setCriteria({ ...EMPTY_CRITERIA, ...(w.criteria || {}) });
      setSubjectGroup(w.subjectGroup ?? "");
      // Coming back from "Edit" on the Confirm step → straight back to Confirm.
      if (searchParams.get("step") === "confirm" && w.programId && w.quota && w.criteria?.declaration) {
        setStep("confirm");
      } else if (w.programId || w.quota) {
        toast.success("Your unsaved progress was restored.", { id: "wip-restored" });
      }
    }
    setWipReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMode]);
  useEffect(() => {
    if (!draftMode || !wipReady) return;
    const t = setTimeout(() => setWip("apply", { programId, quota, criteria, subjectGroup }), 400);
    return () => clearTimeout(t);
  }, [draftMode, wipReady, programId, quota, criteria, subjectGroup]);

  const personal = session?.personal;
  const ssc = session?.ssc;
  // Snapshot taken at the moment of the final Submit, so the finished screen
  // never depends on the session reloading underneath it.
  const [snap, setSnap] = useState<{ personal: NonNullable<typeof personal>; ssc: NonNullable<typeof ssc>; cnic: string } | null>(null);
  const [authToken, setAuthToken] = useState("");

  // Profiles must be complete before applying
  useEffect(() => {
    if (!loading && !submitResult && session?.ok && (!session?.personal || !session?.ssc)) {
      toast.error("Please complete your Personal Information and Matric Profile before applying.");
      navigate("/admission/portal");
    }
  }, [loading, session, submitResult, navigate]);

  // Editing a SUBMITTED application is no longer possible — it is final once
  // submitted. Old ?edit= links just open the application.
  useEffect(() => {
    if (!isEditing || !editId) return;
    toast("Your application has been submitted and can no longer be edited.", { icon: "🔒", id: "locked" });
    navigate(`/admission/application/${editId}`, { replace: true });
  }, [isEditing, editId, navigate]);

  // ONE admission request per applicant: if an active application already
  // exists, a NEW application cannot be started — open the existing one.
  useEffect(() => {
    if (isEditing || loading || !session?.ok || submitResult || step !== "form") return;
    const active = (session.applications ?? []).find((a) => !["cancelled", "rejected"].includes(a.status));
    if (active) {
      toast("You already have an admission request. Opening it.", { icon: "ℹ️", id: "one-app" });
      navigate(`/admission/application/${active.id}`, { replace: true });
    }
  }, [isEditing, loading, session, submitResult, step, navigate]);

  // ── Quota change → cascade behaviour ─────────────────────────────
  // Slow-internet rule: the eligibility RPC can be slow, so the select shows
  // the choice IMMEDIATELY with a small "checking…" hint; a network failure
  // never blocks the choice — the server re-checks everything on submit.
  async function handleQuotaChange(q: string) {
    setQuota(q);
    // reset conditional fields when quota changes ( reset_form())
    setCriteria({ ...EMPTY_CRITERIA });
    if (!q || (!token && !personal)) return;
    setQuotaChecking(true);
    try {
      // shows the swal immediately for local applicants picking Open Merit
      const res = (await (token
        ? interApi.checkQuota(token, q, null)
        : interApi.checkQuotaDraft(personal as unknown as Record<string, unknown>, q, null))) as unknown as {
        ok?: boolean; error?: string; warning?: string; needs?: string;
      };
      // `needs` = a follow-up field (criteria, certificate, etc.) is still to be filled — not a block.
      if (res?.ok === false && res.error && !res.needs) {
        setDialog(res.error);           // e.g. "Your domicile is local; therefore, apply on Local Quota."
        setQuota("");                   // resets the select
        return;
      }
      if (res?.warning) {
        toast(res.warning, { icon: "⚠️", duration: 6000 });
      }
    } catch {
      toast("Couldn't verify this category right now — it will be checked again when you submit.", { icon: "📡", duration: 5000 });
    } finally {
      setQuotaChecking(false);
    }
  }

  // ── Submit application ────────────────────────────────────────────────
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    if (!programId) { toast.error("Please select a Program."); return; }
    if (!quota) { toast.error("Please select a Category of Admission (quota)."); return; }
    if (quota === "local_quota" && !criteria.criteria) {
      toast.error("Please select Criteria for Local Quota."); return;
    }
    if (program?.subject_groups?.length && !subjectGroup) {
      toast.error("Please select a Subject Group."); return;
    }
    // NEW application on a draft: verify eligibility against the on-device
    // draft (read-only), then show the confirm step.  NOTHING is saved yet.
    if (draftMode) {
      if (!personal || !ssc) return;
      setBusy(true);
      try {
        const chk = (await interApi.checkQuotaDraft(
          personal as unknown as Record<string, unknown>, quota,
          criteria as unknown as Record<string, unknown>,
        )) as unknown as { ok?: boolean; error?: string };
        if (chk?.ok === false && chk.error && !isAdmissionNetworkError(chk)) {
          setInlineError(chk.error);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        // A network failure here is not a verdict — the server re-checks
        // everything again at the final Submit.
        setStep("confirm");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const res = (await interApi.submitApplication(
        token!, Number(programId), quota, criteria as unknown as Record<string, unknown>,
        program?.subject_groups?.length ? subjectGroup : null,
      )) as unknown as {
        ok?: boolean; error?: string; needs?: string;
        application_id?: string; tracking_id?: string;
      };
      if (res?.ok && res.application_id) {
        if (personal && ssc) setSnap({ personal, ssc, cnic: session?.applicant?.cnic_formb ?? "" });
        setAuthToken(token ?? "");
        await finishSubmission(res.application_id, res.tracking_id ?? "", token ?? "");
      } else if (res?.error) {
        setInlineError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error("Could not submit your application.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── After a successful submit: create the payment reference straight away so
  // the Fee Challan, the Application PDF and the payment panel all work at once.
  async function finishSubmission(applicationId: string, trackingId: string, tok: string) {
    setSubmitResult({ application_id: applicationId, tracking_id: trackingId });
    setStep("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = (await interApi.proceedPayment(tok, applicationId)) as unknown as {
        ok?: boolean; token?: string; deadline?: string; tracking_id?: string;
      };
      if (res?.ok && res.token) {
        setPayResult({ token: res.token, deadline: res.deadline ?? "", tracking_id: res.tracking_id ?? trackingId });
        refresh();
      }
    } catch { /* the buttons below retry on demand */ }
  }

  // Returns the payment reference, creating it on demand if it does not exist yet.
  async function ensureReference(): Promise<{ token: string; deadline: string; tracking_id: string } | null> {
    if (payResult) return payResult;
    if (!submitResult) return null;
    const tok = authToken || token || "";
    try {
      const res = (await interApi.proceedPayment(tok, submitResult.application_id)) as unknown as {
        ok?: boolean; error?: string; token?: string; deadline?: string; tracking_id?: string;
      };
      if (res?.ok && res.token) {
        const r = { token: res.token, deadline: res.deadline ?? "", tracking_id: res.tracking_id ?? submitResult.tracking_id };
        setPayResult(r);
        return r;
      }
      toast.error(res?.error || "Payment initialization failed.");
    } catch {
      toast.error("Network error. Please try again.");
    }
    return null;
  }

  async function handleChallan() {
    const p = snap?.personal ?? personal;
    if (!p) return;
    const ref = await ensureReference();
    if (!ref) return;
    try {
      await downloadFeeChallan({
        cycle: ADMISSION_CYCLE, fee: PROCESSING_FEE, reference: ref.token,
        trackingId: ref.tracking_id, name: p.full_name, fatherName: p.father_name,
        cnic: formatCnic(snap?.cnic ?? session?.applicant?.cnic_formb ?? ""), mobile: p.mobile_number,
        program: program?.name ?? "", subjectGroup: subjectGroup || "N/A", quota: quotaLabel,
        deadline: ref.deadline, appliedOn: formatDateLong(new Date()),
        methods: admSettings?.payment_methods ?? [],
      });
    } catch {
      toast.error("Could not create the challan. Please try again.");
    }
  }

  async function handleApplicationPdf() {
    const p = snap?.personal ?? personal;
    const sc = snap?.ssc ?? ssc;
    if (!p || !sc || !submitResult) return;
    const ref = await ensureReference();
    const cnic = formatCnic(snap?.cnic ?? session?.applicant?.cnic_formb ?? "");
    try {
      await downloadApplicationForm({
        cycle: ADMISSION_CYCLE, trackingId: submitResult.tracking_id, paymentStatus: "Pending",
        reference: ref?.token ?? "", fee: PROCESSING_FEE, declaration: ADMISSION_MESSAGES.declaration,
        institution: COLLEGE_NAME, username: cnic, deadline: ref?.deadline ?? "", appliedOn: formatDateLong(new Date()),
        applicant: { name: String(p.full_name), fatherName: String(p.father_name), cnic,
          address: String(p.mailing_address ?? ""), program: program?.name ?? "" },
        sections: [
          { title: "Application Details", rows: [
            ["College", COLLEGE_NAME], ["Study Level", STUDY_LEVEL],
            ["Program", program?.name ?? ""], ["Subject Group", subjectGroup || ""],
            ["Category", quotaLabel], ["Shift", "Morning"],
          ] },
          { title: "Personal Information", rows: [
            ["Name", String(p.full_name)], ["Father Name", String(p.father_name)],
            ["Applicant CNIC", cnic], ["Father CNIC", formatCnic(String(p.father_cnic ?? ""))],
            ["Date of Birth", formatDateLong(String(p.date_of_birth))], ["Gender", String(p.gender)],
            ["Mobile", String(p.mobile_number)], ["Father Mobile", String(p.father_mobile ?? "")],
            ["Nationality", String(p.nationality)], ["Religion", String(p.religion)],
            ["Province", String(p.domicile_province)], ["District", String(p.domicile_district)],
            ["Tehsil", String(p.tehsil)], ["Union Council", String(p.union_council)],
            ["Mailing Address", String(p.mailing_address)], ["", ""],
          ] },
          { title: "Academic Information", rows: [
            ["Exam", "SSC"], ["Exam Session", String(sc.exam_session)],
            ["Board", String(sc.exam_board)], ["Passing Year", String(sc.passing_year)],
            ["Study Group", String(sc.study_group)], ["Roll No", String(sc.roll_number)],
            ["Marks", `${sc.marks_obtained} / ${sc.marks_total} (${sc.marks_percentage}%)`], ["Grade", String(sc.grade)],
            ["Hafiz e Quran", sc.hafiz_e_quran ? "Yes" : "No"], ["Institute District", String(sc.institute_district)],
            ["Institute", String(sc.institute_name)], ["", ""],
          ] },
        ],
      });
    } catch {
      toast.error("Could not create the form. Please try again.");
    }
  }

  // ── FINAL SUBMIT (no account) ─────────────────────────────────────────────
  // Turnstile-verified, ONE atomic server write: applicant + personal + matric
  // + application together, or nothing.  Returns a private session so the
  // applicant continues straight to payment on this device.
  async function handleFinalSubmit() {
    if (!personal || !ssc || !programId || !quota) return;
    if (turnstileRequired && !turnstileToken) { toast.error("Please complete the security check above first."); return; }
    setBusy(true);
    try {
      const res = (await interApi.apply({
        nationality: session?.applicant?.nationality ?? personal.nationality,
        cnic: session?.applicant?.cnic_formb ?? "",
        personal: personal as unknown as Record<string, unknown>,
        ssc: ssc as unknown as Record<string, unknown>,
        programId: Number(programId),
        quota,
        criteria: criteria as unknown as Record<string, unknown>,
        subjectGroup: program?.subject_groups?.length ? subjectGroup : null,
        turnstile: turnstileToken,
      })) as unknown as {
        ok?: boolean; error?: string; token?: string; application_id?: string; tracking_id?: string;
      };
      if (res?.ok && res.token && res.application_id) {
        setSnap({ personal, ssc, cnic: session?.applicant?.cnic_formb ?? "" });
        setAuthToken(res.token);
        setToken(res.token);          // private session on this device
        clearDraft();                 // the draft has been committed
        toast.success("Application submitted successfully.");
        await finishSubmission(res.application_id, res.tracking_id ?? "", res.token);
      } else {
        setDialog(res?.error || "Could not submit your application. Please try again.");
        // a Turnstile token is single-use — ask for a fresh one
        setTurnstileToken("");
        setTurnstileKey((k) => k + 1);
      }
    } catch {
      toast.error("Network error. Please try again.");
      setTurnstileToken("");
      setTurnstileKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  if (isEditing) return null;

  if (loading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-16 max-w-2xl space-y-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      </PageLayout>
    );
  }

  // Session could not be loaded because of the network (after retries) — one
  // calm retry card instead of a form whose every submit would fail.
  if (netError && !session) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission/portal" />
          <AdmissionSessionRetry
            what="your application"
            onRetry={refresh}
            backTo={{ to: "/admission/portal", label: "Back to Dashboard" }}
          />
        </div>
      </PageLayout>
    );
  }

  const quotaLabel = QUOTA_LABEL[quota] ?? quota;

  const sel = "block w-full min-w-0 max-w-full truncate h-11 rounded-xl border border-input bg-background px-3 text-sm";

  return (
    <PageLayout>
      {dialog && <SwalDialog message={dialog} onClose={() => setDialog(null)} />}
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <AdmissionBackBar
          onClick={() => {
            if (step === "confirm") { setStep("form"); window.scrollTo({ top: 0, behavior: "auto" }); }
            else navigate("/admission/portal");
          }}
        />
        <div className="mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground">
            {step === "done" ? "Application Submitted" : "Admission Request"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "done"
              ? "Your request has been received. Complete the processing fee to confirm it."
              : <>{STUDY_LEVEL} · {COLLEGE_NAME}. Fields with <span className="text-red-500 font-bold">*</span> are mandatory.</>}
          </p>
        </div>

        <AdmissionStepper
          current={({ form: 1, confirm: 2, done: 3 } as Record<string, number>)[step]}
          steps={["Application", "Confirm", "Payment", "Done"]}
        />

        {/* ═══ STEP 1 — APPLICATION FORM ═══ */}
        {step === "form" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-4 rounded-xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground leading-snug">
              <p className="font-bold text-foreground text-[12px] mb-1">INSTRUCTIONS:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>One admission request per applicant — choose program and category carefully.</li>
                <li>Review and edit on the next step. After Submit, it is final.</li>
                <li>Pay the processing fee before the deadline.</li>
              </ul>
            </div>

            <Card className="border-border/80 shadow-card">
              <CardContent className="p-5 sm:p-7">
                {/* Inline submit errors */}
                {inlineError && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-3.5 text-[13px] font-semibold text-red-700 dark:text-red-300"
                    role="alert">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{inlineError}</span>
                  </motion.div>
                )}
                <form onSubmit={handleSubmitForm} className="space-y-5">
                  {/* College (fixed) */}
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-[13px]">College <span className="text-red-500">*</span></Label>
                    <div className="h-11 rounded-xl bg-muted border border-border flex items-center px-3 text-sm font-semibold text-foreground">
                      <Landmark className="w-4 h-4 mr-2 text-primary shrink-0" /> {COLLEGE_NAME}
                    </div>
                  </div>

                  {/* Study level (fixed) */}
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-[13px]">Level of Studies <span className="text-red-500">*</span></Label>
                    <div className="h-11 rounded-xl bg-muted border border-border flex items-center px-3 text-sm font-semibold text-foreground">
                      {STUDY_LEVEL}
                    </div>
                  </div>

                  {/* Program */}
                  <div className="space-y-1.5">
                    <Label htmlFor="program" className="font-semibold text-[13px]">Program <span className="text-red-500">*</span></Label>
                    <select id="program" className={sel} value={programId}
                      onChange={(e) => {
                        setProgramId(e.target.value ? Number(e.target.value) : "");
                        setSubjectGroup("");   // resets downstream selects on program change
                      }} required>
                      <option value="">Select a Program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.seats} seats)</option>
                      ))}
                    </select>
                  </div>

                  {/* Quota */}
                  <div className="space-y-1.5">
                    <Label htmlFor="quota" className="font-semibold text-[13px]">
                      Category of Admission <span className="text-red-500">*</span>
                      {quotaChecking && <Loader2 className="ml-1.5 inline h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </Label>
                    <select id="quota" className={sel} value={quota} onChange={(e) => handleQuotaChange(e.target.value)} required>
                      <option value="">Select a Category</option>
                      {QUOTAS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                  </div>

                  {/* Local quota criteria quota_j_type */}
                  {quota === "local_quota" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 rounded-xl border border-azure/30 bg-azure-soft/40 dark:bg-azure-soft/15 p-4">
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-[13px]">Criteria for Local Quota <span className="text-red-500">*</span></Label>
                        <select className={sel} value={criteria.criteria}
                          onChange={(e) => setCriteria((c) => ({ ...c, criteria: e.target.value }))} required>
                          <option value="">Select Criteria for Local Quota</option>
                          {LOCAL_CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      {criteria.criteria === "father_serve_area" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="font-semibold text-[13px]">Name of Department / College in which Parent is serving <span className="text-red-500">*</span></Label>
                            <Input className="h-11" placeholder="Name of Department" value={criteria.parent_department}
                              onChange={(e) => setCriteria((c) => ({ ...c, parent_department: e.target.value }))} required />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-semibold text-[13px]">Parent / Spouse Serving District <span className="text-red-500">*</span></Label>
                            <select className={sel} value={criteria.parent_serving_district}
                              onChange={(e) => setCriteria((c) => ({ ...c, parent_serving_district: e.target.value }))} required>
                              <option value="">Select District…</option>
                              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-primary w-4 h-4" checked={criteria.payslip_notice}
                              onChange={(e) => setCriteria((c) => ({ ...c, payslip_notice: e.target.checked }))} required />
                            <span className="text-muted-foreground">
                              I undertake to attach the payslip of my parent/spouse with the application form at the college.
                              <span className="text-red-500 font-bold"> *</span>
                            </span>
                          </label>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Sports quota */}
                  {quota === "sports" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1.5 rounded-xl border border-azure/30 bg-azure-soft/40 dark:bg-azure-soft/15 p-4">
                      <Label className="font-semibold text-[13px]">Sports Participation Certificate <span className="text-red-500">*</span></Label>
                      <select className={sel} value={criteria.sport_certificate}
                        onChange={(e) => setCriteria((c) => ({ ...c, sport_certificate: e.target.value }))} required>
                        <option value="">Select a Sport participation Certificate</option>
                        {SPORT_CERTIFICATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </motion.div>
                  )}

                  {/* College employees quota */}
                  {quota === "college_employees" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4 rounded-xl border border-azure/30 bg-azure-soft/40 dark:bg-azure-soft/15 p-4">
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-[13px]">Name of Department / College in which Parent is serving <span className="text-red-500">*</span></Label>
                        <Input className="h-11" placeholder="Name of Department" value={criteria.parent_department}
                          onChange={(e) => setCriteria((c) => ({ ...c, parent_department: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-[13px]">Parent / Spouse Serving District <span className="text-red-500">*</span></Label>
                        <select className={sel} value={criteria.parent_serving_district}
                          onChange={(e) => setCriteria((c) => ({ ...c, parent_serving_district: e.target.value }))} required>
                          <option value="">Select District…</option>
                          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
                        <input type="checkbox" className="mt-0.5 accent-primary w-4 h-4" checked={criteria.payslip_notice}
                          onChange={(e) => setCriteria((c) => ({ ...c, payslip_notice: e.target.checked }))} required />
                        <span className="text-muted-foreground">
                          I undertake to attach the payslip of my parent/spouse with the application form at the college.
                          <span className="text-red-500 font-bold"> *</span>
                        </span>
                      </label>
                    </motion.div>
                  )}

                  {/* Special person quota */}
                  {quota === "special_person" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1.5 rounded-xl border border-azure/30 bg-azure-soft/40 dark:bg-azure-soft/15 p-4">
                      <Label className="font-semibold text-[13px]">Nature of Disability <span className="text-red-500">*</span></Label>
                      <select className={sel} value={criteria.nature_of_disability}
                        onChange={(e) => setCriteria((c) => ({ ...c, nature_of_disability: e.target.value }))} required>
                        <option value="">Select Nature of Disability</option>
                        {DISABILITY_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </motion.div>
                  )}

                  {/* Subject Group cascade step 7 (only when the program defines groups) */}
                  {!!program?.subject_groups?.length && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1.5">
                      <Label htmlFor="subject-group" className="font-semibold text-[13px]">
                        Subject Group <span className="text-red-500">*</span>
                      </Label>
                      <select id="subject-group" className={sel} value={subjectGroup}
                        onChange={(e) => setSubjectGroup(e.target.value)} required>
                        <option value="">Select a Subject Group</option>
                        {program.subject_groups.map((g) => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}

                  {/* Declaration */}
                  <div className="rounded-xl border border-border p-4">
                    <Label className="font-semibold text-[13px]">Declaration <span className="text-red-500">*</span></Label>
                    <label className="flex items-start gap-2.5 mt-2 text-[13px] cursor-pointer">
                      <input type="checkbox" className="mt-0.5 accent-primary w-4 h-4" checked={criteria.declaration}
                        onChange={(e) => setCriteria((c) => ({ ...c, declaration: e.target.checked }))} required />
                      <span>
                        <span className="font-semibold">Yes, I agree.</span>{" "}
                        <span className="text-muted-foreground">{ADMISSION_MESSAGES.declaration}</span>
                      </span>
                    </label>
                  </div>

                  <Button type="submit" disabled={busy} className="w-full h-10 font-semibold text-[13px]">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Continue to Review
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 2 — CONFIRM ADMISSION REQUEST (last chance to edit) ═══ */}
        {step === "confirm" && draftMode && personal && ssc && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/10 to-transparent p-4 text-center">
              <h2 className="font-heading text-lg font-bold text-foreground">Confirm Admission Request</h2>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted-foreground">
                Review every detail. Use <strong className="text-foreground">Edit</strong> to change anything now —
                after you submit, the application is final and cannot be edited. Processing fee: <strong className="text-foreground">Rs {PROCESSING_FEE}</strong>.
              </p>
            </div>

            <AdmissionReviewTable
              title="Application"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              onEdit={() => { setStep("form"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              rows={[
                { label: "College", value: `${COLLEGE_NAME} (Mohmand)`, wide: true },
                { label: "Admission Cycle", value: ADMISSION_CYCLE },
                { label: "Study Level", value: STUDY_LEVEL },
                { label: "Program", value: program?.name ?? "" },
                { label: "Subject Group", value: subjectGroup || "N/A" },
                { label: "Category", value: `${quotaLabel}${quota === "local_quota" && criteria.criteria === "domicile_of_area" ? ` (Domicile of Local Area: ${personal.union_council})` : ""}`, wide: true },
                { label: "Shift", value: "Morning" },
                { label: "Date", value: formatDateLong(new Date()) },
                { label: "Username (CNIC)", value: formatCnic(session?.applicant?.cnic_formb ?? "") },
                { label: "Tracking ID", value: "Given on submit" },
              ]}
            />

            <AdmissionReviewTable
              title="Personal Information"
              icon={<UserRound className="h-3.5 w-3.5" />}
              editTo="/admission/profile?return=confirm"
              rows={[
                { label: "Name", value: personal.full_name },
                { label: "Father Name", value: personal.father_name },
                { label: "Mobile", value: personal.mobile_number },
                { label: "Father Mobile", value: personal.father_mobile },
                { label: "Applicant CNIC", value: formatCnic(session?.applicant?.cnic_formb ?? "") },
                { label: "Father CNIC", value: formatCnic(personal.father_cnic) },
                { label: "Date of Birth", value: formatDateLong(personal.date_of_birth) },
                { label: "Gender", value: personal.gender },
                { label: "Nationality", value: personal.nationality },
                { label: "Religion", value: personal.religion },
                { label: "Province", value: personal.domicile_province },
                { label: "District", value: personal.domicile_district },
                { label: "Tehsil", value: personal.tehsil },
                { label: "Union Council", value: personal.union_council },
                { label: "Mailing Address", value: personal.mailing_address, wide: true },
              ]}
            />

            <AdmissionReviewTable
              title="Academic Information"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              editTo="/admission/ssc?return=confirm"
              rows={[
                { label: "Highest Exam", value: "SSC" },
                { label: "Exam Session", value: ssc.exam_session },
                { label: "Board", value: ssc.exam_board },
                { label: "Passing Year", value: String(ssc.passing_year) },
                { label: "Study Group", value: ssc.study_group },
                { label: "Roll No.", value: ssc.roll_number },
                { label: "Net Marks", value: `${ssc.marks_obtained} / ${ssc.marks_total} (${ssc.marks_percentage}%)` },
                { label: "Grade", value: ssc.grade },
                { label: "Sport Certificate", value: ssc.sport_certificate || "N/A" },
                { label: "Hafiz e Quran", value: ssc.hafiz_e_quran ? "Yes" : "No" },
                { label: "Institute District", value: ssc.institute_district },
                { label: "Board Record", value: "Not Verified" },
                { label: "School / College", value: ssc.institute_name, wide: true },
              ]}
            />

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/60 p-3 text-[12.5px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {ADMISSION_MESSAGES.declaration}
            </div>

            {/* Security check — full width, never clipped */}
            <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-card">
              <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Security check
              </p>
              <div className="flex w-full justify-center">
                <div className="min-h-[65px] w-[300px] max-w-full origin-top max-[340px]:scale-[0.86]">
                  <Turnstile
                    key={turnstileKey}
                    size="normal"
                    appearance="always"
                    onToken={handleTurnstileToken}
                    onExpire={handleTurnstileExpire}
                    onError={handleTurnstileExpire}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleFinalSubmit} disabled={busy || (turnstileRequired && !turnstileToken)}
                className="h-10 w-full text-[13.5px] font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Submitting…" : "Submit Application"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ═══ STEP 3 — SUBMITTED: ONE screen (tracking · downloads · pay · later) ═══ */}
        {step === "done" && submitResult && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-green-500/40 bg-green-500/[0.06] px-4 py-3 text-left">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="block text-[14px] text-foreground">Submitted successfully</strong>
                Keep your Tracking ID safe. Your application is final and cannot be edited.
              </p>
            </div>

            <AdmissionReviewTable
              title="Submission Details"
              icon={<FileText className="h-3.5 w-3.5" />}
              rows={[
                { label: "Tracking ID", value: <span className="font-mono text-[14px] font-bold text-primary">{submitResult.tracking_id || "—"}</span> },
                { label: "Payment Reference", value: payResult ? <span className="font-mono text-[14px] font-bold">{payResult.token}</span> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> },
                { label: "Amount", value: `Rs ${PROCESSING_FEE}` },
                { label: "Pay Before", value: payResult?.deadline || "—" },
                { label: "Fee Status", value: <span className="text-amber-600 dark:text-amber-400">Pending</span>, wide: true },
              ]}
            />

            {/* Downloads — directly under the details, they only download */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleChallan} className="h-9 text-[13px] font-semibold">
                <Printer className="h-4 w-4" /> Fee Challan
              </Button>
              <Button variant="outline" onClick={handleApplicationPdf} className="h-9 text-[13px] font-semibold">
                <FileText className="h-4 w-4" /> Application PDF
              </Button>
            </div>

            <Card className="border-border/80 shadow-card">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <h3 className="flex items-center justify-center gap-1.5 font-heading text-[13px] font-semibold uppercase tracking-[0.14em] text-foreground">
                  <Wallet className="h-4 w-4 text-primary" /> Pay Processing Fee
                </h3>
                <OnlinePayPanel
                  token={authToken || token || ""}
                  applicationId={submitResult.application_id}
                  trackingId={submitResult.tracking_id}
                  fee={PROCESSING_FEE}
                  methods={admSettings?.payment_methods ?? []}
                  hasReference={Boolean(payResult)}
                  ensureReference={async () => (await ensureReference()) !== null}
                />
              </CardContent>
            </Card>

            <Button variant="ghost" onClick={() => navigate("/admission/portal")}
              className="h-10 w-full border border-border text-[13px] font-semibold text-muted-foreground">
              <LayoutDashboard className="h-4 w-4" /> Pay Later · Go to Dashboard
            </Button>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
