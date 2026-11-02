/**
 * ApplicationView — mirrors HED student_view_application.php:
 * full application details, Processing Fee Status, JazzCash token + deadline
 * notice, Tracking ID, Print Application button, and (when unpaid) the
 * Pay Application Processing Fee flow.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Printer, Loader2, Wallet, ChevronLeft, AlertCircle, CheckCircle2, Info, FileText,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, QUOTA_LABEL, HED_MESSAGES, COLLEGE_NAME, STUDY_LEVEL,
  ADMISSION_CYCLE, PROCESSING_FEE, formatCnic, formatDateLong, formatDeadline,
} from "@/lib/interAdmission";

interface AppDetail {
  ok: boolean; error?: string;
  application?: Record<string, string | number | boolean | null>;
  personal?: Record<string, string | boolean | null>;
  ssc?: Record<string, string | number | boolean | null>;
  applicant_cnic?: string;
  timeline?: Array<{ title: string; details: string | null; date: string }>;
}

export default function ApplicationView() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { token, loading: sessionLoading } = useInterSession();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = (await interApi.applicationDetail(token, id)) as unknown as AppDetail;
      setDetail(res);
      if (!res?.ok) toast.error(res?.error || "Application not found.");
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { if (!sessionLoading) load(); }, [sessionLoading, load]);

  async function handlePay() {
    if (!id) return;
    setPaying(true);
    try {
      const res = (await interApi.proceedPayment(token!, id)) as unknown as {
        ok?: boolean; error?: string; token?: string; deadline?: string;
      };
      if (res?.ok && res.token) {
        toast.success(`JazzCash token ${res.token} Pay Rs ${PROCESSING_FEE}/- before ${res.deadline}.`);
        await load();
      } else {
        toast.error(res?.error || "Payment initialization failed.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  const app = detail?.application;
  const personal = detail?.personal;
  const ssc = detail?.ssc;
  const unpaid = app ? app.payment_status === "pending" : false;
  const autoPay = params.get("pay") === "1" && unpaid;

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="text-muted-foreground shrink-0 text-[13px]">{k}:</span>
      <span className="font-semibold text-foreground text-right text-[13px]">{v}</span>
    </div>
  );

  if (loading || sessionLoading) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-16 max-w-3xl space-y-4">
          <Skeleton className="h-10 w-72 rounded-xl" />
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      </PageLayout>
    );
  }

  if (!detail?.ok || !app || !personal || !ssc) {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-16 max-w-xl text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground mb-5">Application not found or session expired.</p>
          <Link to="/admission/portal"><Button variant="outline" className="font-semibold">Back to Dashboard</Button></Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {autoPay && (
        <div className="container mx-auto px-4 pt-8 max-w-3xl no-print">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gold/50 bg-gold/5 p-4">
            <h2 className="font-heading font-bold text-foreground mb-1.5">Pay Application Processing Fee</h2>
            <div className="grid sm:grid-cols-3 gap-2.5 text-sm mb-3.5">
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-[11px] text-muted-foreground font-semibold">Processing Fee</p>
                <p className="font-bold text-foreground">Rs {PROCESSING_FEE}/-</p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-[11px] text-muted-foreground font-semibold">Additional Charges</p>
                <p className="font-bold text-foreground">Rs 0/-</p>
              </div>
              <div className="rounded-lg bg-card border border-border p-3">
                <p className="text-[11px] text-muted-foreground font-semibold">Total</p>
                <p className="font-bold text-foreground">Rs {PROCESSING_FEE}/-</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Button onClick={handlePay} disabled={paying} className="font-semibold flex-1 h-9">
                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                Proceed with Payment
              </Button>
              <Button variant="outline" onClick={() => navigate(`/admission/application/${id}`)} className="font-semibold h-11">Cancel</Button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10 sm:py-12 max-w-3xl space-y-5 no-print">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Application Form</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {String(personal.full_name)} · {COLLEGE_NAME}
            </p>
          </div>
          <div className="flex gap-2.5">
            {app.jazzcash_token ? (
              <Button variant="outline" onClick={() => window.print()} className="h-10 font-semibold print:hidden">
                <FileText className="w-4 h-4" /> Print Fee Challan
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => window.print()} className="h-10 font-semibold print:hidden">
              <Printer className="w-4 h-4" /> Print Application
            </Button>
            <Link to="/admission/portal" className="print:hidden">
              <Button variant="ghost" className="h-10 font-semibold"><ChevronLeft className="w-4 h-4" /> Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Fee status + token */}
        <Card className={`border ${unpaid ? "border-amber-500/40 bg-amber-500/5" : "border-green-500/40 bg-green-500/5"}`}>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {unpaid
                  ? <AlertCircle className="w-6 h-6 text-amber-600" />
                  : <CheckCircle2 className="w-6 h-6 text-green-600" />}
                <div>
                <p className="font-heading font-bold text-foreground">Processing Fee Status:{" "}
                  <Badge variant="secondary" className={unpaid ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-green-500/15 text-green-700 dark:text-green-400"}>
                    {unpaid ? "Pending" : "Paid"}
                  </Badge>
                </p>
                {app.jazzcash_token ? (
                  <div className="mt-2">
                    <p className="text-sm"><span className="text-muted-foreground">Token: </span>
                      <span className="font-mono font-bold text-foreground text-base tracking-wider">{String(app.jazzcash_token)}</span>
                    </p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">
                      {HED_MESSAGES.feeTokenNotice(String(app.jazzcash_token), formatDeadline(String(app.fee_deadline)).split(" ")[0])}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground mt-1">
                    Click “Proceed with Payment” to generate your JazzCash payment token.
                  </p>
                )}
                </div>
              </div>
              {unpaid && !autoPay && (
                <Link to={`/admission/application/${id}?pay=1`}>
                  <Button className="h-9 font-semibold"><Wallet className="w-5 h-5" /> Pay Application Fee</Button>
                </Link>
              )}
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-border/60 text-[13px]">
              <div><span className="text-muted-foreground">Username: </span><span className="font-mono font-semibold">{formatCnic(detail.applicant_cnic ?? "")}</span></div>
              <div><span className="text-muted-foreground">Tracking ID: </span><span className="font-mono font-bold text-primary">{String(app.tracking_id)}</span></div>
              <div><span className="text-muted-foreground">Date Applied: </span><span className="font-semibold">{formatDateLong(String(app.submitted_at))}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Application details */}
        <Card className="border-border/80 shadow-card">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="font-heading font-bold text-foreground mb-2.5">Application Details</h3>
              <div className="grid sm:grid-cols-2 gap-x-6">
                <Row k="College" v={`${COLLEGE_NAME} (Mohmand)`} />
                <Row k="Admission Cycle" v={ADMISSION_CYCLE} />
                <Row k="Study Level" v={STUDY_LEVEL} />
                <Row k="Program" v={String(app.program_name)} />
                {app.subject_group ? <Row k="Subject Group" v={String(app.subject_group)} /> : null}
                <Row k="Application Quota" v={QUOTA_LABEL[String(app.quota)] ?? String(app.quota)} />
                {app.quota === "local_quota" && app.quota_criteria && (
                  <Row k="Criteria" v={app.quota_criteria === "domicile_of_area"
                    ? `Having Domicile of the Local Area (${String(app.quota_criteria_uc)})`
                    : "Parent / Spouse Posting as Govt. Servant in District"} />
                )}
                {app.sport_certificate && <Row k="Sport Certificate" v={String(app.sport_certificate)} />}
                {app.nature_of_disability && <Row k="Nature of Disability" v={String(app.nature_of_disability)} />}
                {app.parent_department && <Row k="Parent Department" v={String(app.parent_department)} />}
                <Row k="Shift" v={String(app.shift)} />
              </div>
              <p className="text-[12px] text-muted-foreground italic mt-2.5 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {HED_MESSAGES.meritNote}
              </p>
            </div>

            <div>
              <h3 className="font-heading font-bold text-foreground mb-2.5">Personal Information</h3>
              <div className="grid sm:grid-cols-2 gap-x-6">
                <Row k="Name" v={String(personal.full_name)} />
                <Row k="Personal Mobile" v={String(personal.mobile_number)} />
                <Row k="Father Name" v={String(personal.father_name)} />
                <Row k="Father's Mobile" v={String(personal.father_mobile)} />
                <Row k="Applicant's CNIC" v={formatCnic(detail.applicant_cnic ?? "")} />
                <Row k="Father's CNIC" v={formatCnic(String(personal.father_cnic))} />
                <Row k="Date of Birth" v={formatDateLong(String(personal.date_of_birth))} />
                <Row k="Gender" v={String(personal.gender)} />
                <Row k="Nationality" v={String(personal.nationality)} />
                <Row k="Province" v={String(personal.domicile_province)} />
                <Row k="Domicile District" v={String(personal.domicile_district)} />
                <Row k="Tehsil" v={String(personal.tehsil)} />
                <Row k="Union Council" v={String(personal.union_council)} />
                <Row k="Religion" v={String(personal.religion)} />
                <div className="sm:col-span-2"><Row k="Mailing Address" v={String(personal.mailing_address)} /></div>
              </div>
            </div>

            <div>
              <h3 className="font-heading font-bold text-foreground mb-2.5">Academic Information</h3>
              <div className="grid sm:grid-cols-2 gap-x-6">
                <Row k="Highest Exam" v="SSC" />
                <Row k="Exam Session" v={String(ssc.exam_session)} />
                <Row k="Exam Board/Uni" v={String(ssc.exam_board)} />
                <Row k="Passing Year" v={String(ssc.passing_year)} />
                <Row k="Study Group" v={String(ssc.study_group)} />
                <Row k="Roll No." v={String(ssc.roll_number)} />
                <Row k="Net Marks" v={`${ssc.marks_obtained} / ${ssc.marks_total} (${ssc.marks_percentage}%)`} />
                <Row k="Grade" v={String(ssc.grade)} />
                <Row k="Sport Certificate" v={ssc.sport_certificate ? String(ssc.sport_certificate) : "N/A"} />
                <Row k="Hafiz e Quran" v={ssc.hafiz_e_quran ? "Yes" : "No"} />
                <Row k="School/College Districts" v={String(ssc.institute_district)} />
                <Row k="Board Record" v="Not Verified" />
                <div className="sm:col-span-2"><Row k="School/College" v={String(ssc.institute_name)} /></div>
              </div>
            </div>

            <div className="rounded-xl bg-muted/60 border border-border p-3.5 text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">Declaration:</span> {HED_MESSAGES.declaration}
            </div>
          </CardContent>
        </Card>

        {/* Timeline — HED "Application Detail": # | Title | Date | Detials */}
        {detail.timeline && detail.timeline.length > 0 && (
          <Card className="border-border/80 shadow-card">
            <CardContent className="p-5 sm:p-6">
              <h3 className="font-heading font-bold text-foreground mb-3">Application Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Title</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Detials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.timeline.map((t, i) => (
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
            </CardContent>
          </Card>
        )}
      </div>
      {/* ═══ FEE CHALLAN (print-only — JazzCash payment slip) ═══ */}
      {app.jazzcash_token && (
        <div className="hidden print:block px-8 py-6 max-w-3xl mx-auto text-black">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-3">
            <p className="font-bold text-[15px] tracking-wide">GOVERNMENT HIGHER SECONDARY SCHOOL GHALLANAI</p>
            <p className="text-[11px]">District Mohmand, Khyber Pakhtunkhwa</p>
            <p className="font-bold text-[12px] mt-1.5">ONLINE ADMISSION: APPLICATION PROCESSING FEE CHALLAN</p>
            <p className="text-[10px]">{ADMISSION_CYCLE} · Intermediate (1st / 2nd Year)</p>
          </div>

          {/* Token box */}
          <div className="border-2 border-black mt-4 p-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest">JazzCash Token (Account No.)</p>
              <p className="font-mono font-bold text-xl tracking-widest">{String(app.jazzcash_token)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-widest">Amount Payable</p>
              <p className="font-bold text-xl">Rs. {PROCESSING_FEE}/-</p>
            </div>
          </div>

          {/* Details table */}
          <table className="w-full mt-4 text-[11px]" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Applicant Name", String(personal.full_name)],
                ["Father Name", String(personal.father_name)],
                ["CNIC / Form-B", formatCnic(detail.applicant_cnic ?? "")],
                ["Tracking ID", String(app.tracking_id)],
                ["Program", String(app.program_name)],
                ["Subject Group", app.subject_group ? String(app.subject_group) : "N/A"],
                ["Category of Admission", QUOTA_LABEL[String(app.quota)] ?? String(app.quota)],
                ["Mobile Number", String(personal.mobile_number)],
                ["Processing Fee", `Rs. ${PROCESSING_FEE}/-`],
                ["Additional Charges", "Rs. 0/-"],
                ["Total", `Rs. ${PROCESSING_FEE}/- (${PROCESSING_FEE === 100 ? "One Hundred" : String(PROCESSING_FEE)} Rupees Only)`],
                ["Fee Submission Deadline", formatDeadline(String(app.fee_deadline))],
                ["Date Applied", formatDateLong(String(app.submitted_at))],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="border border-black px-2.5 py-1.5 font-semibold" style={{ width: "35%" }}>{k}</td>
                  <td className="border border-black px-2.5 py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Payment instructions */}
          <div className="border border-black mt-4 p-3 text-[10px] leading-relaxed">
            <p className="font-bold text-[11px] mb-1">PAYMENT INSTRUCTIONS</p>
            <p>
              Pay the total amount at any <strong>JAZZ CASH</strong> retailer or through the <strong>JAZZ CASH APP</strong>
              against token number <strong>{String(app.jazzcash_token)}</strong> on or before{" "}
              <strong>{formatDeadline(String(app.fee_deadline))}</strong>. Keep the payment receipt and this slip
              for record. The application is processed further only after the fee is confirmed by the college.
            </p>
          </div>

          {/* Signature strip */}
          <div className="flex justify-between items-end mt-10 text-[10px]">
            <div>
              <p className="border-t border-black pt-1 px-6">College Copy: Stamp / Signature</p>
            </div>
            <div className="text-center">
              <p className="border-t border-black pt-1 px-6">JazzCash Representative</p>
            </div>
            <div>
              <p className="border-t border-black pt-1 px-6">Student Signature</p>
            </div>
          </div>
          <p className="text-center text-[9px] mt-4 text-gray-700">
            Computer-generated challan for online admission application {String(app.tracking_id)} · GHSS Ghallanai Online Admission System.
          </p>
        </div>
      )}
    </PageLayout>
  );
}
