-- 21_admission_merit_flow_not_listed.sql
-- Run once in the Supabase SQL editor AFTER 20_… (safe to re-run).
--
-- The complete, automatic admission → merit flow (online + walk-in):
--
--   Applied → Fee Paid (Awaiting Review) → [Auto Merit List] →
--        Merit Listed        (inside the seats of the program)
--        Not Merit Listed    (fee-paid, but no seat left)
--
--   • Every fee-paid applicant appears in the published merit list, so the
--     Not Merit Listed students can find themselves too (remark
--     "Not Merit Listed").
--   • Running Auto Merit again with the same list number REPLACES the old
--     lists of that number (draft or published), so nothing is duplicated.
--   • The status is automatic, nobody needs to change it one by one.
--
-- No enum change is needed: "Not Merit Listed" is stored as status
-- 'under_review' and is shown with that wording by the website.

-- 1 ─ entries remember whether the applicant got a seat ────────────────────
ALTER TABLE public.inter_merit_list_entries
    ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT true;

-- 2 ─ Auto merit (replaces the version from migration 20) ──────────────────
DROP FUNCTION IF EXISTS public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, boolean, int);
DROP FUNCTION IF EXISTS public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, int);

CREATE OR REPLACE FUNCTION public.inter_admin_merit_auto(
    p_list_no int DEFAULT 1,
    p_admission_start_date date DEFAULT NULL,
    p_admission_last_date date DEFAULT NULL,
    p_instructions text DEFAULT NULL,
    p_publish boolean DEFAULT false,
    p_dry_run boolean DEFAULT false,
    p_program_id int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_prog record;
    v_q record;
    v_id uuid;
    v_ord text;
    v_suffix text;
    v_instr text;
    v_taken int;
    v_left int;
    v_eligible int;
    v_selected int;
    v_unpaid int;
    v_cut numeric;
    v_publish boolean := p_publish;
    v_summary jsonb := '[]'::jsonb;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_total_sel int := 0;
    v_total_not int := 0;
    v_total_lists int := 0;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF p_list_no IS NULL OR p_list_no < 1 OR p_list_no > 50 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'List number must be between 1 and 50.');
    END IF;

    v_ord := CASE p_list_no % 100
        WHEN 11 THEN p_list_no::text || 'th'
        WHEN 12 THEN p_list_no::text || 'th'
        WHEN 13 THEN p_list_no::text || 'th'
        ELSE CASE p_list_no % 10
            WHEN 1 THEN p_list_no::text || 'st'
            WHEN 2 THEN p_list_no::text || 'nd'
            WHEN 3 THEN p_list_no::text || 'rd'
            ELSE p_list_no::text || 'th' END
    END;
    v_suffix := CASE WHEN p_list_no = 1 THEN 'Provisional ' ELSE '' END;
    v_instr := coalesce(nullif(btrim(p_instructions), ''),
        'Printed copy of online admission form;' || chr(10) ||
        '03 copies of SSC (Matric) DMC and domicile;' || chr(10) ||
        '04 passport size photos with white background;' || chr(10) ||
        'Copies of Parent and student CNICs/Form-B;' || chr(10) ||
        'All documents shall be attested;' || chr(10) ||
        'All original documents including Parent / student CNICs;' || chr(10) ||
        'Affidavit (students who passed SSC before the current year must submit an affidavit undertaking that they have not taken admission in any institute during this period).');

    CREATE TEMP TABLE IF NOT EXISTS _auto_sel (
        application_id uuid, quota public.inter_quota, tracking_id text,
        name text, father_name text, total_marks numeric, obtained_marks numeric,
        net_marks numeric, rn int, listed boolean
    ) ON COMMIT DROP;
    DELETE FROM _auto_sel WHERE true;

    -- Replace the old lists of this number (draft AND published): no duplicates.
    IF NOT p_dry_run THEN
        IF EXISTS (SELECT 1 FROM public.inter_merit_lists l
                    WHERE l.list_no = p_list_no AND l.is_published
                      AND (p_program_id IS NULL OR l.program_id = p_program_id)) THEN
            v_publish := true;   -- it was public before, so the new one is public too
        END IF;

        UPDATE public.inter_applications a
           SET status = 'fee_paid', updated_at = now()
         WHERE a.status::text IN ('merit_listed', 'under_review')
           AND EXISTS (SELECT 1 FROM public.inter_merit_list_entries e
                         JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
                        WHERE e.application_id = a.id AND l.list_no = p_list_no
                          AND (p_program_id IS NULL OR l.program_id = p_program_id))
           AND NOT EXISTS (SELECT 1 FROM public.inter_merit_list_entries e2
                             JOIN public.inter_merit_lists l2 ON l2.id = e2.merit_list_id
                            WHERE e2.application_id = a.id AND l2.is_published
                              AND e2.is_listed AND l2.list_no <> p_list_no);
        DELETE FROM public.inter_merit_lists l
         WHERE l.list_no = p_list_no
           AND (p_program_id IS NULL OR l.program_id = p_program_id);
    END IF;

    FOR v_prog IN
        SELECT id, name, seats FROM public.inter_programs
         WHERE is_active AND (p_program_id IS NULL OR id = p_program_id)
         ORDER BY display_order, id
    LOOP
        -- seats already taken by EARLIER published lists
        SELECT count(DISTINCT e.application_id) INTO v_taken
          FROM public.inter_merit_list_entries e
          JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
         WHERE l.program_id = v_prog.id AND l.is_published AND e.is_listed
           AND l.list_no <> p_list_no;
        v_left := greatest(v_prog.seats - v_taken, 0);

        SELECT count(*) INTO v_unpaid
          FROM public.inter_applications a
         WHERE a.program_id = v_prog.id AND a.payment_status <> 'paid'
           AND a.status::text NOT IN ('cancelled', 'rejected');

        DELETE FROM _auto_sel WHERE true;
        INSERT INTO _auto_sel
        SELECT a.id, a.quota, a.tracking_id,
               COALESCE(pp.full_name, '—'), COALESCE(pp.father_name, '—'),
               s.marks_total, s.marks_obtained,
               s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END,
               row_number() OVER (ORDER BY
                   (s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END) DESC,
                   a.submitted_at ASC, a.tracking_id ASC),
               false
          FROM public.inter_applications a
          JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
          JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
         WHERE a.program_id = v_prog.id
           AND a.payment_status = 'paid'
           AND a.status::text NOT IN ('cancelled', 'rejected', 'admitted')
           AND s.marks_total > 0
           AND NOT EXISTS (
                SELECT 1 FROM public.inter_merit_list_entries e
                  JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
                 WHERE e.application_id = a.id AND l.is_published
                   AND e.is_listed AND l.list_no <> p_list_no);

        UPDATE _auto_sel SET listed = (rn <= v_left) WHERE true;
        SELECT count(*) INTO v_eligible FROM _auto_sel;
        SELECT count(*), min(net_marks) INTO v_selected, v_cut FROM _auto_sel WHERE listed;

        IF NOT p_dry_run AND v_eligible > 0 THEN
            FOR v_q IN SELECT DISTINCT quota FROM _auto_sel ORDER BY quota LOOP
                INSERT INTO public.inter_merit_lists (
                    program_id, program_name, quota, list_no, title,
                    admission_start_date, admission_last_date, instructions
                ) VALUES (
                    v_prog.id, v_prog.name, v_q.quota, p_list_no,
                    v_ord || ' ' || v_suffix || 'Merit list for session ' || to_char(now(), 'YYYY')
                        || ' [Government Higher Secondary School Ghallanai] '
                        || v_prog.name || ' (' || initcap(replace(v_q.quota::text, '_', ' ')) || ')',
                    p_admission_start_date, p_admission_last_date, v_instr
                ) RETURNING id INTO v_id;

                INSERT INTO public.inter_merit_list_entries (
                    merit_list_id, application_id, position, tracking_id, name, father_name,
                    total_marks, obtained_marks, net_marks, percentage, remarks, is_listed
                )
                SELECT v_id, x.application_id,
                       row_number() OVER (ORDER BY x.rn),
                       x.tracking_id, x.name, x.father_name,
                       x.total_marks, x.obtained_marks, x.net_marks,
                       round((x.net_marks / x.total_marks) * 100, 2),
                       CASE WHEN x.listed THEN NULL ELSE 'Not Merit Listed' END,
                       x.listed
                  FROM _auto_sel x WHERE x.quota = v_q.quota;

                v_ids := v_ids || v_id;
                v_total_lists := v_total_lists + 1;
            END LOOP;

            -- status of every fee-paid applicant (automatic, nobody clicks it)
            UPDATE public.inter_applications a
               SET status = CASE WHEN x.listed THEN 'merit_listed' ELSE 'under_review' END::public.inter_app_status,
                   updated_at = now()
              FROM _auto_sel x WHERE a.id = x.application_id;
            INSERT INTO public.inter_application_timeline (application_id, title, details)
            SELECT application_id,
                   CASE WHEN listed THEN 'Merit Listed' ELSE 'Not Merit Listed' END,
                   CASE WHEN listed
                        THEN 'Selected in the ' || v_ord || ' merit list for ' || v_prog.name || '.'
                        ELSE 'Not selected in the ' || v_ord || ' merit list for ' || v_prog.name || ' (no seat left).' END
              FROM _auto_sel;
        END IF;

        v_total_sel := v_total_sel + v_selected;
        v_total_not := v_total_not + greatest(v_eligible - v_selected, 0);
        v_summary := v_summary || jsonb_build_object(
            'program_id', v_prog.id, 'program', v_prog.name,
            'seats', v_prog.seats, 'taken', v_taken, 'seats_left', v_left,
            'eligible', v_eligible, 'selected', v_selected,
            'waiting', greatest(v_eligible - v_selected, 0),
            'unpaid', v_unpaid, 'cutoff', v_cut);
    END LOOP;

    IF NOT p_dry_run AND v_publish AND array_length(v_ids, 1) IS NOT NULL THEN
        FOREACH v_id IN ARRAY v_ids LOOP
            PERFORM public.inter_admin_merit_publish(v_id, true);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'dry_run', p_dry_run, 'published', (v_publish AND NOT p_dry_run),
        'lists', v_total_lists, 'selected', v_total_sel, 'not_listed', v_total_not,
        'programs', v_summary);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, int) TO authenticated, service_role;

