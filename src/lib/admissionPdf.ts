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
  /** Institution name used in the undertaking / header strip. */
  institution?: string;
  /** Applicant portal username (CNIC). */
  username?: string;
  /** Payment deadline, e.g. "05 November 2026". */
  deadline?: string;
  /** Date the application was submitted. */
  appliedOn?: string;
  /** Applicant details for the affidavit and undertaking pages. */
  applicant?: { name: string; fatherName: string; cnic: string; address: string; program: string };
  /** Document checklist lines (defaults provided). */
  checklist?: string[];
}

const DEFAULT_CHECKLIST = [
  "This online application form (printed) and the Fee Challan receipt.",
  "All original documents for verification.",
  "Four recent passport size photographs (white background).",
  "Undertaking and Affidavit on this form, signed by the applicant and the father/guardian.",
  "Attested copies of SSC DMC/certificate, Character Certificate, Domicile, applicant CNIC/Form-B and father CNIC.",
  "Certificate for any quota claimed (Sports / Hafiz-e-Quran / College Employee / Disabled / Parent-Spouse Service).",
  "Original Migration Certificate, if SSC or Intermediate was passed from another Board.",
];

export async function downloadApplicationForm(d: ApplicationFormData) {
  const { jsPDF, autoTable } = await lib();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = 210, m = 12, inner = w - m * 2;
  const inst = d.institution || SCHOOL;
  const lastY = (fallback: number) =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
  const ensure = (y: number, need: number, top = 16) => {
    if (y + need > 282) { doc.addPage(); return top; }
    return y;
  };
  const sigLine = (x1: number, x2: number, y: number, label: string) => {
    draw(doc, C.sub); doc.setLineWidth(0.25); doc.line(x1, y, x2, y);
    ink(doc, C.muted); doc.setFont("times", "italic"); doc.setFontSize(8);
    doc.text(label, (x1 + x2) / 2, y + 4, { align: "center" });
  };
  const sectionBar = (y: number, title: string) => {
    fill(doc, C.green); doc.roundedRect(m, y, inner, 6.5, 1.2, 1.2, "F");
    ink(doc, C.white); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(title.toUpperCase(), w / 2, y + 4.4, { align: "center" });
    return y + 9.5;
  };
  const para = (text: string, y: number, size = 8.2, width = inner - 4) => {
    ink(doc, C.ink); doc.setFont("helvetica", "normal"); doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, m + 2, y, { lineHeightFactor: 1.4 });
    return y + lines.length * (size * 0.4 * 1.4) + 2;
  };

  // ── Page 1: header, photo box, key details ──
  header(doc, 8, m, inner, w, "DISTRICT MOHMAND  |  KHYBER PAKHTUNKHWA");
  ink(doc, C.ink); doc.setFont("times", "bold"); doc.setFontSize(16);
  doc.text("APPLICATION FORM", m + (inner - 34) / 2, 32, { align: "center" });
  ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(d.cycle, m + (inner - 34) / 2, 37, { align: "center" });

  // Photo box (right)
  const px = w - m - 30, py = 26;
  draw(doc, C.gold); doc.setLineWidth(0.4); fill(doc, C.white);
  (doc as unknown as { setLineDashPattern: (a: number[], b: number) => void }).setLineDashPattern([1.5, 1.2], 0);
  doc.rect(px, py, 30, 36, "FD");
  (doc as unknown as { setLineDashPattern: (a: number[], b: number) => void }).setLineDashPattern([], 0);
  ink(doc, C.muted); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(["ATTACH", "PASSPORT SIZE", "PHOTO", "(white background)"], px + 15, py + 13, { align: "center", lineHeightFactor: 1.5 });

  // Key strip (2 x 3 grid, left of the photo box)
  const strip: [string, string][] = [
    ["TRACKING ID", d.trackingId],
    ["USERNAME", na(d.username)],
    ["PAYMENT STATUS", d.paymentStatus],
    ["PAYMENT TOKEN", na(d.reference)],
    ["PROCESSING FEE", `Rs. ${d.fee}`],
    ["PAY BEFORE", na(d.deadline)],
  ];
  const gw = inner - 34, cw = gw / 2, ch = 7.6, gy = 41;
  strip.forEach(([label, value], i) => {
    const cx = m + (i % 2) * cw, cy = gy + Math.floor(i / 2) * ch;
    fill(doc, Math.floor(i / 2) % 2 === 0 ? C.goldTint : C.white); draw(doc, C.gold); doc.setLineWidth(0.25);
    doc.rect(cx, cy, cw, ch, "FD");
    ink(doc, C.muted); doc.setFont("helvetica", "bold"); doc.setFontSize(5.8);
    doc.text(label, cx + 2, cy + 3);
    ink(doc, C.green); doc.setFont("times", "bold"); doc.setFontSize(9.5);
    doc.text(value, cx + 2, cy + 6.4, { maxWidth: cw - 4 });
  });

  ink(doc, C.sub); doc.setFont("helvetica", "italic"); doc.setFontSize(7);
  const tokenNote = doc.splitTextToSize(
    `The processing fee token must be paid at any JazzCash shop or through the JazzCash App on or before ${na(d.deadline)}. Applications are considered in Open Merit unless a quota is claimed.`,
    inner,
  );
  doc.text(tokenNote, m, 66, { lineHeightFactor: 1.3 });

  let y = 66 + tokenNote.length * 3.2 + 2;
  d.sections.forEach((sec) => {
    const body: string[][] = [];
    for (let i = 0; i < sec.rows.length; i += 2) {
      const a = sec.rows[i], b = sec.rows[i + 1];
      body.push([a[0], na(a[1]), b ? b[0] : "", b && b[0] ? na(b[1]) : ""]);
    }
    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      tableWidth: inner,
      theme: "grid",
      head: [[{ content: sec.title.toUpperCase(), colSpan: 4, styles: { halign: "center" } }]],
      body,
      styles: { font: "helvetica", fontSize: 8.2, halign: "center", valign: "middle", cellPadding: 1.7, lineColor: C.grid, lineWidth: 0.15, textColor: C.ink },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 8, lineColor: C.green },
      columnStyles: {
        0: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.3 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.3 },
        3: { cellWidth: "auto" },
      },
    } as never);
    y = lastY(y + 20) + 4;
  });

  // ── Documents checklist ──
  const list = d.checklist && d.checklist.length ? d.checklist : DEFAULT_CHECKLIST;
  const listLines = list.map((t) => doc.splitTextToSize(t, inner - 14) as string[]);
  const listH = listLines.reduce((n, l) => n + l.length * 3.7 + 1.2, 0) + 18;
  y = ensure(y, listH);
  y = sectionBar(y, "Documents Checklist (bring with this form)");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  list.forEach((_, i) => {
    const lines = listLines[i];
    draw(doc, C.green); doc.setLineWidth(0.3); doc.rect(m + 2, y - 2.7, 3, 3);
    ink(doc, C.ink); doc.text(lines, m + 8, y, { lineHeightFactor: 1.3 });
    y += lines.length * 3.7 + 1.2;
  });
  ink(doc, C.sub); doc.setFont("helvetica", "italic"); doc.setFontSize(7.2);
  doc.text("Note: Hafiz-e-Quran marks are awarded only after passing the Hifz test.", m + 2, y + 1);
  y += 7;

  // ── Declaration + signatures ──
  y = ensure(y, 40);
  y = sectionBar(y, "Declaration");
  y = para(d.declaration, y, 8.2);
  y += 9;
  sigLine(m + 2, m + 58, y, "Applicant Signature");
  sigLine(m + 74, m + 130, y, "Parent / Guardian Signature");
  ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Date: ____ / ____ / ________", w - m - 2, y - 1, { align: "right" });
  y += 11;

  // ── Office use box ──
  y = ensure(y, 32);
  fill(doc, C.alt); draw(doc, C.gold); doc.setLineWidth(0.3);
  doc.roundedRect(m, y, inner, 30, 1.5, 1.5, "FD");
  ink(doc, C.sub); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("FOR OFFICE USE ONLY", m + 3, y + 5);
  ink(doc, C.ink); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Roll No.: ____________________", w - m - 3, y + 5, { align: "right" });
  sigLine(m + 6, m + 52, y + 22, "Member 1");
  sigLine(m + 62, m + 108, y + 22, "Member 2");
  sigLine(m + 118, m + 164, y + 22, "Chairman");

  // ── Page 2: Affidavit, Undertaking, Endorsement, Witnesses ──
  const ap = d.applicant;
  const nm = ap?.name || "____________________";
  const fn = ap?.fatherName || "____________________";
  y += 38;
  y = ensure(y, 22, 16);
  y = sectionBar(y, "Affidavit");
  y = para(
    `Certified that I ${nm} had not taken admission in the same level of studies in any other institution during the previous year(s). It is further certified that till date I am not registered with any Education Board for the same class or level of studies. In this respect, if my statement is found incorrect at any stage, my right of admission or even admission shall stand cancelled without any further notice.`,
    y,
  );
  y += 0;

  y = ensure(y, 36, 16);
  y = sectionBar(y, "Undertaking");
  y = para(
    `In compliance with the order of the Supreme Court of Pakistan, I, Mr./Mrs. ${nm} Son/Ward of ${fn}, candidate for admission to ${ap?.program || "Intermediate"} at ${inst}, do hereby undertake that, after my admission and during the course of my studies, I shall not indulge in politics. In case I violate this undertaking, I shall be expelled without any further notice from the Principal. Furthermore, the finding with regard to my "indulgence in politics" given by the Principal under his seal and signature shall be final and shall not be questioned except only before the Supreme Court of Pakistan.`,
    y,
  );
  y += 1;

  const idRows = (who: string, name: string, father: string, cnic: string, addr: string) => {
    y = ensure(y, 30, 16);
    autoTable(doc, {
      startY: y, margin: { left: m, right: m }, tableWidth: inner, theme: "grid",
      head: [[{ content: who, colSpan: 4, styles: { halign: "center" } }]],
      body: [[ "Student Name", name || " ", "National Identity Card / Reg. No.", cnic || " " ],
             [ "Father's/Guardian's Name", father || " ", "Permanent Address", addr || " " ],
             [ "Dated", " ", "Signature", " " ]],
      styles: { font: "helvetica", fontSize: 8, halign: "center", valign: "middle", cellPadding: 1.6, lineColor: C.grid, lineWidth: 0.15, textColor: C.ink, minCellHeight: 6.5 },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 7.5, lineColor: C.green },
      columnStyles: {
        0: { cellWidth: 36, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.2 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 40, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.2 },
        3: { cellWidth: "auto" },
      },
    } as never);
    y = lastY(y + 25) + 3;
  };
  idRows("DEPONENT — SIGNATURE OF STUDENT", nm, fn, ap?.cnic || "", ap?.address || "");

  y = ensure(y, 34, 16);
  y = sectionBar(y, "Endorsement by Father / Guardian");
  y = para(
    `I, Mr./Mrs. ${fn} Son/Wife of ____________________ Father/Guardian of ${nm} hereby fully endorse the undertaking by my son/ward and assure that he shall abide by this undertaking during his stay at the institution. In case my son/ward indulges in politics, the finding with regard to which given by the Principal under his seal and signature shall be final and shall not be questioned except only before the Supreme Court of Pakistan, he shall be expelled without any further notice.`,
    y,
  );
  y += 1;
  idRows("DEPONENT — SIGNATURE OF FATHER / GUARDIAN", nm, fn, "", "");

  // Witnesses
  y = ensure(y, 46, 20);
  y = sectionBar(y, "Witnesses");
  const wit = (n: number) => [`Witness No. ${n} Name`, " ", "Father Name", " ", "National Identity No.", " ", "Permanent Address", " ", "Signature", " "];
  const wb: string[][] = [];
  const labels = ["Name", "Father Name", "National Identity No.", "Permanent Address", "Signature"];
  labels.forEach((l) => wb.push([l, " ", l, " "]));
  void wit;
  autoTable(doc, {
    startY: y, margin: { left: m, right: m }, tableWidth: inner, theme: "grid",
    head: [[{ content: "WITNESS NO. 1", colSpan: 2, styles: { halign: "center" } }, { content: "WITNESS NO. 2", colSpan: 2, styles: { halign: "center" } }]],
    body: wb,
    styles: { font: "helvetica", fontSize: 8, halign: "center", valign: "middle", cellPadding: 1.4, lineColor: C.grid, lineWidth: 0.15, textColor: C.ink, minCellHeight: 6.3 },
    headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 7.5, lineColor: C.green },
    columnStyles: {
      0: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.2 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 34, fillColor: C.alt, fontStyle: "bold", textColor: C.sub, fontSize: 7.2 },
      3: { cellWidth: "auto" },
    },
  } as never);
  y = lastY(y + 50) + 10;

  y = ensure(y, 10, 24);
  sigLine(w - m - 90, w - m - 6, y, "Attested (Signature & Seal of the Competent Authority)");

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    ink(doc, C.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(`${inst}   |   Application ${d.trackingId}   |   Page ${pg} of ${pages}`, w / 2, 291, { align: "center" });
  }
  doc.save(`Application-${d.trackingId}.pdf`);
}
