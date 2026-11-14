// src/lib/dutyOrderPDF.ts — premium A4 "Duty Order" (jsPDF, lazy-loaded).
// A4 portrait 595.28 × 841.89 pt, identical left/right margins so everything
// is mathematically centred. Palette matches the site: deep green + gold.
import { formatPkMobile, type DrawDetails } from "@/hooks/useDrawLookup";

type RGB = [number, number, number];
const A4_W = 595.28;
const A4_H = 841.89;
const M = 40;
const W = A4_W - M * 2;
const C = {
  greenDeep: [12, 58, 40] as RGB,
  green: [22, 101, 72] as RGB,
  greenSoft: [236, 246, 240] as RGB,
  gold: [184, 134, 11] as RGB,
  goldLine: [212, 175, 55] as RGB,
  goldSoft: [251, 243, 214] as RGB,
  ink: [15, 23, 42] as RGB,
  text: [30, 41, 59] as RGB,
  muted: [100, 116, 139] as RGB,
  border: [205, 218, 210] as RGB,
  white: [255, 255, 255] as RGB,
};

export interface DutyOrderInput {
  details: DrawDetails;
  session?: string;
  dutyLabel: string;
  schoolName?: string;
}

export async function downloadDutyOrderPDF({ details, session, dutyLabel, schoolName }: DutyOrderInput) {
  const { jsPDF } = await import("jspdf");
  const d = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const fill = (c: RGB) => d.setFillColor(c[0], c[1], c[2]);
  const line = (c: RGB, w = 0.6) => { d.setDrawColor(c[0], c[1], c[2]); d.setLineWidth(w); };
  const ink = (c: RGB) => d.setTextColor(c[0], c[1], c[2]);
  const mid = A4_W / 2;

  // ── page frame ──
  line(C.goldLine, 1.2); d.rect(18, 18, A4_W - 36, A4_H - 36);
  line(C.border, 0.5); d.rect(23, 23, A4_W - 46, A4_H - 46);

  // ── header (light ivory — no heavy fills) ──
  fill([252, 249, 238]); d.rect(23, 23, A4_W - 46, 104, "F");
  fill(C.goldLine); d.rect(23, 127, A4_W - 46, 2, "F");
  fill(C.goldLine); d.rect(23, 131, A4_W - 46, 0.8, "F");
  ink(C.gold); d.setFont("times", "bold"); d.setFontSize(9.5);
  d.text("GOVERNMENT OF KHYBER PAKHTUNKHWA", mid, 50, { align: "center", charSpace: 1.8 });
  ink(C.greenDeep); d.setFont("times", "bold"); d.setFontSize(18.5);
  const name = (schoolName || "Government Higher Secondary School Ghallanai").toUpperCase();
  const nameLines: string[] = d.splitTextToSize(name, W - 20);
  d.text(nameLines, mid, 74, { align: "center" });
  ink(C.muted); d.setFont("helvetica", "normal"); d.setFontSize(9.5);
  d.text("District Mohmand  |  Khyber Pakhtunkhwa, Pakistan", mid, 74 + nameLines.length * 19 + 2, { align: "center" });

  // ── title ──
  let y = 176;
  ink(C.greenDeep); d.setFont("times", "bold"); d.setFontSize(27);
  d.text("DUTY ORDER", mid, y, { align: "center", charSpace: 3 });
  y += 14;
  line(C.goldLine, 1); d.line(mid - 70, y, mid - 8, y); d.line(mid + 8, y, mid + 70, y);
  fill(C.goldLine); d.rect(mid - 3, y - 3, 6, 6, "F");
  y += 22;
  ink(C.green); d.setFont("times", "italic"); d.setFontSize(13);
  d.text(`${session || "BISE Peshawar"}  -  ${dutyLabel}`, mid, y, { align: "center" });
  y += 16;
  ink(C.muted); d.setFont("helvetica", "normal"); d.setFontSize(9);
  d.text("Online Computerized Supervisory Draw  |  Board of Intermediate & Secondary Education Peshawar", mid, y, { align: "center" });

  // ── appointment highlight ──
  y += 24;
  const appt = details.appointedAs || "Appointed";
  fill(C.goldSoft); line(C.goldLine, 0.9);
  d.roundedRect(M + 60, y, W - 120, 64, 8, 8, "FD");
  ink(C.gold); d.setFont("helvetica", "bold"); d.setFontSize(8.5);
  d.text("APPOINTED AS", mid, y + 19, { align: "center", charSpace: 2.2 });
  ink(C.greenDeep); d.setFont("times", "bold");
  let fs = 22; d.setFontSize(fs);
  while (d.getTextWidth(appt) > W - 150 && fs > 12) { fs -= 1; d.setFontSize(fs); }
  d.text(appt, mid, y + 46, { align: "center" });
  y += 90;

  // ── details table ──
  const rows: [string, string | undefined][] = [
    ["Name", details.name],
    ["Designation", details.designation],
    ["Institute / Address", details.institute],
    ["Center No", details.centerNo],
    ["Mobile No", formatPkMobile(details.mobile)],
    ["Duty Type", dutyLabel],
    ["Draw Session", session || "BISE Peshawar"],
    ["Date of Issue", new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ];
  const labelW = 150;
  d.setFont("helvetica", "bold"); d.setFontSize(8.5);
  ink(C.green); d.text("DUTY DETAILS", M, y, { charSpace: 1.8 });
  y += 8;
  rows.filter(([, v]) => v).forEach(([label, val], i) => {
    d.setFont("helvetica", "bold"); d.setFontSize(11);
    const lines: string[] = d.splitTextToSize(String(val), W - labelW - 24);
    const h = Math.max(28, lines.length * 15 + 13);
    fill(i % 2 ? C.white : C.greenSoft); d.rect(M, y, W, h, "F");
    fill(C.greenSoft); d.rect(M, y, labelW, h, "F");
    line(C.border, 0.6); d.rect(M, y, W, h); d.line(M + labelW, y, M + labelW, y + h);
    ink(C.green); d.setFont("helvetica", "bold"); d.setFontSize(9);
    d.text(label.toUpperCase(), M + 14, y + h / 2 + 3, { charSpace: 0.6 });
    ink(C.ink); d.setFont("helvetica", "bold"); d.setFontSize(11);
    d.text(lines, M + labelW + 14, y + h / 2 - (lines.length - 1) * 7.5 + 4);
    y += h;
  });

  // ── instructions ──
  y += 26;
  ink(C.green); d.setFont("helvetica", "bold"); d.setFontSize(8.5);
  d.text("IMPORTANT NOTES", M, y, { charSpace: 1.8 });
  y += 8; line(C.goldLine, 0.8); d.line(M, y, M + 52, y);
  y += 16;
  const notes = [
    "Report to the allotted examination center in good time, carrying your original CNIC and this duty order.",
    "Follow all instructions issued by the Board of Intermediate & Secondary Education Peshawar for conduct of the examination.",
    "Verify this duty against the Board's official draw record before joining; the Board's decision is final.",
  ];
  d.setFont("helvetica", "normal"); d.setFontSize(10); ink(C.text);
  notes.forEach((n, i) => {
    const ls: string[] = d.splitTextToSize(n, W - 26);
    fill(C.gold); d.circle(M + 6, y - 3, 2.2, "F");
    d.text(ls, M + 20, y);
    y += ls.length * 13.5 + 5;
    void i;
  });

  // ── signatures (appointee, head of institution, board authority) ──
  const sy = A4_H - 124;
  const cols = [M + 62, mid, A4_W - M - 62];
  const labels = [["Signature of Appointee", ""], ["Head of Institution", "(Signature & Stamp)"], ["Controller of Examinations", "BISE Peshawar"]];
  line(C.ink, 0.6);
  cols.forEach((cx, i) => {
    d.line(cx - 60, sy, cx + 60, sy);
    ink(C.text); d.setFont("helvetica", "bold"); d.setFontSize(8.5);
    d.text(labels[i][0], cx, sy + 13, { align: "center" });
    if (labels[i][1]) { ink(C.muted); d.setFont("helvetica", "normal"); d.setFontSize(8); d.text(labels[i][1], cx, sy + 24, { align: "center" }); }
  });

  // ── footer (light) ──
  fill(C.goldLine); d.rect(23, A4_H - 68, A4_W - 46, 1.2, "F");
  fill([252, 249, 238]); d.rect(23, A4_H - 66.8, A4_W - 46, 43.8, "F");
  ink(C.muted); d.setFont("helvetica", "normal"); d.setFontSize(8);
  d.text("Generated from the BISE Peshawar online supervisory draw result", mid, A4_H - 47, { align: "center" });
  ink(C.gold); d.setFont("helvetica", "bold"); d.setFontSize(8);
  d.text("ghssghallanai.dpdns.org/duties", mid, A4_H - 34, { align: "center" });

  const safe = (details.name || "Duty").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  d.save(`Duty-Order-${safe || "Staff"}.pdf`);
}
