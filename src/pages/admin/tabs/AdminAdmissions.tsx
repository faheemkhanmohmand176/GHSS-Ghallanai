/**
 * AdminAdmissions — admin console for-mirror Inter admission system
 * (migration 20_inter_admission_hed_mirror.sql).
 *
 * Three sections (tabs):
 *   • Applications — live list via `inter_admin_list`, mark processing fee
 *     Paid/Rejected (with payment reference), update status with a note
 *     (feeds the public tracker timeline), admission open/close settings.
 *   • Merit Lists — generate from fee-paid applications per program+quota,
 *     publish to the public Admission page, delete drafts.
 *   • Programs & Seats — sanctioned seats + open/close per faculty
 *     (fixed four Inter faculties; no BS/ADP/D.Com/DIT).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAdmissionSettings, getAdmissionState, formatAdmissionDate, ADMISSION_SETTINGS_KEY, type AdmissionSettings } from "@/hooks/useAdmission";
import type { PaymentMethod } from "@/hooks/useFees";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList, RefreshCw, Search, Loader2, Wallet, CheckCircle2,
  XCircle, Settings2, Users, GraduationCap, BadgeCheck, Trophy, Landmark, Plus, Trash2, Download, FileSpreadsheet, LockOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { exportApplicationsExcel, type ExportRow } from "@/lib/admissionExcel";
import AdminMeritLists from "./AdminMeritLists";
import AdminAdmissionPrograms from "./AdminAdmissionPrograms";

interface AdminApp {
  id: string; tracking_id: string; applicant_cnic: string; applicant_mobile: string;
  name: string | null; father_name: string | null; program: string; quota: string;
  quota_criteria: string | null; payment_status: string; status: string;
  jazzcash_token: string | null; fee_deadline: string;
  marks: string | null; grade: string | null; percentage: number | null;
  submitted_at: string; domicile: string | null; uc: string | null;
}

// Shape of the admission_settings payload saved by the admin. Declared at
// module scope so both AdminAdmissions and SettingsBody can reference it.
type SettingsSavePayload = Pick<AdmissionSettings,
  "is_open" | "session_year" | "open_date" | "last_date" | "processing_fee" |
  "payment_methods" | "online_payment_enabled" |
  "rate_register_per_ip_day" | "rate_login_max_attempts" | "rate_login_cooldown_minutes" |
  "rate_track_per_ip_hour" | "rate_track_per_id_hour" | "rate_reset_per_ip_day" | "turnstile_required">;

const APP_STATUSES = [
  { value: "submitted",     label: "Submitted" },
  { value: "fee_pending",   label: "Fee Pending" },
  { value: "fee_paid",      label: "Fee Paid" },
  { value: "under_review",  label: "Under Review" },
  { value: "merit_listed",  label: "Merit Listed" },
  { value: "admitted",      label: "Admitted" },
  { value: "rejected",      label: "Rejected" },
  { value: "cancelled",     label: "Cancelled" },
];

const QUOTA_LABELS: Record<string, string> = {
  open_merit: "Open Merit", local_quota: "Local Quota", sports: "Sports",
  college_employees: "College Employees", special_person: "Special Person",
};

const TABS = [
  { value: "applications", label: "Applications", icon: ClipboardList },
  { value: "merit",         label: "Merit Lists",  icon: Trophy },
  { value: "programs",      label: "Programs & Seats", icon: Landmark },
] as const;

type AdminTab = (typeof TABS)[number]["value"];

export default function AdminAdmissions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("applications");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [payDialog, setPayDialog] = useState<AdminApp | null>(null);
  const [payRef, setPayRef] = useState("");
  const [statusDialog, setStatusDialog] = useState<AdminApp | null>(null);
  const [statusValue, setStatusValue] = useState("under_review");
  const [statusNote, setStatusNote] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [delApp, setDelApp] = useState<AdminApp | null>(null);
  const [exporting, setExporting] = useState(false);
  const [unlockDialog, setUnlockDialog] = useState<AdminApp | null>(null);
  const [unlockReason, setUnlockReason] = useState("");

  // debounce search
  const onSearch = (v: string) => {
    setSearch(v);
    const t = setTimeout(() => setDebounced(v.trim()), 350);
    return () => clearTimeout(t);
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inter-admin-apps", debounced],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_list", {
        p_search: debounced || null,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; applications?: AdminApp[] } | AdminApp[];
      // RPC returns jsonb { ok, applications } — or an error payload
      if (Array.isArray(d)) return d;
      if (d?.ok === false) throw new Error(d?.error || "Admin access required.");
      return d?.applications ?? [];
    },
    refetchOnWindowFocus: false,
  });

  const apps: AdminApp[] = (data as unknown as AdminApp[]) ?? [];

  const { data: settings } = useAdmissionSettings();

  const setPayment = useMutation({
    mutationFn: async ({ id, status, ref }: { id: string; status: string; ref: string }) => {
      const { data, error } = await supabase.rpc("inter_admin_set_payment", {
        p_application_id: id, p_payment_status: status, p_reference: ref || null,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: () => { toast.success("Payment status updated."); setPayDialog(null); setPayRef(""); qc.invalidateQueries({ queryKey: ["inter-admin-apps"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note: string }) => {
      const { data, error } = await supabase.rpc("inter_admin_set_status", {
        p_application_id: id, p_status: status, p_note: note || null,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: () => { toast.success("Application status updated."); setStatusDialog(null); setStatusNote(""); qc.invalidateQueries({ queryKey: ["inter-admin-apps"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("inter_admin_delete_application", { p_application_id: id });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Delete failed.");
      return d;
    },
    onSuccess: () => {
      toast.success("Application deleted.");
      setDelApp(null);
      qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
      qc.invalidateQueries({ queryKey: ["inter-admin-merit-lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Unlock a fee-paid application so the applicant can edit it again.
  // The action is logged to audit_log (trigger + explicit log_admin_action).
  const unlockApp = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("inter_admin_unlock_application", {
        p_application_id: id, p_reason: reason || null,
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string };
      if (d?.ok === false) throw new Error(d?.error || "Unlock failed.");
      return d;
    },
    onSuccess: () => { toast.success("Application unlocked. The applicant can now edit it."); setUnlockDialog(null); setUnlockReason(""); qc.invalidateQueries({ queryKey: ["inter-admin-apps"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function exportExcel() {
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("inter_admin_export");
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; rows?: ExportRow[] };
      if (d?.ok === false) throw new Error(d?.error || "Export failed.");
      const rows = d?.rows ?? [];
      if (rows.length === 0) { toast("There are no applications to export."); return; }
      await exportApplicationsExcel(rows, settings?.session_year ?? "");
      toast.success(`${rows.length} application(s) exported.`);
    } catch (e) {
      toast.error((e as Error).message || "Export failed.");
    } finally { setExporting(false); }
  }

  const saveSettings = useMutation({
    mutationFn: async (v: SettingsSavePayload) => {
      // upsert: the old UPDATE ... WHERE id = 1 silently changed 0 rows when the row did not exist
      const { data, error } = await supabase
        .from("admission_settings")
        .upsert({ id: 1, ...v, updated_at: new Date().toISOString() }, { onConflict: "id" })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Settings were not saved. Please check your admin permission.");
      return data as AdmissionSettings;
    },
    onSuccess: (row) => {
      toast.success("Admission settings saved.");
      qc.setQueryData(ADMISSION_SETTINGS_KEY, row);
      qc.invalidateQueries({ queryKey: ADMISSION_SETTINGS_KEY });
      setSettingsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const admState = getAdmissionState(settings);

  const paid = apps.filter((a) => a.payment_status === "paid").length;
  const pendingFee = apps.filter((a) => a.payment_status === "pending").length;

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`h-10 px-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2 border transition-all ${
              tab === t.value
                ? "bg-primary text-white border-primary shadow-md shadow-primary/25"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "merit" && <AdminMeritLists />}
      {tab === "programs" && <AdminAdmissionPrograms />}

      {tab === "applications" && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: ClipboardList, label: "Total Applications", value: apps.length, color: "text-primary" },
          { icon: Wallet, label: "Fee Pending", value: pendingFee, color: "text-amber-600" },
          { icon: BadgeCheck, label: "Fee Paid", value: paid, color: "text-green-600" },
          { icon: Users, label: "Session", value: settings?.session_year ?? "N/A", color: "text-azure-strong dark:text-azure" },
        ].map((s) => (
          <Card key={s.label} className="border-border/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{s.label}</p>
                <p className="font-heading text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search Tracking ID, name or CNIC"
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <Button variant="outline" size="sm" className="h-9 px-3 text-[12.5px] whitespace-nowrap" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button variant="outline" size="sm" className="h-9 px-3 text-[12.5px] whitespace-nowrap" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-3.5 h-3.5" /> Settings
        </Button>
        <Button size="sm" className="h-9 px-3 text-[12.5px] whitespace-nowrap bg-green-700 hover:bg-green-800 text-white" onClick={exportExcel} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />} Export Excel
        </Button>
        <Badge variant="secondary" className={`whitespace-nowrap ${admState.open ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-600"}`}>
          {admState.open
            ? `Admissions Open${admState.daysLeft !== null ? `, ${admState.daysLeft} day${admState.daysLeft === 1 ? "" : "s"} left` : ""}`
            : admState.reason === "not_started" ? `Opens ${formatAdmissionDate(admState.openDate)}`
            : admState.reason === "ended" ? "Admissions Ended" : "Admissions Closed"}
        </Badge>
      </div>

      {/* Applications table */}
      <Card className="border-border/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : apps.length === 0 ? (
            <div className="p-10 text-center">
              <GraduationCap className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {debounced ? "No applications match your search." : "No applications yet, they will appear here as students apply."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border/60">
                {apps.map((a) => (
                  <div key={a.id} className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                    <p className="font-mono text-[13px] font-bold text-primary">{a.tracking_id}</p>
                    <p className="text-[14px] font-semibold text-foreground">{a.name ?? "N/A"}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{a.applicant_cnic} {a.applicant_mobile}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {a.program}, {QUOTA_LABELS[a.quota] ?? a.quota}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <Badge variant="secondary" className={
                        a.payment_status === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : a.payment_status === "rejected" ? "bg-red-500/10 text-red-600" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }>
                        Fee {a.payment_status === "pending" ? "Pending" : a.payment_status === "paid" ? "Paid" : "Rejected"}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{a.status.replace(/_/g, " ")}</Badge>
                      {a.marks && <Badge variant="secondary">{a.marks}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px]"
                        onClick={() => { setPayDialog(a); setPayRef(""); }}>
                        <Wallet className="w-3 h-3" /> Fee
                      </Button>
                      {a.payment_status === "paid" && (
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px] text-amber-700 dark:text-amber-400 border-amber-200 hover:bg-amber-500/5"
                          onClick={() => { setUnlockDialog(a); setUnlockReason(""); }}>
                          <LockOpen className="w-3 h-3" /> Unlock
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px]"
                        onClick={() => { setStatusDialog(a); setStatusValue(a.status === "submitted" || a.status === "fee_pending" ? "under_review" : a.status); setStatusNote(""); }}>
                        <CheckCircle2 className="w-3 h-3" /> Status
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px] text-red-600 border-red-200 hover:bg-red-500/5"
                        onClick={() => setDelApp(a)} aria-label={`Delete ${a.tracking_id}`}>
                        <Trash2 className="w-3 h-3" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-[13px] min-w-[1000px]">
                  <thead className="bg-muted/60 border-b border-border">
                    <tr>
                      {["Tracking ID", "Applicant", "Program", "Category", "Marks", "Reference", "Fee", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-3 py-3 text-center align-middle font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id} className="border-b border-border/60 hover:bg-muted/30">
                        <td className="px-3 py-3 text-center align-middle font-mono font-bold text-primary whitespace-nowrap">{a.tracking_id}</td>
                        <td className="px-3 py-3 text-center align-middle">
                          <p className="font-semibold text-foreground">{a.name ?? "N/A"}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{a.applicant_cnic} {a.applicant_mobile}</p>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">{a.program}</td>
                        <td className="px-3 py-3 text-center align-middle">
                          {QUOTA_LABELS[a.quota] ?? a.quota}
                          <p className="text-[11px] text-muted-foreground">{[a.domicile, a.uc].filter(Boolean).join(", ")}</p>
                        </td>
                        <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
                          {a.marks ?? "N/A"}
                          {a.grade && <Badge variant="secondary" className="ml-1.5">{a.grade}</Badge>}
                        </td>
                        <td className="px-3 py-3 text-center align-middle font-mono text-[11px]">{a.jazzcash_token ?? "N/A"}</td>
                        <td className="px-3 py-3 text-center align-middle">
                          <Badge variant="secondary" className={
                            a.payment_status === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                            : a.payment_status === "rejected" ? "bg-red-500/10 text-red-600" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          }>
                            {a.payment_status === "pending" ? "Pending" : a.payment_status === "paid" ? "Paid" : "Rejected"}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">by {a.fee_deadline}</p>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <Badge variant="outline" className="capitalize whitespace-nowrap">{a.status.replace(/_/g, " ")}</Badge>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px]"
                              onClick={() => { setPayDialog(a); setPayRef(""); }}>
                              <Wallet className="w-3 h-3" /> Fee
                            </Button>
                            {a.payment_status === "paid" && (
                              <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px] text-amber-700 dark:text-amber-400 border-amber-200 hover:bg-amber-500/5"
                                onClick={() => { setUnlockDialog(a); setUnlockReason(""); }} title="Unlock so applicant can edit">
                                <LockOpen className="w-3 h-3" /> Unlock
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11.5px]"
                              onClick={() => { setStatusDialog(a); setStatusValue(a.status === "submitted" || a.status === "fee_pending" ? "under_review" : a.status); setStatusNote(""); }}>
                              <CheckCircle2 className="w-3 h-3" /> Status
                            </Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-500/5"
                              onClick={() => setDelApp(a)} aria-label={`Delete ${a.tracking_id}`} title="Delete application">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <Dialog open={Boolean(delApp)} onOpenChange={(o) => !o && setDelApp(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Delete Application</DialogTitle>
          </DialogHeader>
          {delApp && (
            <div className="space-y-4 text-center">
              <p className="text-[13px] text-muted-foreground">
                Delete <span className="font-mono font-bold text-foreground">{delApp.tracking_id}</span>
                {delApp.name ? <> of <span className="font-semibold text-foreground">{delApp.name}</span></> : null}?
                Its timeline is removed too. This cannot be undone.
              </p>
              <div className="flex gap-2.5">
                <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={() => setDelApp(null)}>Cancel</Button>
                <Button className="h-10 flex-1 font-semibold bg-red-600 hover:bg-red-700 text-white" disabled={deleteApp.isPending}
                  onClick={() => deleteApp.mutate(delApp.id)}>
                  {deleteApp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unlock dialog — admin unlocks a fee-paid application so the applicant
          can edit it again. The action is logged to audit_log. */}
      <Dialog open={Boolean(unlockDialog)} onOpenChange={(o) => !o && setUnlockDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock application: {unlockDialog?.tracking_id}</DialogTitle>
          </DialogHeader>
          {unlockDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3.5 text-[12.5px] text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">This application is currently locked because the fee was paid.</p>
                <p>Unlocking it sets the payment status back to <strong>Pending</strong> and lets the applicant edit their program, group or quota again. The Tracking ID and payment reference are preserved. The action is recorded in the audit log.</p>
              </div>
              <div>
                <Label className="text-[13px] font-semibold">Reason (optional, shown in audit log)</Label>
                <Textarea
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="e.g. Applicant paid the wrong program fee and needs to change it."
                  className="mt-1.5 min-h-[70px]"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button className="flex-1 h-11 font-semibold"
                  disabled={unlockApp.isPending}
                  onClick={() => unlockApp.mutate({ id: unlockDialog.id, reason: unlockReason })}>
                  {unlockApp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockOpen className="w-4 h-4" />}
                  Unlock Application
                </Button>
                <Button variant="outline" className="flex-1 h-11 font-semibold" onClick={() => setUnlockDialog(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fee dialog */}
      <Dialog open={Boolean(payDialog)} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processing Fee: {payDialog?.tracking_id}</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-[13px] space-y-1">
                <p><span className="text-muted-foreground">Applicant:</span> <span className="font-semibold">{payDialog.name}</span></p>
                <p><span className="text-muted-foreground">Payment Reference:</span> <span className="font-mono font-bold">{payDialog.jazzcash_token ?? "not generated"}</span></p>
                <p><span className="text-muted-foreground">Deadline:</span> <span className="font-semibold">{payDialog.fee_deadline}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Payment reference (optional)</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Bank or wallet receipt number" className="h-10" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button className="flex-1 h-10 font-semibold bg-green-600 hover:bg-green-700"
                  disabled={setPayment.isPending}
                  onClick={() => setPayment.mutate({ id: payDialog.id, status: "paid", ref: payRef })}>
                  {setPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Fee Paid (Rs {settings?.processing_fee ?? 100})
                </Button>
                <Button variant="outline" className="flex-1 h-11 font-semibold text-red-600 border-red-200 hover:bg-red-500/5"
                  disabled={setPayment.isPending}
                  onClick={() => setPayment.mutate({ id: payDialog.id, status: "rejected", ref: payRef })}>
                  <XCircle className="w-4 h-4" /> Reject Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status dialog */}
      <Dialog open={Boolean(statusDialog)} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status: {statusDialog?.tracking_id}</DialogTitle>
          </DialogHeader>
          {statusDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {APP_STATUSES.map((s) => (
                  <button key={s.value} type="button" onClick={() => setStatusValue(s.value)}
                    className={`h-10 rounded-xl border-2 text-[13px] font-semibold transition-all ${
                      statusValue === s.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Note (shown in the applicant's timeline)</Label>
                <Textarea rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="e.g. Documents verified at the college office" />
              </div>
              <Button className="w-full h-11 font-semibold" disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: statusDialog.id, status: statusValue, note: statusNote })}>
                {setStatus.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Update Status
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Admission Settings</DialogTitle>
          </DialogHeader>
          <SettingsBody
            key={settings?.updated_at ?? "new"}
            settings={settings ?? null}
            onSave={(v) => saveSettings.mutate(v)}
            saving={saveSettings.isPending}
          />
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}

const PM_TYPES: { value: PaymentMethod["type"]; label: string }[] = [
  { value: "bank", label: "Bank" }, { value: "easypaisa", label: "EasyPaisa" },
  { value: "jazzcash", label: "JazzCash" }, { value: "cash", label: "Cash at School" },
  { value: "other", label: "Other" },
];

function SettingsBody({
  settings, onSave, saving,
}: {
  settings: AdmissionSettings | null;
  onSave: (v: SettingsSavePayload) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(Boolean(settings?.is_open));
  const [year, setYear] = useState(settings?.session_year ?? String(new Date().getFullYear()));
  const [openDate, setOpenDate] = useState(settings?.open_date ?? "");
  const [lastDate, setLastDate] = useState(settings?.last_date ?? "");
  const [fee, setFee] = useState(String(settings?.processing_fee ?? 100));
  const [methods, setMethods] = useState<PaymentMethod[]>(settings?.payment_methods ?? []);
  const [onlinePay, setOnlinePay] = useState(settings?.online_payment_enabled !== false);
  const [importing, setImporting] = useState(false);
  // Rate-limit settings (migration 24) — editable, not hardcoded.
  const [regPerDay, setRegPerDay] = useState(String(settings?.rate_register_per_ip_day ?? 5));
  const [loginMax, setLoginMax] = useState(String(settings?.rate_login_max_attempts ?? 5));
  const [loginCooldown, setLoginCooldown] = useState(String(settings?.rate_login_cooldown_minutes ?? 15));
  const [trackPerIp, setTrackPerIp] = useState(String(settings?.rate_track_per_ip_hour ?? 20));
  const [trackPerId, setTrackPerId] = useState(String(settings?.rate_track_per_id_hour ?? 5));
  const [resetPerDay, setResetPerDay] = useState(String(settings?.rate_reset_per_ip_day ?? 5));
  const [turnstileReq, setTurnstileReq] = useState(settings?.turnstile_required !== false);

  const setPm = (i: number, k: keyof PaymentMethod, v: string) =>
    setMethods((m) => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function importFromFees() {
    setImporting(true);
    try {
      const { data, error } = await supabase.from("fee_structures").select("payment_methods");
      if (error) throw error;
      const seen = new Set(methods.map((m) => JSON.stringify(m)));
      const found: PaymentMethod[] = [];
      (data ?? []).forEach((r: { payment_methods: PaymentMethod[] | null }) =>
        (r.payment_methods ?? []).forEach((m) => {
          const k = JSON.stringify(m);
          if (!seen.has(k)) { seen.add(k); found.push(m); }
        }));
      if (found.length === 0) toast("No payment accounts found in Fee Management.");
      else { setMethods((m) => [...m, ...found]); toast.success(`${found.length} account(s) imported.`); }
    } catch (e) {
      toast.error((e as Error).message || "Could not import.");
    } finally { setImporting(false); }
  }

  function submit() {
    const f = Math.round(Number(fee));
    if (!year.trim()) { toast.error("Please enter the session year."); return; }
    if (!f || f < 0) { toast.error("Please enter a valid processing fee."); return; }
    if (openDate && lastDate && lastDate < openDate) { toast.error("Last date cannot be before the start date."); return; }
    onSave({
      is_open: open, session_year: year.trim(),
      open_date: openDate || null, last_date: lastDate || null,
      processing_fee: f, payment_methods: methods, online_payment_enabled: onlinePay,
      rate_register_per_ip_day: Math.max(1, Number(regPerDay) || 5),
      rate_login_max_attempts: Math.max(1, Number(loginMax) || 5),
      rate_login_cooldown_minutes: Math.max(1, Number(loginCooldown) || 15),
      rate_track_per_ip_hour: Math.max(1, Number(trackPerIp) || 20),
      rate_track_per_id_hour: Math.max(1, Number(trackPerId) || 5),
      rate_reset_per_ip_day: Math.max(1, Number(resetPerDay) || 5),
      turnstile_required: turnstileReq,
    });
  }

  const field = "h-10";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div className="pr-3">
          <p className="font-semibold text-sm text-foreground">Admissions Open</p>
          <p className="text-[12px] text-muted-foreground">When off, the whole public admission is locked.</p>
        </div>
        <Switch checked={open} onCheckedChange={setOpen} />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div className="pr-3">
          <p className="font-semibold text-sm text-foreground">Online Payment (Safepay)</p>
          <p className="text-[12px] text-muted-foreground">Easypaisa / wallet checkout with automatic fee confirmation. Manual transfer always stays available.</p>
        </div>
        <Switch checked={onlinePay} onCheckedChange={setOnlinePay} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Session Year</Label>
          <Input value={year} onChange={(e) => setYear(e.target.value)} className={field} placeholder="2026" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Processing Fee (Rs)</Label>
          <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Start Date</Label>
          <Input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold">Last Date</Label>
          <Input type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} className={field} />
        </div>
      </div>
      <p className="text-[11.5px] text-muted-foreground -mt-1">
        Admission stays open until the last date. The homepage shows the days remaining and closes automatically after it.
      </p>

      {/* Security & rate limits (migration 24) */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="pr-3">
            <p className="font-semibold text-sm text-foreground">Require Turnstile (captcha)</p>
            <p className="text-[12px] text-muted-foreground">Bot protection on register, login, password reset and tracking. If off, the site still works but is unprotected.</p>
          </div>
          <Switch checked={turnstileReq} onCheckedChange={setTurnstileReq} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Registrations / IP / day</Label>
            <Input type="number" min={1} value={regPerDay} onChange={(e) => setRegPerDay(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Login max attempts</Label>
            <Input type="number" min={1} value={loginMax} onChange={(e) => setLoginMax(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Login cooldown (min)</Label>
            <Input type="number" min={1} value={loginCooldown} onChange={(e) => setLoginCooldown(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Track / IP / hour</Label>
            <Input type="number" min={1} value={trackPerIp} onChange={(e) => setTrackPerIp(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Track / ID / hour</Label>
            <Input type="number" min={1} value={trackPerId} onChange={(e) => setTrackPerId(e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold">Resets / IP / day</Label>
            <Input type="number" min={1} value={resetPerDay} onChange={(e) => setResetPerDay(e.target.value)} className={field} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          These limits are enforced server-side by the Vercel auth-gateway and the database — a browser cannot bypass them.
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-semibold">School Payment Accounts</Label>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={importing} onClick={importFromFees}>
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} From Fee Management
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMethods((m) => [...m, { type: "bank" }])}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>
        {methods.length === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">
            No account added. Applicants will be told to pay at the school office.
          </p>
        )}
        {methods.map((m, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <select
                value={m.type}
                onChange={(e) => setPm(i, "type", e.target.value)}
                className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {PM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setMethods((x) => x.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {m.type === "bank" && (
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-9 text-sm" placeholder="Bank name" value={m.bank_name ?? ""} onChange={(e) => setPm(i, "bank_name", e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Account title" value={m.account_title ?? ""} onChange={(e) => setPm(i, "account_title", e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Account number" value={m.account_number ?? ""} onChange={(e) => setPm(i, "account_number", e.target.value)} />
                <Input className="h-9 text-sm" placeholder="IBAN" value={m.iban ?? ""} onChange={(e) => setPm(i, "iban", e.target.value)} />
              </div>
            )}
            {(m.type === "easypaisa" || m.type === "jazzcash") && (
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-9 text-sm" placeholder="Account name" value={m.account_name ?? ""} onChange={(e) => setPm(i, "account_name", e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Mobile number" value={m.phone ?? ""} onChange={(e) => setPm(i, "phone", e.target.value)} />
              </div>
            )}
            {(m.type === "cash" || m.type === "other") && (
              <div className="space-y-2">
                {m.type === "other" && <Input className="h-9 text-sm" placeholder="Method name" value={m.label ?? ""} onChange={(e) => setPm(i, "label", e.target.value)} />}
                <Input className="h-9 text-sm" placeholder="Instructions" value={m.instructions ?? ""} onChange={(e) => setPm(i, "instructions", e.target.value)} />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button className="w-full h-11 font-semibold" disabled={saving} onClick={submit}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Settings
      </Button>
    </div>
  );
}
