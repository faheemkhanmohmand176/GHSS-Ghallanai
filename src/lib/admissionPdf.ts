/**
 * admissionPdf.ts: the two A4 documents of the online admission flow.
 *   1. Fee Challan: two copies on one A4 page (Applicant / School), same
 *      visual language as the Fee Management vouchers. Payment accounts
 *      are the school's own, taken from Admission Settings.
 *   2. Application Form: a clean multi section A4 record.
 * jsPDF loads on demand so it never weighs down the public bundle.
 */
import type { PaymentMethod } from "@/hooks/useFees";
import { describePaymentMethod } from "@/hooks/useAdmission";

type RGB = [number, number, number];
const C = {
  ink: [26, 26, 26] as RGB, sub: [92, 92, 92] as RGB, muted: [128, 128, 128] as RGB,
  green: [20, 83, 45] as RGB, gold: [168, 130, 40] as RGB, goldTint: [251, 245, 226] as RGB,
  alt: [248, 248, 246] as RGB, grid: [220, 220, 216] as RGB, white: [255, 255, 255] as RGB,
};
const SCHOOL = "GOVERNMENT HIGHER SECONDARY SCHOOL GHALLANAI";

async function lib() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}
type Doc = InstanceType<Awaited<ReturnType<typeof lib>>["jsPDF"]>;
const fill = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const draw = (d: Doc, c: RGB) => d.setDrawColor(c[0], c[1], c[2]);
const ink = (d: Doc, c: RGB) => d.setTextColor(c[0], c[1], c[2]);
const na = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? "N/A" : String(v));

