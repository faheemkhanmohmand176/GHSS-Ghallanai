/**
 * ApplyFlow — mirrors the HED application journey end-to-end:
 *   1. Application form   (program → quota → conditional quota criteria →
 *                          declaration → Submit Application)  [student_submit_application.php]
 *   2. Confirm Admission Request (full review + Rs 100 + Go Back /
 *                          Submit & Pay Application Processing Fee)        [.._confirm.php]
 *   3. Pay Application Processing Fee (details + Proceed with Payment /
 *                          Cancel)                                         [student_pay_application_fee.php]
 *   4. Result — JazzCash token + deadline + tracking ID + print.          [student_view_application.php]
 *
 * All validation messages are the verbatim HED strings (validated live):
 * Open Merit blocked for local-UC applicants, duplicate-application block,
 * quota-specific required fields, overage warnings.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, QUOTAS, QUOTA_LABEL, LOCAL_CRITERIA, SPORT_CERTIFICATES,
  DISABILITY_TYPES, HED_MESSAGES, COLLEGE_NAME, STUDY_LEVEL, ADMISSION_CYCLE,
  PROCESSING_FEE, formatCnic, formatDateLong, formatDeadline, DISTRICTS,
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

/** swal-style dialog (HED uses SweetAlert) */
function SwalDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
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
  const { session, loading, token, refresh } = useInterSession();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("form");
  const [programId, setProgramId] = useState<number | "">("");
  const [quota, setQuota] = useState<string>("");
  const [criteria, setCriteria] = useState<Criteria>(EMPTY_CRITERIA);
  const [subjectGroup, setSubjectGroup] = useState<string>("");
  const [dialog, setDialog] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ application_id: string; tracking_id: string } | null>(null);
  const [payResult, setPayResult] = useState<{ token: string; deadline: string; tracking_id: string } | null>(null);

  // ── Programs from RPC ─────────────────────────────────────────────────
  const { data: programsData } = useQuery({
    queryKey: ["inter-programs"],
    queryFn: () => interApi.programsList() as Promise<unknown>,
    staleTime: 5 * 60 * 1000,
  });
  const programs = useMemo(() => {
    const d = programsData as unknown as Array<{
      id: number; name: string; seats: number;
      subject_groups?: Array<{ id: number; name: string }>;
    }> | null;
    return Array.isArray(d) ? d : [];
  }, [programsData]);

  const program = programs.find((p) => p.id === programId);
  const personal = session?.personal;
  const ssc = session?.ssc;

  // Profiles must be complete before applying (HED rule)
  useEffect(() => {
    if (!loading && session?.ok && (!session?.personal || !session?.ssc)) {
      toast.error("Please complete your Personal Information and Matric Profile before applying.");
      navigate("/admission/portal");
    }
  }, [loading, session, navigate]);

  // ── Quota change → HED cascade behaviour ─────────────────────────────
  async function handleQuotaChange(q: string) {
    setQuota(q);
    // reset conditional fields when quota changes (HED reset_form())
    setCriteria((c) => ({ ...EMPTY_CRITERIA }));
    if (!q) return;
    // HED shows the swal immediately for local applicants picking Open Merit
    const res = (await interApi.checkQuota(token!, q, null)) as unknown as {
      ok?: boolean; error?: string; warning?: string;
    };
    if (res?.ok === false && res.error) {
      setDialog(res.error);           // e.g. "Your domicile is local; therefore, apply on Local Quota."
      setQuota("");                   // HED resets the select
      return;
    }
    if (res?.warning) {
      toast(res.warning, { icon: "⚠️", duration: 6000 });
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
        setSubmitResult({ application_id: res.application_id, tracking_id: res.tracking_id! });
        setStep("confirm");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (res?.error) {
        // HED shows submit errors inline (alert-danger above the form, form not submitted)
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

  // ── Proceed with payment → JazzCash token ─────────────────────────────
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

  const quotaLabel = QUOTA_LABEL[quota] ?? quota;

  const sel = "h-11 rounded-xl border border-input bg-background px-3 text-sm";

  return (
    <PageLayout>
      {dialog && <SwalDialog message={dialog} onClose={() => setDialog(null)} />}
      <div className="container mx-auto px-4 py-10 sm:py-12 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">New Admission Request</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {STUDY_LEVEL} · {ADMISSION_CYCLE} · Fields with <span className="text-red-500 font-bold">*</span> are mandatory.
          </p>
        </div>

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
                {/* Inline submit errors (HED alert-danger, e.g. duplicate application) */}
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
                        setSubjectGroup("");   // HED resets downstream selects on program change
                      }} required>
                      <option value="">Select a Program</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.seats} seats)</option>
                      ))}
                    </select>
                  </div>

                  {/* Quota */}
                  <div className="space-y-1.5">
                    <Label htmlFor="quota" className="font-semibold text-[13px]">Category of Admission <span className="text-red-500">*</span></Label>
                    <select id="quota" className={sel} value={quota} onChange={(e) => handleQuotaChange(e.target.value)} required>
                      <option value="">Select a Category</option>
                      {QUOTAS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground">{HED_MESSAGES.meritNote}</p>
                  </div>

                  {/* Local quota criteria — HED quota_j_type */}
                  {quota === "local_quota" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 rounded-xl border border-azure/30 bg-azure-soft/40 dark:bg-azure-soft/15 p-4">
                      <div className="space-y-1.5">
                        <Label className="font-semibold text-[13px]">Criteria for Local Quota <span className="text-red-500">*</span></Label>
                        <select className={sel} value={criteria.criteria}
                          onChange={(e) => setCriteria((c) => ({ ...c, criteria: e.target.value }))} required>
                          <option value="">Select Criteria for Local Quota</option>
                          {LOCAL_CRITERIA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        {criteria.criteria === "domicile_of_area" && personal && (
                          <p className="text-[11px] text-muted-foreground">
                            Having Domicile of the Local Area ({personal.union_council}) — your domicile district
                            ({personal.domicile_district}) must match the college district (Mohmand).
                          </p>
                        )}
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

                  {/* Subject Group — HED cascade step 7 (only when the program defines groups) */}
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
                      <p className="text-[11px] text-muted-foreground">
                        Subjects included in this group are shown on the confirmed application form.
                      </p>
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
                        <span className="text-muted-foreground">{HED_MESSAGES.declaration}</span>
                      </span>
                    </label>
                  </div>

                  <Button type="submit" disabled={busy} className="w-full h-10 font-semibold text-[13px]">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Submit Application
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 2 — CONFIRM ADMISSION REQUEST ═══ */}
        {step === "confirm" && submitResult && personal && ssc && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <Card className="border-gold/40 bg-gradient-to-b from-gold/5 to-transparent">
              <CardContent className="p-5 sm:p-6">
                <h2 className="font-heading text-xl font-bold text-foreground mb-2">Confirm Admission Request</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Almost there! You are about to confirm your application submission. Before you do, please review
                  your application and make sure you have selected correct options. If you are sure that everything
                  is correct, you can click <strong className="text-foreground">“Submit &amp; Pay Application Processing Fee”</strong> button
                  to pay application processing fee <strong className="text-foreground">(Rs {PROCESSING_FEE})</strong>.
                  You can also click “Go Back” to make any changes.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-card">
              <CardContent className="p-5 sm:p-7 space-y-5">
                {/* Application summary */}
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                  {[
                    ["College", `${COLLEGE_NAME} (Mohmand)`],
                    ["Admission Cycle", ADMISSION_CYCLE],
                    ["Study Level", STUDY_LEVEL],
                    ["Program", program?.name ?? ""],
                    ["Subject Group", subjectGroup || "—"],
                    ["Application Quota", `${quotaLabel}${quota === "local_quota" && criteria.criteria === "domicile_of_area" ? ` — Having Domicile of the Local Area (${personal.union_council})` : ""}`],
                    ["Shift", "Morning"],
                    ["Username", formatCnic(session?.applicant?.cnic_formb ?? "")],
                    ["Tracking ID", submitResult.tracking_id],
                    ["Date Applied", formatDateLong(new Date())],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-2">
                      <span className="text-muted-foreground shrink-0">{k}:</span>
                      <span className="font-semibold text-foreground text-right">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-muted-foreground italic">{HED_MESSAGES.meritNote}</p>

                {/* Personal info review */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Personal Information</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
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
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                        <span className="text-muted-foreground shrink-0">{k}:</span>
                        <span className="font-semibold text-foreground text-right capitalize">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Academic review */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Academic Information</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ["Highest Exam", "SSC"], ["Exam Session", ssc.exam_session],
                      ["Exam Board/Uni", ssc.exam_board],
                      ["Passing Year", String(ssc.passing_year)],
                      ["Study Group", ssc.study_group],
                      ["Roll No.", ssc.roll_number],
                      ["Net Marks", `${ssc.marks_obtained} / ${ssc.marks_total} (${ssc.marks_percentage}%)`],
                      ["Grade", ssc.grade],
                      ["Sport Certificate", ssc.sport_certificate || "—"],
                      ["Hafiz e Quran", ssc.hafiz_e_quran ? "Yes" : "No"],
                      ["School/College Districts", ssc.institute_district],
                      ["Board Record", "Not Verified"],
                      ["School/College", ssc.institute_name],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                        <span className="text-muted-foreground shrink-0">{k}:</span>
                        <span className="font-semibold text-foreground text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-muted/60 border border-border p-3.5 text-[13px] text-muted-foreground">
                  <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" />
                  {HED_MESSAGES.declaration}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => { setStep("form"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="h-12 font-semibold flex-1">
                    <ChevronLeft className="w-5 h-5" /> Go Back
                  </Button>
                  <Button onClick={() => { setStep("pay"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="h-12 font-semibold flex-1">
                    <Wallet className="w-5 h-5" />
                    Submit &amp; Pay Application Processing Fee
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
                <h2 className="font-heading text-xl font-bold text-foreground">Pay Application Processing Fee</h2>

                {/* Applicant Details — HED student_pay_application_fee.php */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Applicant Details</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ["Name", personal.full_name],
                      ["S/O, D/O", personal.father_name],
                      ["Address", personal.mailing_address],
                      ["District", personal.domicile_district],
                      ["Tehsil", personal.tehsil],
                      ["Mobile #", personal.mobile_number],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                        <span className="text-muted-foreground shrink-0">{k}:</span>
                        <span className="font-semibold text-foreground text-right">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Details */}
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-2.5">Payment Details</h3>
                  <div className="rounded-xl border border-gold/40 bg-gold/5 p-4 space-y-2 text-sm">
                    <div className="flex justify-between border-b border-gold/20 pb-2">
                      <span className="text-muted-foreground">Tracking ID</span>
                      <span className="font-mono font-bold text-foreground">{submitResult.tracking_id}</span>
                    </div>
                    <div className="flex justify-between border-b border-gold/20 pb-2">
                      <span className="text-muted-foreground">Processing Fee</span>
                      <span className="font-semibold text-foreground">Rs. {PROCESSING_FEE}/-</span>
                    </div>
                    <div className="flex justify-between border-b border-gold/20 pb-2">
                      <span className="text-muted-foreground">Additional Charges</span>
                      <span className="font-semibold text-foreground">Rs. 0/-</span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="font-bold text-foreground">Total</span>
                      <span className="font-heading font-bold text-foreground">Rs. {PROCESSING_FEE}/-</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={() => navigate("/admission/portal")}
                    className="h-12 font-semibold flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleProceedPayment} disabled={busy} className="h-10 font-semibold flex-1">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                    Proceed with Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══ STEP 4 — DONE: JazzCash token ═══ */}
        {step === "done" && payResult && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
            <Card className="border-green-500/40 shadow-card">
              <CardContent className="p-5 sm:p-7 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
                <h2 className="font-heading text-xl font-bold text-foreground">Application Submitted Successfully</h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Your application has been submitted. Pay the processing fee to complete the process.
                </p>

                <div className="mt-6 grid sm:grid-cols-2 gap-3 text-left">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tracking ID</p>
                    <p className="font-mono font-bold text-lg text-foreground mt-0.5">{payResult.tracking_id}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Processing Fee</p>
                    <p className="font-heading font-bold text-lg text-foreground mt-0.5">Rs {PROCESSING_FEE}/-</p>
                  </div>
                  <div className="rounded-xl border border-gold/50 bg-gold/5 p-4 sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">JazzCash Token</p>
                    <p className="font-mono font-bold text-2xl text-foreground mt-0.5 tracking-wider">{payResult.token}</p>
                    <p className="text-[12.5px] text-muted-foreground mt-2">
                      {HED_MESSAGES.feeTokenNotice(payResult.token, payResult.deadline)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to={`/admission/application/${submitResult?.application_id}`}>
                    <Button className="h-9 px-6 font-semibold">
                      <Printer className="w-5 h-5" /> Print Application
                    </Button>
                  </Link>
                  <Link to="/admission/portal">
                    <Button variant="outline" className="h-9 px-6 font-semibold">
                      <BadgeCheck className="w-5 h-5" /> Go to Dashboard
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
