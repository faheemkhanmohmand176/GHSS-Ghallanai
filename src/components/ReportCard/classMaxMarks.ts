// src/components/ReportCard/classMaxMarks.ts
// Fixed total marks per class for BISE Peshawar HSSC results — confirmed and
// used everywhere in this school's reporting: 1st Year (Part-I) and 2nd Year
// (Part-II) papers total 550 marks each for the standard BISE Peshawar groups
// (Pre-Medical / Pre-Engineering / ICS / Humanities). These are NOT
// configurable in the UI on purpose: they don't vary by year or admin, so a
// settings field would only add a place to get it wrong. If the board ever
// changes these totals, update the two constants below — every percentage
// calculation across the Report Card and Merit List features reads from here.
import type { ClassName } from "./types";

export const CLASS_MAX_MARKS: Record<ClassName, number> = {
  "1st Year": 550,
  "2nd Year": 550,
};

/** Human label for titles: returns the class name as-is (1st Year / 2nd Year
 *  already read naturally and never need a "Class" prefix). */
export function classDisplayName(c: ClassName): string {
  return c;
}

/** True for HSSC (college) classes. With only 1st Year and 2nd Year offered,
 *  every supported class is a college class. */
export function isCollegeClass(c: ClassName): boolean {
  return c === "1st Year" || c === "2nd Year";
}

/** The two classes a "Combined" report pairs up for a given selection:
 *  1st Year + 2nd Year (the only two classes GHSS Ghallanai offers). */
export function combinedPairFor(c: ClassName): [ClassName, ClassName] {
  return ["1st Year", "2nd Year"];
}

/** Percentage = obtained / class total × 100, rounded to 1 decimal.
 *  This is the ONLY correct way to compare a 1st Year student's marks against
 *  a 2nd Year student's marks — raw totals are not comparable across classes
 *  with different maximums. Every merit-list ranking that mixes 1st Year and
 *  2nd Year MUST sort by this percentage, never by raw marks. */
export function biseTotalPercentage(totalMarks: number, className: ClassName): number {
  const max = CLASS_MAX_MARKS[className];
  if (!max) return 0;
  return Math.round((totalMarks / max) * 1000) / 10;
}
