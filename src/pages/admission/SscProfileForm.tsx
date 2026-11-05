/**
 * SscProfileForm — SSC (Matric) academic profile (manual
 * entry): board, session, passing year, study group, roll number,
 * marks obtained/total, hafiz e quran, sports certificate and school info.
 * Percentage & grade auto-computed
 * (hafiz = +20 marks; A+ ≥ 80%).
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Save, BookOpen, BadgeCheck } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionSessionRetry from "@/components/shared/AdmissionSessionRetry";
import { useQueryClient } from "@tanstack/react-query";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, EXAM_BOARDS, STUDY_GROUPS, EXAM_SESSIONS, SPORT_CERTIFICATES,
  PROVINCES, DISTRICTS, SscProfileData,
} from "@/lib/interAdmission";
import { saveDraftSsc, getWip, setWip, clearWip } from "@/lib/admissionDraft";


const EMPTY: SscProfileData = {
  exam_session: "Annual", exam_board: "", passing_year: "",
  study_group: "", roll_number: "", marks_obtained: "", marks_total: "600",
  hafiz_e_quran: false, sport_certificate: "",
  institute_province: "Khyber Pakhtunkhwa", institute_district: "Mohmand",
  institute_name: "",
};

function gradeFor(pct: number): string {
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

export default function SscProfileForm() {
  const { session, loading, token, isDraft, netError, refresh } = useInterSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SscProfileData>(EMPTY);
  const [busy, setBusy] = useState(false);
  // HYDRATE ONCE — a background session refetch must never reset the marks a
  // student is still typing (see PersonalProfileForm for the full rationale).
  const hydratedRef = useRef(false);
  const [autosaveReady, setAutosaveReady] = useState(false);

  // No saved SSC yet → restore a half-filled form from this device.
  useEffect(() => {
    if (!isDraft || session?.ssc || hydratedRef.current) return;
    const w = getWip<SscProfileData>("ssc");
    if (w) {
      setForm({ ...EMPTY, ...w });
      toast.success("Your unsaved progress was restored.", { id: "wip-restored" });
    }
    setAutosaveReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraft]);

  useEffect(() => {
    if (hydratedRef.current || !session?.ssc) return;
    hydratedRef.current = true;
    setAutosaveReady(true);
    const s = session.ssc;
    setForm({
      exam_session: s.exam_session ?? "Annual",
      exam_board: s.exam_board ?? "",
      passing_year: String(s.passing_year ?? ""),
      study_group: s.study_group ?? "",
      roll_number: s.roll_number ?? "",
      marks_obtained: String(s.marks_obtained ?? ""),
      marks_total: String(s.marks_total ?? "600"),
      hafiz_e_quran: Boolean(s.hafiz_e_quran),
      sport_certificate: s.sport_certificate ?? "",
      institute_province: s.institute_province ?? "Khyber Pakhtunkhwa",
      institute_district: s.institute_district ?? "Mohmand",
      institute_name: s.institute_name ?? "",
    });
  }, [session]);

  const set = <K extends keyof SscProfileData>(k: K, v: SscProfileData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Autosave every change (debounced) while the applicant is mid-way.
  useEffect(() => {
    if (!autosaveReady || !isDraft) return;
    const t = setTimeout(() => setWip("ssc", form), 400);
    return () => clearTimeout(t);
  }, [autosaveReady, isDraft, form]);

  // Live percentage + grade preview
  const preview = useMemo(() => {
    const obt = parseFloat(form.marks_obtained);
    const tot = parseFloat(form.marks_total);
    if (!isNaN(obt) && !isNaN(tot) && tot > 0 && obt >= 0 && obt <= tot) {
      const eff = obt + (form.hafiz_e_quran ? 20 : 0);
      const pct = Math.round((eff / tot) * 10000) / 100;
      return { pct, grade: gradeFor(pct) };
    }
    return null;
  }, [form.marks_obtained, form.marks_total, form.hafiz_e_quran]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const yr = Number(form.passing_year);
    if (!/^\d{4}$/.test(form.passing_year) || yr < 1990 || yr > new Date().getFullYear()) {
      toast.error(`Please enter a valid 4-digit Passing Year (1990 – ${new Date().getFullYear()}).`);
      return;
    }
    setBusy(true);
    try {
      // DRAFT (no account yet) → saved on this device only; the database is
      // written once, at the final captcha-verified Submit.
      const res = (isDraft
        ? saveDraftSsc(form)
        : await interApi.saveSsc(token!, form as unknown as Record<string, unknown>)) as unknown as {
        ok?: boolean; error?: string;
      };
      if (res?.ok) {
        toast.success(`Matric profile saved: ${preview ? `${preview.pct}% (Grade ${preview.grade})` : ""}`);
        clearWip("ssc");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        await queryClient.invalidateQueries({ queryKey: ["inter-session"] });
        // DIRECT FLOW: Matric is the last profile step — if Personal Information
        // is done too (and no application exists yet) go straight to the
        // admission request; otherwise back to the dashboard.
        const hasApp = (session?.applications ?? []).some((a) => !["cancelled", "rejected"].includes(a.status));
        navigate(session?.personal && !hasApp ? "/admission/apply" : "/admission/portal", { replace: true });
      } else {
        toast.error(res?.error || "Could not save your matric profile.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const F = "space-y-1.5 min-w-0";
  const inp = "h-11";
  const sel = `${inp} block w-full min-w-0 max-w-full truncate rounded-xl border border-input bg-background px-3 text-sm`;

  // Session failed for network reasons (after retries) → retry card instead
  // of a form whose save would fail confusingly.
  if (netError && !session) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission/portal" />
          <AdmissionSessionRetry
            what="your matric profile"
            onRetry={refresh}
            backTo={{ to: "/admission/portal", label: "Back to Dashboard" }}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl">
        <AdmissionBackBar to="/admission/portal" />
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Matric Profile</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Required before you can apply.</p>
            </div>
            {session?.ssc && <BadgeCheck className="w-5 h-5 text-green-600 ml-auto shrink-0" />}
          </div>
        </div>


        <Card className="border-border/80 shadow-card">
          <CardContent className="p-5 sm:p-7">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)}</div>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Exam Session <span className="text-red-500">*</span></Label>
                    <select className={sel} value={form.exam_session} onChange={(e) => set("exam_session", e.target.value)} required>
                      {EXAM_SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Exam Board / University <span className="text-red-500">*</span></Label>
                    <select className={sel} value={form.exam_board} onChange={(e) => set("exam_board", e.target.value)} required>
                      <option value="">Select Board / University</option>
                      {EXAM_BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Passing Year <span className="text-red-500">*</span></Label>
                    <Input
                      className={`${inp} font-mono`} inputMode="numeric" autoComplete="off"
                      maxLength={4} placeholder={`e.g. ${new Date().getFullYear()}`}
                      value={form.passing_year}
                      onChange={(e) => set("passing_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
                      required
                    />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Study Group <span className="text-red-500">*</span></Label>
                    <select className={sel} value={form.study_group} onChange={(e) => set("study_group", e.target.value)} required>
                      <option value="">Select Study Group</option>
                      {STUDY_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <div className={F}>
                  <Label className="font-semibold text-[13px]">Roll Number <span className="text-red-500">*</span></Label>
                  <Input className={inp} placeholder="SSC Roll Number" value={form.roll_number} onChange={(e) => set("roll_number", e.target.value)} required />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Marks Obtained <span className="text-red-500">*</span></Label>
                    <Input className={inp} inputMode="numeric" placeholder="480" value={form.marks_obtained}
                      onChange={(e) => set("marks_obtained", e.target.value.replace(/[^\d]/g, ""))} required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Total Marks <span className="text-red-500">*</span></Label>
                    <Input className={inp} inputMode="numeric" placeholder="600" value={form.marks_total}
                      onChange={(e) => set("marks_total", e.target.value.replace(/[^\d]/g, ""))} required />
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Grade <span className="text-muted-foreground font-normal">(auto)</span></Label>
                    <div className="h-11 rounded-xl bg-muted border border-border flex items-center justify-center font-heading font-bold">
                      {preview ? `${preview.grade} · ${preview.pct}%` : "N/A"}
                    </div>
                  </div>
                </div>
                {form.hafiz_e_quran && (
                  <p className="text-[12px] text-muted-foreground -mt-2">
                    Hafiz e Quran: 20 additional marks are added to your percentage for merit
                    ({preview ? `effective ${preview.pct}%` : ""}).
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Hafiz e Quran</Label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[{ v: false, l: "No" }, { v: true, l: "Yes" }].map((o) => (
                        <button key={o.l} type="button" onClick={() => set("hafiz_e_quran", o.v)}
                          className={`h-11 rounded-xl border-2 text-sm font-semibold transition-all ${
                            form.hafiz_e_quran === o.v ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">Sports Participation Certificate</Label>
                    <select className={sel} value={form.sport_certificate} onChange={(e) => set("sport_certificate", e.target.value)}>
                      <option value="">Select a Certificate (if any)</option>
                      {SPORT_CERTIFICATES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">School Province <span className="text-red-500">*</span></Label>
                    <select className={sel} value={form.institute_province} onChange={(e) => set("institute_province", e.target.value)} required>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={F}>
                    <Label className="font-semibold text-[13px]">School District <span className="text-red-500">*</span></Label>
                    <select className={sel} value={form.institute_district} onChange={(e) => set("institute_district", e.target.value)} required>
                      {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className={F}>
                  <Label className="font-semibold text-[13px]">School / Institute Name <span className="text-red-500">*</span></Label>
                  <Input className={inp} placeholder="e.g. Govt High School Ghallanai" value={form.institute_name} onChange={(e) => set("institute_name", e.target.value)} required />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="submit" disabled={busy} className="h-10 flex-1 font-semibold">
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Information
                  </Button>
                  <Link to="/admission/portal" className="sm:w-auto">
                    <Button type="button" variant="outline" className="h-10 w-full sm:w-40 font-semibold">Back to Dashboard</Button>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
