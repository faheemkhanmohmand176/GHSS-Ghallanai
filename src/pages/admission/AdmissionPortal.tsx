/**
 * AdmissionPortal — applicant dashboard (HED student_dashboard.php):
 * "All Applications" table with the exact HED columns:
 *   # | Tracking ID | Program | Quota | Hafiz e Quran | Fee Submission Deadline | Action
 * plus the sidebar menu (New Admission Request, Personal Information,
 * Matric Profile, Alerts, Logout) and profile-completion prompts.
 */

import { Link, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, UserRound, BookOpen, BellRing,
  LogOut, Plus, Loader2, Search, AlertCircle, BadgeCheck, Wallet,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterSession } from "@/hooks/useInterAdmission";
import { formatCnic, QUOTA_LABEL, formatDeadline } from "@/lib/interAdmission";
import { useQuery } from "@tanstack/react-query";
import { interApi } from "@/lib/interAdmission";

const MENU = [
  { to: "/admission/portal",    icon: Plus,           label: "New Admission Request" },
  { to: "/admission/portal",    icon: LayoutDashboard, label: "All Applications", dashboard: true },
  { to: "/admission/profile",   icon: UserRound,      label: "Personal Information" },
  { to: "/admission/ssc",       icon: BookOpen,       label: "Matric Profile" },
];

export default function AdmissionPortal() {
  const { session, loading, logout } = useInterSession();
  const [params] = useSearchParams();
  const isWelcome = params.get("welcome") === "1";

  const personalDone = Boolean(session?.personal);
  const sscDone = Boolean(session?.ssc);
  const apps = session?.applications ?? [];

  const { data: alerts } = useQuery({
    queryKey: ["inter-portal-alerts"],
    queryFn: async () => [] as Array<Record<string, string>>,
    enabled: false, // Alerts page placeholder (HED: "No alerts found....")
  });

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-10 sm:py-12 max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">Applicant Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {session?.applicant
                ? <>CNIC/Form-B: <span className="font-mono font-semibold text-foreground">{formatCnic(session.applicant.cnic_formb)}</span> · Mobile: <span className="font-mono">{session.applicant.mobile}</span></>
                : "Loading your session…"}
            </p>
          </div>
          <Button variant="outline" onClick={logout} className="h-10 font-semibold">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar — HED admission menu */}
          <aside className="lg:sticky lg:top-24 self-start">
            <Card className="border-border/80">
              <CardContent className="p-4">
                <h3 className="font-heading font-bold text-sm text-foreground mb-3 px-1">Admission Menu</h3>
                <nav className="space-y-1">
                  {MENU.map((m) => (
                    <Link
                      key={m.label}
                      to={m.dashboard ? "/admission/portal" : m.to}
                      className="flex items-center gap-2.5 rounded-lg px-3 h-10 text-[13px] font-semibold text-muted-foreground hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      <m.icon className="w-4 h-4" /> {m.label}
                    </Link>
                  ))}
                  <div className="flex items-center gap-2.5 rounded-lg px-3 h-10 text-[13px] font-semibold text-muted-foreground/60">
                    <BellRing className="w-4 h-4" /> Alerts
                    <Badge variant="secondary" className="ml-auto text-[10px]">0</Badge>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 h-10 text-[13px] font-semibold text-muted-foreground hover:bg-red-500/5 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* Main */}
          <div className="space-y-5 min-w-0">
            {/* Welcome / profile completion prompts */}
            {(isWelcome || !personalDone || !sscDone) && (
              <Card className="border-azure/30 bg-azure-soft/50 dark:bg-azure-soft/15">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-azure-strong dark:text-azure shrink-0 mt-0.5" />
                    <div className="text-sm space-y-2 w-full">
                      <p className="font-bold text-foreground">Complete your profile before applying</p>
                      <p className="text-muted-foreground text-[13px]">
                        To submit an admission application, please complete both profiles first:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link to="/admission/profile">
                          <Button size="sm" variant={personalDone ? "outline" : "default"} className="h-9 font-semibold">
                            {personalDone ? <BadgeCheck className="w-4 h-4 text-green-600" /> : <UserRound className="w-4 h-4" />}
                            Personal Information {personalDone ? "Saved" : ""}
                          </Button>
                        </Link>
                        <Link to="/admission/ssc">
                          <Button size="sm" variant={sscDone ? "outline" : "default"} className="h-9 font-semibold">
                            {sscDone ? <BadgeCheck className="w-4 h-4 text-green-600" /> : <BookOpen className="w-4 h-4" />}
                            Matric (SSC) Profile {sscDone ? "Saved" : ""}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Applications */}
            <Card className="border-border/80 shadow-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-heading text-lg font-bold text-foreground">All Applications</h2>
                  <Link to="/admission/apply">
                    <Button size="sm" className="h-9 font-semibold" disabled={!personalDone || !sscDone}>
                      <Plus className="w-4 h-4" /> New Admission Request
                    </Button>
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                  </div>
                ) : apps.length === 0 ? (
                  <div className="text-center py-10">
                    <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No applications yet. Click <span className="font-semibold text-foreground">New Admission Request</span> to apply.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full text-[13px] min-w-[760px]">
                      <thead className="bg-muted/60">
                        <tr className="text-left">
                          <th className="px-3 py-2.5 font-semibold">#</th>
                          <th className="px-3 py-2.5 font-semibold">Tracking ID</th>
                          <th className="px-3 py-2.5 font-semibold">Program</th>
                          <th className="px-3 py-2.5 font-semibold">Quota</th>
                          <th className="px-3 py-2.5 font-semibold">Hafiz e Quran</th>
                          <th className="px-3 py-2.5 font-semibold">Fee Submission Deadline</th>
                          <th className="px-3 py-2.5 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apps.map((a, i) => {
                          const unpaid = a.payment_status === "pending";
                          return (
                            <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                              <td className="px-3 py-3">{i + 1}</td>
                              <td className="px-3 py-3">
                                <Link to={`/admission/application/${a.id}`} className="font-mono font-bold text-primary hover:underline">
                                  {a.tracking_id}
                                </Link>
                              </td>
                              <td className="px-3 py-3 font-semibold text-foreground">{a.program_name}</td>
                              <td className="px-3 py-3">{QUOTA_LABEL[a.quota] ?? a.quota}</td>
                              <td className="px-3 py-3">{a.hafiz_e_quran ? "Yes" : "No"}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {formatDeadline(a.fee_deadline_iso)}
                                <Badge
                                  variant="secondary"
                                  className={`ml-2 ${unpaid ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-green-500/15 text-green-700 dark:text-green-400"}`}
                                >
                                  {unpaid ? "Pending" : "Paid"}
                                </Badge>
                              </td>
                              <td className="px-3 py-3">
                                {unpaid ? (
                                  <Link to={`/admission/application/${a.id}?pay=1`}>
                                    <Button size="sm" className="h-8 text-xs font-semibold">
                                      <Wallet className="w-3.5 h-3.5" /> Pay Application Fee
                                    </Button>
                                  </Link>
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

            {/* Alerts placeholder — HED shows "No alerts found...." */}
            <Card className="border-border/80">
              <CardContent className="p-4 sm:p-6">
                <h2 className="font-heading text-lg font-bold text-foreground mb-3">Alerts</h2>
                <p className="text-sm text-muted-foreground text-center py-4">
                  {(alerts?.length ?? 0) === 0 ? "No alerts found...." : null}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
