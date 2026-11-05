/**
 * ApplyFlow — the applicant's application journey:
 *   1. Application form   (program → quota → conditional quota criteria →
 *                          declaration → Submit Application)
 *   2. Confirm Admission Request (full review + fee + Go Back / Submit)
 *   3. Pay Application Processing Fee (online via Safepay, or manual transfer)
 *   4. Result — payment reference + deadline + tracking ID + print.
 *
 * Validation messages: Open Merit blocked for local-UC applicants,
 * duplicate-application block, overage notices and similar eligibility rules.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2, Send, ChevronLeft, Wallet, AlertCircle, CheckCircle2,
  Printer, BadgeCheck, Landmark, Info,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionInfoGrid from "@/components/shared/AdmissionInfoGrid";
import AdmissionSessionRetry from "@/components/shared/AdmissionSessionRetry";
import OnlinePayPanel from "@/components/shared/OnlinePayPanel";
import { useAdmissionSettings, cycleLabel } from "@/hooks/useAdmission";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";
import { downloadFeeChallan } from "@/lib/admissionPdf";
import AdmissionStepper from "@/components/shared/AdmissionStepper";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import SecurityStrip from "@/components/shared/SecurityStrip";
import { clearDraft, getWip, setWip } from "@/lib/admissionDraft";
import {
  interApi, setToken, isAdmissionNetworkError, QUOTAS, QUOTA_LABEL, LOCAL_CRITERIA, SPORT_CERTIFICATES,
  DISABILITY_TYPES, ADMISSION_MESSAGES, COLLEGE_NAME, STUDY_LEVEL,
  formatCnic, formatDateLong, formatDeadline, DISTRICTS,
} from "@/lib/interAdmission";

type Step = "form" | "confirm" | "pay" | "done";

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
  const [editLoadFailed, setEditLoadFailed] = useState<null | "network" | "missing">(null);
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
      if (w.programId || w.quota) toast.success("Your unsaved progress was restored.", { id: "wip-restored" });
    }
    setWipReady(true);
  }, [draftMode]);
  useEffect(() => {
    if (!draftMode || !wipReady) return;
    const t = setTimeout(() => setWip("apply", { programId, quota, criteria, subjectGroup }), 400);
    return () => clearTimeout(t);
  }, [draftMode, wipReady, programId, quota, criteria, subjectGroup]);

  const personal = session?.personal;
  const ssc = session?.ssc;

  // Profiles must be complete before applying
  useEffect(() => {
    if (!loading && session?.ok && (!session?.personal || !session?.ssc)) {
      toast.error("Please complete your Personal Information and Matric Profile before applying.");
      navigate("/admission/portal");
    }
  }, [loading, session, navigate]);

  // ── Edit mode: load the existing application and pre-fill the form ──────
  // Slow-internet rule: a NETWORK failure while loading the application for
  // editing must NOT kick the applicant back to the portal (the old behaviour
  // — they lost the screen and had to find their way back). It shows an
  // inline retry instead; only a definitive "not found / locked" navigates.
  const loadEditApplication = useCallback(async () => {
    if (!editId || !token) return;
    setEditLoadFailed(null);
    const res = (await interApi.applicationDetail(token, editId)) as unknown as {
      ok?: boolean; error?: string;
      application?: Record<string, string | number | boolean | null>;
    };
    const app = res?.application;
    if (isAdmissionNetworkError(res) || (!res?.ok && !res?.error)) {
      setEditLoadFailed("network");
      return;
    }
    if (!res?.ok || !app) {
      setEditLoadFailed("missing");
      return;
    }
    // Lock check — if already paid, the RPC will also refuse, but show a
    // friendly message up front.
    if (String(app.payment_status ?? "") === "paid") {
      toast.error("This application is locked because the fee has been paid.");
      navigate(`/admission/application/${editId}`);
      return;
    }
    // Find the program id from the programs list by name
    const prog = programs.find((p) => p.name === String(app.program_name ?? ""));
    if (prog) setProgramId(prog.id);
    setQuota(String(app.quota ?? ""));
    setSubjectGroup(String(app.subject_group ?? ""));
    setCriteria({
      ...EMPTY_CRITERIA,
      criteria: String(app.quota_criteria ?? "") || EMPTY_CRITERIA.criteria,
    });
  }, [editId, token, programs, navigate]);

  useEffect(() => {
    if (!isEditing || !token || !editId || loading) return;
    let cancelled = false;
    loadEditApplication().catch(() => { if (!cancelled) setEditLoadFailed("network"); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, token, editId, loading, programs]);

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
      // EDIT mode → call inter_edit_application (tracking id + payment ref preserved)
      // NEW mode   → call inter_submit_application (random tracking id generated server-side)
      const res = isEditing && editId
        ? (await interApi.editApplication(
            // BUG FIX (admission): the application id was missing here, so the
            // RPC received the program number as p_application_id and could
            // never find the application — Edit Application always failed.
            token!, editId, Number(programId), quota, criteria as unknown as Record<string, unknown>,
            program?.subject_groups?.length ? subjectGroup : null,
          )) as unknown as {
            ok?: boolean; error?: string; needs?: string;
            application_id?: string; tracking_id?: string;
          }
        : (await interApi.submitApplication(
            token!, Number(programId), quota, criteria as unknown as Record<string, unknown>,
            program?.subject_groups?.length ? subjectGroup : null,
          )) as unknown as {
            ok?: boolean; error?: string; needs?: string;
            application_id?: string; tracking_id?: string;
          };
      if (res?.ok && (res.application_id || editId)) {
        if (isEditing) {
          // Editing only changes the form — no payment step. Go straight to
          // the application view so the applicant sees their (unchanged)
          // tracking id + payment reference.
          toast.success("Application updated. Your Tracking ID and payment reference are unchanged.");
          refresh();
          navigate(`/admission/application/${editId}`);
          return;
        }
        setSubmitResult({ application_id: res.application_id!, tracking_id: res.tracking_id! });
        setStep("confirm");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res?.error) {
        // shows submit errors inline (alert-danger above the form, form not submitted)
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

  // ── Proceed with payment → payment reference ─────────────────────────────
  async function handleChallan() {
    if (!payResult || !personal) return;
    try {
      await downloadFeeChallan({
        cycle: ADMISSION_CYCLE, fee: PROCESSING_FEE, reference: payResult.token,
        trackingId: payResult.tracking_id, name: personal.full_name, fatherName: personal.father_name,
        cnic: formatCnic(session?.applicant?.cnic_formb ?? ""), mobile: personal.mobile_number,
        program: program?.name ?? "", subjectGroup: subjectGroup || "N/A", quota: quotaLabel,
        deadline: payResult.deadline, appliedOn: formatDateLong(new Date()),
        methods: admSettings?.payment_methods ?? [],
      });
    } catch {
      toast.error("Could not create the challan. Please try again.");
    }
  }

  // ── FINAL SUBMIT (no account) ─────────────────────────────────────────────
  // Turnstile-verified, ONE atomic server write: applicant + personal + matric
  // + application together, or nothing.  Returns a private session so the
  // applicant continues straight to payment on this device.
  async function handleFinalSubmit() {
    if (!personal || !ssc || !programId || !quota) return;
    if (turnstileRequired && !turnstileToken) { toast.error("Security check is still verifying. Please wait a moment."); return; }
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
        setToken(res.token);          // private session on this device
        clearDraft();                 // the draft has been committed
        setSubmitResult({ application_id: res.application_id, tracking_id: res.tracking_id ?? "" });
        toast.success("Application submitted. Now pay the processing fee to complete it.");
        setStep("pay");
        window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function handleProceedPayment() {
    if (!submitResult) return;
    setBusy(true);
    try {
      const res = (await interApi.proceedPayment(token!, submitResult.application_id)) as unknown as {
        ok?: boolean; error?: string; token?: string; deadline?: string; tracking_id?: string;
      };
      if (res?.ok && res.token) {
        setPayResult({ token: res.token, deadline: res.deadline ?? "", tracking_id: res.tracking_id ?? submitResult.tracking_id });
        setStep("done");
        refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error(res?.error || "Payment initialization failed.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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

  // Edit mode: the application itself could not be loaded.
  if (editLoadFailed) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission/portal" />
          {editLoadFailed === "network" ? (
            <AdmissionSessionRetry
              what="this application for editing"
              onRetry={() => { void loadEditApplication(); }}
              backTo={{ to: "/admission/portal", label: "Back to Dashboard" }}
            />
          ) : (
            <AdmissionSessionRetry
              what="this application for editing"
              onRetry={() => navigate("/admission/portal")}
              backTo={{ to: "/admission/portal", label: "Back to Dashboard" }}
            />
          )}
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
            else if (step === "pay") { setStep("confirm"); window.scrollTo({ top: 0, behavior: "auto" }); }
            else navigate("/admission/portal");
          }}
        />
        <div className="mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground">
            {isEditing ? "Edit Application" : "New Admission Request"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditing
              ? "Change your program, group or quota. Your Tracking ID and payment reference stay the same."
              : <>{STUDY_LEVEL}. Fields with <span className="text-red-500 font-bold">*</span> are mandatory.</>}
          </p>
        </div>

        <AdmissionStepper
          current={({ form: 1, confirm: 2, pay: 3, done: 4 } as Record<string, number>)[step]}
          steps={["Application", "Confirm", "Payment", "Done"]}
        />

        {/* ═══ STEP 1 — APPLICATION FORM ═══ */}
        {step === "form" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-5 rounded-xl border border-border bg-card p-4 text-[12.5px] text-muted-foreground leading-relaxed">
              <p className="font-bold text-foreground text-[13px] mb-1.5">INSTRUCTIONS:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>For each different category (quota) or program, a separate application must be submitted.</li>
                <li>Only one application can be submitted against the same category of admission of the same program within this college.</li>
                <li>For colleges having morning and evening shifts, candidates with highest merit are offered admission in the Morning Shift.</li>
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
                    {isEditing ? "Save Changes" : "Submit Application"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 2 — CONFIRM ADMISSION REQUEST ═══ */}
        {step === "confirm" && (submitResult || draftMode) && personal && ssc && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <Card className="border-gold/40 bg-gradient-to-b from-gold/5 to-transparent">
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-heading text-xl font-bold text-foreground mb-2">Confirm Admission Request</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {draftMode ? (
                    <>
                      Please review your application. If everything is correct, complete the security check
                      and submit; you will then pay the processing fee of{" "}
                      <strong className="text-foreground">Rs {PROCESSING_FEE}</strong>.
                    </>
                  ) : (
                    <>
                      Please review your application. If everything is correct, continue to pay the
                      processing fee of <strong className="text-foreground">Rs {PROCESSING_FEE}</strong>.
                    </>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-card">
              <CardContent className="p-5 sm:p-7 space-y-5">
                {/* Application summary */}
                <AdmissionInfoGrid items={[
                    ["College", `${COLLEGE_NAME} (Mohmand)`],
                    ["Admission Cycle", ADMISSION_CYCLE],
                    ["Study Level", STUDY_LEVEL],
                    ["Program", program?.name ?? ""],
                    ["Subject Group", subjectGroup || "N/A"],
                    ["Application Quota", `${quotaLabel}${quota === "local_quota" && criteria.criteria === "domicile_of_area" ? ` (Having Domicile of the Local Area: ${personal.union_council})` : ""}`],
                    ["Shift", "Morning"],
                    ["Username", formatCnic(session?.applicant?.cnic_formb ?? "")],
                    ["Tracking ID", submitResult?.tracking_id ?? "Assigned when you submit"],
                    ["Date Applied", formatDateLong(new Date())],
                  ].map(([k, v]) => ({ label: String(k), value: v as React.ReactNode }))} />
                

                {/* Personal info review */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Personal Information</h3>
                  <AdmissionInfoGrid items={[
                      ["Name", personal.full_name], ["Personal Mobile", personal.mobile_number],
                      ["Father Name", personal.father_name], ["Father's Mobile", personal.father_mobile],
                      ["Applicant's CNIC", formatCnic(session?.applicant?.cnic_formb ?? "")],
                      ["Father's CNIC", formatCnic(personal.father_cnic)],
                      ["Date of Birth", formatDateLong(personal.date_of_birth)],
                      ["Gender", personal.gender],
                      ["Nationality", personal.nationality], ["Province", personal.domicile_province],
                      ["Domicile District", personal.domicile_district], ["Tehsil", personal.tehsil],
                      ["Union Council", personal.union_council], ["Religion", personal.religion],
                      ["Mailing Address", personal.mailing_address],
                    ].map(([k, v]) => ({ label: String(k), value: v as React.ReactNode }))} />
                </div>

                {/* Academic review */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Academic Information</h3>
                  <AdmissionInfoGrid items={[
                      ["Highest Exam", "SSC"], ["Exam Session", ssc.exam_session],
                      ["Exam Board/Uni", ssc.exam_board],
                      ["Passing Year", String(ssc.passing_year)],
                      ["Study Group", ssc.study_group],
                      ["Roll No.", ssc.roll_number],
                      ["Net Marks", `${ssc.marks_obtained} / ${ssc.marks_total} (${ssc.marks_percentage}%)`],
                      ["Grade", ssc.grade],
                      ["Sport Certificate", ssc.sport_certificate || "N/A"],
                      ["Hafiz e Quran", ssc.hafiz_e_quran ? "Yes" : "No"],
                      ["School/College Districts", ssc.institute_district],
                      ["Board Record", "Not Verified"],
                      ["School/College", ssc.institute_name],
                    ].map(([k, v]) => ({ label: String(k), value: v as React.ReactNode }))} />
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 border border-border p-3.5 text-[13px] text-muted-foreground">
                  <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                  {ADMISSION_MESSAGES.declaration}
                </div>

                {draftMode && (
                  <SecurityStrip
                    key={turnstileKey}
                    onToken={handleTurnstileToken}
                    onExpire={handleTurnstileExpire}
                  />
                )}

                <div className="flex flex-col gap-2.5">
                  {draftMode ? (
                    <Button onClick={handleFinalSubmit} disabled={busy || (turnstileRequired && !turnstileToken)}
                      className="h-12 w-full font-semibold">
                      {busy || (turnstileRequired && !turnstileToken)
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <Send className="w-5 h-5" />}
                      {busy ? "Submitting…" : turnstileRequired && !turnstileToken ? "Verifying…" : "Submit Application"}
                    </Button>
                  ) : (
                    <Button onClick={() => { setStep("pay"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      className="h-12 w-full font-semibold">
                      <Wallet className="w-5 h-5" />
                      Continue to Payment
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setStep("form"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="h-11 w-full font-semibold">
                    <ChevronLeft className="w-5 h-5" /> Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 3 — PAY APPLICATION PROCESSING FEE ═══ */}
        {step === "pay" && submitResult && personal && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <Card className="border-border/80 shadow-card">
              <CardContent className="p-5 sm:p-7 space-y-6">
                <h2 className="font-heading text-xl font-bold text-foreground text-center">Pay Processing Fee</h2>

                {/* Applicant Details */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5 text-center">Applicant Details</h3>
                  <AdmissionInfoGrid items={[
                      ["Name", personal.full_name],
                      ["Father Name", personal.father_name],
                      ["Address", personal.mailing_address],
                      ["District", personal.domicile_district],
                      ["Tehsil", personal.tehsil],
                      ["Mobile Number", personal.mobile_number],
                    ].map(([k, v]) => ({ label: String(k), value: v as React.ReactNode }))} />
                </div>

                {/* Payment Details */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5 text-center">Payment Details</h3>
                  <AdmissionInfoGrid items={[
                    { label: "Tracking ID", value: <span className="font-mono">{submitResult.tracking_id}</span> },
                    { label: "Total Payable", value: `Rs ${PROCESSING_FEE}` },
                  ]} />
                </div>

                <OnlinePayPanel
                  token={token!}
                  applicationId={submitResult.application_id}
                  trackingId={submitResult.tracking_id}
                  fee={PROCESSING_FEE}
                  methods={admSettings?.payment_methods ?? []}
                  hasReference
                  ensureReference={async () => {
                    const res = (await interApi.proceedPayment(token!, submitResult.application_id)) as unknown as { ok?: boolean; error?: string };
                    if (!res?.ok) { toast.error(res?.error || "Payment initialization failed."); return false; }
                    return true;
                  }}
                />

                <div className="flex flex-col gap-2.5 border-t border-border/60 pt-5">
                  <Button variant="outline" onClick={handleProceedPayment} disabled={busy}
                    className="h-11 w-full border-primary/40 font-semibold text-primary hover:text-primary">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                    Generate Fee Challan
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/admission/portal")}
                    className="h-11 w-full font-semibold text-muted-foreground">
                    Pay Later
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 4: DONE ═══ */}
        {step === "done" && payResult && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
            <Card className="border-green-500/40 shadow-card">
              <CardContent className="p-5 sm:p-7 text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground">Application Submitted</h2>
                <p className="text-sm text-muted-foreground mt-1.5">Pay your processing fee online or by manual transfer, then track your status.</p>

                <div className="mt-5">
                  <AdmissionInfoGrid items={[
                    { label: "Tracking ID", value: <span className="font-mono text-base">{payResult.tracking_id}</span> },
                    { label: "Payment Reference", value: <span className="font-mono text-base">{payResult.token}</span> },
                    { label: "Amount", value: `Rs ${PROCESSING_FEE}` },
                    { label: "Pay Before", value: payResult.deadline },
                  ]} />
                </div>

                <div className="mt-6 text-left">
                  <OnlinePayPanel
                    token={token!}
                    applicationId={submitResult!.application_id}
                    trackingId={payResult.tracking_id}
                    fee={PROCESSING_FEE}
                    methods={admSettings?.payment_methods ?? []}
                    hasReference
                    ensureReference={async () => true}
                  />
                </div>

                <div className="mt-6 space-y-2.5 border-t border-border/60 pt-5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button variant="outline" className="h-11 w-full font-semibold" onClick={handleChallan}>
                      <Printer className="w-4 h-4" /> Fee Challan
                    </Button>
                    <Link to={`/admission/application/${submitResult?.application_id}`} className="block">
                      <Button variant="outline" className="h-11 w-full font-semibold">View Application</Button>
                    </Link>
                  </div>
                  <Link to="/admission/portal" className="block">
                    <Button variant="ghost" className="h-11 w-full font-semibold text-muted-foreground">
                      <BadgeCheck className="w-4 h-4" /> Go to Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
