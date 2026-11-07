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
