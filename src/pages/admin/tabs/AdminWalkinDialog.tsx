/**
 * AdminWalkinDialog — office staff enter applications that were handed in on
 * paper (walk-in), one by one ("Add One") or in bulk ("Import Excel / CSV").
 * Needs migration 31_admin_walkin_applications.sql.
 * A walk-in is stored exactly like an online application, so it shows in the
 * Applications list, can be marked Paid, and is ranked with online applicants
 * in the merit list.
 */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { QUOTAS } from "@/lib/interAdmission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, UserPlus, FileSpreadsheet, Download, Upload, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type Row = Record<string, string>;

const sel = "h-9 w-full rounded-xl border border-input bg-background px-2.5 text-[13px]";
const inp = "h-9 text-[13px] rounded-xl";
const lbl = "text-[11.5px] font-semibold";

const EMPTY = {
  full_name: "", father_name: "", cnic: "", mobile: "",
  marks_obtained: "", marks_total: "1100", union_council: "", dob: "",
  roll_number: "", board: "", institute: "", receipt: "",
};

// Import: accepted column names (lower-case, symbols removed) → field name
const ALIASES: Record<string, string> = {
  fullname: "full_name", name: "full_name", studentname: "full_name", student: "full_name",
  fathername: "father_name", father: "father_name", fname: "father_name",
  cnic: "cnic", formb: "cnic", cnicformb: "cnic", bform: "cnic",
  mobile: "mobile", mobileno: "mobile", phone: "mobile", mobilenumber: "mobile",
  program: "program", faculty: "program", group: "program",
  quota: "quota", marksobtained: "marks_obtained", obtained: "marks_obtained", obtainedmarks: "marks_obtained",
  markstotal: "marks_total", total: "marks_total", totalmarks: "marks_total",
  hafiz: "hafiz", hafizequran: "hafiz",
  unioncouncil: "union_council", uc: "union_council",
  dob: "dob", dateofbirth: "dob",
  paid: "paid", feepaid: "paid", paymentmethod: "payment_method", receipt: "receipt",
  rollnumber: "roll_number", rollno: "roll_number", board: "board",
  institute: "institute", school: "institute", address: "address",
  studygroup: "study_group", passingyear: "passing_year", year: "passing_year",
};

const TEMPLATE_HEAD = [
  "full_name", "father_name", "cnic", "mobile", "program", "quota",
  "marks_obtained", "marks_total", "hafiz", "union_council", "dob",
  "paid", "payment_method", "receipt", "roll_number", "board", "institute", "address",
];

function cellToText(v: unknown): string {
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v ?? "").trim();
}

function normDob(s: string): string {
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}

