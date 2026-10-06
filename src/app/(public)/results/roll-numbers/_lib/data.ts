/**
 * SERVER DATA ACCESS — Exam Roll Numbers (public lookup).
 *
 * Each function tries Supabase first when env vars are set (LIVE mode),
 * falling back to the typed demo content otherwise (DEMO mode). The
 * public page consumes these inside a server component — no client-side
 * data fetching waterfalls.
 */

import { isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  DEMO_SESSION,
  DEMO_ROLL_NUMBERS,
  demoUpcomingSession,
  type ExamRollSession,
  type ExamRollNumber,
  type ClassLabel,
} from "./demo";

export type { ExamRollSession, ExamRollNumber, ClassLabel };

/**
 * Returns the most-recently-published exam roll session, or null if none
 * is currently published. In DEMO mode this is always the 2026 Annual
 * session.
 */
export async function getPublishedSession(): Promise<ExamRollSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("exam_roll_sessions")
        .select(
          "id,title,exam_year,exam_term,classes,class_order,starting_number,is_published,publish_at,countdown_label,created_at"
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) return data as ExamRollSession;
    } catch {
      /* fall through to demo */
    }
  }
  return DEMO_SESSION;
}

/**
 * Returns the next scheduled (unpublished but with a future publish_at)
 * session, used by the "Coming Soon" countdown UI. In DEMO mode this is
 * only returned when the preview flag is on; otherwise null.
 */
export async function getUpcomingSession(): Promise<ExamRollSession | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("exam_roll_sessions")
        .select(
          "id,title,exam_year,exam_term,classes,class_order,starting_number,is_published,publish_at,countdown_label,created_at"
        )
        .eq("is_published", false)
        .not("publish_at", "is", null)
        .order("publish_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!error && data) return data as ExamRollSession;
    } catch {
      /* fall through */
    }
  }
  return null;
}

/**
 * Returns a demo upcoming session for the preview (?preview=soon) flow.
 */
export function getDemoUpcomingSession(): ExamRollSession {
  return demoUpcomingSession();
}

/**
 * Looks up a single student by class + name fragment within the given
 * session. The match is case-insensitive substring on student_name (the
 * spec calls for a "premium finder, not a full list" — one slip back).
 *
 * Returns the first matching row, or null if no match.
 */
export async function lookupRollNumber(
  sessionId: string,
  classLabel: string,
  nameQuery: string
): Promise<ExamRollNumber | null> {
  const q = nameQuery.trim();
  if (!q) return null;

  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      // Sanitise the LIKE pattern — escape %, _ and \ so user input can't
      // act as a wildcard.
      const safe = q.replace(/[%_\\]/g, "\\$&");
      const { data, error } = await sb
        .from("exam_roll_numbers")
        .select("*")
        .eq("session_id", sessionId)
        .eq("class_label", classLabel)
        .ilike("student_name", `%${safe}%`)
        .order("serial_number", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as ExamRollNumber;
      return null;
    } catch {
      /* fall through to demo */
    }
  }

  // DEMO lookup — case-insensitive substring match.
  const lc = q.toLowerCase();
  const found = DEMO_ROLL_NUMBERS.find(
    (r) =>
      r.session_id === sessionId &&
      r.class_label === classLabel &&
      r.student_name.toLowerCase().includes(lc)
  );
  return found ?? null;
}
