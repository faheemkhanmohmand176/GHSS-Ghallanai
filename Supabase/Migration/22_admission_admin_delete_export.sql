-- ═══════════════════════════════════════════════════════════════════════
-- 22_admission_admin_delete_export.sql
-- Run AFTER 21. SAFE TO RE-RUN.
--  1. inter_admin_delete_application : admin deletes one application
--  2. inter_admin_export             : every applicant field, for Excel
--  3. inter_admin_merit_view         : admin can open DRAFT merit lists
--  4. inter_admin_set_payment        : marking paid no longer pushes a
--                                      merit-listed / admitted application
--                                      back to "Fee Paid"
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inter_admin_delete_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_track text;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    SELECT tracking_id INTO v_track FROM public.inter_applications WHERE id = p_application_id;
    IF v_track IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.inter_merit_list_entries e
        JOIN public.inter_merit_lists l ON l.id = e.merit_list_id
        WHERE e.application_id = p_application_id AND l.is_published
    ) THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'This application is in a published merit list. Unpublish that list first.');
    END IF;
    -- timeline and draft merit entries are removed by ON DELETE CASCADE
    DELETE FROM public.inter_applications WHERE id = p_application_id;
    RETURN jsonb_build_object('ok', true, 'tracking_id', v_track);
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_export()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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
                'remarks', e.remarks) ORDER BY e.position), '[]'::jsonb)
            FROM public.inter_merit_list_entries e
            WHERE e.merit_list_id = v_row.id));
END;
$$;

CREATE OR REPLACE FUNCTION public.inter_admin_set_payment(
    p_application_id uuid, p_payment_status text, p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_row public.inter_applications;
BEGIN
    IF NOT public.inter_is_admin() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Admin access required.');
    END IF;
    IF p_payment_status NOT IN ('pending', 'paid', 'rejected') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invalid payment status.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications WHERE id = p_application_id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    UPDATE public.inter_applications
        SET payment_status = p_payment_status::public.inter_payment_status,
            payment_reference = p_reference,
            paid_at = CASE WHEN p_payment_status = 'paid' THEN now() ELSE NULL END,
            status = CASE WHEN p_payment_status = 'paid' AND status IN ('submitted', 'fee_pending')
                          THEN 'fee_paid'::public.inter_app_status ELSE status END,
            updated_at = now()
        WHERE id = p_application_id;
    INSERT INTO public.inter_application_timeline (application_id, title, details)
    VALUES (p_application_id,
            CASE WHEN p_payment_status = 'paid' THEN 'Processing Fee Received'
                 ELSE 'Processing Fee ' || initcap(p_payment_status) END,
            CASE WHEN p_payment_status = 'paid'
                 THEN 'Payment of Rs. ' || v_row.processing_fee || ' confirmed'
                      || CASE WHEN nullif(p_reference, '') IS NOT NULL THEN ' (Ref: ' || p_reference || ')' ELSE '' END
                 ELSE 'Fee payment marked ' || p_payment_status END);
    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.inter_admin_delete_application(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inter_admin_export() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inter_admin_merit_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inter_admin_delete_application(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_admin_export() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inter_admin_merit_view(uuid) TO authenticated, service_role;