function header(doc: Doc, y0: number, m: number, inner: number, w: number, sub: string) {
  fill(doc, C.green);
  doc.roundedRect(m, y0, inner, 15, 2, 2, "F");
  doc.rect(m, y0 + 8, inner, 7, "F");
  ink(doc, C.white);
  doc.setFont("times", "bold"); doc.setFontSize(13);
  doc.text(SCHOOL, w / 2, y0 + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  doc.text(sub, w / 2, y0 + 12, { align: "center" });
  fill(doc, C.gold); doc.rect(m, y0 + 15, inner, 0.8, "F");
}

// ───────────────────────── Fee Challan ─────────────────────────
export interface ChallanData {
  cycle: string;
  fee: number;
  reference: string;
  trackingId: string;
  name: string;
  fatherName: string;
  cnic: string;
  mobile: string;
  program: string;
  subjectGroup: string;
  quota: string;
  deadline: string;
  appliedOn: string;
  methods: PaymentMethod[];
}

function paymentLines(methods: PaymentMethod[]): string[] {
  const out = methods.map((m) => {
    const d = describePaymentMethod(m);
    return [d.title, ...d.lines].filter(Boolean).join("   |   ");
  }).filter(Boolean);
  return out.length ? out : ["Payment account details are available at the school office."];
}

function drawChallanCopy(doc: Doc, autoTable: unknown, d: ChallanData, y0: number, copy: string) {
  void autoTable;
  const w = 210, m = 12, inner = w - m * 2, H = 130;

  draw(doc, C.grid); doc.setLineWidth(0.4);
  doc.roundedRect(m, y0, inner, H, 2, 2, "S");
  header(doc, y0, m, inner, w, "DISTRICT MOHMAND  |  KHYBER PAKHTUNKHWA");

  ink(doc, C.ink); doc.setFont("times", "bold"); doc.setFontSize(14);
  doc.text("APPLICATION FEE CHALLAN", w / 2, y0 + 24, { align: "center" });
  ink(doc, C.gold); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text(copy.toUpperCase(), w - m - 4, y0 + 21, { align: "right" });
  ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(d.cycle, w / 2, y0 + 29, { align: "center" });

  // Info grid: 3 columns x 2 rows, all text centered
  const cells: [string, string][] = [
    ["APPLICANT", d.name],
    ["FATHER NAME", d.fatherName],
    ["CNIC / FORM-B", d.cnic],
    ["TRACKING ID", d.trackingId],
    ["PROGRAM", d.program],
    ["CATEGORY", d.quota],
  ];
  const cw = inner / 3, gy = y0 + 33, ch = 13;
  cells.forEach(([label, value], i) => {
    const cx = m + (i % 3) * cw, cy = gy + Math.floor(i / 3) * ch;
    fill(doc, i % 2 === 0 ? C.alt : C.white); draw(doc, C.grid); doc.setLineWidth(0.2);
    doc.rect(cx, cy, cw, ch, "FD");
    ink(doc, C.muted); doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.text(label, cx + cw / 2, cy + 4.2, { align: "center" });
    ink(doc, C.ink); doc.setFont("times", "bold"); doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(na(value), cw - 5).slice(0, 2);
    doc.text(lines, cx + cw / 2, cy + (lines.length > 1 ? 8 : 9.3), { align: "center", lineHeightFactor: 1.05 });
  });

  // Reference + amount strip
  let y = gy + ch * 2 + 4;
  fill(doc, C.goldTint); draw(doc, C.gold); doc.setLineWidth(0.3);
  doc.roundedRect(m, y, inner, 14, 1.5, 1.5, "FD");
  ink(doc, C.sub); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text("PAYMENT REFERENCE", m + inner * 0.25, y + 4.5, { align: "center" });
  doc.text("AMOUNT PAYABLE", m + inner * 0.75, y + 4.5, { align: "center" });
  ink(doc, C.green); doc.setFont("times", "bold"); doc.setFontSize(14);
  doc.text(na(d.reference), m + inner * 0.25, y + 11, { align: "center" });
  doc.text(`Rs. ${d.fee}`, m + inner * 0.75, y + 11, { align: "center" });
  draw(doc, C.gold); doc.setLineWidth(0.2); doc.line(m + inner / 2, y + 2.5, m + inner / 2, y + 11.5);
  y += 19;

  // Pay to
  ink(doc, C.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("PAY TO", w / 2, y, { align: "center" });
  y += 4.2;
  ink(doc, C.sub); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  const pl = paymentLines(d.methods).flatMap((l) => doc.splitTextToSize(l, inner - 10)).slice(0, 5);
  doc.text(pl, w / 2, y, { align: "center", lineHeightFactor: 1.35 });
  y += pl.length * 3.6 + 2;

  ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  const note = doc.splitTextToSize(
    `Pay on or before ${d.deadline}. Write the payment reference on your receipt and keep it for record. Your application is processed after the school confirms the payment.`,
    inner - 10,
  ).slice(0, 3);
  doc.text(note, w / 2, y, { align: "center", lineHeightFactor: 1.3 });

  // Signatures
  const sy = y0 + H - 8;
  draw(doc, C.sub); doc.setLineWidth(0.25);
  doc.line(m + 10, sy, m + 55, sy); doc.line(w - m - 55, sy, w - m - 10, sy);
  ink(doc, C.muted); doc.setFont("times", "italic"); doc.setFontSize(8);
  doc.text("Applicant Signature", m + 32.5, sy + 4, { align: "center" });
  doc.text(copy === "School Copy" ? "Received by" : "Cashier", w - m - 32.5, sy + 4, { align: "center" });
}

export async function downloadFeeChallan(d: ChallanData) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawChallanCopy(doc, autoTable, d, 8, "Applicant Copy");
  draw(doc, C.muted); doc.setLineWidth(0.2);
  (doc as unknown as { setLineDashPattern: (a: number[], b: number) => void }).setLineDashPattern([2, 2], 0);
  doc.line(8, 148.5, 202, 148.5);
  (doc as unknown as { setLineDashPattern: (a: number[], b: number) => void }).setLineDashPattern([], 0);
  drawChallanCopy(doc, autoTable, d, 159, "School Copy");
  doc.save(`Fee-Challan-${d.trackingId}.pdf`);
}

// ───────────────────────── Application Form ─────────────────────────
export interface ApplicationFormData {
  cycle: string;
  trackingId: string;
  paymentStatus: string;
  reference: string;
  fee: number;
  sections: { title: string; rows: [string, string][] }[];
  declaration: string;
}

export async function downloadApplicationForm(d: ApplicationFormData) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = 210, m = 12, inner = w - m * 2;

  header(doc, 8, m, inner, w, "DISTRICT MOHMAND  |  KHYBER PAKHTUNKHWA");
  ink(doc, C.ink); doc.setFont("times", "bold"); doc.setFontSize(16);
  doc.text("APPLICATION FORM", w / 2, 32, { align: "center" });
  ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(d.cycle, w / 2, 37, { align: "center" });

  // Key strip
  const strip: [string, string][] = [
    ["TRACKING ID", d.trackingId],
    ["PAYMENT STATUS", d.paymentStatus],
    ["PAYMENT REFERENCE", na(d.reference)],
    ["PROCESSING FEE", `Rs. ${d.fee}`],
  ];
  const cw = inner / 4;
  strip.forEach(([label, value], i) => {
    const cx = m + i * cw;
    fill(doc, i % 2 === 0 ? C.goldTint : C.white); draw(doc, C.gold); doc.setLineWidth(0.25);
    doc.rect(cx, 41, cw, 13, "FD");
    ink(doc, C.muted); doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.text(label, cx + cw / 2, 45.5, { align: "center" });
    ink(doc, C.green); doc.setFont("times", "bold"); doc.setFontSize(10);
    doc.text(value, cx + cw / 2, 51, { align: "center", maxWidth: cw - 3 });
  });

  let y = 60;
  d.sections.forEach((s) => {
    const body: string[][] = [];
    for (let i = 0; i < s.rows.length; i += 2) {
      const a = s.rows[i], b = s.rows[i + 1];
      body.push([a[0], na(a[1]), b ? b[0] : "", b ? na(b[1]) : ""]);
    }
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      tableWidth: inner,
      theme: "grid",
      head: [[{ content: s.title.toUpperCase(), colSpan: 4, styles: { halign: "center" } }]],
      body,
      styles: { font: "helvetica", fontSize: 8.5, halign: "center", valign: "middle", cellPadding: 2, lineColor: C.grid, lineWidth: 0.15, textColor: C.ink },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 8, lineColor: C.green },
      columnStyles: {
        0: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.5 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.5 },
        3: { cellWidth: "auto" },
      },
    } as never);
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20) + 5;
  });

  if (y > 250) { doc.addPage(); y = 20; }
  ink(doc, C.sub); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("DECLARATION", w / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const dl = doc.splitTextToSize(d.declaration, inner - 10);
  doc.text(dl, w / 2, y + 4.5, { align: "center", lineHeightFactor: 1.35 });
  y += 4.5 + dl.length * 4 + 14;

  if (y > 275) { doc.addPage(); y = 30; }
  draw(doc, C.sub); doc.setLineWidth(0.25);
  doc.line(m + 8, y, m + 62, y); doc.line(w - m - 62, y, w - m - 8, y);
  ink(doc, C.muted); doc.setFont("times", "italic"); doc.setFontSize(8);
  doc.text("Applicant Signature", m + 35, y + 4, { align: "center" });
  doc.text("Admission Incharge", w - m - 35, y + 4, { align: "center" });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(`Application ${d.trackingId}   |   Page ${p} of ${pages}`, w / 2, 291, { align: "center" });
  }
  doc.save(`Application-${d.trackingId}.pdf`);
}
