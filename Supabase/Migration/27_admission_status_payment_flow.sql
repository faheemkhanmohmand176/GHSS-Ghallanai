-- ===========================================================================
--  27 · ADMISSION STATUS + PAYMENT FLOW
-- ---------------------------------------------------------------------------
--  The problem this migration solves
--  --------------------------------
--  The admin console offered the SAME fact twice:
--
--    • the "Fee" action wrote   payment_status  (pending | paid | rejected)
--    • the "Status" action ALSO offered "Fee Pending" and "Fee Paid",
--      which wrote  status  (a public.inter_app_status enum value)
--
--  Two columns, one meaning.  Setting status = 'fee_paid' never touched
--  payment_status, so the public tracker could report "Fee Paid — payment
--  confirmed" for an application whose fee was still outstanding.  The
--  reverse was true too: inter_admin_set_payment already moved status to
--  'fee_paid' by itself, so the admin's manual "Fee Paid" click added
--  nothing except a redundant timeline entry ("Status Updated: Fee Paid").
--
--  The model after this migration
--  ------------------------------
--    payment_status (pending|paid|rejected)  ← money.  Owned by the Fee
--                                                 action ONLY.
--    status         (inter_app_status)        ← the college's workflow.
--                                                 Owned by the Status action
--                                                 ONLY, and the admin may now
--                                                 choose exactly five
--                                                 stages:
--                                                    under_review
--                                                    merit_listed
--                                                    admitted
--                                                    rejected
--                                                    cancelled
--                                                 'submitted', 'fee_pending'
--                                                 and 'fee_paid' stay in the
--                                                 enum (rows still use them)
--                                                 but they are SYSTEM-managed
--                                                 and the Status action now
--                                                 rejects them.
--
--  A stage that can only be reached with money in hand
--  ---------------------------------------------------
--  'under_review', 'merit_listed' and 'admitted' all sit BEHIND the fee, so
--  they are refused while payment_status <> 'paid'.  That removes the last
--  way for the two columns to contradict each other.
--
--  Also in this migration
--  -----------------------
--    • inter_track_by_id(text) — the public tracker's RPC existed in the
--      live database but was NOT in version control (it had been added
--      straight through the Supabase dashboard).  It is re-created here so
--      a rebuilt database keeps working, and it now also returns
--      payment_method.
--    • inter_admin_set_payment_full(...) — records the payment METHOD
--      (bank / easypaisa / jazzcash / cash / safepay / other) next to the
--      payment reference.  inter_admin_set_payment(...) stays as a
--      compatibility wrapper so a client that has not been redeployed yet
--      keeps working.
--    • inter_admin_list / inter_admin_export — now carry payment_method.
--
--  Safe to re-run.
-- ===========================================================================