-- 3 ─ Publish / unpublish: only SELECTED applicants become Merit Listed ────
CREATE OR REPLACE FUNCTION public.inter_admin_merit_publish(
    p_merit_list_id uuid, p_published boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_title text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT title INTO v_title FROM public.inter_merit_lists WHERE id = p_merit_list_id;
    IF v_title IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Merit list not found.');
    END IF;

    UPDATE public.inter_merit_lists
       SET is_published = p_published,
           published_at = CASE WHEN p_published THEN now() ELSE NULL END
     WHERE id = p_merit_list_id;

    IF p_published THEN
        WITH moved AS (
            UPDATE public.inter_applications a
               SET status = CASE WHEN e.is_listed THEN 'merit_listed' ELSE 'under_review' END::public.inter_app_status,
                   updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.payment_status = 'paid'
               AND a.status::text IN ('submitted', 'fee_pending', 'fee_paid', 'under_review', 'merit_listed')
               AND a.status::text IS DISTINCT FROM (CASE WHEN e.is_listed THEN 'merit_listed' ELSE 'under_review' END)
         RETURNING a.id, e.is_listed
        )
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        SELECT id, CASE WHEN is_listed THEN 'Merit Listed' ELSE 'Not Merit Listed' END,
               'Published merit list: ' || v_title FROM moved;
    ELSE
        WITH moved AS (
            UPDATE public.inter_applications a
               SET status = 'fee_paid', updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.status::text IN ('merit_listed', 'under_review')
               AND NOT EXISTS (
                    SELECT 1 FROM public.inter_merit_list_entries e2
                    JOIN public.inter_merit_lists l2 ON l2.id = e2.merit_list_id
                    WHERE e2.application_id = a.id AND l2.is_published
                      AND l2.id <> p_merit_list_id)
         RETURNING a.id
        )
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        SELECT id, 'Removed from Merit List', 'The merit list was withdrawn: ' || v_title FROM moved;
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4 ─ Public + admin list views know who got a seat ────────────────────────
CREATE OR REPLACE FUNCTION public.inter_merit_lists_public()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'college', 'Government Higher Secondary School Ghallanai',
        'level', 'Intermediate',
        'program', m.program_name,
        'quota', initcap(replace(m.quota::text, '_', ' ')),
        'list_no', m.list_no,
        'title', m.title,
        'no_of_applicants', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id),
        'listed_count', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id AND e.is_listed),
        'not_listed_count', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id AND NOT e.is_listed),
        'published_on', to_char(m.published_at, 'Day DD Mon, YYYY'),
        'admission_start_date', to_char(m.admission_start_date, 'DD-Mon-YYYY'),
        'admission_last_date', to_char(m.admission_last_date, 'DD-Mon-YYYY')
    ) ORDER BY m.list_no DESC, m.program_id, m.quota), '[]'::jsonb)
    FROM public.inter_merit_lists m
    WHERE m.is_published;
