/**
 * ADMIN DEMO DATA — Master Plan §7.1.
 * Admissions review queue and office stats for the admin dashboard.
 * SAMPLE data — live from Supabase when configured.
 */

/** Admin queue — admissions review (§7.1) */
export const DEMO_ADMISSIONS_QUEUE = [
  { no: "GHSS-2026-0501", name: "SAMPLE Applicant 1", programme: "Pre-Medical", percent: "89%", status: "received" as const, flags: "" },
  { no: "GHSS-2026-0502", name: "SAMPLE Applicant 2", programme: "ICS", percent: "74%", status: "received" as const, flags: "" },
  { no: "GHSS-2026-0503", name: "SAMPLE Applicant 3", programme: "Pre-Engineering", percent: "61%", status: "review" as const, flags: "Marks below guidance" },
  { no: "GHSS-2026-0504", name: "SAMPLE Applicant 4", programme: "Arts", percent: "82%", status: "shortlisted" as const, flags: "" },
  { no: "GHSS-2026-0505", name: "SAMPLE Applicant 5", programme: "Pre-Medical", percent: "86%", status: "review" as const, flags: "" },
  { no: "GHSS-2026-0506", name: "SAMPLE Applicant 6", programme: "ICS", percent: "58%", status: "received" as const, flags: "Group mismatch — maths" },
];

export const DEMO_ADMIN_STATS = [
  { label: "Applications this session", value: "146", delta: "+22 this week" },
  { label: "Notices published", value: "18", delta: "last: 2 days ago" },
  { label: "Result lookups (7 days)", value: "1,204", delta: "+18% vs last week" },
  { label: "PWA installs", value: "63", delta: "+9 this week" },
];
