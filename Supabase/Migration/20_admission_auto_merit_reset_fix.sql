-- 20_admission_auto_merit_reset_fix.sql
-- Run once in the Supabase SQL editor (safe to re-run).
--
--   1. inter_admin_reset_all   : FIX for  "DELETE requires a WHERE clause"
--                                (Supabase enables pg_safeupdate, which rejects
--                                 every DELETE without a WHERE clause).
--   2. inter_admin_merit_auto  : ONE-CLICK merit list for ALL programs, using
--                                the seats fixed in Programs & Seats.
--
-- Auto merit rules
--   • Only FEE-PAID applications that are not cancelled / rejected / admitted.
--   • Per program, applicants (online + walk-in together) are ranked by net
--     marks = SSC obtained + 20 (Hafiz-e-Quran), ties → earlier application.
--   • The top N are selected, N = program seats − seats already taken by
--     earlier PUBLISHED lists (so 2nd / 3rd lists fill only what is left).
--   • One list is created per program + quota (the public format is kept).
--   • Selected applicants become "Merit Listed"; the other fee-paid ones are
--     moved to "Under Review" (optional).
--   • Re-running with the same list number replaces the DRAFT lists of that
--     number, so the admin can change seats and run it again.
--   • p_dry_run = true only PREVIEWS: nothing is written.

