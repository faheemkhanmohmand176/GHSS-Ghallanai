/**
 * admissionExcel.ts: styled Excel export of every admission application.
 * Green header, gold title band, thin borders on every cell, all text
 * centered, status colours, frozen header, auto filter and a summary sheet.
 */
import { QUOTA_LABEL } from "@/lib/interAdmission";
import { paymentMethodLabel } from "@/lib/admissionStatus";

export interface ExportRow {
  [k: string]: string | number | boolean | null | undefined;
}

const GREEN = "FF14532D";
const GOLD = "FFB8891F";
const GOLD_TINT = "FFFBF5E2";
const ALT = "FFF6F8F5";
const WHITE = "FFFFFFFF";
const BORDER = { style: "thin" as const, color: { argb: "FFBFC8C0" } };
const BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const cap = (s: unknown) => String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const val = (v: unknown) => (v === null || v === undefined || v === "" ? "N/A" : v);

interface Col { header: string; key: string; width: number; fmt?: (r: ExportRow) => string | number }
const COLS: Col[] = [
  { header: "Tracking ID", key: "tracking_id", width: 17 },
  { header: "Applied On", key: "submitted_at", width: 18 },
  { header: "Name", key: "full_name", width: 22 },
  { header: "Father Name", key: "father_name", width: 22 },
  { header: "CNIC / Form-B", key: "cnic", width: 17 },
  { header: "Mobile", key: "applicant_mobile", width: 14 },
  { header: "Date of Birth", key: "dob", width: 13 },
  { header: "Gender", key: "gender", width: 9, fmt: (r) => cap(r.gender) },
  { header: "Religion", key: "religion", width: 11 },
  { header: "Nationality", key: "nationality", width: 12 },
  { header: "Program", key: "program", width: 20 },
  { header: "Subject Group", key: "subject_group", width: 34 },
  { header: "Category", key: "quota", width: 17, fmt: (r) => QUOTA_LABEL[String(r.quota)] ?? cap(r.quota) },
  { header: "Criteria", key: "quota_criteria", width: 18, fmt: (r) => cap(r.quota_criteria) },
  { header: "Payment", key: "payment_status", width: 11, fmt: (r) => cap(r.payment_status) },
  { header: "Paid By", key: "payment_method", width: 15, fmt: (r) => paymentMethodLabel(String(r.payment_method ?? "")) || "N/A" },
  { header: "Status", key: "status", width: 14, fmt: (r) => cap(r.status) },
  { header: "Fee (Rs)", key: "processing_fee", width: 10 },
  { header: "Payment Reference", key: "fee_reference", width: 19 },
  { header: "Receipt No", key: "payment_reference", width: 15 },
  { header: "Fee Deadline", key: "fee_deadline", width: 13 },
  { header: "Paid On", key: "paid_at", width: 18 },
  { header: "SSC Board", key: "ssc_board", width: 17 },
  { header: "SSC Year", key: "ssc_year", width: 9 },
  { header: "SSC Group", key: "ssc_group", width: 30 },
  { header: "Roll No", key: "ssc_roll", width: 11 },
  { header: "Obtained", key: "ssc_obtained", width: 10 },
  { header: "Total", key: "ssc_total", width: 9 },
  { header: "Percentage", key: "ssc_percentage", width: 11, fmt: (r) => (r.ssc_percentage === null || r.ssc_percentage === undefined ? "N/A" : `${r.ssc_percentage}%`) },
  { header: "Grade", key: "ssc_grade", width: 8 },
  { header: "Hafiz e Quran", key: "hafiz", width: 12, fmt: (r) => (r.hafiz ? "Yes" : "No") },
  { header: "District", key: "district", width: 15 },
  { header: "Tehsil", key: "tehsil", width: 14 },
  { header: "Union Council", key: "union_council", width: 16 },
  { header: "Address", key: "address", width: 34 },
  { header: "Father CNIC", key: "father_cnic", width: 17 },
  { header: "Father Mobile", key: "father_mobile", width: 14 },
  { header: "Mother Name", key: "mother_name", width: 20 },
  { header: "Email", key: "email", width: 26 },
  { header: "Blood Group", key: "blood_group", width: 11 },
  { header: "Institute", key: "inst_name", width: 28 },
  { header: "Institute District", key: "inst_district", width: 16 },
  { header: "Admin Note", key: "admin_note", width: 26 },
];

