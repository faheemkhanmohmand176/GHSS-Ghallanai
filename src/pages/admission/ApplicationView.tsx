/**
 * ApplicationView — mirrors HED student_view_application.php:
 * full application details, Processing Fee Status, JazzCash token + deadline
 * notice, Tracking ID, Print Application button, and (when unpaid) the
 * Pay Application Processing Fee flow.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Printer, Loader2, Wallet, AlertCircle, CheckCircle2, FileText,
} from "lucide-react";
import AdmissionBackBar from "@/components/shared/AdmissionBackBar";
import AdmissionInfoGrid from "@/components/shared/AdmissionInfoGrid";
import AdmissionPaymentAccounts from "@/components/shared/AdmissionPaymentAccounts";
import { useAdmissionSettings, cycleLabel } from "@/hooks/useAdmission";
import { downloadFeeChallan, downloadApplicationForm } from "@/lib/admissionPdf";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useInterSession } from "@/hooks/useInterAdmission";
import {
  interApi, QUOTA_LABEL, HED_MESSAGES, COLLEGE_NAME, STUDY_LEVEL,
  formatCnic, formatDateLong, formatDeadline,
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
  
  const { token, loading: sessionLoading } = useInterSession();
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const { data: admSettings } = useAdmissionSettings();
  const ADMISSION_CYCLE = cycleLabel(admSettings);

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
        toast.success(`Payment reference ${res.token} generated.`);
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

  const FEE = Number(app.processing_fee ?? admSettings?.processing_fee ?? 100);
  const quotaName = QUOTA_LABEL[String(app.quota)] ?? String(app.quota);
  const deadlineShort = formatDeadline(String(app.fee_deadline)).split(" ").slice(0, 3).join(" ");
  const cnicShown = formatCnic(detail.applicant_cnic ?? "");

  async function downloadChallan() {
    try {
      await downloadFeeChallan({
        cycle: ADMISSION_CYCLE, fee: FEE, reference: String(app!.jazzcash_token ?? ""),
        trackingId: String(app!.tracking_id), name: String(personal!.full_name), fatherName: String(personal!.father_name),
        cnic: cnicShown, mobile: String(personal!.mobile_number),
        program: String(app!.program_name), subjectGroup: app!.subject_group ? String(app!.subject_group) : "N/A",
        quota: quotaName, deadline: deadlineShort, appliedOn: formatDateLong(String(app!.submitted_at)),
        methods: admSettings?.payment_methods ?? [],
      });
    } catch { toast.error("Could not create the challan. Please try again."); }
  }

  async function downloadForm() {
    try {
      const p = personal!, sc = ssc!, ap = app!;
      await downloadApplicationForm({
        cycle: ADMISSION_CYCLE, trackingId: String(ap.tracking_id), paymentStatus: unpaid ? "Pending" : "Paid",
        reference: String(ap.jazzcash_token ?? ""), fee: FEE, declaration: HED_MESSAGES.declaration,
        institution: COLLEGE_NAME, username: cnicShown, deadline: deadlineShort, appliedOn: formatDateLong(String(ap.submitted_at)),
        applicant: { name: String(p.full_name), fatherName: String(p.father_name), cnic: cnicShown,
          address: String(p.mailing_address ?? ""), program: String(ap.program_name) },
        sections: [
          { title: "Application Details", rows: [
            ["College", COLLEGE_NAME], ["Study Level", STUDY_LEVEL],
            ["Program", String(ap.program_name)], ["Subject Group", String(ap.subject_group ?? "")],
            ["Category", quotaName], ["Shift", String(ap.shift ?? "")],
            ["Date Applied", formatDateLong(String(ap.submitted_at))], ["Fee Deadline", deadlineShort],
          ] },
          { title: "Personal Information", rows: [
            ["Name", String(p.full_name)], ["Father Name", String(p.father_name)],
            ["Applicant CNIC", cnicShown], ["Father CNIC", formatCnic(String(p.father_cnic ?? ""))],
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
    } catch { toast.error("Could not create the form. Please try again."); }
  }

  const items = {
    app: [
      { label: "College", value: `${COLLEGE_NAME} (Mohmand)`, wide: true },
      { label: "Admission Cycle", value: ADMISSION_CYCLE },
      { label: "Study Level", value: STUDY_LEVEL },
      { label: "Program", value: String(app.program_name) },
      ...(app.subject_group ? [{ label: "Subject Group", value: String(app.subject_group) }] : []),
      { label: "Category", value: quotaName },
      ...(app.quota === "local_quota" && app.quota_criteria ? [{ label: "Criteria", value: app.quota_criteria === "domicile_of_area"
        ? `Domicile of the Local Area (${String(app.quota_criteria_uc)})` : "Parent or Spouse posted as Govt. Servant in District" }] : []),
      ...(app.sport_certificate ? [{ label: "Sport Certificate", value: String(app.sport_certificate) }] : []),
      ...(app.nature_of_disability ? [{ label: "Nature of Disability", value: String(app.nature_of_disability) }] : []),
      ...(app.parent_department ? [{ label: "Parent Department", value: String(app.parent_department) }] : []),
      { label: "Shift", value: String(app.shift) },
    ],
    personal: [
      { label: "Name", value: String(personal.full_name) },
      { label: "Father Name", value: String(personal.father_name) },
      { label: "Applicant CNIC", value: cnicShown },
      { label: "Father CNIC", value: formatCnic(String(personal.father_cnic ?? "")) },
      { label: "Personal Mobile", value: String(personal.mobile_number) },
      { label: "Father Mobile", value: String(personal.father_mobile ?? "") },
      { label: "Date of Birth", value: formatDateLong(String(personal.date_of_birth)) },
      { label: "Gender", value: String(personal.gender) },
      { label: "Nationality", value: String(personal.nationality) },
      { label: "Religion", value: String(personal.religion) },
      { label: "Province", value: String(personal.domicile_province) },
      { label: "Domicile District", value: String(personal.domicile_district) },
      { label: "Tehsil", value: String(personal.tehsil) },
      { label: "Union Council", value: String(personal.union_council) },
      { label: "Mailing Address", value: String(personal.mailing_address), wide: true },
    ],
    academic: [
      { label: "Highest Exam", value: "SSC" },
      { label: "Exam Session", value: String(ssc.exam_session) },
      { label: "Exam Board", value: String(ssc.exam_board) },
      { label: "Passing Year", value: String(ssc.passing_year) },
      { label: "Study Group", value: String(ssc.study_group), wide: true },
      { label: "Roll No", value: String(ssc.roll_number) },
      { label: "Net Marks", value: `${ssc.marks_obtained} / ${ssc.marks_total} (${ssc.marks_percentage}%)` },
      { label: "Grade", value: String(ssc.grade) },
      { label: "Hafiz e Quran", value: ssc.hafiz_e_quran ? "Yes" : "No" },
      { label: "Institute District", value: String(ssc.institute_district) },
      { label: "School or College", value: String(ssc.institute_name), wide: true },
    ],
  };

  const H3 = "font-heading font-bold text-foreground mb-3 text-center";

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-3xl space-y-5">
        <AdmissionBackBar to="/admission/portal" />

        {/* Header */}
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Application Form</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{String(personal.full_name)}</p>
          <p className="text-[12.5px] text-muted-foreground">{COLLEGE_NAME}</p>
          <div className="mt-4 mx-auto grid max-w-md grid-cols-2 gap-2.5">
            {app.jazzcash_token ? (
              <Button variant="outline" onClick={downloadChallan} className="h-10 font-semibold">
                <FileText className="w-4 h-4" /> Fee Challan
              </Button>
            ) : <span className="hidden" />}
            <Button variant="outline" onClick={downloadForm} className={`h-10 font-semibold ${app.jazzcash_token ? "" : "col-span-2"}`}>
              <Printer className="w-4 h-4" /> Application PDF
            </Button>
          </div>
        </div>

        {/* Fee status */}
        <Card className={`border ${unpaid ? "border-amber-500/40 bg-amber-500/5" : "border-green-500/40 bg-green-500/5"}`}>
          <CardContent className="p-5 sm:p-6 text-center">
            <div className="flex flex-col items-center gap-1.5">
              {unpaid ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <CheckCircle2 className="w-6 h-6 text-green-600" />}
              <p className="font-heading font-bold text-foreground">Processing Fee</p>
              <Badge variant="secondary" className={unpaid ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-green-500/15 text-green-700 dark:text-green-400"}>
                {unpaid ? "Pending" : "Paid"}
              </Badge>
              {app.jazzcash_token ? (
                <>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Payment Reference</p>
                  <p className="font-mono text-xl font-bold tracking-wider text-foreground">{String(app.jazzcash_token)}</p>
                  {unpaid && (
                    <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                      {HED_MESSAGES.feeTokenNotice(String(app.jazzcash_token), deadlineShort)}
                    </p>
                  )}
                </>
              ) : (
                <p className="max-w-sm text-[12.5px] text-muted-foreground">Generate your fee challan to see the payment details.</p>
              )}
            </div>

            {unpaid && (
              <div className="mt-5">
                <h3 className="font-heading font-bold text-foreground mb-2.5">Pay To</h3>
                <AdmissionPaymentAccounts methods={admSettings?.payment_methods ?? []} />
                {!app.jazzcash_token && (
                  <Button onClick={handlePay} disabled={paying} className="mt-4 h-10 font-semibold">
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    Generate Fee Challan
                  </Button>
                )}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border/60">
              <AdmissionInfoGrid items={[
                { label: "Username", value: <span className="font-mono">{cnicShown}</span> },
                { label: "Tracking ID", value: <span className="font-mono text-primary">{String(app.tracking_id)}</span> },
                { label: "Date Applied", value: formatDateLong(String(app.submitted_at)) },
                { label: "Amount", value: `Rs ${FEE}` },
              ]} />
            </div>
          </CardContent>
        </Card>

        {/* Application details */}
        <Card className="border-border/80 shadow-card">
          <CardContent className="p-5 sm:p-6 space-y-6">
            <div><h3 className={H3}>Application Details</h3><AdmissionInfoGrid items={items.app} /></div>
            <div><h3 className={H3}>Personal Information</h3><AdmissionInfoGrid items={items.personal} /></div>
            <div><h3 className={H3}>Academic Information</h3><AdmissionInfoGrid items={items.academic} /></div>
            <div className="rounded-xl bg-muted/60 border border-border p-3.5 text-center text-[12.5px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Declaration: </span>{HED_MESSAGES.declaration}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        {detail.timeline && detail.timeline.length > 0 && (
          <Card className="border-border/80 shadow-card">
            <CardContent className="p-5 sm:p-6">
              <h3 className={H3}>Application Timeline</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-center align-middle font-semibold">#</th>
                      <th className="px-3 py-2 text-center align-middle font-semibold">Title</th>
                      <th className="px-3 py-2 text-center align-middle font-semibold">Date</th>
                      <th className="px-3 py-2 text-center align-middle font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.timeline.map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2.5 text-center align-middle">{i + 1}</td>
                        <td className="px-3 py-2.5 text-center align-middle font-semibold">{t.title}</td>
                        <td className="px-3 py-2.5 text-center align-middle whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-2.5 text-center align-middle text-muted-foreground">{t.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
