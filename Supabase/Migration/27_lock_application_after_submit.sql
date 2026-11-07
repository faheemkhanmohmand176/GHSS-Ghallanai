-- 27_lock_application_after_submit.sql
-- An admission application can be reviewed and edited ONLY BEFORE the final
-- "Submit Application" (that stage lives on the applicant's own device, nothing
-- is in the database yet).  Once submitted it is final: this function now always
-- refuses, so the lock cannot be bypassed by calling the API directly.
-- Same signature as before, so nothing else needs to change.

CREATE OR REPLACE FUNCTION public.inter_edit_application(
    p_token          uuid,
    p_application_id uuid,
    p_program_id     int,
    p_quota          text,
    p_criteria       jsonb DEFAULT NULL,
    p_subject_group  text  DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN jsonb_build_object(
        'ok', false,
        'error', 'This application has been submitted and can no longer be edited. '
              || 'Contact the school office if something must be corrected.'
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- Profiles (Personal + SSC) are locked too once an application is
-- submitted.  Guard on UPDATE only, so the first-time atomic apply (an
-- INSERT) and re-apply after a cancelled/rejected application still work.
-- Signed-in staff (auth.uid() not null) are never blocked.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.inter_profile_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.inter_applications a
        WHERE a.applicant_id = NEW.applicant_id
          AND a.status::text NOT IN ('cancelled', 'rejected')
          AND a.submitted_at < now()
    ) THEN
        RAISE EXCEPTION 'Your application has been submitted; profile details can no longer be edited.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inter_personal_lock ON public.inter_personal_profiles;
CREATE TRIGGER trg_inter_personal_lock
    BEFORE UPDATE ON public.inter_personal_profiles
    FOR EACH ROW EXECUTE FUNCTION public.inter_profile_lock_guard();

DROP TRIGGER IF EXISTS trg_inter_ssc_lock ON public.inter_ssc_profiles;
CREATE TRIGGER trg_inter_ssc_lock
    BEFORE UPDATE ON public.inter_ssc_profiles
    FOR EACH ROW EXECUTE FUNCTION public.inter_profile_lock_guard();