export async function exportApplicationsExcel(rows: ExportRow[], session: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "GHSS Ghallanai";
  wb.created = new Date();

  const ws = wb.addWorksheet("Applications", { views: [{ state: "frozen", ySplit: 4, xSplit: 3 }] });
  const n = COLS.length;
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.width }));

  const band = (row: number, text: string, size: number, fill: string, color: string, h: number) => {
    ws.mergeCells(row, 1, row, n);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { name: "Calibri", size, bold: true, color: { argb: color } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    ws.getRow(row).height = h;
  };
  band(1, "GOVERNMENT HIGHER SECONDARY SCHOOL GHALLANAI", 16, GREEN, WHITE, 28);
  band(2, `Online Admission Applications, Session ${session}`, 12, GOLD, WHITE, 22);
  band(3, `Total Applications: ${rows.length}     Exported: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, 10, GOLD_TINT, "FF3A3A3A", 20);

  const head = ws.getRow(4);
  head.height = 26;
  COLS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.border = BORDERS;
  });

  rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    row.height = 22;
    COLS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.fmt ? c.fmt(r) : (val(r[c.key]) as string | number);
      cell.font = { name: "Calibri", size: 10.5 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = BORDERS;
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT } };
      if (c.key === "payment_status" || c.key === "status") {
        const v = String(r[c.key] ?? "");
        const good = v === "paid" || v === "admitted" || v === "fee_paid" || v === "merit_listed";
        const bad = v === "rejected" || v === "cancelled";
        const bg = good ? "FFD9F2E1" : bad ? "FFF8D9D9" : "FFFFF0CC";
        const fg = good ? "FF166534" : bad ? "FF991B1B" : "FF92400E";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: fg } };
      }
      if (c.key === "tracking_id") cell.font = { name: "Consolas", size: 10.5, bold: true, color: { argb: GREEN } };
    });
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: n } };
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Summary sheet
  const sm = wb.addWorksheet("Summary");
  sm.columns = [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }];
  sm.mergeCells(1, 1, 1, 5);
  const t = sm.getCell(1, 1);
  t.value = "Summary by Program";
  t.font = { name: "Calibri", size: 15, bold: true, color: { argb: WHITE } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
  sm.getRow(1).height = 28;
  const sh = ["Program", "Applications", "Fee Paid", "Fee Pending", "Rejected"];
  sh.forEach((h, i) => {
    const c = sm.getRow(2).getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDERS;
  });
  const groups = new Map<string, ExportRow[]>();
  rows.forEach((r) => { const k = String(r.program ?? "N/A"); groups.set(k, [...(groups.get(k) ?? []), r]); });
  let rIdx = 3;
  const line = (label: string, list: ExportRow[], bold = false) => {
    const vals = [
      label, list.length,
      list.filter((r) => r.payment_status === "paid").length,
      list.filter((r) => r.payment_status === "pending").length,
      list.filter((r) => r.payment_status === "rejected").length,
    ];
    vals.forEach((v, i) => {
      const c = sm.getRow(rIdx).getCell(i + 1);
      c.value = v;
      c.font = { name: "Calibri", size: 11, bold };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = BORDERS;
      if (bold) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD_TINT } };
    });
    sm.getRow(rIdx).height = 22;
    rIdx++;
  };
  [...groups.entries()].forEach(([k, list]) => line(k, list));
  line("Total", rows, true);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Admission-Applications-${session || "export"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
