/**
 * RESULTS DATA — Master Plan §6.5 & §7.2.
 * SAMPLE board-result records for the public lookup demo.
 * In production these live in Supabase (marks / board_results tables)
 * and arrive through the supervised import pipeline.
 */

export type ProgrammeKey = "ics" | "pre-medical" | "pre-engineering" | "arts";

export interface SubjectMark {
  subject: string;
  total: number;
  obtained: number;
  grade: string;
  practical?: boolean;
}

export interface BoardResult {
  rollNo: string;
  year: 2026 | 2025;
  programme: ProgrammeKey;
  studentName: string;
  fatherName: string;
  subjects: SubjectMark[];
  total: number;
  obtained: number;
  percentage: string;
  grade: string;
  position?: string;
}

export const BOARD_RESULTS: BoardResult[] = [
  {
    rollNo: "GH-12-101",
    year: 2026,
    programme: "pre-medical",
    studentName: "SAMPLE Student A",
    fatherName: "SAMPLE Father A",
    subjects: [
      { subject: "English", total: 100, obtained: 78, grade: "A" },
      { subject: "Urdu", total: 100, obtained: 82, grade: "A+" },
      { subject: "Biology", total: 100, obtained: 88, grade: "A+", practical: true },
      { subject: "Chemistry", total: 100, obtained: 84, grade: "A+", practical: true },
      { subject: "Physics", total: 100, obtained: 79, grade: "A", practical: true },
      { subject: "Pak Studies", total: 50, obtained: 45, grade: "A" },
    ],
    total: 550,
    obtained: 456,
    percentage: "82.9%",
    grade: "A+",
    position: "1st in school (SAMPLE)",
  },
  {
    rollNo: "GH-12-102",
    year: 2026,
    programme: "pre-engineering",
    studentName: "SAMPLE Student B",
    fatherName: "SAMPLE Father B",
    subjects: [
      { subject: "English", total: 100, obtained: 74, grade: "A" },
      { subject: "Urdu", total: 100, obtained: 80, grade: "A+" },
      { subject: "Mathematics", total: 100, obtained: 90, grade: "A+" },
      { subject: "Physics", total: 100, obtained: 81, grade: "A+", practical: true },
      { subject: "Chemistry", total: 100, obtained: 77, grade: "A", practical: true },
      { subject: "Pak Studies", total: 50, obtained: 44, grade: "A" },
    ],
    total: 550,
    obtained: 446,
    percentage: "81.1%",
    grade: "A+",
  },
  {
    rollNo: "GH-11-201",
    year: 2026,
    programme: "ics",
    studentName: "SAMPLE Student C",
    fatherName: "SAMPLE Father C",
    subjects: [
      { subject: "English", total: 100, obtained: 71, grade: "A" },
      { subject: "Urdu", total: 100, obtained: 76, grade: "A" },
      { subject: "Computer Science", total: 100, obtained: 87, grade: "A+", practical: true },
      { subject: "Mathematics", total: 100, obtained: 83, grade: "A+" },
      { subject: "Physics", total: 100, obtained: 72, grade: "A", practical: true },
      { subject: "Islamiyat", total: 50, obtained: 42, grade: "A" },
    ],
    total: 550,
    obtained: 431,
    percentage: "78.4%",
    grade: "A",
  },
  {
    rollNo: "GH-11-202",
    year: 2026,
    programme: "arts",
    studentName: "SAMPLE Student D",
    fatherName: "SAMPLE Father D",
    subjects: [
      { subject: "English", total: 100, obtained: 69, grade: "A" },
      { subject: "Urdu", total: 100, obtained: 79, grade: "A+" },
      { subject: "Civics", total: 100, obtained: 82, grade: "A+" },
      { subject: "Economics", total: 100, obtained: 75, grade: "A" },
      { subject: "History", total: 100, obtained: 73, grade: "A" },
      { subject: "Islamiyat", total: 50, obtained: 41, grade: "A" },
    ],
    total: 550,
    obtained: 419,
    percentage: "76.2%",
    grade: "A",
  },
  {
    rollNo: "GH-12-103",
    year: 2025,
    programme: "pre-medical",
    studentName: "SAMPLE Student E",
    fatherName: "SAMPLE Father E",
    subjects: [
      { subject: "English", total: 100, obtained: 75, grade: "A" },
      { subject: "Urdu", total: 100, obtained: 81, grade: "A+" },
      { subject: "Biology", total: 100, obtained: 85, grade: "A+", practical: true },
      { subject: "Chemistry", total: 100, obtained: 80, grade: "A+", practical: true },
      { subject: "Physics", total: 100, obtained: 76, grade: "A", practical: true },
      { subject: "Pak Studies", total: 50, obtained: 43, grade: "A" },
    ],
    total: 550,
    obtained: 440,
    percentage: "80.0%",
    grade: "A+",
  },
];