-- ===========================================================================
--  1 · PUBLIC TRACKER — inter_track_by_id(text)
-- ---------------------------------------------------------------------------
--  Lookup by Tracking ID only, so the applicant can check an application
--  without an account (the site's "Track Application" form).  The applied
--  status is returned as stored; the CLIENT derives the human-facing stage
--  from status + payment_status so the two facts can never contradict
--  each other on screen.
-- ===========================================================================
DROP FUNCTION IF EXISTS public.inter_track_by_id(text);

CREATE FUNCTION public.inter_track_by_id(p_tracking_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key text;
    a     public.inter_applications;
BEGIN
    v_key := upper(regexp_replace(coalesce(p_tracking_id, ''), '[^A-Za-z0-9]', '', 'g'));
    IF v_key = '' THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    SELECT x.* INTO a
      FROM public.inter_applications x
     WHERE upper(regexp_replace(x.tracking_id, '[^A-Za-z0-9]', '', 'g')) = v_key
     ORDER BY x.submitted_at DESC
     LIMIT 1;

    IF a.id IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'tracking_id', a.tracking_id,
        'college', 'Government Higher Secondary School Ghallanai',
        'program', a.program_name,
        'subject_group', a.subject_group,
        'quota', a.quota::text,
        'payment_status', initcap(a.payment_status::text),
        'payment_method', a.payment_method,
        -- the challan / payment reference the applicant pays against
        -- (unchanged from the deployed function — the applicant needs this one)
        'payment_reference', a.jazzcash_token,
        -- the receipt / transaction number the college recorded for the payment
        'payment_receipt', a.payment_reference,
        'status', a.status::text,
        'processing_fee', a.processing_fee,
        'application_date', to_char(a.submitted_at, 'DD Mon YYYY'),
        'fee_deadline', to_char(a.fee_deadline, 'DD Mon YYYY'),
        'timeline', (
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                'title', t.title, 'details', t.details,
                'date', to_char(t.created_at, 'DD Mon YYYY HH12:MI AM'))
                ORDER BY t.created_at), '[]'::jsonb)
            FROM public.inter_application_timeline t
            WHERE t.application_id = a.id)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inter_track_by_id(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.inter_track_by_id(text) TO anon, authenticated, service_role;


-- ===========================================================================
--  2 · STATUS ACTION — workflow stages only
-- ---------------------------------------------------------------------------
--  Same signature as before, so a redeployed OR an old client both work.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_set_status(
    p_application_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row  public.inter_applications;
    v_stage text;
    v_label text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;

    v_stage := lower(trim(coalesce(p_status, '')));

    -- The payment states are not workflow stages — the Fee action owns them.
    IF v_stage NOT IN ('under_review','merit_listed','admitted','rejected','cancelled') THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'That is a payment state, not a workflow stage. Use the Fee action to record the processing fee, '
            'then move the application to Under Review, Merit Listed or Admitted here.');
    END IF;

    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;

    -- Review, merit and admission all sit behind the processing fee.
    IF v_stage IN ('under_review','merit_listed','admitted')
       AND v_row.payment_status <> 'paid' THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Mark the processing fee as paid (Fee action) before moving the application to this stage.');
    END IF;

    -- Nothing to do — do not write a duplicate timeline entry.
    IF v_row.status::text = v_stage THEN
        RETURN jsonb_build_object('ok', true, 'unchanged', true);
    END IF;

    UPDATE public.inter_applications
       SET status      = v_stage::public.inter_app_status,
           admin_note  = coalesce(nullif(p_note, ''), admin_note),
           updated_at  = now()
     WHERE id = v_row.id;

    v_label := CASE v_stage
                   WHEN 'under_review' THEN 'Under Review'
                   WHEN 'merit_listed' THEN 'Merit Listed'
                   WHEN 'admitted'     THEN 'Admitted'
                   WHEN 'rejected'     THEN 'Rejected'
                   ELSE 'Cancelled'
               END;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_row.id,
            'Status Updated: ' || v_label,
            coalesce(nullif(p_note, ''), 'Application moved to ' || v_label || ' by the college.'));

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- ===========================================================================
--  3 · FEE ACTION — payment status + method + reference
-- ---------------------------------------------------------------------------
--  inter_admin_set_payment_full is the new entry point: it records HOW the
--  fee was paid (payment_method) next to the receipt reference, keeps
--  `status` in step with `payment_status`, and refuses to regress an
--  application that is already on the merit list or admitted.
--
--  `status` is kept in step on purpose:
--    paid     → status = 'fee_paid'      (the fee milestone is reached)
--    pending  → status = 'fee_pending'   (the fee is outstanding again)
--    rejected → status = 'fee_pending'   (the fee was NOT received)
--  so the workflow column can never say "Fee Paid" for an unpaid fee.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_set_payment_full(
    p_application_id  uuid,
    p_payment_status  text,
    p_reference       text DEFAULT NULL,
    p_payment_method  text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row      public.inter_applications;
    v_pay      text;
    v_ref      text;
    v_method   text;
    v_method_label text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;

    v_pay := lower(trim(coalesce(p_payment_status, '')));
    IF v_pay NOT IN ('pending','paid','rejected') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Unknown payment status.');
    END IF;

    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;

    -- Never regress a merit_listed / admitted application.
    IF v_row.status IN ('merit_listed','admitted') AND v_pay <> 'paid' THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Cannot change payment for an application already on the merit list.');
    END IF;

    v_ref    := nullif(trim(coalesce(p_reference, '')), '');
    v_method := nullif(lower(trim(coalesce(p_payment_method, ''))), '');
    IF v_method IS NOT NULL
       AND v_method NOT IN ('bank','easypaisa','jazzcash','cash','safepay','other') THEN
        v_method := 'other';
    END IF;
    -- Keep the method already on file when the caller does not send one.
    IF v_method IS NULL THEN
        v_method := v_row.payment_method;
    END IF;

    v_method_label := CASE v_method
                          WHEN 'bank'      THEN 'Bank'
                          WHEN 'easypaisa' THEN 'EasyPaisa'
                          WHEN 'jazzcash'  THEN 'JazzCash'
                          WHEN 'cash'      THEN 'Cash at School'
                          WHEN 'safepay'   THEN 'Online Payment'
                          WHEN 'other'     THEN 'Other'
                          ELSE NULL
                      END;

    -- Nothing actually changed — do not write a duplicate timeline entry.
    IF v_row.payment_status::text = v_pay
       AND v_row.payment_method IS NOT DISTINCT FROM v_method
       AND (v_pay <> 'paid' OR v_row.payment_reference IS NOT DISTINCT FROM v_ref) THEN
        RETURN jsonb_build_object('ok', true, 'unchanged', true);
    END IF;

    UPDATE public.inter_applications
       SET payment_status    = v_pay::public.inter_payment_status,
           payment_reference = CASE
                                  WHEN v_pay = 'paid' THEN v_ref
                                  ELSE coalesce(v_ref, payment_reference)
                              END,
           payment_method    = CASE WHEN v_pay = 'paid' THEN v_method ELSE NULL END,
           payment_provider  = CASE
                                  WHEN v_pay = 'paid' AND v_method = 'safepay' THEN 'safepay'
                                  WHEN v_pay = 'paid' THEN 'manual'
                                  ELSE NULL
                              END,
           paid_at    = CASE WHEN v_pay = 'paid' THEN now() ELSE NULL END,
           locked_at  = CASE WHEN v_pay = 'paid' THEN now() ELSE NULL END,
           locked_by  = CASE WHEN v_pay = 'paid' THEN auth.uid() ELSE NULL END,
           status     = CASE
                           WHEN v_pay = 'paid' THEN 'fee_paid'::public.inter_app_status
                           WHEN v_row.status IN ('submitted','fee_pending','fee_paid')
                               THEN 'fee_pending'::public.inter_app_status
                           ELSE v_row.status
                       END,
           updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (v_row.id,
            CASE WHEN v_pay = 'paid' THEN 'Processing Fee Received'
                 ELSE 'Processing Fee ' || initcap(v_pay) END,
            CASE WHEN v_pay = 'paid'
                 THEN 'Payment of Rs. ' || v_row.processing_fee || ' confirmed'
                      || CASE WHEN v_method_label IS NOT NULL THEN ' via ' || v_method_label ELSE '' END
                      || CASE WHEN v_ref IS NOT NULL THEN ' (Ref: ' || v_ref || ')' ELSE '' END
                 ELSE 'Fee payment marked ' || v_pay END);

    RETURN jsonb_build_object('ok', true);
END;
$$;


-- Compatibility wrapper: the OLD three-argument call still works, it simply
-- does not carry a payment method.
CREATE OR REPLACE FUNCTION public.inter_admin_set_payment(
    p_application_id uuid, p_payment_status text, p_reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT public.inter_admin_set_payment_full(p_application_id, p_payment_status, p_reference, NULL);
$$;


-- ===========================================================================
--  4 · ADMIN LIST + EXPORT — carry the payment method
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.inter_admin_list(p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'applications', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', a.id, 'tracking_id', a.tracking_id,
            'applicant_cnic', ap.cnic_formb, 'applicant_mobile', ap.mobile_number,
            'name', pp.full_name, 'father_name', pp.father_name,
            'program', a.program_name, 'subject_group', a.subject_group,
            'quota', a.quota::text,
            'quota_criteria', a.quota_criteria,
            'payment_status', a.payment_status::text, 'status', a.status::text,
            'payment_method', a.payment_method,
            'payment_reference', a.payment_reference,
            'jazzcash_token', a.jazzcash_token,
            'fee_deadline', to_char(a.fee_deadline, 'DD-Mon-YYYY'),
            'marks', (s.marks_obtained || '/' || s.marks_total),
            'grade', s.grade, 'percentage', s.marks_percentage,
            'submitted_at', to_char(a.submitted_at, 'DD-Mon-YYYY'),
            'domicile', pp.domicile_district, 'uc', pp.union_council
        ) ORDER BY a.submitted_at DESC), '[]'::jsonb)
        FROM public.inter_applications a
        JOIN public.inter_applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
        LEFT JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
        WHERE p_search IS NULL
           OR a.tracking_id ILIKE '%' || p_search || '%'
           OR pp.full_name ILIKE '%' || p_search || '%'
           OR ap.cnic_formb LIKE '%' || regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g') || '%')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_export()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'rows', (
        SELECT coalesce(jsonb_agg(
            jsonb_build_object(
                'tracking_id', a.tracking_id, 'program', a.program_name,
                'subject_group', a.subject_group, 'quota', a.quota::text,
                'quota_criteria', a.quota_criteria, 'quota_uc', a.quota_criteria_uc,
                'sport_certificate', coalesce(a.sport_certificate, s.sport_certificate),
                'nature_of_disability', a.nature_of_disability,
                'parent_department', a.parent_department,
                'parent_serving_district', a.parent_serving_district,
                'shift', a.shift, 'status', a.status::text,
                'payment_status', a.payment_status::text,
                'payment_method', a.payment_method,
                'payment_reference', a.payment_reference,
                'fee_reference', a.jazzcash_token, 'processing_fee', a.processing_fee,
                'fee_deadline', to_char(a.fee_deadline AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD'),
                'submitted_at', to_char(a.submitted_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI'),
                'paid_at', to_char(a.paid_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD HH24:MI'),
                'admin_note', a.admin_note
            ) || jsonb_build_object(
                'cnic', ap.cnic_formb, 'applicant_mobile', ap.mobile_number,
                'nationality', pp.nationality, 'full_name', pp.full_name,
                'father_name', pp.father_name,
                'dob', to_char(pp.date_of_birth, 'YYYY-MM-DD'), 'gender', pp.gender,
                'email', pp.email_address, 'landline', pp.landline_number,
                'religion', pp.religion, 'province', pp.domicile_province,
                'district', pp.domicile_district, 'tehsil', pp.tehsil,
                'union_council', pp.union_council, 'address', pp.mailing_address,
                'blood_group', pp.blood_group, 'father_cnic', pp.father_cnic,
                'father_mobile', pp.father_mobile, 'mother_name', pp.mother_name,
                'mother_cnic', pp.mother_cnic, 'hafiz', pp.hafiz_e_quran
            ) || jsonb_build_object(
                'ssc_session', s.exam_session, 'ssc_board', s.exam_board,
                'ssc_year', s.passing_year, 'ssc_group', s.study_group,
                'ssc_roll', s.roll_number, 'ssc_obtained', s.marks_obtained,
                'ssc_total', s.marks_total, 'ssc_percentage', s.marks_percentage,
                'ssc_grade', s.grade, 'inst_province', s.institute_province,
                'inst_district', s.institute_district, 'inst_name', s.institute_name,
                'board_verified', s.board_record_verified
            )
            ORDER BY a.submitted_at DESC), '[]'::jsonb)
        FROM public.inter_applications a
        JOIN public.inter_applicants ap ON ap.id = a.applicant_id
        LEFT JOIN public.inter_personal_profiles pp ON pp.applicant_id = a.applicant_id
        LEFT JOIN public.inter_ssc_profiles s ON s.applicant_id = a.applicant_id
    ));
END;
$$;


-- ===========================================================================
--  5 · GRANTS — keep the access model of migration 24 intact
-- ===========================================================================
REVOKE EXECUTE ON FUNCTION public.inter_admin_set_payment_full(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_set_payment_full(uuid,text,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.inter_admin_set_payment(uuid,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_set_payment(uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.inter_admin_set_status(uuid,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_set_status(uuid,text,text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.inter_admin_list(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_list(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.inter_admin_export() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.inter_admin_export() TO authenticated, service_role;

-- Re-assert the bulk grants of migration 24 so a re-run of any earlier
-- hardening script cannot lock the public flow out of anything, and so the
-- functions added above get the same treatment as their siblings.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname LIKE 'inter\_%'
  LOOP
    IF r.proname LIKE 'inter\_admin\_%' OR r.proname = 'inter_is_admin'
       OR r.proname IN ('inter_random_suffix') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
    ELSIF r.proname IN ('inter_register','inter_login') THEN
      NULL;
    ELSIF r.proname = 'inter_track' THEN
      NULL;
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role', r.proname, r.args);
    END IF;
  END LOOP;
END $$;
