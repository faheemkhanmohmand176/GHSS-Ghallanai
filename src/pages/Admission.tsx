/**
 * Admission — PUBLIC admission home for the Inter (1st/2nd Year) online
 * admission system, mirroring the HED KPK Online College Admission System
 * (admission.hed.gkp.pk) as captured for GHSS/GCMS Ghallanai Mohmand.
 *
 * Sections: hero + how-to-apply steps · Track Application (public, tracking
 * ID only) · programs & seats · important instructions (EN/UR) · helpline.
 * The full applicant portal lives under /admission/{register,login,portal}.
 */

import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap, Search, UserPlus, LogIn, LayoutDashboard, ClipboardList,
  AlertCircle, Phone, Mail, Loader2, CheckCircle2, XCircle,
  BadgeCheck, BookOpen, Landmark, Wallet, Printer, Trophy, ArrowRight,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import PageBanner from "@/components/shared/PageBanner";
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
  interApi, getToken, QUOTA_LABEL, COLLEGE_SHORT,
  PROCESSING_FEE, ADMISSION_CYCLE, STUDY_LEVEL, FACULTIES,
} from "@/lib/interAdmission";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";

// ─────────────────────────────────────────────────────────────────────────────
// Track Application (public — tracking ID only, exactly like HED
// application_status.php; no login, no CNIC)
// ─────────────────────────────────────────────────────────────────────────────
function TrackApplication() {
  const [trackingId, setTrackingId] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const doSearch = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = trackingId.trim();
    if (!q) { toast.error("Please enter your Tracking ID."); return; }
    setSearching(true); setSearched(q); setResult(null);
    try {
      const res = await interApi.track(q) as unknown as Record<string, unknown>;
      setResult(res);
    } catch {
      setResult({ ok: false });
    } finally {
      setSearching(false);
    }
  }, [trackingId]);

  const timeline = (result?.timeline as Array<Record<string, string>> | undefined) ?? [];
  const found = Boolean(result?.ok);

  return (
    <Card id="track" className="scroll-mt-24 overflow-hidden border-gold/30 shadow-card premium-frame">
      <CardContent className="p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-gold/40 bg-gold/[0.07]">
            <Search className="w-[18px] h-[18px] text-gold" strokeWidth={1.4} />
          </div>
          <div className="min-w-0">
            <span className="premium-kicker block !text-[0.6rem]">Status</span>
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground leading-tight">Track Application</h2>
          </div>
        </div>
        <form onSubmit={doSearch} className="mt-4">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 p-1 pl-4 shadow-sm transition-colors focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/15">
            <Search className="w-4 h-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
              placeholder="Tracking ID"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold tracking-[0.08em] text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/70 outline-none"
              aria-label="Application Tracking ID"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <Button type="submit" disabled={searching} className="h-9 shrink-0 rounded-full px-5 text-[12.5px] font-semibold tracking-wide">
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />}
              Track
            </Button>
          </div>
        </form>

        {searched && (
          <div className="mt-5">
            {found ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex items-start gap-2.5 rounded-xl border border-green-500/30 bg-green-500/5 p-3.5">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-foreground">Application Detail</p>
                    <p className="text-muted-foreground">Tracking ID <span className="font-mono font-bold text-foreground">{String(result?.tracking_id)}</span></p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr className="text-left">
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">#</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Tracking Id</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">College</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Program</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Payment Status</th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Application Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="px-3 py-2.5">1</td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{String(result?.tracking_id)}</td>
                        <td className="px-3 py-2.5">{String(result?.college)}</td>
                        <td className="px-3 py-2.5">{String(result?.program)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={String(result?.payment_status) === "Paid" ? "default" : "secondary"}
                            className={String(result?.payment_status) === "Paid" ? "bg-green-600" : ""}>
                            {String(result?.payment_status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">{String(result?.application_date)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {timeline.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-primary text-primary-foreground">
                        <tr className="text-left">
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">#</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Title</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Date</th>
                          <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Detials</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((t, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-3 py-2.5">{i + 1}</td>
                            <td className="px-3 py-2.5 font-semibold">{t.title}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{t.date}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{t.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-sm">
                <XCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-muted-foreground">
                  No application found for Tracking ID <span className="font-mono font-bold text-foreground">{searched}</span>.
                  Please check the ID on your submission receipt.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Merit Lists (public — exactly like the HED college page: one card per
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
    staleTime: 60 * 1000,
  });
  const lists = (Array.isArray(data) ? data : []) as PublicMeritList[];

  const { data: viewData, isFetching: viewLoading } = useQuery({
    queryKey: ["inter-merit-view", viewId],
    queryFn: () => interApi.meritListView(viewId!) as Promise<unknown>,
    enabled: Boolean(viewId),
    staleTime: 60 * 1000,
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

      {/* Merit list detail (HED merit_list_view.php table) */}
      <Dialog open={Boolean(viewId)} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left pr-8">{view?.list?.title ?? "Merit List"}</DialogTitle>
          </DialogHeader>
          {viewLoading && !view ? (
            <div className="space-y-2.5 py-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />)}</div>
          ) : view?.ok ? (
            <div className="space-y-4">
              {(view.list?.admission_start_date || view.list?.admission_last_date) && (
                <div className="rounded-xl border border-gold/40 bg-gold/5 p-3.5 text-[13px]">
                  <p className="font-bold text-foreground mb-1">Important Dates</p>
                  <p className="text-muted-foreground">
                    Admission Start: <span className="font-semibold text-foreground">{view.list?.admission_start_date ?? "N/A"}</span>
                    {" · "}Admission Last Date: <span className="font-semibold text-foreground">{view.list?.admission_last_date ?? "N/A"}</span>
                  </p>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-primary text-primary-foreground">
                    <tr className="text-left">
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">#</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Tracking ID</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Name</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Father Name</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Total</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Obtained</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Net Marks</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">%</th>
                      <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(view.entries ?? []).map((e) => (
                      <tr key={e.tracking_id} className="border-t border-border">
                        <td className="px-2.5 py-2.5">{e.position}</td>
                        <td className="px-2.5 py-2.5 font-mono font-semibold">{e.tracking_id}</td>
                        <td className="px-2.5 py-2.5 font-semibold text-foreground">{e.name}</td>
                        <td className="px-2.5 py-2.5">{e.father_name}</td>
                        <td className="px-2.5 py-2.5">{e.total_marks}</td>
                        <td className="px-2.5 py-2.5">{e.obtained_marks}</td>
                        <td className="px-2.5 py-2.5 font-semibold">{e.net_marks}</td>
                        <td className="px-2.5 py-2.5 font-semibold text-primary">{e.percentage}%</td>
                        <td className="px-2.5 py-2.5 text-muted-foreground">{e.remarks ?? "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {view.list?.instructions && (
                <div className="rounded-xl bg-muted/60 border border-border p-3.5 text-[12.5px] text-muted-foreground">
                  <p className="font-bold text-foreground mb-1">Instructions</p>
                  <p className="whitespace-pre-line">{view.list.instructions}</p>
                </div>
              )}
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
const HERO_BTN = "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[12.5px] font-semibold tracking-wide transition-all active:scale-[0.97]";
const HERO_BTN_PRIMARY = "bg-gold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)] hover:brightness-110";
const HERO_BTN_GLASS = "border border-white/30 bg-white/[0.06] text-white backdrop-blur-sm hover:bg-white/15";

const HOW_TO_APPLY = [
  { icon: UserPlus,      title: "Create Account",   desc: "Register with CNIC or Form-B, mobile number and a password." },
  { icon: ClipboardList, title: "Personal Profile", desc: "Name, date of birth, domicile, parents and address." },
  { icon: BookOpen,      title: "Matric Profile",   desc: "SSC board, session, roll number and marks." },
  { icon: Landmark,      title: "Submit Application", desc: `Choose a program (${FACULTIES.join(", ")}) and a quota.` },
  { icon: BadgeCheck,    title: "Confirm & Pay",    desc: `Review everything, then submit with the Rs ${PROCESSING_FEE} fee.` },
  { icon: Wallet,        title: "Pay via JazzCash", desc: "Use your JazzCash token at any shop or in the app." },
  { icon: Search,        title: "Track Status",     desc: "Check payment and application status with your Tracking ID." },
  { icon: Printer,       title: "Print & Visit",    desc: "Print the form and bring original documents to college." },
];

export default function Admission() {
  const navigate = useNavigate();
  const hasSession = Boolean(getToken());
  const { data: school } = useSchoolSettings();

  const { data: programs } = useQuery({
    queryKey: ["inter-programs-public"],
    queryFn: () => interApi.programsList() as Promise<{ ok?: boolean } & { [k: string]: unknown }>,
    staleTime: 5 * 60 * 1000,
  });
  const programList = (programs as unknown as { id?: number; name: string; study_level: string; seats: number }[] | undefined) ?? [];
  // Offline fallback — the school's own four Inter faculties (never BS/D.Com)
  const fallbackPrograms = [
    { id: 1, name: "Pre-Medical", study_level: STUDY_LEVEL, seats: 100 },
    { id: 2, name: "Pre-Engineering", study_level: STUDY_LEVEL, seats: 50 },
    { id: 3, name: "ICS (Computer Sciences)", study_level: STUDY_LEVEL, seats: 50 },
    { id: 4, name: "Arts/Humanities", study_level: STUDY_LEVEL, seats: 100 },
  ];

  return (
    <PageLayout>
      <PageBanner
        variant="premium"
        eyebrow="Online Admissions"
        icon={<GraduationCap className="w-6 h-6" strokeWidth={1.3} />}
        title="Intermediate Admissions"
        subtitle={`${COLLEGE_SHORT} · ${STUDY_LEVEL} · Session 2026–27. Fully online, no manual or postal forms accepted.`}
        actions={
          <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
            {hasSession ? (
              <button onClick={() => navigate("/admission/portal")} className={`${HERO_BTN} ${HERO_BTN_PRIMARY}`}>
                <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} /> My Portal
              </button>
            ) : (
              <>
                <Link to="/admission/register" className={`${HERO_BTN} ${HERO_BTN_PRIMARY}`}>
                  <UserPlus className="w-4 h-4" strokeWidth={1.5} /> Create Account
                </Link>
                <Link to="/admission/login" className={`${HERO_BTN} ${HERO_BTN_GLASS}`}>
                  <LogIn className="w-4 h-4" strokeWidth={1.5} /> Login
                </Link>
              </>
            )}
            <a href="#track" className={`${HERO_BTN} ${HERO_BTN_GLASS}`}>
              <Search className="w-4 h-4" strokeWidth={1.5} /> Track Application
            </a>
          </div>
        }
      />

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
          <ol className="relative mx-auto grid max-w-3xl gap-x-8 sm:grid-cols-2">
            {HOW_TO_APPLY.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: (i % 4) * 0.04 }}
                className="group relative flex items-start gap-3 py-2.5"
              >
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.06] text-gold transition-colors group-hover:bg-gold/15">
                  <s.icon className="h-[17px] w-[17px]" strokeWidth={1.35} />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5 group-last:border-b-0">
                  <h3 className="font-heading text-[14px] font-semibold leading-snug text-foreground">{s.title}</h3>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{s.desc}</p>
                </div>
              </motion.li>
            ))}
          </ol>
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
              Cycle <span className="font-semibold text-foreground">{ADMISSION_CYCLE}</span> · Morning shift for highest merit
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Program</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Study Level</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap">Program Seats</th>
                </tr>
              </thead>
              <tbody>
                {(programList.length ? programList : fallbackPrograms).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.study_level}</td>
                    <td className="px-4 py-3 font-semibold">{p.seats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
            {[
              "All quotas except Afghan count in Open Merit",
              "One application per quota or program",
              `Fee Rs ${PROCESSING_FEE} each`,
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.05] px-3 py-1 text-[11.5px] font-medium text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-gold" />{t}
              </span>
            ))}
          </div>
        </section>

        {/* Categories / quotas */}
        <section>
          <div className="text-center mb-5">
            <span className="premium-kicker block">Categories</span>
            <h2 className="section-title premium-display !text-[1.75rem] sm:!text-4xl mt-1">Admission Quotas</h2>
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
        <section className="grid gap-4 lg:grid-cols-2">
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
          <Card className="border-gold/25 shadow-card">
            <CardContent className="p-5" dir="rtl">
              <div className="mb-3.5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/40 bg-gold/[0.06]">
                  <ClipboardList className="h-4 w-4 text-gold" strokeWidth={1.4} />
                </span>
                <h3 className="font-urdu text-[16px] font-semibold text-foreground">ضروری ہدایات</h3>
              </div>
              <ol className="font-urdu space-y-3 text-[13px] leading-[2] text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">1</span>
                  <span>ہر کوٹے یا پروگرام کے لیے الگ درخواست جمع کروائیں۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">2</span>
                  <span>ایک پروگرام میں ایک کوٹے پر صرف ایک درخواست دی جا سکتی ہے۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">3</span>
                  <span>ستارے (*) والے خانے پُر کرنا لازمی ہے۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">4</span>
                  <span>موبائل نمبر احتیاط سے درج کریں (03451234567)۔ یہ بعد میں تبدیل نہیں ہو سکے گا اور فیس اور ایس ایم ایس کے لیے استعمال ہوگا۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">5</span>
                  <span>تمام درخواستیں آن لائن جمع ہوں گی۔ دستی یا ڈاک کے ذریعے فارم قبول نہیں کیا جائے گا۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">6</span>
                  <span>آخری تاریخ حتمی ہے۔ اس کے بعد سسٹم فارم قبول نہیں کرے گا۔</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[10px] font-semibold text-gold">7</span>
                  <span>غلط معلومات کی صورت میں درخواست منسوخ کر دی جائے گی۔</span>
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
