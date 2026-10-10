"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet, Plus, Search, Printer, Receipt, FileSpreadsheet, AlertTriangle, RefreshCw,
} from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Tabs, DataTable } from "@/components/ui/console";
import { toast } from "@/hooks/use-toast";
import { supabaseBrowser } from "@/lib/auth";
import { callRpc } from "@/lib/admin-data";
import {
  CLASS_LABELS, FEE_TYPES, FEE_FREQUENCIES, MONTHS, VOUCHER_STATUSES,
  VOUCHER_STATUS_META, fmtMoney, newVoucherNumber, downloadCsv,
} from "@/lib/constants";
import {
  DEMO_FEE_STRUCTURES, DEMO_VOUCHERS, type FeeStructureRow, type VoucherRow,
} from "@/content/demo-content";

/**
 * Fee Management — Babi Khel pattern with five sub-tabs:
 * Dashboard · Structures · Vouchers · Payments · Reports.
 * Payments post through the record_fee_payment RPC (atomic voucher update).
 */

interface PaymentRow {
  id: string;
  voucher_id: string;
  amount: number;
  payment_method: string;
  receipt_number: string | null;
  payment_date: string;
  received_by: string | null;
  notes: string | null;
}

export default function AdminFeesPage() {
  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Fee Management"
        desc="Structures define what a class owes; vouchers bill a student; payments record the money — with defaulters, collection rates and printable challans."
      />
      <Tabs
        tabs={[
          { id: "dashboard", label: "Dashboard", icon: <Wallet className="h-4 w-4" aria-hidden /> },
          { id: "structures", label: "Structures", icon: <Plus className="h-4 w-4" aria-hidden /> },
          { id: "vouchers", label: "Vouchers", icon: <Receipt className="h-4 w-4" aria-hidden /> },
          { id: "payments", label: "Payments", icon: <FileSpreadsheet className="h-4 w-4" aria-hidden /> },
          { id: "reports", label: "Reports", icon: <FileSpreadsheet className="h-4 w-4" aria-hidden /> },
        ]}
      >
        {(active) =>
          active === "dashboard" ? <FeesDashboard /> :
          active === "structures" ? <StructuresTab /> :
          active === "vouchers" ? <VouchersTab /> :
          active === "payments" ? <PaymentsTab /> :
          <ReportsTab />
        }
      </Tabs>
    </AdminChrome>
  );
}

/* ------------------------------- Dashboard ------------------------------- */