$$;

CREATE OR REPLACE FUNCTION public.inter_merit_list_view(p_merit_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_merit_lists;
BEGIN
    SELECT * INTO v_row FROM public.inter_merit_lists
     WHERE id = p_merit_list_id AND is_published;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'list', jsonb_build_object(
            'id', v_row.id, 'title', v_row.title,
            'program', v_row.program_name,
            'quota', initcap(replace(v_row.quota::text, '_', ' ')),
            'list_no', v_row.list_no,
            'admission_start_date', to_char(v_row.admission_start_date, 'DD-Mon-YYYY'),
            'admission_last_date', to_char(v_row.admission_last_date, 'DD-Mon-YYYY'),
            'instructions', v_row.instructions,
            'published_on', to_char(v_row.published_at, 'Day DD Mon, YYYY')),
        'entries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id,
                'position', e.position, 'tracking_id', e.tracking_id,
                'name', e.name, 'father_name', e.father_name,
                'total_marks', e.total_marks, 'obtained_marks', e.obtained_marks,
                'net_marks', e.net_marks, 'percentage', e.percentage,
                'remarks', e.remarks, 'is_listed', e.is_listed)
                ORDER BY e.position), '[]'::jsonb)
            FROM public.inter_merit_list_entries e
            WHERE e.merit_list_id = v_row.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_merit_view(p_merit_list_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_merit_lists;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT * INTO v_row FROM public.inter_merit_lists WHERE id = p_merit_list_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;
    RETURN jsonb_build_object(
        'ok', true,
        'list', jsonb_build_object('id', v_row.id, 'title', v_row.title,
            'instructions', v_row.instructions, 'is_published', v_row.is_published),
        'entries', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'id', e.id, 'position', e.position, 'tracking_id', e.tracking_id,
                'name', e.name, 'father_name', e.father_name,
                'total_marks', e.total_marks, 'obtained_marks', e.obtained_marks,
                'net_marks', e.net_marks, 'percentage', e.percentage,
                'remarks', e.remarks, 'is_listed', e.is_listed) ORDER BY e.position), '[]'::jsonb)
            FROM public.inter_merit_list_entries e
            WHERE e.merit_list_id = v_row.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_merit_lists()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'lists', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', m.id, 'program', m.program_name,
            'quota', initcap(replace(m.quota::text, '_', ' ')),
            'list_no', m.list_no, 'title', m.title,
            'is_published', m.is_published,
            'published_at', to_char(m.published_at, 'DD-Mon-YYYY'),
            'created_at', to_char(m.created_at, 'DD-Mon-YYYY'),
            'admission_start_date', to_char(m.admission_start_date, 'DD-Mon-YYYY'),
            'admission_last_date', to_char(m.admission_last_date, 'DD-Mon-YYYY'),
            'no_of_applicants', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id),
            'listed_count', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id AND e.is_listed),
            'not_listed_count', (SELECT count(*) FROM public.inter_merit_list_entries e WHERE e.merit_list_id = m.id AND NOT e.is_listed)
        ) ORDER BY m.list_no DESC, m.program_id, m.quota), '[]'::jsonb)
        FROM public.inter_merit_lists m));
END;
$$;

-- 5 ─ Clean start: remove the old test / duplicate lists once ──────────────
-- (unpublished + published; applicants go back to "Awaiting Review")
-- Uncomment ONLY if you want to wipe every existing merit list right now.
-- UPDATE public.inter_applications SET status = 'fee_paid', updated_at = now()
--  WHERE status::text IN ('merit_listed', 'under_review') AND payment_status = 'paid';
-- DELETE FROM public.inter_merit_lists WHERE true;