-- 1 ─ Delete All (every DELETE now has a WHERE clause) ─────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_reset_all(p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_apps int; v_lists int;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF p_confirm IS DISTINCT FROM 'DELETE ALL' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Confirmation text did not match.');
    END IF;

    SELECT count(*) INTO v_apps  FROM public.inter_applications;
    SELECT count(*) INTO v_lists FROM public.inter_merit_lists;

    DELETE FROM public.inter_merit_list_entries   WHERE true;
    DELETE FROM public.inter_merit_lists          WHERE true;
    DELETE FROM public.inter_application_timeline WHERE true;
    BEGIN
        DELETE FROM public.inter_payment_events   WHERE true;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    DELETE FROM public.inter_applications         WHERE true;
    DELETE FROM public.inter_applicant_sessions   WHERE true;
    DELETE FROM public.inter_personal_profiles    WHERE true;
    DELETE FROM public.inter_ssc_profiles         WHERE true;
    DELETE FROM public.inter_applicants           WHERE true;

    BEGIN
        PERFORM public.log_admin_action(
            'admission.reset_all', 'admission', 'all',
            'Deleted ' || v_apps || ' application(s) and ' || v_lists || ' merit list(s) for the next session.',
            NULL, NULL);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('ok', true, 'applications', v_apps, 'merit_lists', v_lists);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_reset_all(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_reset_all(text) TO authenticated, service_role;

-- 2 ─ One-click merit list for every program ───────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_merit_auto(
    p_list_no int DEFAULT 1,
    p_admission_start_date date DEFAULT NULL,
    p_admission_last_date date DEFAULT NULL,
    p_instructions text DEFAULT NULL,
    p_publish boolean DEFAULT false,
    p_dry_run boolean DEFAULT false,
    p_review_rest boolean DEFAULT true,
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
    v_published_same boolean;
    v_summary jsonb := '[]'::jsonb;
    v_ids uuid[] := ARRAY[]::uuid[];
    v_total_sel int := 0;
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

    -- Working table (one program at a time)
    CREATE TEMP TABLE IF NOT EXISTS _auto_sel (
        application_id uuid, quota public.inter_quota, tracking_id text,
        name text, father_name text, total_marks numeric, obtained_marks numeric,
        net_marks numeric, rn int
    ) ON COMMIT DROP;
    DELETE FROM _auto_sel WHERE true;

    -- A re-run replaces the DRAFT lists of this number (published ones stay)
    IF NOT p_dry_run THEN
        UPDATE public.inter_applications a
           SET status = 'under_review', updated_at = now()
         WHERE a.status::text = 'merit_listed'
           AND EXISTS (SELECT 1 FROM public.inter_merit_list_entries e
                         JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
                        WHERE e.application_id = a.id AND l.list_no = p_list_no
                          AND NOT l.is_published
                          AND (p_program_id IS NULL OR l.program_id = p_program_id))
           AND NOT EXISTS (SELECT 1 FROM public.inter_merit_list_entries e2
                             JOIN public.inter_merit_lists l2 ON l2.id = e2.merit_list_id
                            WHERE e2.application_id = a.id AND l2.is_published);
        DELETE FROM public.inter_merit_lists l
         WHERE l.list_no = p_list_no AND NOT l.is_published
           AND (p_program_id IS NULL OR l.program_id = p_program_id);
    END IF;

    FOR v_prog IN
        SELECT id, name, seats FROM public.inter_programs
         WHERE is_active AND (p_program_id IS NULL OR id = p_program_id)
         ORDER BY display_order, id
    LOOP
        SELECT EXISTS (SELECT 1 FROM public.inter_merit_lists
                        WHERE program_id = v_prog.id AND list_no = p_list_no AND is_published)
          INTO v_published_same;

        SELECT count(DISTINCT e.application_id) INTO v_taken
          FROM public.inter_merit_list_entries e
          JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
         WHERE l.program_id = v_prog.id AND l.is_published AND l.list_no <> p_list_no;

        v_left := greatest(v_prog.seats - v_taken, 0);

        SELECT count(*) INTO v_unpaid
          FROM public.inter_applications a
         WHERE a.program_id = v_prog.id AND a.payment_status <> 'paid'
           AND a.status::text NOT IN ('cancelled', 'rejected');

        DELETE FROM _auto_sel WHERE true;

        IF NOT v_published_same THEN
            INSERT INTO _auto_sel
            SELECT a.id, a.quota, a.tracking_id,
                   COALESCE(pp.full_name, '—'), COALESCE(pp.father_name, '—'),
                   s.marks_total, s.marks_obtained,
                   s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END,
                   row_number() OVER (ORDER BY
                       (s.marks_obtained + CASE WHEN COALESCE(s.hafiz_e_quran, false) THEN 20 ELSE 0 END) DESC,
                       a.submitted_at ASC, a.tracking_id ASC)
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
                     WHERE e.application_id = a.id AND l.is_published AND l.list_no <> p_list_no);
        END IF;

        SELECT count(*) INTO v_eligible FROM _auto_sel;
        DELETE FROM _auto_sel WHERE rn > v_left;
        SELECT count(*), min(net_marks) INTO v_selected, v_cut FROM _auto_sel;

        IF NOT p_dry_run AND v_selected > 0 THEN
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
                    total_marks, obtained_marks, net_marks, percentage, remarks
                )
                SELECT v_id, x.application_id,
                       row_number() OVER (ORDER BY x.rn),
                       x.tracking_id, x.name, x.father_name,
                       x.total_marks, x.obtained_marks, x.net_marks,
                       round((x.net_marks / x.total_marks) * 100, 2), NULL
                  FROM _auto_sel x WHERE x.quota = v_q.quota;

                v_ids := v_ids || v_id;
                v_total_lists := v_total_lists + 1;
            END LOOP;

            UPDATE public.inter_applications a
               SET status = 'merit_listed', updated_at = now()
             WHERE a.id IN (SELECT application_id FROM _auto_sel);
            INSERT INTO public.inter_application_timeline (application_id, title, details)
            SELECT application_id, 'Included in Merit List',
                   'Selected in the ' || v_ord || ' merit list for ' || v_prog.name || '.'
              FROM _auto_sel;
        END IF;

        IF NOT p_dry_run AND p_review_rest AND NOT v_published_same THEN
            WITH moved AS (
                UPDATE public.inter_applications a
                   SET status = 'under_review', updated_at = now()
                 WHERE a.program_id = v_prog.id AND a.payment_status = 'paid'
                   AND a.status::text IN ('submitted', 'fee_pending', 'fee_paid')
                   AND a.id NOT IN (SELECT application_id FROM _auto_sel)
             RETURNING a.id
            )
            INSERT INTO public.inter_application_timeline (application_id, title, details)
            SELECT id, 'Under Review', 'Reviewed. Not selected in the ' || v_ord || ' merit list.' FROM moved;
        END IF;

        v_total_sel := v_total_sel + v_selected;
        v_summary := v_summary || jsonb_build_object(
            'program_id', v_prog.id, 'program', v_prog.name,
            'seats', v_prog.seats, 'taken', v_taken, 'seats_left', v_left,
            'eligible', v_eligible, 'selected', v_selected,
            'waiting', greatest(v_eligible - v_selected, 0),
            'unpaid', v_unpaid, 'cutoff', v_cut,
            'skipped', CASE WHEN v_published_same THEN 'List ' || p_list_no || ' is already published for this program.' ELSE NULL END);
    END LOOP;

    IF NOT p_dry_run AND p_publish AND array_length(v_ids, 1) IS NOT NULL THEN
        FOREACH v_id IN ARRAY v_ids LOOP
            PERFORM public.inter_admin_merit_publish(v_id, true);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'dry_run', p_dry_run, 'published', (p_publish AND NOT p_dry_run),
        'lists', v_total_lists, 'selected', v_total_sel, 'programs', v_summary);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, boolean, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_merit_auto(int, date, date, text, boolean, boolean, boolean, int) TO authenticated, service_role;
