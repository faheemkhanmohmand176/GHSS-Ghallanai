/**
 * AdminAdmissions — admin console for the HED-mirror Inter admission system
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
import { useAdmissionSettings } from "@/hooks/useAdmission";
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
  XCircle, Settings2, Users, GraduationCap, BadgeCheck, Trophy, Landmark,
} from "lucide-react";
import toast from "react-hot-toast";
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

  const saveSettings = useMutation({
    mutationFn: async ({ is_open, session_year }: { is_open: boolean; session_year: string }) => {
      const { error } = await supabase
        .from("admission_settings")
        .update({ is_open, session_year, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Admission settings saved."); qc.invalidateQueries({ queryKey: ["admission-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

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
          { icon: Users, label: "Session", value: settings?.session_year ?? "2026", color: "text-azure-strong dark:text-azure" },
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
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by Tracking ID, name or CNIC…"
            className="pl-9 h-10"
          />
        </div>
        <Button variant="outline" size="sm" className="h-10" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button variant="outline" size="sm" className="h-10" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-4 h-4" /> Settings
        </Button>
        <Badge variant="secondary" className={settings?.is_open ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-600"}>
          {settings?.is_open ? "Admissions Open" : "Admissions Closed"}
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
                {debounced ? "No applications match your search." : "No applications yet — they will appear here as students apply."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1050px]">
                <thead className="bg-muted/60 border-b border-border">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-semibold">Tracking ID</th>
                    <th className="px-4 py-3 font-semibold">Applicant</th>
                    <th className="px-4 py-3 font-semibold">Program</th>
                    <th className="px-4 py-3 font-semibold">Quota</th>
                    <th className="px-4 py-3 font-semibold">Marks</th>
                    <th className="px-4 py-3 font-semibold">Token</th>
                    <th className="px-4 py-3 font-semibold">Fee</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono font-bold text-primary whitespace-nowrap">{a.tracking_id}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{a.name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{a.applicant_cnic} · {a.applicant_mobile}</p>
                      </td>
                      <td className="px-4 py-3">{a.program}</td>
                      <td className="px-4 py-3">
                        {QUOTA_LABELS[a.quota] ?? a.quota}
                        <p className="text-[11px] text-muted-foreground">{a.domicile ?? ""} {a.uc ? `· ${a.uc}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {a.marks ?? "—"}
                        {a.grade && <Badge variant="secondary" className="ml-1.5">{a.grade}</Badge>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">{a.jazzcash_token ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={
                          a.payment_status === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400"
                          : a.payment_status === "rejected" ? "bg-red-500/10 text-red-600" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }>
                          {a.payment_status === "pending" ? "Pending" : a.payment_status === "paid" ? "Paid" : "Rejected"}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">by {a.fee_deadline}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize">{a.status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="outline" className="h-8 text-xs"
                          onClick={() => { setPayDialog(a); setPayRef(""); }}>
                          <Wallet className="w-3.5 h-3.5" /> Fee
                        </Button>{" "}
                        <Button size="sm" variant="outline" className="h-8 text-xs"
                          onClick={() => { setStatusDialog(a); setStatusValue(a.status === "submitted" || a.status === "fee_pending" ? "under_review" : a.status); setStatusNote(""); }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Status
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee dialog */}
      <Dialog open={Boolean(payDialog)} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processing Fee — {payDialog?.tracking_id}</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-[13px] space-y-1">
                <p><span className="text-muted-foreground">Applicant:</span> <span className="font-semibold">{payDialog.name}</span></p>
                <p><span className="text-muted-foreground">JazzCash Token:</span> <span className="font-mono font-bold">{payDialog.jazzcash_token ?? "not generated"}</span></p>
                <p><span className="text-muted-foreground">Deadline:</span> <span className="font-semibold">{payDialog.fee_deadline}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Payment reference (optional)</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="JazzCash transaction / receipt no." className="h-10" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Button className="flex-1 h-11 font-semibold bg-green-600 hover:bg-green-700"
                  disabled={setPayment.isPending}
                  onClick={() => setPayment.mutate({ id: payDialog.id, status: "paid", ref: payRef })}>
                  {setPayment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Fee Paid (Rs 100)
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
            <DialogTitle>Update Status — {statusDialog?.tracking_id}</DialogTitle>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admission Settings</DialogTitle>
          </DialogHeader>
          <SettingsBody
            isOpen={Boolean(settings?.is_open)}
            sessionYear={settings?.session_year ?? "2026"}
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

function SettingsBody({
  isOpen, sessionYear, onSave, saving,
}: {
  isOpen: boolean; sessionYear: string;
  onSave: (v: { is_open: boolean; session_year: string }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(isOpen);
  const [year, setYear] = useState(sessionYear);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <p className="font-semibold text-sm text-foreground">Admissions Open</p>
          <p className="text-[12px] text-muted-foreground">Controls the “Admissions Open” pill on the homepage ticker.</p>
        </div>
        <Switch checked={open} onCheckedChange={setOpen} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[13px] font-semibold">Session Year</Label>
        <Input value={year} onChange={(e) => setYear(e.target.value)} className="h-10" placeholder="2026" />
      </div>
      <Button className="w-full h-11 font-semibold" disabled={saving} onClick={() => onSave({ is_open: open, session_year: year })}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Settings
      </Button>
    </div>
  );
}
