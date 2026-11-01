// src/lib/classOrder.ts
//
// GHSS Ghallanai only has two classes: "1st Year" (HSSC Part-I / 11th) and
// "2nd Year" (HSSC Part-II / 12th). Class names are strings, so numeric
// sorting such as Number("1st Year") yields NaN — use these helpers instead.

/** Sort rank for a class label: 1st Year → 1, 2nd Year → 2, anything else last. */
export function classRank(raw: unknown): number {
  const s = String(raw ?? "").trim().toLowerCase();
  if (/^(1st|first|xi\b|11)/.test(s)) return 1;
  if (/^(2nd|second|xii\b|12)/.test(s)) return 2;
  return 99;
}

/** Array.sort comparator for class labels (1st Year before 2nd Year). */
export function sortClassNames(a: unknown, b: unknown): number {
  return classRank(a) - classRank(b) || String(a ?? "").localeCompare(String(b ?? ""));
}

/** Normalises legacy / free-text class input to "1st Year" | "2nd Year" (or returns the trimmed input). */
export function normalizeYearLabel(raw: string): string {
  const s = String(raw ?? "").trim();
  const r = classRank(s);
  return r === 1 ? "1st Year" : r === 2 ? "2nd Year" : s;
}
