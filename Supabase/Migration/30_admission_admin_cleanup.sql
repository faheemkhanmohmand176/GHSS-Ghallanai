-- ═══════════════════════════════════════════════════════════════════════
-- 30_admission_admin_cleanup.sql      SAFE TO RE-RUN
--   1. inter_admin_unlock_application : disabled (a paid / submitted
--      application is final — nobody re-opens it).
--   2. inter_admin_reset_all          : "Delete All" for the next session
--      (export Excel first). Needs the exact confirmation text.
--   3. inter_admin_merit_publish      : publishing a merit list now moves the
--      listed (fee-paid) applicants to "Merit Listed" automatically and
--      writes their timeline; unpublishing reverts them to "Under Review".
-- ═══════════════════════════════════════════════════════════════════════

-- 1 ─ Unlock is gone ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_admin_unlock_application(
    p_application_id uuid,
    p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN jsonb_build_object('ok', false, 'error',
        'Unlocking is disabled. A submitted application is final.');
END;
$$;

-- 2 ─ Delete everything for the next admission session ────────────────────
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

    DELETE FROM public.inter_merit_list_entries;
    DELETE FROM public.inter_merit_lists;
    DELETE FROM public.inter_application_timeline;
    BEGIN
        DELETE FROM public.inter_payment_events;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    DELETE FROM public.inter_applications;
    DELETE FROM public.inter_applicant_sessions;
    DELETE FROM public.inter_personal_profiles;
    DELETE FROM public.inter_ssc_profiles;
    DELETE FROM public.inter_applicants;

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

-- 3 ─ Publishing a merit list updates the applicants ──────────────────────
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
               SET status = 'merit_listed', updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.payment_status = 'paid'
               AND a.status::text IN ('submitted', 'fee_pending', 'fee_paid', 'under_review')
         RETURNING a.id
        )
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        SELECT id, 'Merit Listed', 'Included in the published merit list: ' || v_title FROM moved;
    ELSE
        WITH moved AS (
            UPDATE public.inter_applications a
               SET status = 'under_review', updated_at = now()
              FROM public.inter_merit_list_entries e
             WHERE e.merit_list_id = p_merit_list_id
               AND e.application_id = a.id
               AND a.status::text = 'merit_listed'
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
