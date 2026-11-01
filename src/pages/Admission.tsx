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
  AlertCircle, Phone, Mail, Loader2, CheckCircle2, XCircle, Info,
  BadgeCheck, BookOpen, Landmark, Wallet, Printer, Trophy,
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
  interApi, getToken, QUOTA_LABEL, HED_MESSAGES, COLLEGE_SHORT,
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
    if (!q) { toast.error("Please enter your Application Tracking Id."); return; }
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
    <Card id="track" className="scroll-mt-24 border-gold/30 shadow-card premium-frame">
      <CardContent className="p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-foreground">Track Application</h2>
            <p className="text-xs text-muted-foreground">Enter the Tracking ID you received when you submitted your application (e.g. NOV2026394612).</p>
          </div>
        </div>
        <form onSubmit={doSearch} className="mt-4 flex flex-col sm:flex-row gap-2.5">
          <Input
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
            placeholder="Application Tracking Id"
            className="h-10 flex-1 font-semibold tracking-wide"
            aria-label="Application Tracking Id"
          />
          <Button type="submit" disabled={searching} className="h-10 px-6 text-[13px] font-semibold">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
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
                  Please check the ID printed on your application submission receipt.
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
          Merit lists are generated from fee-paid applications and published here by the college —
          the same way the HED Online Admission System publishes them per program and quota.
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
                  <span>Published: {m.published_on ?? "—"}</span>
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
                    Admission Start: <span className="font-semibold text-foreground">{view.list?.admission_start_date ?? "—"}</span>
                    {" · "}Admission Last Date: <span className="font-semibold text-foreground">{view.list?.admission_last_date ?? "—"}</span>
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
                        <td className="px-2.5 py-2.5 text-muted-foreground">{e.remarks ?? "—"}</td>
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
const HOW_TO_APPLY = [
  { icon: UserPlus,       title: "Create Account",            desc: "New students register with CNIC/Form-B (13 digits, no dashes), mobile number and a password (min 8 characters)." },
  { icon: ClipboardList,  title: "Complete Personal Profile", desc: "Name, father's name, date of birth, gender, domicile district, tehsil, union council, parents' details and mailing address." },
  { icon: BookOpen,       title: "Complete Matric Profile",   desc: "SSC exam details — board, session, passing year, study group, roll number, marks (enter manually; grade is computed automatically)." },
  { icon: Landmark,       title: "Submit Application",        desc: `Select the program (${FACULTIES.join(" · ")}) and the category (quota), agree to the declaration and submit.` },
  { icon: BadgeCheck,     title: "Confirm & Pay",             desc: "Review your application, then click Submit & Pay Application Processing Fee (Rs 100 per application)." },
  { icon: Wallet,         title: "Pay via JazzCash",          desc: "You receive a JazzCash token. Pay Rs 100 at any JAZZ CASH shop or through the JAZZ CASH APP before the deadline." },
  { icon: Search,         title: "Track Application",         desc: "Use your Tracking ID (e.g. NOV2026…) on this page to check the payment and application status." },
  { icon: Printer,        title: "Print & Visit",             desc: "Print your application form and visit the college with all original documents to complete your admission." },
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
        icon={<GraduationCap className="w-7 h-7" />}
        title="Intermediate Admissions — Apply Online"
        subtitle={`${COLLEGE_SHORT} · ${STUDY_LEVEL} · Session 2026–27 · A fully online process — no manual or postal forms are accepted.`}
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {hasSession ? (
            <Button onClick={() => navigate("/admission/portal")} className="rounded-full h-9 px-6 text-[13px] font-semibold">
              <LayoutDashboard className="w-4 h-4" /> Go to My Portal
            </Button>
          ) : (
            <>
              <Link to="/admission/register">
                <Button className="rounded-full h-9 px-6 text-[13px] font-semibold">
                  <UserPlus className="w-4 h-4" /> Create Account
                </Button>
              </Link>
              <Link to="/admission/login">
                <Button variant="outline" className="rounded-full h-9 px-6 text-[13px] font-semibold bg-transparent text-white border-white/35 hover:bg-white/10 hover:text-white">
                  <LogIn className="w-4 h-4" /> Login
                </Button>
              </Link>
            </>
          )}
          <a href="#track">
            <Button variant="ghost" className="rounded-full h-9 px-6 text-[13px] font-semibold text-white border border-white/25 hover:bg-white/10">
              <Search className="w-4 h-4" /> Track Application
            </Button>
          </a>
        </div>
      </PageBanner>

      <div className="container mx-auto px-4 py-10 sm:py-14 max-w-5xl space-y-12">
        {/* How to apply */}
        <section>
          <div className="text-center mb-8">
            <span className="premium-kicker block">Process</span>
            <h2 className="section-title premium-display !text-[1.9rem] sm:!text-4xl mt-1">How to Apply</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-sm sm:text-base">
              The application process is pretty simple and fully online — the same process used by the
              Higher Education Department's Online College Admission System.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3.5 sm:gap-4">
            {HOW_TO_APPLY.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05 }}
                className="group relative flex gap-4 overflow-hidden rounded-2xl border border-gold/25 bg-card p-4 sm:p-5 shadow-card transition-colors hover:border-gold/60"
              >
                <span aria-hidden className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
                <div className="shrink-0 w-12 text-center">
                  <span className="block font-display text-[2.1rem] font-semibold leading-none text-gold">{String(i + 1).padStart(2, "0")}</span>
                  <span aria-hidden className="mx-auto mt-2 block h-px w-6 bg-gold/50" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-foreground text-[15px] leading-snug">{s.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
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
              Admission Cycle: <span className="font-semibold text-foreground">{ADMISSION_CYCLE}</span> · Shift: Morning
              (highest-merit candidates are offered the Morning shift).
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
          <p className="text-xs text-muted-foreground mt-2.5 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {HED_MESSAGES.meritNote} Separate application must be submitted for each different category (quota) or program.
            Processing fee: Rs {PROCESSING_FEE} per application.
          </p>
        </section>

        {/* Categories / quotas */}
        <section>
          <div className="text-center mb-7">
            <span className="premium-kicker block">Categories</span>
            <h2 className="section-title premium-display !text-[1.9rem] sm:!text-4xl mt-1">Categories of Admission (Quotas)</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(QUOTA_LABEL).map(([k, label]) => (
              <div key={k} className="bg-card rounded-xl border border-gold/25 p-3.5 text-center shadow-card flex items-center justify-center min-h-[3.25rem]">
                <p className="font-heading font-bold text-sm text-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-azure/25 bg-azure-soft/60 dark:bg-azure-soft/20 p-3.5 text-[13px] text-muted-foreground">
            <AlertCircle className="w-5 h-5 shrink-0 text-azure-strong dark:text-azure mt-0.5" />
            <p>
              Applicants whose domicile/union council falls inside District Mohmand must apply on <strong className="text-foreground">Local Quota</strong> —
              Open Merit is only for non-local applicants. Local Quota is also considered in Open Merit, so local applicants are not disadvantaged.
            </p>
          </div>
        </section>

        {/* Instructions */}
        <section className="grid lg:grid-cols-2 gap-4">
          <Card className="border-gold/25 shadow-card">
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> Important Instructions
              </h3>
              <ul className="space-y-2 text-[13px] text-muted-foreground list-disc pl-5">
                <li>For each different category (quota) or program, a separate application must be submitted.</li>
                <li>Only one application can be submitted against the same category of admission of the same program within this college.</li>
                <li>Fields marked with <span className="text-red-500 font-bold">*</span> are mandatory.</li>
                <li>Make sure your mobile number is correct and in 03451234567 format — you will not be able to change it later. It is used for fee payment and all SMS alerts regarding your admission.</li>
                <li>All applications must be submitted online. No manual or postal forms will be accepted.</li>
                <li>The prescribed deadline is binding — after the last date the online system will not accept your form.</li>
                <li>Any misrepresentation will result in disqualification of the application for admission.</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-gold/25 shadow-card">
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-heading font-bold text-foreground mb-3" dir="rtl">ضروری ہدایات</h3>
              <ul className="space-y-2 text-[13px] text-muted-foreground list-disc pl-5" dir="rtl">
                <li>آن لائن داخلے کے لیے شناختی کارڈ نمبر لازمی ہے۔</li>
                <li>سب سے پہلے اپنا شناختی کارڈ درج کریں، نیا پاس ورڈ درج کریں اور دوبارہ لکھیں۔</li>
                <li>ریاضی کے آسان سوال کا جواب درج کریں اور اکاؤنٹ بنائیں بٹن پر کلک کریں۔</li>
                <li>تمام درخواستیں آن لائن کی جائیں گی۔ کوئی دستی یا ہاتھ سے یا پوسٹ فارم قبول نہیں کیا جائے گا۔</li>
                <li>مقررہ مدت کی پابندی لازمی ہے۔ مقررہ تاریخ کے بعد آن لائن داخلہ سسٹم آپ کا فارم قبول نہیں کرے گا۔</li>
                <li>ہر درخواست پر 100 روپے فیس جاز کیش ٹوکن کے ذریعے جمع کروائیں۔</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Helpline */}
        <section className="premium-frame p-5 sm:p-7">
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <Phone className="w-5 h-5 text-primary" />
              <p className="font-heading font-bold text-sm text-foreground">College Helpline</p>
              <p className="text-[13px] text-muted-foreground">
                {school?.phone?.trim() ? school.phone : "Available on the Contact page"}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <Mail className="w-5 h-5 text-primary" />
              <p className="font-heading font-bold text-sm text-foreground">Email</p>
              <p className="text-[13px] text-muted-foreground break-all">
                {school?.email?.trim() ? school.email : "ghssghallanai@gmail.com"}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <GraduationCap className="w-5 h-5 text-primary" />
              <p className="font-heading font-bold text-sm text-foreground">HED Helpdesk</p>
              <p className="text-[13px] text-muted-foreground">admissionhedkp@gmail.com · 091-9214110 (Mon–Fri 9–5)</p>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
