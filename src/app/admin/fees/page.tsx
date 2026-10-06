import { Wallet, Plus, FileText, Receipt, BarChart3, Coins, AlertTriangle, TrendingUp } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid } from "@/components/admin/stat-card";
import { BarChart, DonutChart } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";

// ---- Types -----------------------------------------------------------------

interface FeeStructureRow {
  id: string;
  class_label: string;
  programme: string;
  fee_type: string;
  label: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "annual" | "one_time";
  is_active: boolean;
}

interface FeeVoucherRow {
  id: string;
  voucher_no: string;
  student_name: string;
  class_label: string;
  programme: string;
  month: string;
  total: number;
  paid: number;
  status: "unpaid" | "partial" | "paid" | "overdue" | "waived";
  due_date: string;
}

interface FeePaymentRow {
  id: string;
  receipt_no: string;
  student_name: string;
  amount: number;
  method: "cash" | "bank" | "online" | "cheque";
  date: string;
}

// ---- Demo data -------------------------------------------------------------

const DEMO_STRUCTURES: FeeStructureRow[] = [
  { id: "fs1", class_label: "1st Year", programme: "All", fee_type: "admission", label: "Admission Fee (one time)", amount: 500, frequency: "one_time", is_active: true },
  { id: "fs2", class_label: "1st Year", programme: "ICS", fee_type: "lab", label: "Computer Lab Fund", amount: 500, frequency: "annual", is_active: true },
  { id: "fs3", class_label: "1st Year", programme: "Pre-Medical", fee_type: "lab", label: "Science Lab Fund", amount: 500, frequency: "annual", is_active: true },
  { id: "fs4", class_label: "1st Year", programme: "Pre-Engineering", fee_type: "lab", label: "Science Lab Fund", amount: 500, frequency: "annual", is_active: true },
  { id: "fs5", class_label: "1st Year", programme: "All", fee_type: "exam", label: "Send-up Examination", amount: 300, frequency: "quarterly", is_active: true },
  { id: "fs6", class_label: "2nd Year", programme: "All", fee_type: "bise", label: "BISE Board Registration", amount: 600, frequency: "annual", is_active: true },
  { id: "fs7", class_label: "2nd Year", programme: "All", fee_type: "exam", label: "Annual Board Examination", amount: 800, frequency: "annual", is_active: true },
  { id: "fs8", class_label: "All", programme: "All", fee_type: "transport", label: "Transport (optional)", amount: 800, frequency: "monthly", is_active: true },
];

const DEMO_VOUCHERS: FeeVoucherRow[] = [
  { id: "v1", voucher_no: "GHSS-V-2026-1001", student_name: "Abdul Rahman Khan", class_label: "2nd Year", programme: "ICS", month: "Sep 2026", total: 1100, paid: 1100, status: "paid", due_date: "2026-09-15" },
  { id: "v2", voucher_no: "GHSS-V-2026-1002", student_name: "Ayesha Bibi", class_label: "2nd Year", programme: "Pre-Medical", month: "Sep 2026", total: 1100, paid: 600, status: "partial", due_date: "2026-09-15" },
  { id: "v3", voucher_no: "GHSS-V-2026-1003", student_name: "Hassan Ali", class_label: "1st Year", programme: "Pre-Engineering", month: "Sep 2026", total: 1600, paid: 0, status: "overdue", due_date: "2026-09-10" },
  { id: "v4", voucher_no: "GHSS-V-2026-1004", student_name: "Fatima Khan", class_label: "1st Year", programme: "Arts", month: "Sep 2026", total: 1000, paid: 0, status: "unpaid", due_date: "2026-09-30" },
  { id: "v5", voucher_no: "GHSS-V-2026-1005", student_name: "Bilal Ahmed", class_label: "2nd Year", programme: "ICS", month: "Sep 2026", total: 1100, paid: 1100, status: "paid", due_date: "2026-09-15" },
];

const DEMO_PAYMENTS: FeePaymentRow[] = [
  { id: "p1", receipt_no: "GHSS-R-2026-2001", student_name: "Abdul Rahman Khan", amount: 1100, method: "cash", date: "2026-09-12" },
  { id: "p2", receipt_no: "GHSS-R-2026-2002", student_name: "Ayesha Bibi", amount: 600, method: "online", date: "2026-09-14" },
  { id: "p3", receipt_no: "GHSS-R-2026-2003", student_name: "Bilal Ahmed", amount: 1100, method: "bank", date: "2026-09-10" },
  { id: "p4", receipt_no: "GHSS-R-2026-2004", student_name: "Usman Khan", amount: 1600, method: "cash", date: "2026-09-08" },
  { id: "p5", receipt_no: "GHSS-R-2026-2005", student_name: "Maryam Bibi", amount: 1000, method: "cheque", date: "2026-09-05" },
];

