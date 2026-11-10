-- ═════════════════════════════════════════════════════════════════════
-- MIGRATION 12 — Result ranks RPC + one-call result card search
-- ═════════════════════════════════════════════════════════════════════
-- Consolidated, in the ORIGINAL run order, from these source files
-- (content copied verbatim, nothing removed or edited):
--   • 18_result_ranks_rpc.sql
--   • 19_search_result_card_rpc.sql
-- Run the 19 files in numeric order (01 → 19). Any 'Run AFTER <old file
-- number>' remarks inside the original text are kept as history only.
-- ═════════════════════════════════════════════════════════════════════


-- ▼▼▼ BEGIN original file: 18_result_ranks_rpc.sql ▼▼▼
-- ═══════════════════════════════════════════════════════════════════════
-- FILE 18 — Fast, exact Rank + Position for the homepage Result Card
-- Safe to run more than once. Read-only function; changes no data.
--
-- WHY: the Result Card used to download every result row of the year (all
-- classes) into the browser to work out Rank/Position. That was slow, and
-- Supabase silently caps a response at 1000 rows, so some students fell off
-- the end of the list and saw "—". This does the ranking inside Postgres
-- and returns ONE tiny row per result.
--
--   Position = standing inside the student's own class (class + exam + year)
--   Rank     = standing across ALL uploaded (published) classes of the year
--
-- A class/exam/year group counts as "uploaded" once it has >= 1 published
-- row. Held-back toppers (unpublished rows of such a group) still count, so
-- hiding the top 3 never shifts anyone's rank. One row per student (their
-- highest percentage); equal percentages share the same number.
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_results_year_class_exam
  ON public.results (year, class, exam_type);



CREATE OR REPLACE FUNCTION public.get_result_ranks(p_result_ids uuid[])
RETURNS TABLE (
  result_id      uuid,
  class_position integer,
  class_total    integer,
  school_rank    integer,
  school_total   integer
)
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH targets AS (
    SELECT r.id, r.class, r.exam_type, r.year,
           COALESCE(r.student_id::text, r.id::text) AS sid
      FROM public.results r
     WHERE r.id = ANY (p_result_ids) AND r.is_published = true
     LIMIT 20
  ),
  live_groups AS (
    SELECT DISTINCT r.class, r.exam_type, r.year
      FROM public.results r
     WHERE r.is_published = true
       AND r.year IN (SELECT year FROM targets)
  ),
  pool AS (
    SELECT r.class, r.exam_type, r.year,
           COALESCE(r.student_id::text, r.id::text) AS sid,
           r.percentage, r.created_at
      FROM public.results r
      JOIN live_groups g USING (class, exam_type, year)
     WHERE r.percentage IS NOT NULL
  ),
  cbest AS (
    SELECT DISTINCT ON (class, exam_type, year, sid) *
      FROM pool
     ORDER BY class, exam_type, year, sid, percentage DESC, created_at DESC
  ),
  cranked AS (
    SELECT class, exam_type, year, sid,
           (rank() OVER (PARTITION BY class, exam_type, year ORDER BY percentage DESC))::int AS pos,
           (count(*) OVER (PARTITION BY class, exam_type, year))::int AS tot
      FROM cbest
  ),
  sbest AS (
    SELECT DISTINCT ON (year, sid) *
      FROM pool
     ORDER BY year, sid, percentage DESC, created_at DESC
  ),
  sranked AS (
    SELECT year, sid,
           (rank() OVER (PARTITION BY year ORDER BY percentage DESC))::int AS rk,
           (count(*) OVER (PARTITION BY year))::int AS tot
      FROM sbest
  )
  SELECT t.id, c.pos, c.tot, s.rk, s.tot
    FROM targets t
    LEFT JOIN cranked c
           ON c.class = t.class AND c.exam_type = t.exam_type
          AND c.year = t.year AND c.sid = t.sid
    LEFT JOIN sranked s
           ON s.year = t.year AND s.sid = t.sid;
$$;



GRANT EXECUTE ON FUNCTION public.get_result_ranks(uuid[]) TO anon, authenticated;



-- rollback: drop function if exists public.get_result_ranks(uuid[]);
--           drop index if exists public.idx_results_year_class_exam;
-- ▲▲▲ END original file: 18_result_ranks_rpc.sql ▲▲▲

-- ▼▼▼ BEGIN original file: 19_search_result_card_rpc.sql ▼▼▼
-- FILE 19 — One-call Result Card search (student + marks + Rank + Position).
-- Safe to run more than once. Run AFTER file 18. Read-only; changes no data.
-- Returns only PUBLISHED results, same fields the card already showed.

CREATE INDEX IF NOT EXISTS idx_students_class_roll ON public.students (class, roll_number);



CREATE OR REPLACE FUNCTION public.search_result_card(
  p_mode  text,            -- 'exam' (6-digit exam roll) or 'class'
  p_roll  text,
  p_class text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  WITH hits AS (
    SELECT r.*
      FROM public.results r
      LEFT JOIN public.students s ON s.id = r.student_id
     WHERE r.is_published = true
       AND ( (p_mode = 'exam'  AND r.exam_roll_no = p_roll)
          OR (p_mode = 'class' AND r.class = p_class AND s.roll_number = p_roll) )
     ORDER BY r.year DESC
     LIMIT 10
  ),
  rk AS (
    SELECT * FROM public.get_result_ranks((SELECT array_agg(id) FROM hits))
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', h.id, 'student_id', h.student_id, 'class', h.class,
      'exam_type', h.exam_type, 'year', h.year,
      'total_marks', h.total_marks, 'obtained_marks', h.obtained_marks,
      'percentage', h.percentage, 'grade', h.grade, 'is_pass', h.is_pass,
      'remarks', h.remarks, 'subject_marks', h.subject_marks,
      'exam_roll_no', COALESCE(NULLIF(h.exam_roll_no, ''), (
          SELECT n.exam_roll_no
            FROM public.exam_roll_numbers n
            JOIN public.exam_roll_sessions es ON es.id = n.session_id
           WHERE n.student_id = h.student_id
             AND es.exam_year = h.year AND es.exam_term = h.exam_type
           ORDER BY (n.class = h.class) DESC LIMIT 1)),
      'position', rk.class_position, 'total_students', rk.class_total,
      'school_rank', rk.school_rank, 'school_total', rk.school_total,
      'students', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object(
          'full_name', s.full_name, 'roll_number', s.roll_number,
          'father_name', s.father_name, 'photo_url', s.photo_url, 'class', s.class) END
    ) ORDER BY h.year DESC), '[]'::jsonb)
    FROM hits h
    LEFT JOIN public.students s ON s.id = h.student_id
    LEFT JOIN rk ON rk.result_id = h.id;
$$;



GRANT EXECUTE ON FUNCTION public.search_result_card(text, text, text) TO anon, authenticated;


-- rollback: drop function if exists public.search_result_card(text,text,text);
-- ▲▲▲ END original file: 19_search_result_card_rpc.sql ▲▲▲
