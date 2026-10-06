/**
 * DEMO CONTENT — Public Report Cards.
 *
 * Three realistic Pakistani intermediate report cards:
 *   • 1st Year ICS student — class topper (A+)
 *   • 2nd Year Pre-Medical student — school topper (A+)
 *   • 1st Year Pre-Engineering student — compartment (1 absent, 1 fail)
 *
 * Marks scheme: 100 marks per compulsory subject; 100 theory + 50 practical
 * per science subject (150 total). Islamiat (1st Year) and Pak Studies
 * (2nd Year) are 50-mark compulsory subjects.
 *
 * In LIVE mode these come from Supabase `board_results` (migration
 * 0001_schema.sql) — the roll_no field is the same exam_roll_no that
 * appears on the roll-number slip from /results/roll-numbers.
 */

export type ProgrammeKey = "ics" | "pre-medical" | "pre-engineering" | "arts";

export type ClassLabel = "1st Year" | "2nd Year";

export type SubjectStatus = "pass" | "fail" | "absent";

export type OverallGrade = "A+" | "A" | "B" | "C" | "D" | "F" | "Compartment";

export interface SubjectMark {
  subject: string;
  total: number;
  obtained: number;
  grade: string;
  practical?: boolean;
  status: SubjectStatus;
}

export interface ReportCard {
  /** Same value as the exam_roll_no on the roll slip (e.g. "100000"). */
  examRollNo: string;
  /** 12-character code printed on the official report card (e.g. GHSS-2026-001). */
  reportCardCode: string;
  year: number;
  examination: string;
  classLabel: ClassLabel;
  programme: ProgrammeKey;
  studentName: string;
  fatherName: string;
  subjects: SubjectMark[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: OverallGrade;
  position?: string;
  /** Compartment note (e.g. "Compartment in Chemistry"). */
  compartmentNote?: string;
  publishedAt: string;
}

export const DEMO_REPORT_CARDS: ReportCard[] = [
  {
    examRollNo: "100000",
    reportCardCode: "GHSS-2026-001",
    year: 2026,
    examination: "Annual Examination 2026",
    classLabel: "1st Year",
    programme: "ics",
    studentName: "Muhammad Hamza Khan",
    fatherName: "Muhammad Khan",
    subjects: [
      { subject: "English-I", total: 100, obtained: 78, grade: "A", status: "pass" },
      { subject: "Urdu-I", total: 100, obtained: 82, grade: "A+", status: "pass" },
      { subject: "Islamiyat", total: 50, obtained: 44, grade: "A+", status: "pass" },
      {
        subject: "Computer Science",
        total: 150,
        obtained: 130,
        grade: "A+",
        practical: true,
        status: "pass",
      },
      { subject: "Mathematics-I", total: 100, obtained: 88, grade: "A+", status: "pass" },
      {
        subject: "Physics",
        total: 150,
        obtained: 124,
        grade: "A",
        practical: true,
        status: "pass",
      },
    ],
    totalMarks: 650,
    obtainedMarks: 546,
    percentage: 84.0,
    grade: "A+",
    position: "1st in class",
    publishedAt: "2026-08-12T10:00:00+05:00",
  },
  {
    examRollNo: "100004",
    reportCardCode: "GHSS-2026-002",
    year: 2026,
    examination: "Annual Examination 2026",
    classLabel: "2nd Year",
    programme: "pre-medical",
    studentName: "Hassan Raza",
    fatherName: "Muhammad Raza",
    subjects: [
      { subject: "English-II", total: 100, obtained: 75, grade: "A", status: "pass" },
      { subject: "Urdu-II", total: 100, obtained: 81, grade: "A+", status: "pass" },
      { subject: "Pak Studies", total: 50, obtained: 45, grade: "A", status: "pass" },
      {
        subject: "Biology",
        total: 150,
        obtained: 128,
        grade: "A+",
        practical: true,
        status: "pass",
      },
      {
        subject: "Chemistry",
        total: 150,
        obtained: 121,
        grade: "A",
        practical: true,
        status: "pass",
      },
      {
        subject: "Physics",
        total: 150,
        obtained: 119,
        grade: "A",
        practical: true,
        status: "pass",
      },
    ],
    totalMarks: 700,
    obtainedMarks: 569,
    percentage: 81.3,
    grade: "A+",
    position: "1st in school",
    publishedAt: "2026-09-20T10:00:00+05:00",
  },
  {
    examRollNo: "100002",
    reportCardCode: "GHSS-2026-003",
    year: 2026,
    examination: "Annual Examination 2026",
    classLabel: "1st Year",
    programme: "pre-engineering",
    studentName: "Bilal Ahmed",
    fatherName: "Gul Zarin",
    subjects: [
      { subject: "English-I", total: 100, obtained: 71, grade: "A", status: "pass" },
      { subject: "Urdu-I", total: 100, obtained: 76, grade: "A", status: "pass" },
      { subject: "Islamiyat", total: 50, obtained: 18, grade: "F", status: "fail" },
      { subject: "Mathematics-I", total: 100, obtained: 90, grade: "A+", status: "pass" },
      {
        subject: "Physics",
        total: 150,
        obtained: 118,
        grade: "A",
        practical: true,
        status: "pass",
      },
      {
        subject: "Chemistry",
        total: 150,
        obtained: 0,
        grade: "Ab",
        practical: true,
        status: "absent",
      },
    ],
    totalMarks: 650,
    obtainedMarks: 373,
    percentage: 57.4,
    grade: "Compartment",
    compartmentNote: "Compartment in Islamiat & Chemistry — re-appear in supply examination.",
    publishedAt: "2026-08-12T10:00:00+05:00",
  },
];

const PROGRAMME_LABEL: Record<ProgrammeKey, string> = {
  ics: "ICS — Computer Science",
  "pre-medical": "Pre-Medical (F.Sc)",
  "pre-engineering": "Pre-Engineering (F.Sc)",
  arts: "Arts (Humanities)",
};

export function programmeLabel(p: ProgrammeKey): string {
  return PROGRAMME_LABEL[p];
}