const DEMO_COLLECTION_TREND = [
  { label: "Apr", value: 1812000 },
  { label: "May", value: 1842500 },
  { label: "Jun", value: 1760000 },
  { label: "Jul", value: 1695000 },
  { label: "Aug", value: 1788000 },
  { label: "Sep", value: 1845000 },
];

const DEMO_STATUS_BREAKDOWN = [
  { label: "Paid", value: 742, color: "#10b981" },
  { label: "Partial", value: 86, color: "#b8860b" },
  { label: "Unpaid", value: 312, color: "#94a3b8" },
  { label: "Overdue", value: 100, color: "#f43f5e" },
];

// ---- Helpers ---------------------------------------------------------------

const STATUS_TONE: Record<FeeVoucherRow["status"], string> = {
  paid: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  partial: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  unpaid: "border-muted-foreground/40 text-muted-foreground",
  overdue: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  waived: "border-primary/40 text-primary",
};

const FREQUENCY_LABEL: Record<FeeStructureRow["frequency"], string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  one_time: "One-time",
};

function formatPKR(amount: number) {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

const PROGRAMME_LABEL: Record<string, string> = {
  "ics": "ICS",
  "pre-medical": "Pre-Medical",
  "pre-engineering": "Pre-Engineering",
  "arts": "Arts",
  "All": "All Programmes",
};

export default async function AdminFeesPage() {
  let structures: FeeStructureRow[] = DEMO_STRUCTURES;
  let vouchers: FeeVoucherRow[] = DEMO_VOUCHERS;
  let payments: FeePaymentRow[] = DEMO_PAYMENTS;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();

      const [structuresRes, vouchersRes, paymentsRes] = await Promise.all([
        sb.from("fee_structures").select("*").eq("is_active", true).order("class_label").order("fee_type"),
        sb.from("fee_vouchers").select("*").order("created_at", { ascending: false }).limit(50),
        sb.from("fee_payments").select("*").order("payment_date", { ascending: false }).limit(50),
      ]);

      if (!structuresRes.error && structuresRes.data && structuresRes.data.length > 0) {
        structures = (structuresRes.data as any[]).map((s) => ({
          id: s.id,
          class_label: s.class_label,
          programme: s.programme ?? "All",
          fee_type: s.fee_type,
          label: s.label,
          amount: Number(s.amount ?? 0),
          frequency: s.frequency ?? "one_time",
          is_active: s.is_active ?? true,
        }));
      }
      if (!vouchersRes.error && vouchersRes.data && vouchersRes.data.length > 0) {
        vouchers = (vouchersRes.data as any[]).map((v) => ({
          id: v.id,
          voucher_no: v.voucher_number,
          student_name: v.student_id ?? "—",
          class_label: v.class_label ?? "—",
          programme: v.programme ?? "—",
          month: v.month ? `${v.month}/${v.year}` : `${v.year ?? "—"}`,
          total: Number(v.total_amount ?? 0),
          paid: Number(v.paid_amount ?? 0),
          status: v.status ?? "unpaid",
          due_date: v.due_date ?? "—",
        }));
      }
      if (!paymentsRes.error && paymentsRes.data && paymentsRes.data.length > 0) {
        payments = (paymentsRes.data as any[]).map((p) => ({
          id: p.id,
          receipt_no: p.receipt_number ?? "—",
          student_name: p.student_id ?? "—",
          amount: Number(p.amount ?? 0),
          method: p.payment_method ?? "cash",
          date: p.payment_date ?? "—",
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const collected = vouchers.filter((v) => v.status === "paid" || v.status === "partial")
    .reduce((s, v) => s + v.paid, 0);
  const outstanding = vouchers.filter((v) => v.status !== "paid" && v.status !== "waived")
    .reduce((s, v) => s + (v.total - v.paid), 0);
  const defaulters = vouchers.filter((v) => v.status === "overdue").length;
  const collectionRate = vouchers.length > 0
    ? Math.round((vouchers.filter((v) => v.status === "paid").length / vouchers.length) * 1000) / 10
    : 0;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Fee Management"
        desc="Structures, voucher generation, payment recording and the at-a-glance dashboard. Government tuition is free — fees here are limited to admission, board, lab, exam and optional transport funds."
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Custom Fee
            </Button>
            <Button variant="outline" className="h-11 rounded-full">
              <Receipt className="mr-1.5 h-4 w-4" aria-hidden /> Record Payment
            </Button>
            <Button className="h-11 rounded-full font-semibold">
              <FileText className="mr-1.5 h-4 w-4" aria-hidden /> Generate Vouchers
            </Button>
          </>
        }
      />

      <Tabs defaultValue="structures">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="vouchers">Vouchers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        {/* ============ Structures ============ */}
        <TabsContent value="structures">
          <SectionCard
            title="Fee Structures"
            description="Per-class catalog of fee types. Government tuition is free — these are board, lab, exam and optional funds."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structures.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/40 text-primary">{s.class_label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{PROGRAMME_LABEL[s.programme] ?? s.programme}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-gold/10 text-gold-strong">{s.fee_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{s.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{FREQUENCY_LABEL[s.frequency]}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatPKR(s.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          s.is_active
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : "border-muted-foreground/40 text-muted-foreground"
                        }
                      >
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* ============ Vouchers ============ */}
        <TabsContent value="vouchers">
          <SectionCard
            title="Generated Vouchers"
            description="Most recent voucher batch. Each maps to a student × month × fee period; status updates automatically as payments land."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Voucher No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs font-semibold">{v.voucher_no}</TableCell>
                    <TableCell className="font-medium">{v.student_name}</TableCell>
                    <TableCell>{v.class_label}</TableCell>
                    <TableCell className="text-sm">{PROGRAMME_LABEL[v.programme] ?? v.programme}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.month}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatPKR(v.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatPKR(v.paid)}
                    </TableCell>
                    <TableCell className="text-xs">{v.due_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[v.status]}>{v.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* ============ Payments ============ */}
        <TabsContent value="payments">
          <SectionCard
            title="Recorded Payments"
            description="Every receipt ties back to a voucher. The DB trigger on this table recomputes the voucher's paid_amount and status atomically."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-semibold">{p.receipt_no}</TableCell>
                    <TableCell className="font-medium">{p.student_name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatPKR(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize bg-primary/10 text-primary">{p.method}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* ============ Dashboard ============ */}
        <TabsContent value="dashboard">
          <StatGrid className="mb-5">
            <StatCard
              label="Collected (this month)"
              value={formatPKR(collected)}
              hint="Across all paid & partial vouchers"
              icon={Coins}
              accent="success"
              trend={{ direction: "up", value: "+3.4% MoM" }}
            />
            <StatCard
              label="Outstanding"
              value={formatPKR(outstanding)}
              hint="Unpaid + overdue balances"
              icon={Wallet}
              accent="warning"
            />
            <StatCard
              label="Defaulters"
              value={defaulters}
              hint="Vouchers past due date"
              icon={AlertTriangle}
              accent={defaulters > 0 ? "danger" : "neutral"}
            />
            <StatCard
              label="Collection Rate"
              value={`${collectionRate}%`}
              hint="Vouchers fully paid"
              icon={TrendingUp}
              accent="primary"
              trend={{ direction: "up", value: "+1.8%" }}
            />
          </StatGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <SectionCard
              title="Monthly Collection Trend"
              description="PKR collected per month (last 6 months)"
              className="lg:col-span-2"
            >
              <BarChart
                data={DEMO_COLLECTION_TREND.map((d) => ({
                  label: d.label,
                  value: Math.round(d.value / 10000) / 10,
                  hint: "Lakh PKR",
                }))}
                accent="gold"
                height={240}
              />
            </SectionCard>

            <SectionCard
              title="Status Breakdown"
              description="Current voucher distribution"
            >
              <DonutChart data={DEMO_STATUS_BREAKDOWN} size={180} />
            </SectionCard>
          </div>

          <SectionCard
            title="Bank Details & Notes"
            description="The bank account shown on every printed voucher"
            className="mt-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Bank</p>
                <p className="font-semibold">National Bank of Pakistan</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Account Title</p>
                <p className="font-semibold">GHSS Ghallanai — Fee Account</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Account No</p>
                <p className="font-mono font-semibold">— SAMPLE —</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="font-semibold">Ghallanai Branch</p>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
