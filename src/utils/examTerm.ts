// src/utils/examTerm.ts
//
// One Exam Roll session covers ALL classes. Its exam_term is stored as
// "Annual-I" / "Annual-II". 1st Year and 2nd Year both sit the same slot
// under those terms. These helpers map between session-level slot labels
// and the per-class exam_type values.

/** 1 / 2 for the first / second exam slot, null when unknown (e.g. "Annual"). */
export function termSlot(term: string): 1 | 2 | null {
  const s = (term || "").trim().toLowerCase();
  if (/1st|first|annual-i\b/.test(s)) return 1;
  if (/2nd|second|annual-ii\b/.test(s)) return 2;
  return null;
}

/** True when a date-sheet / result exam_type belongs to the session's term. */
export function termMatches(examType: string, term: string): boolean {
  const a = (examType || "").trim().toLowerCase();
  const b = (term || "").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const sa = termSlot(a);
  return sa !== null && sa === termSlot(b);
}

/** The exam_type a given class actually uses for the session's term.
 *  GHSS Ghallanai only has HSSC classes (1st Year / 2nd Year), so every
 *  class uses "Annual-I" / "Annual-II". */
export function termForClass(_cls: string, term: string): string {
  const slot = termSlot(term);
  if (slot === null) return term;
  return slot === 1 ? "Annual-I" : "Annual-II";
}

/** Label for a whole session, e.g. "Annual-I". */
export function sessionTermLabel(term: string): string {
  const slot = termSlot(term);
  if (slot === 1) return "Annual-I";
  if (slot === 2) return "Annual-II";
  return term;
}

/**
 * Public result title term. With only HSSC classes, the website shows
 * "Annual-I" / "Annual-II" as the single title for the whole school.
 */
export function resultTermLabel(examType: string): string {
  const slot = termSlot(examType);
  if (slot === 1) return "Annual-I";
  if (slot === 2) return "Annual-II";
  return examType;
}

/**
 * Every raw exam_type value that belongs to the same slot, e.g.
 * "Annual-I" -> ["Annual-I"]. All classes use the same exam_type strings.
 */
export function examTypeVariants(examType: string): string[] {
  const slot = termSlot(examType);
  if (slot === 1) return ["Annual-I"];
  if (slot === 2) return ["Annual-II"];
  return [examType];
}
