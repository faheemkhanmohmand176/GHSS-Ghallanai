/**
 * DEMO CONTENT — Exam Roll Numbers (public lookup).
 *
 * In production these rows live in Supabase `exam_roll_sessions` and
 * `exam_roll_numbers` (migration 0003_admin_extension.sql). In DEMO mode
 * (no env vars) these typed records stand in for the live query results.
 *
 * The demo ships ONE published session ("Annual Examination 2026") with
 * 8 sample roll numbers — 4 per class, sequential starting from 100000.
 */

export type ProgrammeKey = "ics" | "pre-medical" | "pre-engineering" | "arts";

export type ClassLabel = "1st Year" | "2nd Year";

export type ExamTerm = "Annual-I" | "Annual-II" | "Supply";

export interface ExamRollSession {
  id: string;
  title: string;
  exam_year: number;
  exam_term: ExamTerm;
  classes: ClassLabel[];
  class_order: ClassLabel[];
  starting_number: number;
  is_published: boolean;
  publish_at: string | null;
  countdown_label: string;
  created_at: string;
}

export interface ExamRollNumber {
  id: string;
  session_id: string;
  student_name: string;
  father_name: string;
  class_label: ClassLabel;
  programme: ProgrammeKey;
  class_roll_no: string;
  exam_roll_no: string;
  serial_number: number;
  created_at: string;
}

export const DEMO_SESSION: ExamRollSession = {
  id: "demo-annual-2026",
  title: "Annual Examination 2026",
  exam_year: 2026,
  exam_term: "Annual-I",
  classes: ["1st Year", "2nd Year"],
  class_order: ["1st Year", "2nd Year"],
  starting_number: 100000,
  is_published: true,
  publish_at: null,
  countdown_label: "Exam Roll Numbers will be published in",
  created_at: "2026-04-01T08:00:00+05:00",
};

export const DEMO_ROLL_NUMBERS: ExamRollNumber[] = [
  // 1st Year — 100000-100003
  {
    id: "rn-001",
    session_id: "demo-annual-2026",
    student_name: "Muhammad Hamza Khan",
    father_name: "Muhammad Khan",
    class_label: "1st Year",
    programme: "ics",
    class_roll_no: "11-ICS-01",
    exam_roll_no: "100000",
    serial_number: 1,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-002",
    session_id: "demo-annual-2026",
    student_name: "Ayesha Bibi",
    father_name: "Abdul Rashid",
    class_label: "1st Year",
    programme: "pre-medical",
    class_roll_no: "11-PM-04",
    exam_roll_no: "100001",
    serial_number: 2,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-003",
    session_id: "demo-annual-2026",
    student_name: "Bilal Ahmed",
    father_name: "Gul Zarin",
    class_label: "1st Year",
    programme: "pre-engineering",
    class_roll_no: "11-PE-02",
    exam_roll_no: "100002",
    serial_number: 3,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-004",
    session_id: "demo-annual-2026",
    student_name: "Zainab Noor",
    father_name: "Noor Muhammad",
    class_label: "1st Year",
    programme: "arts",
    class_roll_no: "11-AR-03",
    exam_roll_no: "100003",
    serial_number: 4,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  // 2nd Year — 100004-100007
  {
    id: "rn-005",
    session_id: "demo-annual-2026",
    student_name: "Hassan Raza",
    father_name: "Muhammad Raza",
    class_label: "2nd Year",
    programme: "pre-medical",
    class_roll_no: "12-PM-07",
    exam_roll_no: "100004",
    serial_number: 5,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-006",
    session_id: "demo-annual-2026",
    student_name: "Fatima Khan",
    father_name: "Khan Zada",
    class_label: "2nd Year",
    programme: "pre-engineering",
    class_roll_no: "12-PE-05",
    exam_roll_no: "100005",
    serial_number: 6,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-007",
    session_id: "demo-annual-2026",
    student_name: "Abdullah Jan",
    father_name: "Jan Muhammad",
    class_label: "2nd Year",
    programme: "ics",
    class_roll_no: "12-ICS-06",
    exam_roll_no: "100006",
    serial_number: 7,
    created_at: "2026-04-01T08:00:00+05:00",
  },
  {
    id: "rn-008",
    session_id: "demo-annual-2026",
    student_name: "Maryam Bibi",
    father_name: "Bibi Hajira",
    class_label: "2nd Year",
    programme: "arts",
    class_roll_no: "12-AR-08",
    exam_roll_no: "100007",
    serial_number: 8,
    created_at: "2026-04-01T08:00:00+05:00",
  },
];

/**
 * A demo "upcoming" (not-yet-published) session, scheduled ~30 days out.
 * Used by the Coming-Soon UI when an admin previews the countdown
 * (via ?preview=soon) or in LIVE mode before the admin publishes.
 */
export function demoUpcomingSession(): ExamRollSession {
  const publishAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...DEMO_SESSION,
    id: "demo-supply-2026",
    title: "Supply Examination 2026",
    exam_term: "Supply",
    exam_year: 2026,
    is_published: false,
    publish_at: publishAt,
    countdown_label: "Supply Examination Roll Numbers will be published in",
  };
}
