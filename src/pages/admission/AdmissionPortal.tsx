/**
 * AdmissionPortal — applicant dashboard:
 * "All Applications" table with the exact columns:
 *   # | Tracking ID | Program | Quota | Hafiz e Quran | Fee Submission Deadline | Action
 * plus the sidebar menu (New Admission Request, Personal Information,
 * Matric Profile) and profile-completion prompts.
 *
 * NO ACCOUNT / LOGIN: before the final Submit this page shows the applicant's
 * draft, which lives only on their own device.  After Submit (or after
 * "Track Application" opens an application) it shows the submitted
 * application(s) with Pay / Edit / View.
 */

import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard, ClipboardList, UserRound, BookOpen,
  LogOut, Plus, Search, AlertCircle, BadgeCheck, Wallet, PencilLine,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterSession } from "@/hooks/useInterAdmission";
import { formatCnic, QUOTA_LABEL, formatDeadline, maskMobile } from "@/lib/interAdmission";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionSessionRetry from "@/components/shared/AdmissionSessionRetry";

export default function AdmissionPortal() {
  const { session, loading, logout, discardDraft, isDraft, draft, netError, refresh } = useInterSession();
  const navigate = useNavigate();

  const personalDone = Boolean(session?.personal);
  const sscDone = Boolean(session?.ssc);
  const profilesDone = personalDone && sscDone;
  const apps = session?.applications ?? [];
  // ONE active application per cycle — hide "New Application" while one exists.
  // A cancelled / rejected application does NOT count as active.
  const activeApp = apps.find(a => !['cancelled','rejected'].includes(a.status));
  const hasActiveApp = Boolean(activeApp);
  // The application the applicant can edit (unpaid + not yet locked)
  const editableApp = apps.find(a => a.payment_status === 'pending'
    && !['fee_paid','under_review','merit_listed','admitted','rejected','cancelled'].includes(a.status));

  const itemCls = "w-full flex items-center gap-2.5 rounded-lg px-3 h-10 text-[13px] font-semibold text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors text-left";

  // Slow-internet guard: while the session call is failing (after its network
  // retries), show ONE calm retry card instead of an empty dashboard. The old
  // behaviour fell through to "No applications yet" — genuinely alarming for
  // an applicant whose applications DO exist.
  if (netError && !session) {
    return (
      <PageLayout>
        <div className="container mx-auto max-w-xl px-4 py-12">
          <AdmissionBackBar to="/admission" />
          <AdmissionSessionRetry
            what="your dashboard"
            onRetry={refresh}
            backTo={{ to: "/admission", label: "Back to Admission Home" }}
          />
        </div>
      </PageLayout>
    );
  }

  function goNewApplication() {
    if (!profilesDone) {
      toast.error("Please complete your profiles before applying.");
      document.getElementById("complete-profile")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (hasActiveApp) {
      toast.error("You already have an active application for this cycle. Use Edit Application instead.");
      document.getElementById("all-applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate("/admission/apply");
  }

  function goAllApplications() {
    document.getElementById("all-applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }


  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl">
        <AdmissionBackBar to="/admission" />
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">Applicant Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isDraft
                ? (session?.applicant?.cnic_formb
                    ? <>CNIC/Form-B: <span className="font-mono font-semibold text-foreground">{formatCnic(session.applicant.cnic_formb)}</span> · Your draft is saved on this device and is not submitted yet.</>
                    : "Fill in the steps below. Your draft is saved on this device until you submit.")
                : session?.applicant
                  ? <>CNIC/Form-B: <span className="font-mono font-semibold text-foreground">{formatCnic(session.applicant.cnic_formb)}</span> · Mobile: <span className="font-mono">{maskMobile(session.applicant.mobile)}</span></>
                  : "Loading your application…"}
            </p>
          </div>
          {isDraft ? (
            (draft.personal || draft.ssc) && (
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm("Discard your saved draft from this device? This cannot be undone.")) {
                    discardDraft();
                    toast.success("Draft discarded.");
                  }
                }}
                className="h-10 font-semibold"
              >
                <LogOut className="w-4 h-4" /> Discard Draft
              </Button>
            )
          ) : (
            <Button variant="outline" onClick={logout} className="h-10 font-semibold">
              <LogOut className="w-4 h-4" /> Exit
            </Button>
          )}
        </div>

        {/* Profile completion — shown first, only while something is missing */}
        {!profilesDone && (
          <Card id="complete-profile" className="border-azure/30 bg-azure-soft/50 dark:bg-azure-soft/15 mb-6">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-azure-strong dark:text-azure shrink-0 mt-0.5" />
                <div className="text-sm space-y-2 w-full min-w-0">
                  <p className="font-bold text-foreground">Complete your profile before applying</p>
                  <div className="flex flex-wrap gap-2">
                    {!personalDone && (
                      <Link to="/admission/profile">
                        <Button size="sm" className="h-9 font-semibold">
                          <UserRound className="w-4 h-4" /> Personal Information
                        </Button>
                      </Link>
                    )}
                    {!sscDone && (
                      <Link to="/admission/ssc">
                        <Button size="sm" className="h-9 font-semibold">
                          <BookOpen className="w-4 h-4" /> Matric (SSC) Profile
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar — admission menu */}
          <aside className="lg:sticky lg:top-24 self-start">
            <Card className="border-border/80">
              <CardContent className="p-4">
                <h3 className="font-heading font-bold text-sm text-foreground mb-3 px-1">Admission Menu</h3>
                <nav className="space-y-1">
                  {hasActiveApp ? (
                    <Link to={editableApp ? `/admission/apply?edit=${editableApp.id}` : `/admission/application/${activeApp?.id ?? ""}`} className={itemCls}>
                      <PencilLine className="w-4 h-4" /> Edit Application
                    </Link>
                  ) : (
                    <button type="button" onClick={goNewApplication} className={itemCls}>
                      <Plus className="w-4 h-4" /> New Admission Request
                    </button>
                  )}
                  <button type="button" onClick={goAllApplications} className={itemCls}>
                    <LayoutDashboard className="w-4 h-4" /> All Applications
                  </button>
                  <Link to="/admission/profile" className={itemCls}>
                    <UserRound className="w-4 h-4" /> Personal Information
                    {personalDone && <BadgeCheck className="w-4 h-4 text-green-600 ml-auto" />}
                  </Link>
                  <Link to="/admission/ssc" className={itemCls}>
                    <BookOpen className="w-4 h-4" /> Matric Profile
                    {sscDone && <BadgeCheck className="w-4 h-4 text-green-600 ml-auto" />}
                  </Link>
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main */}
          <div className="space-y-5 min-w-0">
            {/* All Applications */}
            <Card id="all-applications" className="border-border/80 shadow-card scroll-mt-24">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-heading text-lg font-bold text-foreground">All Applications</h2>
                </div>

                {loading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                  </div>
                ) : apps.length === 0 ? (
                  <div className="text-center py-10">
                    <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {isDraft
                        ? "Not submitted yet. Complete your Personal Information and Matric Profile, then use New Admission Request to choose your program and submit."
                        : "No applications yet."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-[13px] min-w-[760px]">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">#</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Tracking ID</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Program</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Quota</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Hafiz e Quran</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Fee Submission Deadline</th>
                          <th className="px-3 py-2.5 text-center align-middle font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apps.map((a, i) => {
                          const unpaid = a.payment_status === "pending";
                          return (
                            <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                              <td className="px-3 py-3 text-center align-middle">{i + 1}</td>
                              <td className="px-3 py-3 text-center align-middle">
                                <Link to={`/admission/application/${a.id}`} className="font-mono font-bold text-primary hover:underline">
                                  {a.tracking_id}
                                </Link>
                              </td>
                              <td className="px-3 py-3 text-center align-middle font-semibold text-foreground">{a.program_name}</td>
                              <td className="px-3 py-3 text-center align-middle">{QUOTA_LABEL[a.quota] ?? a.quota}</td>
                              <td className="px-3 py-3 text-center align-middle">{a.hafiz_e_quran ? "Yes" : "No"}</td>
                              <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                                {formatDeadline(a.fee_deadline_iso)}
                                <Badge
                                  variant="secondary"
                                  className={`ml-2 ${unpaid ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-green-500/15 text-green-700 dark:text-green-400"}`}
                                >
                                  {unpaid ? "Pending" : "Paid"}
                                </Badge>
                              </td>
                              <td className="px-3 py-3 text-center align-middle">
                                {unpaid ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Link to={`/admission/application/${a.id}?pay=1`}>
                                      <Button size="sm" className="h-8 text-xs font-semibold">
                                        <Wallet className="w-3.5 h-3.5" /> Pay
                                      </Button>
                                    </Link>
                                    {a.status !== 'cancelled' && a.status !== 'rejected' && (
                                      <Link to={`/admission/apply?edit=${a.id}`}>
                                        <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
                                          <PencilLine className="w-3.5 h-3.5" /> Edit
                                        </Button>
                                      </Link>
                                    )}
                                  </div>
                                ) : (
                                  <Link to={`/admission/application/${a.id}`}>
                                    <Button size="sm" variant="outline" className="h-8 text-xs font-semibold">
                                      <Search className="w-3.5 h-3.5" /> View
                                    </Button>
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </PageLayout>
  );
}
