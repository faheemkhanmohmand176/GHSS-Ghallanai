/**
 * SERVER DATA ACCESS — Public Report Card Lookup.
 *
 * In LIVE mode the lookup hits Supabase `board_results` (migration
 * 0001_schema.sql) — rows where `published = true`. In DEMO mode the
 * typed sample cards stand in.
 *
 * Two lookup paths:
 *   1. By exam roll number (`?rollNo=100000`)
 *   2. By 12-character report card code (`?code=GHSS-2026-001`)
 *
 * The `report_card_code` column does not exist in the production schema
 * yet (planned for a later migration); in LIVE mode we therefore fall
 * back to a `roll_no` lookup when a code is supplied. In DEMO mode both
 * paths are fully supported against the typed records.
 */

import { isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseServer } from "@/lib/supabase-server";
import { DEMO_REPORT_CARDS, type ReportCard } from "./demo";

export type { ReportCard };

interface LiveBoardResult {
  roll_no: string;
  year: number;
  programme: string;
  student_name: string;
  father_name: string | null;
  subjects_json: unknown;
  total: number;
  obtained: number;
  percentage: number | string;
  grade: string;
  position: string | null;
  published: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Normalises a live board_results row into our ReportCard shape. */
function normalise(row: LiveBoardResult): ReportCard {
  const subjectsRaw = Array.isArray(row.subjects_json)
    ? (row.subjects_json as Array<Record<string, unknown>>)
    : [];
  const subjects = subjectsRaw.map((s) => {
    const obtained = Number(s.obtained ?? 0);
    const total = Number(s.total ?? 0);
    const gradeStr = String(s.grade ?? "").trim();
    const status: ReportCard["subjects"][number]["status"] =
      obtained === 0 && total > 0 ? "absent" : obtained / total < 0.4 ? "fail" : "pass";
    return {
      subject: String(s.subject ?? "Subject"),
      total,
      obtained,
      grade: gradeStr,
      practical: Boolean(s.practical),
      status,
    };
  });
  const percentageNum =
    typeof row.percentage === "number" ? row.percentage : Number(row.percentage ?? 0);
  // The `board_results` table does not store a class_label column yet — we
  // default to "1st Year" and let the production schema (or a later join
  // against `exam_roll_numbers`) refine it. The DEMO path sets this
  // explicitly so the demo cards render correctly.
  const classLabel: ReportCard["classLabel"] = "1st Year";
  return {
    examRollNo: row.roll_no,
    reportCardCode: "", // not yet stored in production
    year: Number(row.year),
    examination: `Annual Examination ${row.year}`,
    classLabel,
    programme: row.programme as ReportCard["programme"],
    studentName: row.student_name,
    fatherName: row.father_name ?? "",
    subjects,
    totalMarks: Number(row.total),
    obtainedMarks: Number(row.obtained),
    percentage: Math.round(percentageNum * 10) / 10,
    grade: (row.grade as ReportCard["grade"]) ?? "F",
    position: row.position ?? undefined,
    publishedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

/** Looks up a report card by exam roll number. */
export async function lookupByRollNo(rollNo: string): Promise<ReportCard | null> {
  const q = rollNo.trim();
  if (!q) return null;

  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("board_results")
        .select("*")
        .eq("roll_no", q)
        .eq("published", true)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return normalise(data as LiveBoardResult);
      return null;
    } catch {
      /* fall through to demo */
    }
  }

  return (
    DEMO_REPORT_CARDS.find(
      (r) => r.examRollNo.toLowerCase() === q.toLowerCase()
    ) ?? null
  );
}

/**
 * Looks up a report card by 12-character report card code.
 *
 * In DEMO mode the lookup matches against the typed `reportCardCode`
 * field. In LIVE mode the `report_card_code` column does not yet exist
 * on `board_results`, so we fall back to a `roll_no` lookup using the
 * code value (which will return null in practice — the user gets a
 * friendly "no match" empty state).
 */
export async function lookupByCode(code: string): Promise<ReportCard | null> {
  const q = code.trim();
  if (!q) return null;

  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      // TODO: replace with .eq("report_card_code", q) once the column
      // exists in the production schema. For now, fall back to roll_no.
      const { data, error } = await sb
        .from("board_results")
        .select("*")
        .eq("roll_no", q)
        .eq("published", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return normalise(data as LiveBoardResult);
      return null;
    } catch {
      /* fall through to demo */
    }
  }

  return (
    DEMO_REPORT_CARDS.find(
      (r) => r.reportCardCode.toLowerCase() === q.toLowerCase()
    ) ?? null
  );
}
