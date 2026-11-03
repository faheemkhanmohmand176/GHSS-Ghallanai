/**
 * masking — CNIC and mobile masking helpers for public / semi-public screens.
 *
 * CNIC: 13 digits → show first 5 and last 1, mask the middle 7.
 *   e.g.  6110198765432  →  61101-*******-2
 * Mobile: 11 digits → show first 3 and last 2, mask the middle 6.
 *   e.g.  03011234567   →  0301-******-67
 *
 * The applicant themselves (in their own portal, behind their token) still
 * sees full values — these helpers are only used on the PUBLIC Track screen
 * and in the Admin view where appropriate.
 */

/** True if the caller is the applicant viewing their own data (pass a flag). */
export function maskCnic(cnic: string | null | undefined): string {
  const d = (cnic || "").replace(/\D/g, "");
  if (d.length !== 13) return cnic || "—";
  return `${d.slice(0, 5)}-*******-${d.slice(12)}`;
}

/** Mask a mobile number: 0301-******-67 */
export function maskMobile(mobile: string | null | undefined): string {
  const d = (mobile || "").replace(/\D/g, "");
  if (d.length !== 11) return mobile || "—";
  return `${d.slice(0, 4)}-******-${d.slice(9)}`;
}

/** Mask CNIC keeping the dashes-formatted shape: 61101-XXXXXXX-X → 61101-*******-X */
export function maskCnicFormatted(cnic: string | null | undefined): string {
  const d = (cnic || "").replace(/\D/g, "");
  if (d.length !== 13) return cnic || "—";
  return `${d.slice(0, 5)}-*******-${d.slice(12)}`;
}
