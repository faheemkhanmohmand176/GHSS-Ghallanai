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
  // headers of the styled template
  hafizyesno: "hafiz", dobyyyymmdd: "dob", feepaidyesno: "paid", receiptno: "receipt",
  previousschool: "institute", sscobtained: "marks_obtained", ssctotal: "marks_total",
};

// Template columns: header text, field key, width, required
const TEMPLATE_COLS: Array<{ h: string; w: number; req?: boolean; text?: boolean }> = [
  { h: "Full Name", w: 24, req: true }, { h: "Father Name", w: 24, req: true },
  { h: "CNIC / Form-B", w: 19, req: true, text: true }, { h: "Mobile", w: 15, req: true, text: true },
  { h: "Program", w: 16, req: true }, { h: "Quota", w: 18 },
  { h: "Marks Obtained", w: 11, req: true }, { h: "Marks Total", w: 10, req: true },
  { h: "Hafiz (yes/no)", w: 10 }, { h: "Union Council", w: 18 },
  { h: "DOB (YYYY-MM-DD)", w: 16, text: true }, { h: "Fee Paid (yes/no)", w: 11 },
  { h: "Payment Method", w: 14 }, { h: "Receipt No", w: 14 },
  { h: "Roll No", w: 11, text: true }, { h: "Board", w: 14 },
  { h: "Previous School", w: 24 }, { h: "Address", w: 24 },
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
    try {
      const ExcelJS = (await import("exceljs")).default;
      const GREEN = "FF14532D", GOLD = "FFB8891F", TINT = "FFFBF5E2", WHITE = "FFFFFFFF", GREY = "FFF3F4F1";
      const side = { style: "thin" as const, color: { argb: "FF9CA3AF" } };
      const box = { top: side, left: side, bottom: side, right: side };
      const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
      const mid = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
      const n = TEMPLATE_COLS.length;
      const FIRST = 5, ROWS = 100, LAST_VALID = 504;

      const wb = new ExcelJS.Workbook();
      wb.creator = "GHSS Ghallanai";
      const ws = wb.addWorksheet("Walk-in", { views: [{ state: "frozen", ySplit: 4, xSplit: 1 }] });
      ws.columns = TEMPLATE_COLS.map((c) => ({ width: c.w }));

      const band = (r: number, text: string, size: number, bg: string, color: string, h: number, bold = true) => {
        ws.mergeCells(r, 1, r, n);
        const c = ws.getCell(r, 1);
        c.value = text; c.alignment = mid; c.fill = fill(bg);
        c.font = { name: "Calibri", size, bold, color: { argb: color } };
        ws.getRow(r).height = h;
      };
      band(1, "GOVERNMENT HIGHER SECONDARY SCHOOL GHALLANAI", 16, GREEN, WHITE, 28);
      band(2, "Walk-in Admission Applications, Import Sheet", 12, GOLD, WHITE, 22);
      band(3, "Type one student per row from row 5. Columns marked * are required. Do not change the header row (row 4).", 10, TINT, "FF3A3A3A", 20, false);

      const head = ws.getRow(4);
      head.height = 32;
      TEMPLATE_COLS.forEach((c, i) => {
        const cell = head.getCell(i + 1);
        cell.value = c.req ? `${c.h} *` : c.h;
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
        cell.fill = fill(c.req ? GREEN : "FF4B7F5E");
        cell.alignment = mid; cell.border = box;
      });

      for (let r = FIRST; r < FIRST + ROWS; r++) {
        const row = ws.getRow(r);
        row.height = 22;
        TEMPLATE_COLS.forEach((c, i) => {
          const cell = row.getCell(i + 1);
          cell.alignment = mid; cell.border = box;
          cell.font = { name: "Calibri", size: 11 };
          if (c.text) cell.numFmt = "@";
          if ((r - FIRST) % 2 === 1) cell.fill = fill(GREY);
        });
      }

      // dropdowns (Program / Quota / Yes-No / Payment method) on every data row up to 500
      const list = (col: number, items: string[]) => {
        const letter = ws.getColumn(col).letter;
        for (let r = FIRST; r <= LAST_VALID; r++) {
          ws.getCell(`${letter}${r}`).dataValidation = {
            type: "list", allowBlank: true, showErrorMessage: true,
            errorTitle: "Choose from the list", error: "Please pick one of the listed values.",
            formulae: [`"${items.join(",")}"`],
          };
        }
      };
      const progNames = programs.map((p) => p.name).filter((n) => !n.includes(","));
      if (progNames.length) list(5, progNames);
      list(6, QUOTAS.map((q) => q.label));
      list(9, ["yes", "no"]);
      list(12, ["yes", "no"]);
      list(13, ["cash", "bank", "easypaisa", "jazzcash", "other"]);

      // ── Help sheet ────────────────────────────────────────────────────
      const hs = wb.addWorksheet("Help");
      hs.columns = [{ width: 24 }, { width: 70 }];
      hs.mergeCells(1, 1, 1, 2);
      const t = hs.getCell(1, 1);
      t.value = "How to fill the Walk-in sheet"; t.alignment = mid; t.fill = fill(GREEN);
      t.font = { name: "Calibri", size: 14, bold: true, color: { argb: WHITE } };
      hs.getRow(1).height = 28;
      const help: Array<[string, string]> = [
        ["Required (*)", "Full Name, Father Name, CNIC / Form-B, Mobile, Program, Marks Obtained, Marks Total"],
        ["CNIC / Form-B", "13 digits, no dashes needed (cells are already text)"],
        ["Mobile", "03XXXXXXXXX"],
        ["Program", (programs.map((p) => p.name).join(" / ")) || "Pre-Medical / Pre-Engineering / ICS / Arts"],
        ["Quota", QUOTAS.map((q) => q.label).join(" / ") + "  (empty = Local Quota)"],
        ["Marks", "SSC obtained and total, for example 850 and 1100"],
        ["Hafiz (yes/no)", "yes adds 20 marks in the merit list"],
        ["Fee Paid (yes/no)", "yes = fee received at the office. Only fee-paid students enter the merit list"],
        ["Payment Method", "cash, bank, easypaisa, jazzcash or other (empty = cash)"],
        ["DOB", "YYYY-MM-DD, optional"],
        ["Example row", "Ali Khan | Gul Khan | 2148700000000 | 03001234567 | Pre-Medical | Local Quota | 850 | 1100 | no | ... | yes | cash"],
      ];
      help.forEach(([k, v], i) => {
        const r = hs.getRow(i + 2);
        r.height = 24;
        const a1 = r.getCell(1), b1 = r.getCell(2);
        a1.value = k; b1.value = v;
        a1.font = { name: "Calibri", size: 11, bold: true, color: { argb: GREEN } };
        b1.font = { name: "Calibri", size: 11 };
        a1.alignment = mid; b1.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        a1.fill = fill(TINT); a1.border = box; b1.border = box;
      });

      ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Walk-in-Applications-Template.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      toast.error("Could not create the template.");
    }
  }

  async function onFile(file: File | undefined) {
    setReport(null); setRows([]); setFileName("");
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
      const keyOf = (v: unknown) => ALIASES[String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")];
      // header row = first row (within the top 15) that has 3 or more known column names
      const hi = grid.slice(0, 15).findIndex((r) => r.filter((c) => keyOf(c)).length >= 3);
      if (hi < 0) { toast.error("Column headings not found. Use the downloaded template."); return; }
      const keys = grid[hi].map((c) => keyOf(c) ?? "");
      const parsed: Row[] = grid.slice(hi + 1)
        .map((r) => {
          const o: Row = {};
          keys.forEach((key, i) => {
            if (!key || o[key]) return;
            const v = r[i];
            o[key] = key === "dob" ? normDob(cellToText(v)) : cellToText(v);
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
      // Everything imported → the page closes by itself. If some rows failed the
      // dialog stays open so the admin can read which rows and why.
      if (d.failed === 0 && d.imported > 0) {
        setReport(null);
        onOpenChange(false);
      }
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
