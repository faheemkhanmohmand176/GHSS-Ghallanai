/**
 * Admission — PUBLIC admission home for the Inter (1st/2nd Year) online
 * admission system of Government Higher Secondary School Ghallanai.
 *
 * Sections: hero + how-to-apply steps · Track Application (public, tracking
 * ID only) · programs & seats · important instructions (EN/UR) · helpline.
 * The applicant portal lives under /admission/portal (no account, no login).
 */

import { MeritTitleBlock, MeritDates, MeritInstructions } from "@/components/shared/MeritListSheet";
import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import { motion } from "framer-motion";
import {
  GraduationCap, Search, UserPlus, LayoutDashboard, ClipboardList,
  AlertCircle, Phone, Mail, Loader2, CheckCircle2, XCircle,
  BadgeCheck, BookOpen, Landmark, Wallet, Printer, Trophy, ArrowRight,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import AdmissionStepper from "@/components/shared/AdmissionStepper";
import AdmissionReviewTable from "@/components/shared/AdmissionReviewTable";
import { AdmissionClosedCard } from "@/components/shared/AdmissionGate";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmissionSettings, getAdmissionState, formatAdmissionDate } from "@/hooks/useAdmission";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  interApi, getToken, QUOTA_LABEL, COLLEGE_SHORT, STUDY_LEVEL, FACULTIES,
} from "@/lib/interAdmission";
import { hasDraftData } from "@/lib/admissionDraft";
import { TRACK_STEPS, resolveStage, paymentMethodLabel } from "@/lib/admissionStatus";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";

// ─────────────────────────────────────────────────────────────────────────────
// Track Application (public: Tracking ID only, read-only status, no account)
// ─────────────────────────────────────────────────────────────────────────────
interface TrackResult {
  ok?: boolean; tracking_id?: string; college?: string; program?: string;
  subject_group?: string | null; quota?: string; payment_status?: string;
  payment_method?: string | null; payment_receipt?: string | null;
  status?: string; processing_fee?: number; payment_reference?: string | null;
  application_date?: string; fee_deadline?: string;
  timeline?: Array<{ title: string; details: string | null; date: string }>;
}

// The stage the applicant is in is resolved from BOTH facts the database
// stores — the workflow status AND the processing-fee state — so the tracker
// can never claim a payment that did not happen.  See src/lib/admissionStatus.ts.