export default function AdminWalkinDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"one" | "import">("one");
  const [f, setF] = useState({ ...EMPTY });
  const [programId, setProgramId] = useState("");
  const [quota, setQuota] = useState("local_quota");
  const [hafiz, setHafiz] = useState(false);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  // import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [markAllPaid, setMarkAllPaid] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<null | {
    total: number; imported: number; failed: number;
    errors: Array<{ row: number; name?: string; error: string }>;
  }>(null);

  const programsQ = useQuery({
    queryKey: ["inter-admin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inter_programs_list");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as Array<{ id: number; name: string; seats: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const programs = programsQ.data ?? [];

  const ucQ = useQuery({
    queryKey: ["inter-union-councils"],
    queryFn: async () => {
      const { data } = await supabase.from("inter_union_councils").select("name").order("name");
      return (data ?? []).map((r: { name: string }) => r.name);
    },
    staleTime: 30 * 60 * 1000,
  });

  const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["inter-admin-apps"] });
    qc.invalidateQueries({ queryKey: ["inter-admin-merit-lists"] });
  };

  async function saveOne() {
    if (!f.full_name.trim() || !f.father_name.trim()) { toast.error("Enter student and father name."); return; }
    if (!/^\d{13}$/.test(f.cnic.replace(/\D/g, ""))) { toast.error("CNIC / Form-B must be 13 digits."); return; }
    if (!/^(0?3\d{9})$/.test(f.mobile.replace(/\D/g, ""))) { toast.error("Mobile must look like 03XXXXXXXXX."); return; }
    if (!programId) { toast.error("Select a program."); return; }
    if (f.marks_obtained === "" || Number(f.marks_total) <= 0 || Number(f.marks_obtained) > Number(f.marks_total)) {
      toast.error("Check SSC obtained / total marks."); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("inter_admin_add_walkin", {
        p: {
          ...f, dob: normDob(f.dob), program_id: programId, quota,
          hafiz: hafiz ? "yes" : "no", paid: paid ? "yes" : "no", payment_method: method,
        },
      });
      if (error) throw error;
      const d = data as { ok?: boolean; error?: string; tracking_id?: string };
      if (d?.ok === false) throw new Error(d?.error || "Could not save.");
      toast.success(`Saved. Tracking ID ${d.tracking_id}`);
      setLast(d.tracking_id ?? null);
      setF({ ...EMPTY, marks_total: f.marks_total });   // ready for the next student
      setHafiz(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message || "Could not save.");
    } finally { setSaving(false); }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const example = [
      "Ali Khan", "Gul Khan", "2148700000000", "03001234567",
      programs[0]?.name ?? "Pre-Medical", "Local Quota", "850", "1100", "no",
      "", "2010-05-14", "yes", "cash", "", "123456", "Peshawar", "GHSS Ghallanai", "Ghallanai",
    ];
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEAD, example]);
    // keep CNIC / mobile as text so Excel does not turn them into 2.1E+12
    for (const col of ["C", "D"]) {
      const c = ws[`${col}2`]; if (c) { c.t = "s"; c.z = "@"; }
    }
    const help = XLSX.utils.aoa_to_sheet([
      ["Field", "Rules"],
      ["program", programs.map((p) => p.name).join(" / ") || "Pre-Medical / Pre-Engineering / ICS / Arts"],
      ["quota", QUOTAS.map((q) => q.label).join(" / ") + "  (blank = Local Quota)"],
      ["cnic / mobile", "13 digits / 03XXXXXXXXX (type them as text)"],
      ["hafiz, paid", "yes or no"],
      ["payment_method", "cash, bank, easypaisa, jazzcash, other (blank = cash)"],
      ["dob", "YYYY-MM-DD (optional)"],
      ["Required", "full_name, father_name, cnic, mobile, program, marks_obtained, marks_total"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Walk-in");
    XLSX.utils.book_append_sheet(wb, help, "Help");
    XLSX.writeFile(wb, "walk-in-applications-template.xlsx");
  }

  async function onFile(file: File | undefined) {
    setReport(null); setRows([]); setFileName("");
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      const parsed: Row[] = raw
        .map((r) => {
          const o: Row = {};
          Object.entries(r).forEach(([k, v]) => {
            const key = ALIASES[k.toLowerCase().replace(/[^a-z0-9]/g, "")];
            if (key) o[key] = key === "dob" ? normDob(cellToText(v)) : cellToText(v);
          });
          return o;
        })
        .filter((o) => Object.values(o).some((v) => v !== ""));
      if (parsed.length === 0) { toast.error("No student rows found. Use the template."); return; }
      if (parsed.length > 500) { toast.error("Import at most 500 rows at a time."); return; }
      setRows(parsed); setFileName(file.name);
    } catch {
      toast.error("Could not read this file. Use the .xlsx template or a .csv file.");
    }
  }

  async function runImport() {
    setImporting(true);
    try {
      const payload = rows.map((r) => (markAllPaid && !r.paid ? { ...r, paid: "yes" } : r));
      const { data, error } = await supabase.rpc("inter_admin_import_walkins", { p_rows: payload });
      if (error) throw error;
      const d = data as {
        ok?: boolean; error?: string; total: number; imported: number; failed: number;
        results?: Array<{ row: number; name?: string; ok: boolean; error?: string }>;
      };
      if (d?.ok === false) throw new Error(d?.error || "Import failed.");
      setReport({
        total: d.total, imported: d.imported, failed: d.failed,
        errors: (d.results ?? []).filter((x) => !x.ok).map((x) => ({ row: x.row, name: x.name, error: x.error ?? "Failed" })),
      });
      if (d.imported > 0) { toast.success(`${d.imported} application(s) imported.`); refresh(); }
      setRows([]); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message || "Import failed.");
    } finally { setImporting(false); }
  }

  const tab = (v: "one" | "import", icon: React.ReactNode, text: string) => (
    <button type="button" onClick={() => setMode(v)}
      className={`flex-1 h-8 rounded-full text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 border transition-all ${
        mode === v ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border"}`}>
      {icon} {text}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-4">
        <DialogHeader>
          <DialogTitle className="text-center text-[15px]">Walk-in Applications</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {tab("one", <UserPlus className="w-3.5 h-3.5" />, "Add One")}
          {tab("import", <FileSpreadsheet className="w-3.5 h-3.5" />, "Import Excel")}
        </div>

        {mode === "one" ? (
          <div className="space-y-2.5">
            {last && (
              <p className="flex items-center justify-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/5 px-2 py-1.5 text-[12px] font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved: <span className="font-mono">{last}</span>
              </p>
            )}
            <div className="space-y-1"><Label className={lbl}>Student name *</Label>
              <Input className={inp} value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
            <div className="space-y-1"><Label className={lbl}>Father name *</Label>
              <Input className={inp} value={f.father_name} onChange={(e) => set("father_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className={lbl}>CNIC / Form-B *</Label>
                <Input className={inp} inputMode="numeric" maxLength={15} placeholder="13 digits" value={f.cnic} onChange={(e) => set("cnic", e.target.value)} /></div>
              <div className="space-y-1"><Label className={lbl}>Mobile *</Label>
                <Input className={inp} inputMode="numeric" maxLength={11} placeholder="03XXXXXXXXX" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className={lbl}>Program *</Label>
                <select className={sel} value={programId} onChange={(e) => setProgramId(e.target.value)}>
                  <option value="">Select</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
              <div className="space-y-1"><Label className={lbl}>Quota</Label>
                <select className={sel} value={quota} onChange={(e) => setQuota(e.target.value)}>
                  {QUOTAS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className={lbl}>SSC obtained *</Label>
                <Input className={inp} inputMode="decimal" value={f.marks_obtained} onChange={(e) => set("marks_obtained", e.target.value)} /></div>
              <div className="space-y-1"><Label className={lbl}>SSC total *</Label>
                <Input className={inp} inputMode="decimal" value={f.marks_total} onChange={(e) => set("marks_total", e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-medium">
              <input type="checkbox" checked={hafiz} onChange={(e) => setHafiz(e.target.checked)} className="h-4 w-4 accent-green-700" />
              Hafiz-e-Quran (+20 marks in merit)
            </label>
            <div className="space-y-1"><Label className={lbl}>Union council (optional)</Label>
              <Input className={inp} list="walkin-ucs" value={f.union_council} onChange={(e) => set("union_council", e.target.value)} />
              <datalist id="walkin-ucs">{(ucQ.data ?? []).map((n) => <option key={n} value={n} />)}</datalist></div>

            <details className="rounded-xl border border-border px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-muted-foreground">More details (optional)</summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className={lbl}>Date of birth</Label>
                  <Input className={inp} type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></div>
                <div className="space-y-1"><Label className={lbl}>SSC roll no.</Label>
                  <Input className={inp} value={f.roll_number} onChange={(e) => set("roll_number", e.target.value)} /></div>
                <div className="space-y-1"><Label className={lbl}>Board</Label>
                  <Input className={inp} value={f.board} onChange={(e) => set("board", e.target.value)} /></div>
                <div className="space-y-1"><Label className={lbl}>Previous school</Label>
                  <Input className={inp} value={f.institute} onChange={(e) => set("institute", e.target.value)} /></div>
              </div>
            </details>

            <div className="rounded-xl border border-border bg-muted/30 p-2.5 space-y-2">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 accent-green-700" />
                Processing fee received
              </label>
              {paid && (
                <div className="grid grid-cols-2 gap-2">
                  <select className={sel} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash at School</option>
                    <option value="bank">Bank</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="jazzcash">JazzCash</option>
                    <option value="other">Other</option>
                  </select>
                  <Input className={inp} placeholder="Receipt no. (optional)" value={f.receipt} onChange={(e) => set("receipt", e.target.value)} />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">Only fee-paid students enter the merit list.</p>
            </div>

            <Button className="w-full h-10 rounded-full font-semibold" disabled={saving} onClick={saveOne}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Save Application
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="space-y-2 text-[12.5px] text-muted-foreground">
              <li><b className="text-foreground">1.</b> Download the template and fill one student per row.</li>
              <li><b className="text-foreground">2.</b> Choose the filled .xlsx or .csv file.</li>
              <li><b className="text-foreground">3.</b> Press Import. Good rows are saved; wrong rows are listed with the reason.</li>
            </ol>
            <Button variant="outline" className="w-full h-9 rounded-full text-[12.5px] font-semibold" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Download Template
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" className="w-full h-9 rounded-full text-[12.5px] font-semibold" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> {fileName ? fileName : "Choose File"}
            </Button>
            {rows.length > 0 && (
              <>
                <p className="text-center text-[12.5px] font-semibold text-foreground">{rows.length} student row(s) ready</p>
                <label className="flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={markAllPaid} onChange={(e) => setMarkAllPaid(e.target.checked)} className="h-4 w-4 accent-green-700" />
                  Mark rows without a "paid" value as Paid (Cash at School)
                </label>
                <Button className="w-full h-10 rounded-full font-semibold" disabled={importing} onClick={runImport}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import {rows.length} Application(s)
                </Button>
              </>
            )}
            {report && (
              <div className="space-y-2 rounded-xl border border-border p-3 text-[12.5px]">
                <p className="text-center font-semibold">
                  <span className="text-green-700 dark:text-green-400">{report.imported} imported</span>
                  {report.failed > 0 && <> · <span className="text-red-600">{report.failed} failed</span></>}
                </p>
                {report.errors.length > 0 && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-[11.5px] text-muted-foreground">
                    {report.errors.map((e) => (
                      <li key={e.row}><b className="text-foreground">Row {e.row}{e.name ? ` (${e.name})` : ""}:</b> {e.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
