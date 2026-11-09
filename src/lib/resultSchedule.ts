/**
 * resultSchedule — the public "when do the results go live?" schedule.
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (Nov 2026 security hardening)
 *
 * The countdown strip on every page needs to know which exam results are
 * SCHEDULED to be published — that is public information by design (the
 * school announces the date in advance).
 *
 * It used to read the `results` table directly with
 *     .eq("is_published", false).select("class, exam_type, year, publish_at")
 * which is only possible because the table carried a blanket
 * `results_public_read ... USING (true)` policy. That policy also exposed
 * EVERY result row — the marks, the student ids and the rows the school
 * deliberately holds back (including "hide the top 3") — to the entire
 * internet, defeating the whole publish workflow.
 *
 * The schedule is now read through `public.result_schedule(scope)`, a
 * SECURITY DEFINER function that returns those four columns and nothing
 * else. The public may therefore see WHEN a result goes live, never WHAT
 * it contains before it is published.
 *
 * FALLBACK: the callers still have their cached /api/public-data path
 * (which reads the same data with the service role). This module is the
 * direct-to-database path used when that cache is unavailable.
 */
import { supabase } from "@/lib/supabase";

export interface ResultScheduleRow {
  /** The class the schedule belongs to ("1st Year" / "2nd Year"). */
  class: string;
  /** The exam slot ("Annual-I" / "Annual-II" / …), may be null. */
  exam_type: string | null;
  /** The exam year, may be null. */
  year: number | null;
  /** ISO timestamp at which the result is published. */
  publish_at: string;
}

/**
 * Read the publish schedule.
 *
 * @param scope "upcoming" → results scheduled for the future (the countdown)
 *             "due"      → results whose publish time has already passed but
 *                           which have not been flipped yet (the auto-publish
 *                           safety net)
 */
export async function fetchResultSchedule(
  scope: "upcoming" | "due" = "upcoming"
): Promise<ResultScheduleRow[]> {
  const { data, error } = await supabase.rpc("result_schedule", { p_scope: scope });
  if (error) throw error;
  return (data ?? []) as ResultScheduleRow[];
}