function FeesDashboard() {
  const [vouchers, setVouchers] = useState<VoucherRow[]>(DEMO_VOUCHERS);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    const [v, p] = await Promise.all([
      sb.from("fee_vouchers").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("fee_payments").select("*").order("payment_date", { ascending: false }).limit(500),
    ]);
    if (v.data) setVouchers(v.data as VoucherRow[]);
    if (p.data) setPayments(p.data as PaymentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const totals = useMemo(() => {
    const billed = vouchers.reduce((a, v) => a + Number(v.total_amount) + Number(v.late_fee), 0);
    const collected = vouchers.reduce((a, v) => a + Number(v.paid_amount), 0);
    const outstanding = billed - collected;
    const waived = vouchers.filter((v) => v.status === "waived").length;
    const overdue = vouchers.filter((v) => v.status === "overdue");
    return {
      billed, collected, outstanding, waived,
      overdueCount: overdue.length,
      overdueSum: overdue.reduce((a, v) => a + Number(v.total_amount) + Number(v.late_fee) - Number(v.paid_amount), 0),
      rate: billed > 0 ? Math.round((collected / billed) * 100) : 0,
      count: vouchers.length,
      paid: vouchers.filter((v) => v.status === "paid").length,
      unpaid: vouchers.filter((v) => v.status === "unpaid").length,
      partial: vouchers.filter((v) => v.status === "partial").length,
    };
  }, [vouchers]);

  const defaulters = useMemo(() => {
    const byStudent = new Map<string, VoucherRow[]>();
    for (const v of vouchers) {
      if (v.status === "paid" || v.status === "waived") continue;
      byStudent.set(v.student_name, [...(byStudent.get(v.student_name) ?? []), v]);
    }
    return [...byStudent.entries()]
      .map(([name, vs]) => ({
        name,
        class: vs[0].class_label,
        due: vs.reduce((a, v) => a + Number(v.total_amount) + Number(v.late_fee) - Number(v.paid_amount), 0),
        count: vs.length,
      }))
      .sort((a, b) => b.due - a.due)
      .slice(0, 10);
  }, [vouchers]);

  if (loading) return <p className="py-8 text-center text-small text-muted-foreground">Loading fee dashboard…</p>;

  return (
    <div className="space-y-5">
      {/* Collection hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary-strong p-6 text-white shadow-lg dark:bg-[#0a1810]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#E8F5EC]/70">Total collection</p>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums">{fmtMoney(totals.collected)}</p>
            <p className="mt-1 text-xs text-[#E8F5EC]/70">of {fmtMoney(totals.billed)} billed</p>
          </div>
          <div className="min-w-56">
            <div className="h-3 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gold" style={{ width: `${totals.rate}%` }} />
            </div>
            <p className="mt-1.5 text-right text-xs font-bold text-gold">{totals.rate}% collection rate</p>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Outstanding", value: fmtMoney(totals.outstanding) },
          { label: "Overdue vouchers", value: `${totals.overdueCount} (${fmtMoney(totals.overdueSum)})` },
          { label: "Vouchers", value: `${totals.count} · ${totals.paid} paid · ${totals.partial} partial · ${totals.unpaid} unpaid` },
          { label: "Payments recorded", value: String(payments.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-small font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Defaulters */}
      <Card>
        <CardContent>
          <p className="mb-3 flex items-center gap-2 text-small font-bold">
            <AlertTriangle className="h-4 w-4 text-gold-strong dark:text-gold" aria-hidden /> Top defaulters
          </p>
          {defaulters.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No outstanding fees — fully collected.</p>
          ) : (
            <DataTable head={["Student", "Class", "Vouchers", "Outstanding"]}>
              {defaulters.map((d) => (
                <tr key={d.name}>
                  <td className="py-2.5 pr-4 text-small font-semibold">{d.name}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{d.class}</td>
                  <td className="py-2.5 pr-4 text-small tabular-nums">{d.count}</td>
                  <td className="py-2.5 text-right text-small font-bold text-destructive tabular-nums">{fmtMoney(d.due)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Structures ------------------------------ */

function StructuresTab() {
  const [rows, setRows] = useState<FeeStructureRow[]>(DEMO_FEE_STRUCTURES);
  const [classFilter, setClassFilter] = useState<string>(CLASS_LABELS[0]);
  const [editing, setEditing] = useState<Partial<FeeStructureRow> | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const { data } = await sb.from("fee_structures").select("*").order("class_label").order("fee_type");
    if (data) setRows(data as FeeStructureRow[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = rows.filter((r) => r.class_label === classFilter);

  async function save(row: Partial<FeeStructureRow>) {
    if (!row.label?.trim() || !row.fee_type) {
      toast({ title: "Label and fee type are required.", variant: "destructive" });
      return;
    }
    const payload = { ...row, amount: Number(row.amount ?? 0), class_label: row.class_label ?? classFilter } as FeeStructureRow;
    const sb = supabaseBrowser();
    if (sb) {
      const { error } = await sb.from("fee_structures").upsert({ ...payload, id: payload.id ?? undefined, updated_at: new Date().toISOString() });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setRows((rs) => [payload, ...rs.filter((r) => r.id !== payload.id)]);
    }
    setEditing(null);
    toast({ title: "Fee structure saved", description: `${payload.label} — ${fmtMoney(payload.amount)} (${payload.frequency})` });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="h-11 w-64" aria-label="Class"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CLASS_LABELS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing({ class_label: classFilter, fee_type: "tuition", label: "", amount: 0, frequency: "monthly", is_optional: false, is_recurring: true, is_active: true })} className="button-press h-11 rounded-full font-bold">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add fee
        </Button>
      </div>

      <Card>
        <CardContent>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-small text-muted-foreground">No fee structure for this class yet — add one.</p>
          ) : (
            <DataTable head={["Fee", "Type", "Amount", "Cycle", "Status", ""]}>
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <td className="py-3 pr-4 text-small font-bold">{r.label}</td>
                  <td className="py-3 pr-4 text-xs capitalize text-muted-foreground">{r.fee_type}</td>
                  <td className="py-3 pr-4 text-small font-bold tabular-nums">{fmtMoney(r.amount)}</td>
                  <td className="py-3 pr-4 text-xs capitalize text-muted-foreground">{r.frequency.replace("_", " ")}{r.is_optional ? " · optional" : ""}</td>
                  <td className="py-3 pr-4">
                    {r.is_active ? (
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)} className="button-press h-9 rounded-full">Edit</Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit fee" : "Add fee"} desc="Vouchers for the class pull these items automatically.">
        {editing && (
          <StructureForm form={editing} setForm={setEditing} onSave={() => save(editing)} />
        )}
      </Dialog>
    </div>
  );
}

function StructureForm({
  form, setForm, onSave,
}: {
  form: Partial<FeeStructureRow>;
  setForm: (f: Partial<FeeStructureRow>) => void;
  onSave: () => void;
}) {
  const set = (k: keyof FeeStructureRow, v: unknown) => setForm({ ...form, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Class</Label>
          <Select value={form.class_label ?? CLASS_LABELS[0]} onValueChange={(v) => set("class_label", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLASS_LABELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Fee type</Label>
          <Select value={form.fee_type ?? "tuition"} onValueChange={(v) => set("fee_type", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Label</Label>
          <Input className="h-11" value={form.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="Monthly tuition" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Amount (Rs)</Label>
          <Input type="number" className="h-11" value={form.amount ?? 0} onChange={(e) => set("amount", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Frequency</Label>
          <Select value={form.frequency ?? "monthly"} onValueChange={(v) => set("frequency", v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FEE_FREQUENCIES.map((f) => (
                <SelectItem key={f} value={f}>{f.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-small font-semibold">Status</Label>
          <Select value={form.is_active ? "active" : "inactive"} onValueChange={(v) => set("is_active", v === "active")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave} className="button-press h-10 rounded-full font-bold">Save structure</Button>
      </div>
    </div>
  );
}

/* ------------------------------- Vouchers ------------------------------- */

function VouchersTab() {
  const [vouchers, setVouchers] = useState<VoucherRow[]>(DEMO_VOUCHERS);
  const [structures, setStructures] = useState<FeeStructureRow[]>(DEMO_FEE_STRUCTURES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<VoucherRow | null>(null);
  const [viewing, setViewing] = useState<VoucherRow | null>(null);
  const [deleting, setDeleting] = useState<VoucherRow | null>(null);
  const [form, setForm] = useState({
    student_name: "", roll_no: "", class_label: CLASS_LABELS[0] as string,
    month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    due_date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    late_fee: 0, notes: "", selected: {} as Record<string, boolean>,
  });
  const [payForm, setPayForm] = useState({ amount: 0, method: "cash", receipt: "", notes: "" });

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const [v, s] = await Promise.all([
      sb.from("fee_vouchers").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("fee_structures").select("*").eq("is_active", true),
    ]);
    if (v.data) setVouchers(v.data as VoucherRow[]);
    if (s.data) setStructures(s.data as FeeStructureRow[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = vouchers.filter(
    (v) =>
      (statusFilter === "all" || v.status === statusFilter) &&
      (!search ||
        v.student_name.toLowerCase().includes(search.toLowerCase()) ||
        v.voucher_number.toLowerCase().includes(search.toLowerCase()) ||
        (v.roll_no ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  const classStructures = structures.filter((s) => s.class_label === form.class_label);
  const selectedItems = classStructures.filter((s) => form.selected[s.id] !== false);
  const newTotal = selectedItems.reduce((a, s) => a + Number(s.amount), 0);

  async function createVoucher() {
    if (!form.student_name.trim() || selectedItems.length === 0) {
      toast({ title: "Student name and at least one fee item are required.", variant: "destructive" });
      return;
    }
    const payload: VoucherRow = {
      id: `demo-${Date.now()}`,
      voucher_number: newVoucherNumber(),
      student_name: form.student_name.trim(),
      roll_no: form.roll_no.trim() || null,
      class_label: form.class_label,
      month: form.month,
      year: form.year,
      fee_period: "monthly",
      fee_items: selectedItems.map((s) => ({ label: s.label, fee_type: s.fee_type, amount: Number(s.amount) })),
      total_amount: newTotal,
      paid_amount: 0,
      late_fee: Number(form.late_fee),
      due_date: form.due_date,
      status: "unpaid",
      bank_details: {},
      notes: form.notes || null,
    };
    const sb = supabaseBrowser();
    if (sb) {
      const { id, bank_details, ...rest } = payload;
      void id; void bank_details;
      const { error } = await sb.from("fee_vouchers").insert({ ...rest, voucher_number: payload.voucher_number });
      if (error) {
        toast({ title: "Voucher failed", description: error.message, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setVouchers((vs) => [payload, ...vs]);
    }
    setCreating(false);
    toast({ title: "Voucher created", description: `${payload.voucher_number} — ${fmtMoney(payload.total_amount)} for ${payload.student_name}` });
  }

  async function recordPayment() {
    if (!paying || payForm.amount <= 0) return;
    const sb = supabaseBrowser();
    if (sb) {
      const res = await callRpc("record_fee_payment", {
        p_voucher_id: paying.id,
        p_amount: Number(payForm.amount),
        p_method: payForm.method,
        p_receipt: payForm.receipt || null,
        p_notes: payForm.notes || null,
      });
      if (!res.ok) {
        toast({ title: "Payment failed", description: res.error, variant: "destructive" });
        return;
      }
      await load();
    } else {
      setVouchers((vs) =>
        vs.map((v) =>
          v.id === paying.id
            ? {
                ...v,
                paid_amount: v.paid_amount + Number(payForm.amount),
                status: v.paid_amount + Number(payForm.amount) >= v.total_amount + v.late_fee ? "paid" : "partial",
              }
            : v
        )
      );
    }
    toast({ title: "Payment recorded", description: `${fmtMoney(payForm.amount)} against ${paying.voucher_number}` });
    setPaying(null);
  }

  async function removeVoucher(v: VoucherRow) {
    const sb = supabaseBrowser();
    if (sb) await sb.from("fee_vouchers").delete().eq("id", v.id);
    setVouchers((vs) => vs.filter((x) => x.id !== v.id));
    toast({ title: "Voucher deleted", description: `${v.voucher_number} (audit-logged)` });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, roll or voucher no…" className="h-11 pl-10" aria-label="Search vouchers" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-40" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VOUCHER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{VOUCHER_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreating(true)} className="button-press h-11 rounded-full font-bold">
          <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Create voucher
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <p className="py-8 text-center text-small text-muted-foreground md:col-span-2 xl:col-span-3">No vouchers match — create one.</p>
        )}
        {visible.slice(0, 60).map((v) => {
          const meta = VOUCHER_STATUS_META[v.status] ?? VOUCHER_STATUS_META.unpaid;
          const progress = v.total_amount > 0 ? Math.min(100, Math.round((Number(v.paid_amount) / (Number(v.total_amount) + Number(v.late_fee))) * 100)) : 0;
          return (
            <Card key={v.id} className="card-lift">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-small font-bold">{v.student_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.voucher_number} · {MONTHS[v.month - 1]} {v.year}
                    </p>
                  </div>
                  <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{v.class_label}{v.roll_no ? ` · Roll ${v.roll_no}` : ""}</p>
                <div className="mt-2.5 flex items-baseline justify-between">
                  <p className="font-display text-lg font-bold tabular-nums">{fmtMoney(Number(v.total_amount) + Number(v.late_fee))}</p>
                  {v.paid_amount > 0 && (
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {fmtMoney(v.paid_amount)} paid
                    </p>
                  )}
                </div>
                {v.status === "partial" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Due {new Date(v.due_date).toLocaleDateString("en-PK")}
                  {v.late_fee > 0 ? ` · late fee ${fmtMoney(v.late_fee)}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                  <Button variant="outline" size="sm" onClick={() => setViewing(v)} className="button-press h-9 rounded-full">View</Button>
                  {(v.status === "unpaid" || v.status === "partial" || v.status === "overdue") && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPaying(v);
                        setPayForm({
                          amount: Number(v.total_amount) + Number(v.late_fee) - Number(v.paid_amount),
                          method: "cash", receipt: "", notes: "",
                        });
                      }}
                      className="button-press h-9 rounded-full"
                    >
                      Record payment
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleting(v)}
                    aria-label={`Delete ${v.voucher_number}`}
                    className="button-press ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create voucher dialog */}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Create voucher" desc="Fee items auto-load from the class structure." wide>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Student name *</Label>
              <Input className="h-11" value={form.student_name} onChange={(e) => setForm((f) => ({ ...f, student_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Roll no</Label>
              <Input className="h-11" value={form.roll_no} onChange={(e) => setForm((f) => ({ ...f, roll_no: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Class</Label>
              <Select value={form.class_label} onValueChange={(v) => setForm((f) => ({ ...f, class_label: v, selected: {} }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASS_LABELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Month / Year</Label>
              <div className="flex gap-2">
                <Select value={String(form.month)} onValueChange={(v) => setForm((f) => ({ ...f, month: Number(v) }))}>
                  <SelectTrigger className="h-11 w-full" aria-label="Month"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" className="h-11 w-28" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} aria-label="Year" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Due date</Label>
              <Input type="date" className="h-11" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small font-semibold">Late fee (Rs)</Label>
              <Input type="number" className="h-11" value={form.late_fee} onChange={(e) => setForm((f) => ({ ...f, late_fee: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <Label className="text-small font-semibold">Fee items (from the class structure)</Label>
            <ul className="mt-2 space-y-1.5">
              {classStructures.length === 0 && (
                <li className="text-xs text-muted-foreground">No active structure for this class — define one in the Structures tab first.</li>
              )}
              {classStructures.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5">
                    <span className="flex items-center gap-3">
                      <Switch
                        checked={form.selected[s.id] !== false}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, selected: { ...f.selected, [s.id]: v } }))}
                        aria-label={`Include ${s.label}`}
                      />
                      <span className="text-small font-semibold">{s.label}</span>
                    </span>
                    <span className="text-small font-bold tabular-nums">{fmtMoney(s.amount)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary px-3.5 py-2.5">
              <span className="text-small font-bold">Total</span>
              <span className="font-display text-lg font-bold tabular-nums">{fmtMoney(newTotal)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={createVoucher} className="button-press h-11 rounded-full font-bold">
              <Receipt className="mr-1.5 h-4 w-4" aria-hidden /> Create voucher ({fmtMoney(newTotal)})
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={paying !== null} onClose={() => setPaying(null)} title={`Record payment — ${paying?.voucher_number ?? ""}`} desc={paying ? `${paying.student_name} · outstanding ${fmtMoney(Number(paying.total_amount) + Number(paying.late_fee) - Number(paying.paid_amount))}` : ""}>
        {paying && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Amount (Rs)</Label>
                <Input type="number" className="h-11" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "bank", "online", "cheque", "jazzcash", "easypaisa"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Receipt number</Label>
                <Input className="h-11" value={payForm.receipt} onChange={(e) => setPayForm((f) => ({ ...f, receipt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small font-semibold">Notes</Label>
                <Input className="h-11" value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Posts through an atomic RPC: the payment row and the voucher&apos;s paid_amount / status
              update together or not at all.
            </p>
            <div className="flex justify-end">
              <Button onClick={recordPayment} className="button-press h-11 rounded-full font-bold">Record payment</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* View voucher dialog */}
      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.voucher_number ?? ""} desc={viewing ? `${viewing.student_name} · ${viewing.class_label}` : ""} wide
        footer={viewing && (
          <Button variant="outline" onClick={() => window.print()} className="button-press h-10 rounded-full">
            <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print challan
          </Button>
        )}
      >
        {viewing && (
          <div>
            <ul className="divide-y divide-border/60">
              {(viewing.fee_items ?? []).map((item, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-small">
                  <span>{item.label}</span>
                  <span className="font-bold tabular-nums">{fmtMoney(item.amount)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-2.5 text-small">
                <span>Late fee</span>
                <span className="font-bold tabular-nums">{fmtMoney(viewing.late_fee)}</span>
              </li>
            </ul>
            <div className="mt-3 space-y-1.5 rounded-xl bg-secondary p-4 text-small">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold tabular-nums">{fmtMoney(Number(viewing.total_amount) + Number(viewing.late_fee))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{fmtMoney(viewing.paid_amount)}</span></div>
              <div className="flex justify-between border-t border-border pt-1.5">
                <span className="text-muted-foreground">Outstanding</span>
                <span className="font-bold tabular-nums text-destructive">{fmtMoney(Number(viewing.total_amount) + Number(viewing.late_fee) - Number(viewing.paid_amount))}</span>
              </div>
            </div>
            {viewing.notes && <p className="mt-3 text-xs text-muted-foreground">Note: {viewing.notes}</p>}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeVoucher(deleting)}
        title="Delete this voucher?"
        desc={`${deleting?.voucher_number ?? ""} — ${deleting?.student_name ?? ""}. Its payment history is removed with it.`}
        confirmLabel="Delete voucher"
      />
    </div>
  );
}

/* ------------------------------- Payments -------------------------------- */

function PaymentsTab() {
  const [payments, setPayments] = useState<(PaymentRow & { voucher?: VoucherRow })[]>([]);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setPayments([
        { id: "p1", voucher_id: DEMO_VOUCHERS[0].id, amount: 350, payment_method: "cash", receipt_number: "R-001", payment_date: new Date().toISOString().slice(0, 10), received_by: "Demo Admin", notes: null, voucher: DEMO_VOUCHERS[0] },
        { id: "p2", voucher_id: DEMO_VOUCHERS[1].id, amount: 150, payment_method: "online", receipt_number: "R-002", payment_date: new Date().toISOString().slice(0, 10), received_by: "Demo Admin", notes: "Partial", voucher: DEMO_VOUCHERS[1] },
      ]);
      return;
    }
    const { data } = await sb
      .from("fee_payments")
      .select("*, voucher:fee_vouchers(*)")
      .eq("month", Number(month))
      .order("payment_date", { ascending: false })
      .limit(300);
    if (data) setPayments(data as (PaymentRow & { voucher?: VoucherRow })[]);
  }, [month]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const visible = payments.filter(
    (p) => !search || (p.voucher?.student_name ?? "").toLowerCase().includes(search.toLowerCase()) || (p.receipt_number ?? "").includes(search)
  );
  const sum = visible.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or receipt…" className="h-11 pl-10" aria-label="Search payments" />
        </div>
        <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-11 w-24" aria-label="Year" />
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="h-11 w-40" aria-label="Month"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-11 rounded-full border-primary/40 px-4 text-sm font-bold text-primary">
          Total: {fmtMoney(sum)}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visible.length === 0 && <p className="py-8 text-center text-small text-muted-foreground md:col-span-2">No payments recorded for this month.</p>}
        {visible.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Receipt className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-bold">{p.voucher?.student_name ?? "Student"}</p>
                <p className="text-xs text-muted-foreground">
                  {p.voucher?.voucher_number ?? p.voucher_id} · {p.payment_method} · {new Date(p.payment_date).toLocaleDateString("en-PK")}
                </p>
                {p.receipt_number && <p className="text-xs text-muted-foreground">Receipt {p.receipt_number}</p>}
              </div>
              <p className="shrink-0 font-display text-lg font-bold tabular-nums">{fmtMoney(p.amount)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Reports -------------------------------- */

function ReportsTab() {
  const [vouchers, setVouchers] = useState<VoucherRow[]>(DEMO_VOUCHERS);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.from("fee_vouchers").select("*").limit(500).then(({ data }) => {
      if (data) setVouchers(data as VoucherRow[]);
    });
  }, []);

  const byClass = useMemo(() => {
    const map = new Map<string, { billed: number; collected: number; count: number; outstanding: number }>();
    for (const v of vouchers) {
      const cur = map.get(v.class_label) ?? { billed: 0, collected: 0, count: 0, outstanding: 0 };
      cur.billed += Number(v.total_amount) + Number(v.late_fee);
      cur.collected += Number(v.paid_amount);
      cur.outstanding = cur.billed - cur.collected;
      cur.count += 1;
      map.set(v.class_label, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].billed - a[1].billed);
  }, [vouchers]);

  const maxBilled = Math.max(1, ...byClass.map(([, s]) => s.billed));

  function exportCsv() {
    downloadCsv("ghss-fee-report.csv", [
      ["Class", "Vouchers", "Billed", "Collected", "Outstanding", "Rate %"],
      ...byClass.map(([label, s]) => [label, s.count, s.billed, s.collected, s.outstanding, s.billed > 0 ? Math.round((s.collected / s.billed) * 100) : 0]),
    ]);
    toast({ title: "Report exported", description: "Class-wise collection CSV downloaded." });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" onClick={exportCsv} className="button-press h-10 rounded-full">
          <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden /> Export CSV
        </Button>
      </div>
      <div className="space-y-3">
        {byClass.length === 0 && <p className="py-8 text-center text-small text-muted-foreground">No voucher data yet.</p>}
        {byClass.map(([label, s]) => {
          const rate = s.billed > 0 ? Math.round((s.collected / s.billed) * 100) : 0;
          return (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-small font-bold">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.count} vouchers · billed {fmtMoney(s.billed)} · outstanding {fmtMoney(s.outstanding)}
                  </p>
                </div>
                <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(s.billed / maxBilled) * 100}%` }}>
                    <div className="h-full rounded-full bg-gold" style={{ width: `${rate}%` }} />
                  </div>
                </div>
                <p className="mt-1.5 text-right text-xs font-bold text-primary">{rate}% collected</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
