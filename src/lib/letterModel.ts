// src/lib/letterModel.ts — shared model for the board's own duty letter.
// The server returns the letter's text VERBATIM as positioned lines. This file only
// groups them into rows/columns for display; it never adds or rewrites any wording.
export interface LetterRun { t: string; b?: 1; u?: 1 }
export interface LetterLine { row: number; col: number; tbl?: number; runs?: LetterRun[]; center?: 1; img?: string }
export interface LetterCol { lines: LetterLine[]; weight: number }
export interface LetterRow { id: number; cols: LetterCol[]; narrowFirst: boolean }

export const lineText = (l: LetterLine) => (l.runs || []).map((r) => r.t).join("");

export function groupRows(lines: LetterLine[]): LetterRow[] {
  const order: number[] = [];
  const byRow = new Map<number, LetterLine[]>();
  for (const l of lines) {
    if (!byRow.has(l.row)) { byRow.set(l.row, []); order.push(l.row); }
    byRow.get(l.row)!.push(l);
  }
  // column geometry is shared by every row of the same table, so columns line up
  const tblLens = new Map<number, number[]>();
  const len = (l: LetterLine) => (l.img ? 24 : lineText(l).length);
  for (const l of lines) {
    if (!l.tbl) continue;
    const a = tblLens.get(l.tbl) ?? [];
    while (a.length <= l.col) a.push(0);
    a[l.col] = Math.max(a[l.col], len(l));
    tblLens.set(l.tbl, a);
  }
  return order.map((id) => {
    const ls = byRow.get(id)!;
    const tbl = ls[0].tbl || 0;
    const rowN = Math.max(...ls.map((l) => l.col)) + 1;
    const tl = tbl ? tblLens.get(tbl)! : null;
    // a lone cell inside a multi-column table is a colspan row → full width
    const n = tl && rowN > 1 ? tl.length : rowN;
    const lens = tl && rowN > 1 ? tl : Array.from({ length: n }, (_, i) => Math.max(0, ...ls.filter((l) => l.col === i).map(len)));
    const cols: LetterCol[] = Array.from({ length: n }, () => ({ lines: [], weight: 0 }));
    ls.forEach((l) => cols[l.col].lines.push(l));
    const narrowFirst = n > 1 && lens[0] > 0 && lens[0] <= 4;
    const maxLen = Math.max(...lens, 1);
    cols.forEach((c, i) => {
      c.weight = narrowFirst && i === 0 ? 0.06 : Math.max(8, Math.min(lens[i] || maxLen, 28));
    });
    return { id, cols, narrowFirst };
  });
}

/** Facts read straight out of the letter's own sentences (each only if present). */
export function letterFacts(lines: LetterLine[]) {
  const text = lines.filter((l) => l.runs).map(lineText).join("\n");
  const flat = text.replace(/\s+/g, " ");
  const pick = (re: RegExp) => (flat.match(re)?.[1] || "").trim() || undefined;
  return {
    ref: pick(/\bNo\.\s*([^\s]+)/),
    dated: pick(/Dated:\s*([\d-]+)/),
    cnic: pick(/CNIC\s*:\s*(\d{13})/),
    centerName: pick(/Center Name\s*:\s*(.+?)\.\s+You have been/i) || pick(/Center Name\s*:\s*([^.]+)\./i),
    drawDate: pick(/draw held on\s+(.+?)\s+in the/i),
    reportDate: pick(/reach the Examination Centre on\s*([\d-]+)/i),
    reportTime: pick(/reach the Examination Centre on\s*[\d-]+\s*at\s*([\d:]+\s*[AP]M)/i),
    commencing: pick(/COMMENCING ON\s+(.+?)(?:\s+Memo|$)/i),
  };
}
