/**
 * PORTAL DEMO DATA — Master Plan §7.3 (Table 8).
 * LMS surface at launch: assignments, resources, attendance, notices,
 * timetable, grades. SAMPLE data — live from Supabase when configured.
 */

export const DEMO_STUDENT = {
  name: "SAMPLE Student",
  rollNo: "GH-12-101",
  class: "2nd Year · Pre-Medical",
  section: "B",
  attendancePercent: 87,
};

export const DEMO_TIMETABLE = [
  { day: "Mon", periods: ["Physics", "Chemistry", "Biology", "English", "Urdu", "Practical (Bio)"] },
  { day: "Tue", periods: ["Biology", "Physics", "Chemistry", "Math", "English", "Practical (Chem)"] },
  { day: "Wed", periods: ["Chemistry", "Biology", "Physics", "Urdu", "Islamiyat", "Library"] },
  { day: "Thu", periods: ["Physics", "English", "Biology", "Chemistry", "Urdu", "Test (Phys)"] },
  { day: "Fri", periods: ["Biology", "Chemistry", "English", "Physics", "Sports", "Sports"] },
  { day: "Sat", periods: ["Chemistry", "Physics", "Urdu", "Biology", "MDCAT prep", "—"] },
];

export const DEMO_ASSIGNMENTS = [
  { id: "a1", title: "Physics — Chapter 12 numericals", subject: "Physics", due: "2026-10-08", status: "pending" as const },
  { id: "a2", title: "Biology — Genetics worksheet", subject: "Biology", due: "2026-10-05", status: "submitted" as const },
  { id: "a3", title: "Chemistry — Organic reactions map", subject: "Chemistry", due: "2026-09-28", status: "graded" as const, grade: "18/25", remarks: "Good work — revise isomerism." },
  { id: "a4", title: "English — Essay: My District", subject: "English", due: "2026-09-20", status: "graded" as const, grade: "22/25", remarks: "Excellent structure." },
];

export const DEMO_ATTENDANCE_LOG = [
  { date: "2026-09-29", status: "p" as const },
  { date: "2026-09-28", status: "p" as const },
  { date: "2026-09-27", status: "a" as const },
  { date: "2026-09-26", status: "p" as const },
  { date: "2026-09-25", status: "p" as const },
  { date: "2026-09-24", status: "l" as const },
  { date: "2026-09-23", status: "p" as const },
];

export const DEMO_INTERNAL_MARKS = [
  { test: "Monthly Test 1", subject: "Physics", obtained: 24, total: 25 },
  { test: "Monthly Test 1", subject: "Chemistry", obtained: 21, total: 25 },
  { test: "Monthly Test 1", subject: "Biology", obtained: 23, total: 25 },
  { test: "Send-up Exam", subject: "Physics", obtained: 68, total: 85 },
  { test: "Send-up Exam", subject: "Chemistry", obtained: 61, total: 85 },
  { test: "Send-up Exam", subject: "Biology", obtained: 72, total: 85 },
];

export const DEMO_RESOURCES = [
  { title: "Physics — Past papers 2021-2025", subject: "Physics", type: "PDF" },
  { title: "Biology — Genetics notes (Ch. 5-6)", subject: "Biology", type: "PDF" },
  { title: "Chemistry — Organic summary sheets", subject: "Chemistry", type: "PDF" },
  { title: "MDCAT — Vocabulary & formula sheet", subject: "MDCAT", type: "PDF" },
];

export const DEMO_TEACHER = {
  name: "Mr. Khan",
  subject: "Physics",
  classes: ["1st Year Pre-Engineering A", "1st Year Pre-Medical B", "2nd Year Pre-Medical A"],
};

export const DEMO_CLASS_ROSTER = [
  { roll: 1, name: "SAMPLE Student 1", present: true },
  { roll: 2, name: "SAMPLE Student 2", present: true },
  { roll: 3, name: "SAMPLE Student 3", present: false },
  { roll: 4, name: "SAMPLE Student 4", present: true },
  { roll: 5, name: "SAMPLE Student 5", present: true },
  { roll: 6, name: "SAMPLE Student 6", present: true },
  { roll: 7, name: "SAMPLE Student 7", present: false },
  { roll: 8, name: "SAMPLE Student 8", present: true },
];

export const DEMO_GRADEBOOK = [
  { roll: 1, name: "SAMPLE Student 1", mt1: 22, mt2: 24, sendup: 74, total: "88%" },
  { roll: 2, name: "SAMPLE Student 2", mt1: 19, mt2: 21, sendup: 65, total: "78%" },
  { roll: 3, name: "SAMPLE Student 3", mt1: 15, mt2: 18, sendup: 52, total: "63%" },
  { roll: 4, name: "SAMPLE Student 4", mt1: 25, mt2: 24, sendup: 81, total: "96%" },
  { roll: 5, name: "SAMPLE Student 5", mt1: 17, mt2: 19, sendup: 58, total: "70%" },
];

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
