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
import { useAdmissionSettings, ADMISSION_SETTINGS_KEY, type AdmissionSettings } from "@/hooks/useAdmission";
import { markAdmissionSettingsBust } from "@/lib/publicData";
import type { PaymentMethod } from "@/hooks/useFees";
import {
  PAYMENT_METHODS, stageLabel, stageTone,
  paymentMethodLabel,
} from "@/lib/admissionStatus";
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
  ClipboardList, Search, Loader2, Wallet, CheckCircle2,
  XCircle, Settings2, Users, GraduationCap, BadgeCheck, Trophy, Landmark, Plus, Trash2, UserPlus, FileSpreadsheet, AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import { exportApplicationsExcel, type ExportRow } from "@/lib/admissionExcel";
import AdminWalkinDialog from "./AdminWalkinDialog";
import AdminMeritLists from "./AdminMeritLists";
import AdminAdmissionPrograms from "./AdminAdmissionPrograms";

interface AdminApp {
  id: string; tracking_id: string; applicant_cnic: string; applicant_mobile: string;
  name: string | null; father_name: string | null; program: string; quota: string;
  quota_criteria: string | null; payment_status: string; status: string;
  payment_method?: string | null; payment_reference?: string | null;
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

// The workflow stages the college can move an application to.
//
// NOTE: "Fee Pending" and "Fee Paid" are NOT here.  They describe the
// processing fee, and the Fee action already records that — the payment
// state lives in `payment_status` and is derived into the public tracker
// from there.  Offering both in the status list gave the college two
// different ways to say the same thing, and they could disagree with each
// other.  See src/lib/admissionStatus.ts and migration 27.
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

/**
 * The Fee badge — reads `payment_status` only.
 * The Stage badge — reads `status` only.
 * Keeping them on separate columns is the point: the same fact must never be
 * shown twice, and the two can no longer contradict each other.
 */
function FeeBadge({ app }: { app: AdminApp }) {
  const paid = app.payment_status === "paid";
  const rejected = app.payment_status === "rejected";
  return (
    <Badge variant="secondary" className={
      paid ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : rejected ? "bg-red-500/10 text-red-600"
      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    }>
      {paid ? "Paid" : rejected ? "Rejected" : "Pending"}
      {app.payment_method && (
        <span className="ml-1 font-normal opacity-80">· {paymentMethodLabel(app.payment_method)}</span>
      )}
    </Badge>
  );
}

function StageBadge({ app }: { app: AdminApp }) {
  return (
    <Badge variant="secondary" className={`whitespace-nowrap ${stageTone(app.status)}`}>
      {stageLabel(app.status)}
    </Badge>
  );
}

export default function AdminAdmissions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>("applications");
  const [search, setSearch] = useState("");
  const [payDialog, setPayDialog] = useState<AdminApp | null>(null);
  const [payRef, setPayRef] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [delApp, setDelApp] = useState<AdminApp | null>(null);
  const [exporting, setExporting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");

  // Instant client-side search (the list is small); matches ID, name, CNIC, mobile and program.
  const onSearch = (v: string) => setSearch(v);

  const { data, isLoading } = useQuery({
    queryKey: ["inter-admin-apps"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_list", {
        p_search: null,
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

  const allApps: AdminApp[] = (data as unknown as AdminApp[]) ?? [];
  const query = search.trim().toLowerCase();
  const qDigits = query.replace(/\D/g, "");
  const apps: AdminApp[] = query
    ? allApps.filter((a) => {
        const text = [a.tracking_id, a.name, a.program, a.jazzcash_token].filter(Boolean).join(" ").toLowerCase();
        if (text.includes(query)) return true;
        if (qDigits.length >= 3) {
          const nums = `${a.applicant_cnic ?? ""} ${a.applicant_mobile ?? ""}`.replace(/\D/g, "");
          return nums.includes(qDigits);
        }
        return false;
      })
    : allApps;

  const { data: settings } = useAdmissionSettings();

  const setPayment = useMutation({
    mutationFn: async ({ id, status, ref, method }: { id: string; status: string; ref: string; method: string }) => {
      // inter_admin_set_payment_full also records HOW the fee was paid.
      // If the database has not been updated to migration 27 yet, fall back to
      // the older three-argument call so the office is never blocked.
      const call = async (withMethod: boolean) => {
        const args = withMethod
          ? { p_application_id: id, p_payment_status: status, p_reference: ref || null, p_payment_method: method || null }
          : { p_application_id: id, p_payment_status: status, p_reference: ref || null };
        return supabase.rpc(withMethod ? "inter_admin_set_payment_full" : "inter_admin_set_payment", args);
      };
      let data: unknown;
      const first = await call(true);
      data = first.data;
      if (first.error) {
        const msg = String(first.error.message ?? "");
        const missing = /could not find the function|PGRST202|not exist/i.test(msg);
        if (!missing) throw first.error;
        const fallback = await call(false);
        if (fallback.error) throw fallback.error;
        data = fallback.data;
        toast("Payment recorded, but the payment method was not saved — apply database migration 27.");
      }
      const d = data as { ok?: boolean; error?: string; unchanged?: boolean };
      if (d?.ok === false) throw new Error(d?.error || "Update failed.");
      return d;
    },
    onSuccess: (d) => {
      if (d?.unchanged) toast("Nothing changed — the payment is already recorded that way.");
      else toast.success("Payment recorded.");
      setPayDialog(null); setPayRef(""); setPayMethod("cash");
      qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
    },
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

  // Delete ALL applicants + applications + merit lists (for the next session).
  // Requires the exact confirmation text; the database re-checks it.
  const resetAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("inter_admin_reset_all", { p_confirm: "DELETE ALL" });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; applications?: number };
      if (d?.ok === false) throw new Error(d?.error || "Delete failed.");
      return d;
    },
    onSuccess: (d) => {
      toast.success(`${d?.applications ?? 0} application(s) deleted. Ready for the next session.`);
      setResetOpen(false); setResetText("");
      qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
      qc.invalidateQueries({ queryKey: ["inter-admin-merit-lists"] });
      qc.invalidateQueries({ queryKey: ["inter-merit-public"] });
    },
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
      // Bust the shared /api/public-data CDN key FIRST so the refetch below
      // (and every visitor’s next refetch) reads the just-saved row instead
      // of a cached copy up to 60 s old.
      markAdmissionSettingsBust();
      toast.success("Admission settings saved.");
      qc.setQueryData(ADMISSION_SETTINGS_KEY, row);
      qc.invalidateQueries({ queryKey: ADMISSION_SETTINGS_KEY });
      setSettingsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const paid = allApps.filter((a) => a.payment_status === "paid").length;
  const pendingFee = allApps.filter((a) => a.payment_status === "pending").length;

  // One action row per application: Fee · Delete. The workflow status is automatic:
  // the one-click merit list marks every paid applicant Merit Listed / Not Merit Listed.
  const btn = "h-8 px-2 text-[11.5px] font-semibold rounded-full";
  const FeeBtn = ({ a }: { a: AdminApp }) => (
    <Button size="sm" variant={a.payment_status === "paid" ? "outline" : "default"} className={btn}
      onClick={() => { setPayDialog(a); setPayRef(a.payment_reference ?? ""); setPayMethod(a.payment_method || "cash"); }}>
      <Wallet className="w-3 h-3" /> Fee
    </Button>
  );
  const DeleteBtn = ({ a }: { a: AdminApp }) => (
    <Button size="sm" variant="outline" className={`${btn} text-red-600 border-red-200 hover:bg-red-500/5`}
      onClick={() => setDelApp(a)} aria-label={`Delete ${a.tracking_id}`}>
      <Trash2 className="w-3 h-3" /> Delete
    </Button>
  );

  return (
    <div className="space-y-5">
      {/* Section tabs */}
      <div className="space-y-2">
        {[
          TABS.filter((t) => t.value !== "merit"),
          TABS.filter((t) => t.value === "merit"),
        ].map((row, i) => (
          <div key={i} className={`flex items-center justify-center gap-2 ${i === 0 ? "" : "pt-0.5"}`}>
            {row.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`h-8 px-3.5 rounded-full text-[12px] font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 border transition-all ${
                  i === 0 ? "flex-1 max-w-[200px]" : "min-w-[140px]"
                } ${
                  tab === t.value
                    ? "bg-primary text-white border-primary shadow-sm shadow-primary/25"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                }`}
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" /> {t.label}
              </button>
            ))}
          </div>
        ))}
        {/* paper-style header rule */}
        <div className="pt-1" aria-hidden="true">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="mt-[3px] h-px w-full bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        </div>
      </div>

      {tab === "merit" && <AdminMeritLists />}
      {tab === "programs" && <AdminAdmissionPrograms />}

      {tab === "applications" && (
      <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {[
          { icon: ClipboardList, label: "Applied", value: allApps.length, color: "text-primary" },
          { icon: Wallet, label: "Pending", value: pendingFee, color: "text-amber-600" },
          { icon: BadgeCheck, label: "Paid", value: paid, color: "text-green-600" },
          { icon: Users, label: "Session", value: settings?.session_year ?? "N/A", color: "text-azure-strong dark:text-azure" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-card px-1 py-2 shadow-sm">
            <p className="font-heading text-[15px] sm:text-xl font-bold leading-none text-foreground">{s.value}</p>
            <p className="mt-1.5 flex items-center gap-1 text-[9px] sm:text-[11px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
              <s.icon className={`w-3 h-3 shrink-0 ${s.color}`} /> {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col items-center gap-2.5">
        <div className="relative w-full max-w-xs mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search ID, name or CNIC"
            className="pl-9 h-9 text-[12.5px] rounded-full"
          />
        </div>
        <div className="flex flex-nowrap items-center justify-center gap-1.5 w-full">
          <Button variant="outline" size="sm" className="h-8 px-3 text-[11.5px] rounded-full whitespace-nowrap gap-1" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-3 h-3" /> Settings
          </Button>
          {allApps.length > 0 && !query && (
            <Button variant="outline" size="sm" className="h-8 px-3 text-[11.5px] rounded-full whitespace-nowrap gap-1 text-red-600 border-red-200 hover:bg-red-500/5"
              onClick={() => { setResetText(""); setResetOpen(true); }}>
              <Trash2 className="w-3 h-3" /> Delete All
            </Button>
          )}
        </div>
        <div className="flex flex-nowrap items-center justify-center gap-1.5 w-full">
          <Button size="sm" className="h-8 px-3 text-[11.5px] rounded-full whitespace-nowrap gap-1 bg-green-700 hover:bg-green-800 text-white" onClick={exportExcel} disabled={exporting}>
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />} Export Excel
          </Button>
          <Button size="sm" className="h-8 px-3 text-[11.5px] rounded-full whitespace-nowrap gap-1" onClick={() => setWalkinOpen(true)}>
            <UserPlus className="w-3 h-3" /> Add Walk-in / Import
          </Button>
        </div>
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
                {query ? "No applications match your search." : "No applications yet, they will appear here as students apply."}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden">
                {apps.map((a) => (
                  <div key={a.id} className="p-3">
                    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card to-muted/30 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.25)]">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-700 via-emerald-500 to-amber-400" />
                      <div className="flex flex-col items-center gap-1.5 px-4 pt-5 pb-4 text-center">
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[11.5px] font-bold tracking-wider text-primary">{a.tracking_id}</span>
                        <p className="mt-1 font-heading text-[16px] font-bold leading-tight text-foreground">{a.name ?? "N/A"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{a.applicant_cnic} · {a.applicant_mobile}</p>
                        <p className="text-[12px] font-medium text-muted-foreground">
                          {a.program} <span className="mx-1 opacity-50">•</span> {QUOTA_LABELS[a.quota] ?? a.quota}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                          <FeeBadge app={a} />
                          <StageBadge app={a} />
                          {a.marks && <Badge variant="secondary" className="font-semibold">{a.marks}</Badge>}
                        </div>
                        <div className="mx-auto mt-2.5 grid w-full max-w-[280px] grid-cols-2 gap-2 border-t border-border/60 pt-3">
                          <FeeBtn a={a} />
                          <DeleteBtn a={a} />
                        </div>
                      </div>
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
                          <FeeBadge app={a} />
                          <p className="text-[10px] text-muted-foreground mt-0.5">by {a.fee_deadline}</p>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <StageBadge app={a} />
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <FeeBtn a={a} />
                              <DeleteBtn a={a} />
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

      <AdminWalkinDialog open={walkinOpen} onOpenChange={setWalkinOpen} />

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

      {/* Delete ALL — clears the whole session for next year */}
      <Dialog open={resetOpen} onOpenChange={(o) => { if (!o) { setResetOpen(false); setResetText(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Delete All Applications
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 text-center">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              This permanently deletes <strong className="text-foreground">{allApps.length} application(s)</strong>, all applicant
              profiles and every merit list. Programs, seats and settings are kept.
            </p>
            <Button variant="outline" className="h-9 w-full text-[12.5px] font-semibold" onClick={exportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              Download Excel backup first
            </Button>
            <div className="space-y-1.5 text-left">
              <Label className="text-[12px] font-semibold">Type <span className="font-mono text-red-600">DELETE ALL</span> to confirm</Label>
              <Input value={resetText} onChange={(e) => setResetText(e.target.value)} className="h-10 text-center font-mono" autoComplete="off" />
            </div>
            <div className="flex gap-2.5">
              <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button className="h-10 flex-1 font-semibold bg-red-600 hover:bg-red-700 text-white"
                disabled={resetText !== "DELETE ALL" || resetAll.isPending} onClick={() => resetAll.mutate()}>
                {resetAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fee dialog — the processing fee and how it was paid.
          This is the ONLY place the fee is recorded;
          Review and merit are automatic (Merit Lists tab). */}
      <Dialog open={Boolean(payDialog)} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-green-700/10 to-transparent px-5 py-4">
            <DialogTitle className="flex items-center justify-center gap-2 text-[15px]">
              <Wallet className="w-4 h-4 text-primary" /> Processing Fee
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 px-5 py-4 max-h-[75vh] overflow-y-auto">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/30">
                <div className="flex flex-col items-center gap-1 px-4 py-3 text-center">
                  <span className="rounded-full bg-primary/10 px-3 py-0.5 font-mono text-[11px] font-bold tracking-wider text-primary">{payDialog.tracking_id}</span>
                  <p className="font-heading text-[15px] font-bold text-foreground">{payDialog.name ?? "N/A"}</p>
                </div>
                <div className="divide-y divide-border/60 border-t border-border/60 text-[12.5px]">
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono font-bold">{payDialog.jazzcash_token ?? "not generated"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className="font-semibold">{payDialog.fee_deadline}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-muted-foreground">Fee status</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                      payDialog.payment_status === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                      : payDialog.payment_status === "rejected" ? "bg-red-500/10 text-red-600"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                      {payDialog.payment_status === "paid" ? "Paid"
                        : payDialog.payment_status === "rejected" ? "Rejected" : "Pending"}
                      {payDialog.payment_method && ` · ${paymentMethodLabel(payDialog.payment_method)}`}
                    </span>
                  </div>
                </div>
              </div>

              {payDialog.payment_status === "paid" ? (
                <p className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 px-3 py-3 text-center text-[12.5px] font-semibold text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Fee received. This application is final.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold">Paid by</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYMENT_METHODS.map((m) => (
                        <button key={m.value} type="button" onClick={() => setPayMethod(m.value)}
                          className={`h-9 rounded-full border text-[12px] font-semibold transition-all ${
                            payMethod === m.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                          }`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold">Receipt / transaction no. (optional)</Label>
                    <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Bank or wallet receipt number" className="h-9 text-[13px] rounded-xl" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button className="h-10 rounded-full font-semibold bg-green-600 hover:bg-green-700"
                      disabled={setPayment.isPending}
                      onClick={() => setPayment.mutate({ id: payDialog.id, status: "paid", ref: payRef, method: payMethod })}>
                      {setPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark Fee Paid (Rs {settings?.processing_fee ?? 100})
                    </Button>
                    {payDialog.payment_status !== "rejected" && (
                      <Button variant="outline" className="h-10 rounded-full font-semibold text-red-600 border-red-200 hover:bg-red-500/5"
                        disabled={setPayment.isPending}
                        onClick={() => setPayment.mutate({ id: payDialog.id, status: "rejected", ref: payRef, method: payMethod })}>
                        <XCircle className="w-4 h-4" /> Reject Payment
                      </Button>
                    )}
                    {payDialog.payment_status === "rejected" && (
                      <Button variant="ghost" className="h-9 text-[12px] font-semibold text-muted-foreground"
                        disabled={setPayment.isPending}
                        onClick={() => setPayment.mutate({ id: payDialog.id, status: "pending", ref: payRef, method: payMethod })}>
                        Reset to Fee Pending
                      </Button>
                    )}
                  </div>
                </>
              )}

              <p className="text-center text-[11px] leading-snug text-muted-foreground">
                Fee is recorded here only. Review and merit are automatic: use the Merit Lists tab.
              </p>
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

      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-semibold">School Payment Accounts</Label>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setMethods((m) => [...m, { type: "bank" }])}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
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

      <Button className="w-full h-11 font-semibold" disabled={saving} onClick={submit}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Settings
      </Button>
    </div>
  );
}