function TrackApplication() {
  const [trackingId, setTrackingId] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [failDetail, setFailDetail] = useState("");
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  // Open the connection to the database while the visitor is still typing, so
  // the lookup itself needs no DNS / TLS set-up time.
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url || document.querySelector(`link[rel="preconnect"][href="${url}"]`)) return;
    const l = document.createElement("link");
    l.rel = "preconnect"; l.href = url; l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  }, []);

  const doSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = trackingId.replace(/\s+/g, "").trim();
    if (!q) { toast.error("Please enter your Tracking ID."); return; }
    setSearching(true); setSearched(q); setResult(null); setFailed(false); setFailDetail(""); setShowAllTimeline(false);
    try {
      const res = (await interApi.track(q)) as unknown as TrackResult & { error?: string; detail?: string };
      if (res?.ok) setResult(res);
      else if (res?.error) { setFailed(true); setFailDetail(typeof res.detail === "string" ? res.detail : ""); }   // a real error, not "not found"
      // NOTE: an unknown Tracking ID returns { ok:false } with NO error string.
    } catch {
      setFailed(true);
    } finally {
      setSearching(false);
    }
  }, [trackingId]);

  const timeline = result?.timeline ?? [];
  // One source of truth for what the applicant is told: the workflow status
  // AND the processing-fee state are read together, so the badge, the note,
  // the tracker and the timeline can never disagree with each other.
  const st = resolveStage(result?.status, result?.payment_status);
  const closedOut = st.closed;
  const paid = st.paid;
  const methodLabel = paymentMethodLabel(result?.payment_method);

  return (
    <Card id="track" className="scroll-mt-24 overflow-hidden border-gold/30 shadow-card premium-frame">
      <CardContent className="p-5 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.07]">
            <Search className="h-[19px] w-[19px] text-gold" strokeWidth={1.4} />
          </div>
          <span className="premium-kicker mt-2 block !text-[0.6rem]">Status</span>
          <h2 className="font-heading text-xl font-semibold leading-tight text-foreground sm:text-2xl">Track Application</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Enter your Tracking ID to check your application status.
          </p>
        </div>
        <form onSubmit={doSearch} className="mx-auto mt-4 max-w-md space-y-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 p-1 pl-4 shadow-sm transition-colors focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/15">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
              placeholder="e.g. NOV2026-K7MQXA"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold tracking-[0.08em] text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/70"
              aria-label="Application Tracking ID"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <Button type="submit" disabled={searching} className="h-9 shrink-0 rounded-full px-5 text-[12.5px] font-semibold tracking-wide">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
              Track
            </Button>
          </div>
        </form>

        {searched && !searching && (
          <div className="mt-6">
            {result ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl space-y-3.5">
                {/* Header — ID + ONE status badge */}
                <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 px-4 py-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tracking ID</span>
                  <span className="font-mono text-lg font-bold tracking-wider text-foreground">{result.tracking_id}</span>
                  <Badge variant="secondary" className={`mt-1.5 ${st.tone}`}>{st.label}</Badge>
                  {closedOut && <p className="mt-2 max-w-sm text-[12.5px] leading-snug text-muted-foreground">{st.note}</p>}
                </div>

                {/* Progress — finished steps are ticked, the NEXT step is highlighted */}
                {closedOut ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm font-semibold text-red-600">
                    <XCircle className="h-4 w-4" /> {st.label}
                  </div>
                ) : (
                  <AdmissionStepper steps={TRACK_STEPS} current={st.complete ? TRACK_STEPS.length : st.step + 1} allComplete={st.complete} />
                )}

                {st.warning && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] leading-snug text-amber-700 dark:text-amber-400">
                    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                    <span>{st.warning}</span>
                  </div>
                )}

                {/* What happens next — one short line */}
                {!closedOut && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-[12.5px] leading-snug text-foreground/85">
                      <span className="font-semibold text-foreground">Next: </span>{st.next}
                    </p>
                  </div>
                )}

                {/* Summary — thin table */}
                <AdmissionReviewTable
                  title="Application"
                  icon={<ClipboardList className="h-3.5 w-3.5" />}
                  rows={[
                    { label: "Program", value: result.program },
                    { label: "Category", value: QUOTA_LABEL[result.quota ?? ""] ?? result.quota },
                    ...(result.subject_group ? [{ label: "Subject Group", value: result.subject_group.split(",").map((x) => x.trim()).filter(Boolean).join(", "), wide: true }] : []),
                    { label: "Fee", value: `Rs ${result.processing_fee} · ${paid ? "Paid" : result.payment_status === "rejected" ? "Rejected" : "Pending"}` },
                    { label: "Applied On", value: result.application_date },
                    ...(methodLabel ? [{ label: "Paid Via", value: methodLabel }] : []),
                    ...(result.payment_receipt ? [{ label: "Receipt No.", value: result.payment_receipt }] : []),
                    { label: paid ? "Payment Ref." : "Fee Deadline", value: paid ? result.payment_reference : result.fee_deadline },
                  ]}
                />

                {/* Timeline — latest first, collapsed */}
                {timeline.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-center font-heading text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground">Timeline</h3>
                    <ol className="space-y-0">
                      {[...timeline].reverse().slice(0, showAllTimeline ? undefined : 3).map((t, i, arr) => (
                        <li key={i} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                          {i < arr.length - 1 && <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border" aria-hidden />}
                          <span className={`relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${i === 0 ? "border-gold bg-gold/20" : "border-border bg-card"}`} />
                          <div className="min-w-0 flex-1 rounded-lg border border-border/70 bg-card px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-x-3">
                              <p className="text-[12.5px] font-semibold text-foreground">{t.title}</p>
                              <p className="text-[10.5px] text-muted-foreground">{t.date}</p>
                            </div>
                            {t.details && <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{t.details}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                    {timeline.length > 3 && (
                      <button type="button" onClick={() => setShowAllTimeline((v) => !v)}
                        className="mx-auto mt-2 block text-[12px] font-semibold text-primary hover:underline">
                        {showAllTimeline ? "Show less" : `Show all ${timeline.length} updates`}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-5 text-center">
                <XCircle className="h-6 w-6 text-amber-600" />
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {failed ? "Could not check right now" : "No application found"}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {failed
                    ? (failDetail ? "The lookup service reported a problem." : "Please check your connection and try again.")
                    : <>No match for <span className="font-mono font-bold text-foreground">{searched}</span>. Check the Tracking ID on your challan, then try again.</>}
                </p>
                {failed && failDetail && (
                  <p className="mt-1.5 break-words font-mono text-[10.5px] leading-snug text-muted-foreground/80">{failDetail}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Merit Lists (public: one card per
// published program+quota list with a “View Merit List” table)
// ─────────────────────────────────────────────────────────────────────────────
interface PublicMeritList {
  id: string; college: string; level: string; program: string; quota: string;
  list_no: number; title: string; no_of_applicants: number;
  published_on: string | null; admission_start_date: string | null;
  admission_last_date: string | null;
}

interface MeritEntry {
  position: number; tracking_id: string; name: string; father_name: string;
  total_marks: number; obtained_marks: number; net_marks: number;
  percentage: number; remarks: string | null;
}

function MeritLists() {
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["inter-merit-public"],
    queryFn: () => interApi.meritListsPublic() as Promise<unknown>,
    staleTime: ADMISSION_CLIENT_CACHE.meritListsStaleMs,
  });
  const lists = (Array.isArray(data) ? data : []) as PublicMeritList[];

  const { data: viewData, isFetching: viewLoading } = useQuery({
    queryKey: ["inter-merit-view", viewId],
    queryFn: () => interApi.meritListView(viewId!) as Promise<unknown>,
    enabled: Boolean(viewId),
    staleTime: ADMISSION_CLIENT_CACHE.meritListStaleMs,
  });
  const view = (viewData ?? null) as null | {
    ok: boolean;
    list?: {
      title: string; program: string; quota: string; instructions: string | null;
      admission_start_date: string | null; admission_last_date: string | null;
      published_on: string | null;
    };
    entries?: MeritEntry[];
  };

  return (
    <section id="merit-lists">
      <div className="text-center mb-7">
        <span className="premium-kicker block">Merit Lists</span>
        <h2 className="section-title premium-display !text-[1.9rem] sm:!text-4xl mt-1">Admission Merit Lists</h2>
        <p className="text-muted-foreground mt-2 text-sm max-w-2xl mx-auto">
          Merit lists are prepared from fee-paid applications and published here by the college, per program and quota.
        </p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-3.5">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/80"><CardContent className="p-5 h-32 animate-pulse bg-muted/40 rounded-2xl" /></Card>
          ))}
        </div>
      ) : lists.length === 0 ? (
        <Card className="border-gold/25 shadow-card">
          <CardContent className="p-8 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No merit list has been published yet.</p>
            <p className="text-[13px] text-muted-foreground mt-1">
              Merit lists appear here as soon as the college publishes them after the admission deadline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3.5">
          {lists.map((m) => (
            <Card key={m.id} className="border-border/80 shadow-card">
              <CardContent className="p-4.5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-[15px] text-foreground leading-snug">{m.program}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      {m.quota} · List #{m.list_no} · {m.level}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
                    {m.no_of_applicants} applicant{m.no_of_applicants === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                  <span>Published: {m.published_on ?? "N/A"}</span>
                  {(m.admission_last_date) && (
                    <span className="font-semibold text-foreground">Join by: {m.admission_last_date}</span>
                  )}
                </div>
                <Button size="sm" className="mt-3.5 h-9 w-full text-[13px] font-semibold" onClick={() => setViewId(m.id)}>
                  <ClipboardList className="w-4 h-4" /> View Merit List
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Merit list detail */}
      <Dialog open={Boolean(viewId)} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="sr-only">{view?.list?.title ?? "Merit List"}</DialogTitle>
          </DialogHeader>
          {viewLoading && !view ? (
            <div className="space-y-2.5 py-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />)}</div>
          ) : view?.ok ? (
            <div className="space-y-4">
              <MeritTitleBlock title={view.list?.title ?? "Merit List"} />
              <MeritDates start={view.list?.admission_start_date} last={view.list?.admission_last_date} />
              <div className="space-y-2 md:hidden">
                {(Array.isArray(view.entries) ? view.entries : []).map((e) => (
                  <div key={e.tracking_id} className="rounded-xl border border-border bg-card px-3 py-2.5 text-center">
                    <p className="text-[13px] font-semibold text-foreground">#{e.position} · {e.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">S/O {e.father_name}</p>
                    <p className="mt-0.5 font-mono text-[11.5px] font-semibold text-primary">{e.tracking_id}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {e.obtained_marks}/{e.total_marks} · Net <strong className="text-foreground">{e.net_marks}</strong> · <strong className="text-primary">{e.percentage}%</strong>
                    </p>
                    {e.remarks && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{e.remarks}</p>}
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">#</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Tracking ID</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Name</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Father Name</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Total</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Obtained</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Net Marks</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">%</th>
                      <th className="text-center align-middle px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(view.entries) ? view.entries : []).map((e) => (
                      <tr key={e.tracking_id} className="border-t border-border">
                        <td className="text-center align-middle px-2.5 py-2.5">{e.position}</td>
                        <td className="text-center align-middle px-2.5 py-2.5 font-mono font-semibold">{e.tracking_id}</td>
                        <td className="text-center align-middle px-2.5 py-2.5 font-semibold text-foreground">{e.name}</td>
                        <td className="text-center align-middle px-2.5 py-2.5">{e.father_name}</td>
                        <td className="text-center align-middle px-2.5 py-2.5">{e.total_marks}</td>
                        <td className="text-center align-middle px-2.5 py-2.5">{e.obtained_marks}</td>
                        <td className="text-center align-middle px-2.5 py-2.5 font-semibold">{e.net_marks}</td>
                        <td className="text-center align-middle px-2.5 py-2.5 font-semibold text-primary">{e.percentage}%</td>
                        <td className="text-center align-middle px-2.5 py-2.5 text-muted-foreground">{e.remarks ?? "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <MeritInstructions text={view.list?.instructions} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">This merit list is no longer available.</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
function buildSteps(fee: number) {
  return [
    { icon: ClipboardList, title: "Personal Profile",   desc: "CNIC or Form-B, name, date of birth, domicile, parents and address." },
    { icon: BookOpen,      title: "Matric Profile",     desc: "SSC board, session, roll number and marks." },
    { icon: Landmark,      title: "Submit Application", desc: `Choose a program (${FACULTIES.join(", ")}) and a category.` },
    { icon: BadgeCheck,    title: "Confirm and Pay",    desc: `Review everything, pass the security check and submit. Then pay the Rs ${fee} processing fee.` },
    { icon: Wallet,        title: "Pay the Fee",        desc: "Pay into the school account printed on your fee challan." },
    { icon: Search,        title: "Track Status",       desc: "Check payment and application status with your Tracking ID." },
    { icon: Printer,       title: "Print and Visit",    desc: "Print the form and bring original documents to the school." },
  ];
}

const ACTION_BASE = "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 active:scale-[0.98]";
const ACTION_GOLD = "bg-gradient-to-br from-[#e6bf55] to-[#b8891f] text-[#1c2a10] shadow-[0_6px_16px_-8px_rgba(214,170,60,0.7)] hover:brightness-110";
const ACTION_GLASS = "border border-white/20 bg-white/[0.07] text-white backdrop-blur-md hover:border-white/40 hover:bg-white/[0.13]";

function ActionTile({
  icon: Icon, title, sub, gold, to, href, onClick,
}: {
  icon: typeof UserPlus; title: string; sub: string; gold?: boolean;
  to?: string; href?: string; onClick?: () => void;
}) {
  const cls = `${ACTION_BASE} ${gold ? ACTION_GOLD : ACTION_GLASS}`;
  const inner = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${gold ? "bg-black/15" : "bg-white/10 ring-1 ring-white/20"}`}>
        <Icon className="h-[16px] w-[16px]" strokeWidth={1.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight">{title}</span>
        <span className={`mt-px block text-[10.5px] leading-tight ${gold ? "text-[#1c2a10]/70" : "text-white/65"}`}>{sub}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </>
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

function AdmissionHero({
  session, daysLeft, lastDate, hasSession, open,
}: {
  session: string; daysLeft: number | null; lastDate: string | null; hasSession: boolean; open: boolean;
}) {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0a3220_0%,#0e4128_52%,#155534_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_88%_0%,rgba(214,170,60,0.30),transparent_62%),radial-gradient(50%_60%_at_0%_100%,rgba(214,170,60,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#d6aa3c]/70 to-transparent" />
      <div className="container relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-7 pt-7 text-center sm:pb-10 sm:pt-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d6aa3c]/50 bg-[#d6aa3c]/10 px-3.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#f0d27a]">
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.6} /> Online Admissions
        </span>
        <h1 className="mt-4 font-heading text-[2rem] font-semibold leading-[1.1] sm:text-5xl">Intermediate Admissions</h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-white/70 sm:text-[15px]">{COLLEGE_SHORT}</p>

        {/* Session + countdown */}
        {open && (
          <div className="mt-4 grid w-full max-w-sm grid-cols-3 overflow-hidden rounded-xl border border-white/15 bg-white/[0.07] backdrop-blur-md">
            <div className="flex flex-col items-center justify-center px-1.5 py-2">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/55">Session</span>
              <span className="mt-0.5 font-heading text-[15px] font-semibold sm:text-base">{session || "N/A"}</span>
            </div>
            <div className="flex flex-col items-center justify-center border-x border-white/15 bg-[#d6aa3c]/[0.14] px-1.5 py-2">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-[#f0d27a]">
                {daysLeft === null ? "Status" : daysLeft === 1 ? "Day Remaining" : "Days Remaining"}
              </span>
              <span className="mt-0.5 font-heading text-[19px] font-bold leading-none text-[#f6dc8c] sm:text-xl">
                {daysLeft === null ? "Open" : daysLeft}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center px-1.5 py-2">
              <span className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/55">Last Date</span>
              <span className="mt-0.5 text-[11px] font-semibold leading-tight sm:text-xs">
                {lastDate ? formatAdmissionDate(lastDate) : "To be announced"}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {hasSession ? (
            <ActionTile icon={LayoutDashboard} title="My Application" sub="Pay, edit or view" gold onClick={() => navigate("/admission/portal")} />
          ) : (
            <ActionTile
              icon={ClipboardList}
              title="Apply Online"
              sub={hasDraftData() ? "Continue your application" : "Start your application"}
              gold
              onClick={() => navigate("/admission/portal")}
            />
          )}
          <ActionTile icon={Search} title="Track Application" sub="Check your status" href="#track" />
        </div>
      </div>
    </section>
  );
}

export default function Admission() {
  const hasSession = Boolean(getToken());
  const { data: school } = useSchoolSettings();
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = useAdmissionSettings();
  const state = getAdmissionState(settings);
  const fee = settings?.processing_fee ?? 100;
  const session = settings?.session_year ?? "";
  const steps = buildSteps(fee);

  const { data: programs } = useQuery({
    queryKey: ["inter-programs-public"],
    queryFn: () => interApi.programsList() as Promise<{ ok?: boolean } & { [k: string]: unknown }>,
    staleTime: ADMISSION_CLIENT_CACHE.programsStaleMs,
    enabled: state.open || settingsError,
  });
  // Defensive: the RPC / edge cache can return a wrapped object or an error object
  // instead of a bare array. Never call .map on anything that is not an array.
  const programList = ((): { id?: number; name: string; study_level: string; seats: number }[] => {
    const p = programs as unknown;
    if (Array.isArray(p)) return p;
    const inner = (p as { programs?: unknown; data?: unknown; items?: unknown } | null | undefined);
    for (const k of [inner?.programs, inner?.data, inner?.items]) if (Array.isArray(k)) return k;
    return [];
  })();

  if (settingsLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-3xl space-y-4 px-4 py-14">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </PageLayout>
    );
  }

  // Admin closed admissions (or the date window is over): everything is locked.
  if (!settingsError && !state.open) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/" />
          <AdmissionClosedCard state={state} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <AdmissionHero session={session} daysLeft={state.daysLeft} lastDate={state.lastDate} hasSession={hasSession} open />

      <div className="container mx-auto px-4 py-10 sm:py-14 max-w-5xl space-y-12">
        {/* How to apply */}
        <section>
          <div className="text-center mb-7">
            <span className="premium-kicker block">Process</span>
            <h2 className="section-title premium-display !text-[1.75rem] sm:!text-4xl mt-1">How to Apply</h2>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto text-[13px] sm:text-sm leading-relaxed">
              Eight simple steps, completed entirely online.
            </p>
          </div>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-card">
            <div className="h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-400" />
            <ol className="relative ml-[1.35rem] sm:ml-8 mr-3 sm:mr-6 my-5 border-l-2 border-gold/30 pl-6 sm:pl-8 space-y-3.5">
              {steps.map((s, i) => {
                const last = i === steps.length - 1;
                return (
                  <motion.li
                    key={s.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ delay: (i % 4) * 0.04 }}
                    className="relative"
                  >
                    <span
                      className={`absolute -left-[2.95rem] sm:-left-[3.45rem] top-3 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                        last
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/.15)]"
                          : "border-gold bg-card text-gold"
                      }`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <div className={`rounded-2xl border px-4 py-3 ${last ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-strong dark:text-gold">Step {String(i + 1).padStart(2, "0")}</p>
                        <h3 className="font-luxe text-[1.15rem] font-bold leading-tight text-foreground">{s.title}</h3>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground break-words">{s.desc}</p>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Track application */}
        <TrackApplication />

        {/* Merit lists */}
        <MeritLists />

        {/* Programs & seats */}
        <section>
          <div className="text-center mb-7">
            <span className="premium-kicker block">Offered</span>
            <h2 className="section-title premium-display !text-[1.9rem] sm:!text-4xl mt-1">Programs &amp; Seats</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Session <span className="font-semibold text-foreground">{session}</span>
            </p>
          </div>
          {programList.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-card">
              Programs will be announced by the school soon.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
              <table className="w-full text-sm">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="text-center align-middle px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Program</th>
                    <th className="text-center align-middle px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Study Level</th>
                    <th className="text-center align-middle px-4 py-3 text-center align-middle text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {programList.map((p, i) => (
                    <tr key={p.id ?? i} className="border-t border-border">
                      <td className="text-center align-middle px-4 py-3 text-center align-middle font-semibold text-foreground">{p.name}</td>
                      <td className="text-center align-middle px-4 py-3 text-center align-middle text-muted-foreground">{p.study_level}</td>
                      <td className="text-center align-middle px-4 py-3 text-center align-middle font-semibold">{p.seats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
            {[
              "All categories except Afghan count in Open Merit",
              "One application per category or program",
              `Processing fee Rs ${fee} per application`,
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.05] px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-gold" />{t}
              </span>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section>
          <div className="text-center mb-5">
            <span className="premium-kicker block">Categories</span>
            <h2 className="section-title premium-display !text-[1.75rem] sm:!text-4xl mt-1">Admission Categories</h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {Object.entries(QUOTA_LABEL).map(([k, label]) => (
              <span key={k} className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-gold/30 bg-card px-3.5 text-[12px] font-semibold tracking-wide text-foreground shadow-sm">
                {label}
              </span>
            ))}
          </div>
          <div className="mx-auto mt-4 flex max-w-xl items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/[0.04] px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.5} />
            <p>
              Domicile holders of District Mohmand apply on <strong className="font-semibold text-foreground">Local Quota</strong>.
              Open Merit is for non-local applicants, and Local Quota is also counted in Open Merit.
            </p>
          </div>
        </section>

        {/* Instructions */}
        <section className="mx-auto max-w-2xl">
          <Card className="border-gold/25 shadow-card">
            <CardContent className="p-5">
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.06]">
                  <ClipboardList className="h-4 w-4 text-gold" strokeWidth={1.4} />
                </span>
                <h3 className="font-heading text-[15px] font-semibold text-foreground">Important Instructions</h3>
              </div>
              <ol className="space-y-2.5 text-[12.5px] leading-snug text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">1</span>
                  <span>Submit a separate application for each quota or program.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">2</span>
                  <span>Only one application is allowed per quota in the same program.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">3</span>
                  <span>Fields marked * are mandatory.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">4</span>
                  <span>Enter your mobile number carefully (03451234567). It cannot be changed later and is used for fee payment and SMS alerts.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">5</span>
                  <span>All applications are online. No manual or postal forms are accepted.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">6</span>
                  <span>The deadline is final. The system closes after the last date.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">7</span>
                  <span>Any false information will cancel your application.</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* Helpline */}
        <section className="premium-frame p-5 sm:p-6">
          <div className="mb-4 text-center">
            <span className="premium-kicker block">Support</span>
            <h3 className="font-heading text-lg font-semibold text-foreground mt-0.5">College Helpline</h3>
          </div>
          <div className="mx-auto grid max-w-xl gap-2.5 sm:grid-cols-2">
            {[
              {
                icon: Phone, label: "Call",
                value: school?.phone?.trim() || "",
                href: school?.phone?.trim() ? `tel:${school.phone.replace(/[^+\d]/g, "")}` : "/contact",
                fallback: "See Contact page",
              },
              {
                icon: Mail, label: "Email",
                value: school?.email?.trim() || "ghssghallanai@gmail.com",
                href: `mailto:${school?.email?.trim() || "ghssghallanai@gmail.com"}`,
                fallback: "",
              },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-gold/25 bg-card/90 px-3.5 py-3 shadow-sm transition-all hover:border-gold/60 hover:shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.07] transition-colors group-hover:bg-gold/15">
                  <c.icon className="h-[18px] w-[18px] text-gold" strokeWidth={1.35} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{c.label}</span>
                  <span className="block break-all text-[13px] font-semibold leading-snug text-foreground">{c.value || c.fallback}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
