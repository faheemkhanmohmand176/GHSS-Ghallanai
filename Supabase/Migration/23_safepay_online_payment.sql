-- ═══════════════════════════════════════════════════════════════════════════
-- 23 · Safepay online payment (Easypaisa / JazzCash wallets, cards)
--
--  Adds automatic, per-applicant fee collection through Safepay.
--  • orderId sent to Safepay  = inter_applications.tracking_id
--    (already UNIQUE + indexed → webhook lookup is a single index hit).
--  • All money-state changes happen ONLY inside SECURITY DEFINER functions
--    that are executable by the service role (the Vercel function) — never by
--    the browser. The webhook signature is verified before they are called.
--  • Idempotent: Safepay may deliver the same event many times.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1 · New columns on applications -------------------------------------------------
ALTER TABLE public.inter_applications
    ADD COLUMN IF NOT EXISTS safepay_tracker         text,
    ADD COLUMN IF NOT EXISTS safepay_transaction_id  text,
    ADD COLUMN IF NOT EXISTS payment_method          text,
    ADD COLUMN IF NOT EXISTS payment_provider        text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_safepay_tracker
    ON public.inter_applications (safepay_tracker) WHERE safepay_tracker IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_safepay_txn
    ON public.inter_applications (safepay_transaction_id) WHERE safepay_transaction_id IS NOT NULL;
-- tracking_id (the Safepay orderId) is UNIQUE already; make the lookup index explicit.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_apps_tracking_lookup
    ON public.inter_applications (tracking_id);

-- 2 · Admin switch (no hardcoded behaviour) --------------------------------------
ALTER TABLE public.admission_settings
    ADD COLUMN IF NOT EXISTS online_payment_enabled boolean NOT NULL DEFAULT true;

-- 3 · Payment event ledger (audit + replay protection) ---------------------------
CREATE TABLE IF NOT EXISTS public.inter_payment_events (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider     text        NOT NULL DEFAULT 'safepay',
    kind         text        NOT NULL CHECK (kind IN ('checkout_created', 'webhook')),
    tracking_id  text,
    tracker      text,
    state        text,
    event_key    text,
    amount       numeric,
    currency     text,
    outcome      text,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inter_payment_events_key
    ON public.inter_payment_events (provider, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inter_payment_events_track
    ON public.inter_payment_events (tracking_id, created_at DESC);

ALTER TABLE public.inter_payment_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (server) can read or write it.
REVOKE ALL ON public.inter_payment_events FROM anon, authenticated;

-- 4 · Context for creating a checkout (verifies the applicant session) -----------
CREATE OR REPLACE FUNCTION public.inter_payment_context(p_token uuid, p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_app public.inter_applicants;
    v_row public.inter_applications;
    v_online boolean;
BEGIN
    v_app := public.inter_auth(p_token);
    IF v_app.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Session expired. Please login again.');
    END IF;
    SELECT * INTO v_row FROM public.inter_applications
        WHERE id = p_application_id AND applicant_id = v_app.id;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Application not found.');
    END IF;
    SELECT coalesce(online_payment_enabled, true) INTO v_online
        FROM public.admission_settings WHERE id = 1;

    RETURN jsonb_build_object(
        'ok', true,
        'application_id', v_row.id,
        'tracking_id', v_row.tracking_id,
        'processing_fee', v_row.processing_fee,
        'payment_status', v_row.payment_status,
        'status', v_row.status,
        'deadline_passed', v_row.fee_deadline < now(),
        'online_enabled', coalesce(v_online, true)
    );
END;
$$;

-- 5 · Apply a verified Safepay event -------------------------------------------
-- p_state: 'paid' | 'failed'. Idempotent. Validates tracker + amount + currency.
CREATE OR REPLACE FUNCTION public.inter_safepay_apply(
    p_tracking_id text,
    p_tracker     text,
    p_state       text,
    p_txn_id      text,
    p_amount      numeric,
    p_currency    text,
    p_method      text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row public.inter_applications;
BEGIN
    SELECT * INTO v_row FROM public.inter_applications
        WHERE tracking_id = p_tracking_id FOR UPDATE;
    IF v_row.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'unknown_order');
    END IF;

    -- The tracker must be one WE issued for this exact application.
    IF NOT EXISTS (
        SELECT 1 FROM public.inter_payment_events
         WHERE kind = 'checkout_created' AND tracking_id = p_tracking_id AND tracker = p_tracker
    ) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'tracker_mismatch');
    END IF;

    IF p_state = 'paid' THEN
        IF v_row.payment_status = 'paid' THEN
            RETURN jsonb_build_object('ok', true, 'code', 'already_paid');
        END IF;
        IF upper(coalesce(p_currency, 'PKR')) <> 'PKR'
           OR p_amount IS NULL OR p_amount < v_row.processing_fee THEN
            RETURN jsonb_build_object('ok', false, 'code', 'amount_mismatch');
        END IF;

        UPDATE public.inter_applications
           SET payment_status        = 'paid',
               paid_at               = now(),
               safepay_tracker       = p_tracker,
               safepay_transaction_id= nullif(p_txn_id, ''),
               payment_method        = coalesce(nullif(p_method, ''), 'safepay'),
               payment_provider      = 'safepay',
               payment_reference     = coalesce(nullif(p_txn_id, ''), p_tracker),
               confirmed_at          = coalesce(confirmed_at, now()),
               status = CASE WHEN status IN ('submitted', 'fee_pending')
                             THEN 'fee_paid'::public.inter_app_status ELSE status END,
               updated_at            = now()
         WHERE id = v_row.id;

        INSERT INTO public.inter_application_timeline (application_id, title, details)
        VALUES (v_row.id, 'Processing Fee Received',
                'Online payment of Rs. ' || v_row.processing_fee || ' received and verified automatically.');
        RETURN jsonb_build_object('ok', true, 'code', 'paid');
    END IF;

    -- Failed / cancelled attempt: keep the application payable (status stays pending)
    -- so the applicant can simply try again; the attempt is logged on the timeline.
    IF v_row.payment_status <> 'paid' THEN
        INSERT INTO public.inter_application_timeline (application_id, title, details)
        VALUES (v_row.id, 'Online Payment Not Completed',
                'The online payment attempt did not complete. You can try again at any time before the deadline.');
    END IF;
    RETURN jsonb_build_object('ok', true, 'code', 'failed_logged');
END;
$$;

-- 6 · Lock the functions down: server (service_role) only ---------------------
REVOKE ALL ON FUNCTION public.inter_payment_context(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inter_safepay_apply(text, text, text, text, numeric, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inter_payment_context(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.inter_safepay_apply(text, text, text, text, numeric, text, text) TO service_role;
GRANT ALL ON public.inter_payment_events TO service_role;
