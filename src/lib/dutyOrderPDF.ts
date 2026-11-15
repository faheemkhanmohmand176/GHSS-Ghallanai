// src/lib/dutyOrderPDF.ts — A4 duty order built ONLY from what BISE Peshawar returns.
// Every word, number, date and the signature image come from the board's own letter.
// This file adds styling (type, spacing, gold hairlines) — never content.
import { formatPkMobile, type DrawDetails } from "@/hooks/useDrawLookup";
import { groupRows, lineText, type LetterLine, type LetterRow, type LetterRun } from "@/lib/letterModel";

type RGB = [number, number, number];
const A4_W = 595.28, A4_H = 841.89, M = 42;
const W = A4_W - M * 2;
const GOLD: RGB = [196, 150, 40];
const GREEN: RGB = [20, 88, 62];
const INK: RGB = [24, 32, 40];
const MUTED: RGB = [110, 120, 128];

export interface DutyOrderInput { letter?: LetterLine[] | null; details: DrawDetails; dutyLabel?: string; session?: string }

export async function downloadDutyOrderPDF({ letter, details, dutyLabel, session }: DutyOrderInput) {
  const { jsPDF } = await import("jspdf");
  const d = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const ink = (c: RGB) => d.setTextColor(c[0], c[1], c[2]);
  const stroke = (c: RGB, w = 0.6) => { d.setDrawColor(c[0], c[1], c[2]); d.setLineWidth(w); };
  const mid = A4_W / 2;

  const frame = () => {
    stroke(GOLD, 1); d.rect(20, 20, A4_W - 40, A4_H - 40);
    stroke([225, 210, 160], 0.5); d.rect(25, 25, A4_W - 50, A4_H - 50);
  };

  // ───────────────────────── fallback: verified fields only ─────────────────────────
  if (!letter || letter.length < 5) {
    frame();
    ink(GREEN); d.setFont("times", "bold"); d.setFontSize(15);
    d.text("BOARD OF INTERMEDIATE AND SECONDARY EDUCATION PESHAWAR", mid, 74, { align: "center", maxWidth: W });
    stroke(GOLD, 1); d.line(mid - 50, 90, mid + 50, 90);
    ink(MUTED); d.setFont("helvetica", "normal"); d.setFontSize(10);
    d.text([session, dutyLabel].filter(Boolean).join("  -  "), mid, 108, { align: "center" });
    const rows: [string, string | undefined][] = [
      ["Name", details.name], ["Designation", details.designation], ["Address", details.institute],
      ["Center No", details.centerNo], ["Contact", formatPkMobile(details.mobile)], ["Appointed As", details.appointedAs],
    ];
    let y = 140;
    rows.filter(([, v]) => v).forEach(([k, v]) => {
      const ls: string[] = d.splitTextToSize(String(v), W - 150);
      const h = Math.max(30, ls.length * 14 + 14);
      stroke([215, 222, 216], 0.6); d.rect(M, y, W, h); d.line(M + 130, y, M + 130, y + h);
      ink(GREEN); d.setFont("helvetica", "bold"); d.setFontSize(9); d.text(k.toUpperCase(), M + 12, y + h / 2 + 3);
      ink(INK); d.setFontSize(11); d.text(ls, M + 142, y + h / 2 - (ls.length - 1) * 7 + 4);
      y += h;
    });
    save(d, details.name);
    return;
  }

  // ───────────────────────── the board's letter, verbatim ─────────────────────────
  const rows: LetterRow[] = groupRows(letter);

  type Word = { w: number; t: string; b: boolean; u: boolean; space: number };
  const wrap = (runs: LetterRun[], width: number, fs: number, font: string): Word[][] => {
    const lines: Word[][] = [[]]; let x = 0;
    d.setFontSize(fs);
    runs.forEach((r) => {
      d.setFont(font, r.b ? "bold" : "normal");
      const sp = d.getTextWidth(" ");
      r.t.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { if (x > 0) x += sp; return; }
        const w = d.getTextWidth(tok);
        if (x > 0 && x + w > width + 0.5) { lines.push([]); x = 0; }
        const cur = lines[lines.length - 1];
        cur.push({ w, t: tok, b: !!r.b, u: !!r.u, space: sp });
        x += w;
      });
    });
    return lines.filter((l) => l.length);
  };
  type Seg = { t: string; b: boolean; u: boolean; sp: boolean };
  const toSegs = (ws: Word[]): Seg[] => {
    const segs: Seg[] = [];
    ws.forEach((w, i) => {
      const last = segs[segs.length - 1];
      if (last && last.b === w.b && last.u === w.u) last.t += " " + w.t;
      else segs.push({ t: w.t, b: w.b, u: w.u, sp: i > 0 });
    });
    return segs;
  };
  // a style change keeps its word-space: measured explicitly (never as a trailing char)
  const spaceW = () => d.getTextWidth("a a") - d.getTextWidth("aa");
  const segW = (segs: Seg[], font: string, fs: number) => {
    d.setFontSize(fs);
    return segs.reduce((a, g) => {
      d.setFont(font, g.b ? "bold" : "normal");
      return a + (g.sp ? spaceW() : 0) + d.getTextWidth(g.t);
    }, 0);
  };

  const layout = (fs: number, draw: boolean) => {
    const lh = fs * 1.36;
    const top = 44, bottom = A4_H - 44;
    let y = top; let page = 1;
    const ensure = (h: number) => { if (draw && y + h > bottom) { d.addPage(); frame(); page += 1; y = top; } else if (!draw && y + h > bottom) { page += 1; y = top; } };
    rows.forEach((row, ri) => {
      const isTitle = ri === 0;
      const rfs = isTitle ? fs + 3.5 : fs;
      const rlh = rfs * 1.36;
      const font = isTitle ? "times" : "helvetica";
      const gap = row.narrowFirst ? 2 : fs * 0.38;
      const total = row.cols.reduce((a, c) => a + c.weight, 0);
      const colW = row.narrowFirst
        ? [28, ...row.cols.slice(1).map((c) => (c.weight / (total - row.cols[0].weight)) * (W - 28))]
        : row.cols.map((c) => (c.weight / total) * W);
      const colX = colW.map((_, i) => M + colW.slice(0, i).reduce((a, b) => a + b, 0));
      // measure each column
      const built = row.cols.map((c, i) => {
        const items = c.lines.map((l) => {
          if (l.img) return { kind: "img" as const, l, h: 38 };
          const ws = wrap(l.runs || [], colW[i] - (i < row.cols.length - 1 ? 8 : 0), rfs, font);
          return { kind: "txt" as const, l, ws, h: ws.length * rlh };
        });
        return { items, h: items.reduce((a, it) => a + it.h, 0) };
      });
      const rowH = Math.max(...built.map((b) => b.h), 0);
      const onlyDashes = row.cols.length === 1 && /^[-–—_=\s]{12,}$/.test(lineText(row.cols[0].lines[0] || ({} as LetterLine)));
      const h = onlyDashes ? rlh : rowH;
      ensure(h + gap);
      if (draw) {
        if (onlyDashes) {
          stroke([190, 190, 190], 0.6); d.setLineDashPattern([3, 3], 0); d.line(M, y + rlh / 2, M + W, y + rlh / 2); d.setLineDashPattern([], 0);
        } else {
          built.forEach((b, i) => {
            let yy = y;
            b.items.forEach((it) => {
              if (it.kind === "img") {
                try {
                  const p = d.getImageProperties(it.l.img!);
                  const ih = 36, iw = Math.min(colW[i] - 8, (p.width / p.height) * ih);
                  const ix = it.l.center ? colX[i] + (colW[i] - iw) / 2 : colX[i];
                  d.addImage(it.l.img!, p.fileType, ix, yy + 1, iw, ih);
                } catch { /* unreadable image → skipped, never replaced */ }
                yy += it.h; return;
              }
              it.ws.forEach((ws) => {
                const segs = toSegs(ws);
                const lw = segW(segs, font, rfs);
                let x = it.l.center ? colX[i] + (colW[i] - lw) / 2 : colX[i];
                const base = yy + rfs;
                segs.forEach((g) => {
                  d.setFont(font, g.b ? "bold" : "normal"); d.setFontSize(rfs);
                  if (g.sp) x += spaceW();
                  ink(isTitle ? GREEN : INK);
                  d.text(g.t, x, base);
                  const gw = d.getTextWidth(g.t);
                  if (g.u) { stroke(isTitle ? GREEN : INK, 0.6); d.line(x, base + 1.6, x + gw, base + 1.6); }
                  x += gw;
                });
                yy += rlh;
              });
            });
          });
        }
        if (isTitle) { stroke(GOLD, 1.1); d.line(mid - 60, y + h + 3, mid + 60, y + h + 3); }
      }
      y += h + gap + (isTitle ? 10 : 0);
    });
    void lh;
    return { y, page };
  };

  // choose the largest size that keeps the whole letter on a single A4 page
  let fs = 10.5;
  for (; fs > 8; fs -= 0.25) { if (layout(fs, false).page === 1) break; }
  frame();
  layout(fs, true);
  save(d, details.name);
}

function save(d: import("jspdf").jsPDF, name?: string) {
  const safe = (name || "Duty").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  d.save(`Duty-Order-${safe || "Staff"}.pdf`);
}