export interface MeritRow {
  meritNo: number;
  applicationNo: string;
  name: string;
  programme: string;
  matricPercent: string;
  testScore: string;
  status: string;
}

/** SAMPLE merit list — generated from admissions in production (§7.1) */
export const MERIT_LIST: MeritRow[] = [
  { meritNo: 1, applicationNo: "GHSS-2026-0412", name: "SAMPLE Applicant 1", programme: "Pre-Medical", matricPercent: "89.1%", testScore: "—", status: "Admitted" },
  { meritNo: 2, applicationNo: "GHSS-2026-0287", name: "SAMPLE Applicant 2", programme: "Pre-Engineering", matricPercent: "88.4%", testScore: "—", status: "Admitted" },
  { meritNo: 3, applicationNo: "GHSS-2026-0119", name: "SAMPLE Applicant 3", programme: "ICS", matricPercent: "87.6%", testScore: "—", status: "Admitted" },
  { meritNo: 4, applicationNo: "GHSS-2026-0533", name: "SAMPLE Applicant 4", programme: "Pre-Medical", matricPercent: "86.9%", testScore: "—", status: "Admitted" },
  { meritNo: 5, applicationNo: "GHSS-2026-0201", name: "SAMPLE Applicant 5", programme: "Arts", matricPercent: "85.5%", testScore: "—", status: "Admitted" },
  { meritNo: 6, applicationNo: "GHSS-2026-0345", name: "SAMPLE Applicant 6", programme: "Pre-Engineering", matricPercent: "84.2%", testScore: "—", status: "Admitted" },
  { meritNo: 7, applicationNo: "GHSS-2026-0098", name: "SAMPLE Applicant 7", programme: "ICS", matricPercent: "83.7%", testScore: "—", status: "Admitted" },
  { meritNo: 8, applicationNo: "GHSS-2026-0466", name: "SAMPLE Applicant 8", programme: "Pre-Medical", matricPercent: "82.0%", testScore: "—", status: "Admitted" },
  { meritNo: 9, applicationNo: "GHSS-2026-0154", name: "SAMPLE Applicant 9", programme: "Arts", matricPercent: "81.4%", testScore: "—", status: "Waitlisted" },
  { meritNo: 10, applicationNo: "GHSS-2026-0301", name: "SAMPLE Applicant 10", programme: "Pre-Engineering", matricPercent: "80.2%", testScore: "—", status: "Waitlisted" },
];

export interface Topper {
  name: string;
  position: string;
  year: string;
  programme: string;
  percentage: string;
  quote: string;
}

/** SAMPLE toppers wall (§6.5) */
export const TOPPERS: Topper[] = [
  {
    name: "SAMPLE Topper 1",
    position: "1st position",
    year: "Annual 2026",
    programme: "Pre-Medical",
    percentage: "82.9%",
    quote: "The monthly tests kept me honest. By send-ups, the board paper felt familiar. (SAMPLE content)",
  },
  {
    name: "SAMPLE Topper 2",
    position: "2nd position",
    year: "Annual 2026",
    programme: "Pre-Engineering",
    percentage: "81.1%",
    quote: "The mathematics club problems were harder than the board paper. That was the point. (SAMPLE content)",
  },
  {
    name: "SAMPLE Topper 3",
    position: "1st position",
    year: "Annual 2026",
    programme: "ICS",
    percentage: "78.4%",
    quote: "One machine per student in the lab meant nowhere to hide — every practical had to work. (SAMPLE content)",
  },
];

/** Five-year result trend (percentages of passes) — SAMPLE for charts */
export const RESULT_TREND = [
  { year: "2021", passPercent: 71 },
  { year: "2022", passPercent: 76 },
  { year: "2023", passPercent: 82 },
  { year: "2024", passPercent: 86 },
  { year: "2025", passPercent: 90 },
] as const;
