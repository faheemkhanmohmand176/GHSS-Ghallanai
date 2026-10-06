-- ============================================================================
-- GHSS GHALANAI · RLS POLICIES FOR ADMISSION PORTAL · 0006
-- ----------------------------------------------------------------------------
-- RLS for every new table created in 0005_admission_portal.sql.
--
-- Rules:
--   * admission_applicants — applicant reads/updates own row; admin reads all
--   * admissions (existing table, new columns) — anon INSERT for new applications;
--     applicant reads own via profile_id match; admin reads/manages all
--   * admission_status_timeline — append-only; applicant reads own; admin reads all
--   * admission_cycles — public read; admin write
--   * admission_quota_config — public read; admin write
--   * programme_subjects — public read; admin write
--   * admission_otp_codes — applicant reads own; anon INSERT for password_reset
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ADMISSION APPLICANTS
-- ---------------------------------------------------------------------------
alter table public.admission_applicants enable row level security;

create policy "applicants_read_own" on public.admission_applicants
  for select to authenticated
  using (profile_id = auth.uid());

create policy "applicants_insert_own" on public.admission_applicants
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "applicants_update_own" on public.admission_applicants
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "applicants_admin_read" on public.admission_applicants
  for select to authenticated
  using (public.is_admin());

create policy "applicants_admin_manage" on public.admission_applicants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSIONS (existing table — EXTEND with new policies for new columns)
-- The existing policies already allow anon INSERT (status='received'),
-- admin read/update. Add a policy so applicants can read their OWN application
-- once they sign in (matched by applicant_id → profile_id).
-- ---------------------------------------------------------------------------
create policy "admissions_applicant_read_own" on public.admissions
  for select to authenticated
  using (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
  );

create policy "admissions_applicant_update_own" on public.admissions
  for update to authenticated
  using (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
    and status = 'received'  -- applicant can edit only before review
  )
  with check (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- ADMISSION STATUS TIMELINE — append-only
-- ---------------------------------------------------------------------------
alter table public.admission_status_timeline enable row level security;

-- applicant reads own timeline (joined via application_id → applicant_id → profile_id)
create policy "timeline_applicant_read_own" on public.admission_status_timeline
  for select to authenticated
  using (
    application_id in (
      select a.id from public.admissions a
      join public.admission_applicants ap on ap.id = a.applicant_id
      where ap.profile_id = auth.uid()
    )
  );

create policy "timeline_admin_read" on public.admission_status_timeline
  for select to authenticated
  using (public.is_admin());

-- Insert via the SECURITY DEFINER RPC `update_application_status` only — no direct INSERT
-- from any role (the function bypasses RLS because it's SECURITY DEFINER).
revoke insert on public.admission_status_timeline from anon, authenticated;

-- Allow admin to insert directly (in case RPC is bypassed)
create policy "timeline_admin_insert" on public.admission_status_timeline
  for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSION CYCLES — public read; admin write
-- ---------------------------------------------------------------------------
alter table public.admission_cycles enable row level security;

create policy "cycles_public_read" on public.admission_cycles
  for select to anon, authenticated
  using (true);

create policy "cycles_admin_manage" on public.admission_cycles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSION QUOTA CONFIG — public read; admin write
-- ---------------------------------------------------------------------------
alter table public.admission_quota_config enable row level security;

create policy "quotas_public_read" on public.admission_quota_config
  for select to anon, authenticated
  using (true);

create policy "quotas_admin_manage" on public.admission_quota_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PROGRAMME SUBJECTS — public read; admin write
-- ---------------------------------------------------------------------------
alter table public.programme_subjects enable row level security;

create policy "subjects_public_read" on public.programme_subjects
  for select to anon, authenticated
  using (true);

create policy "subjects_admin_manage" on public.programme_subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSION OTP CODES — applicant reads own; anon can INSERT (for password reset flow)
-- ---------------------------------------------------------------------------
alter table public.admission_otp_codes enable row level security;

create policy "otp_applicant_read_own" on public.admission_otp_codes
  for select to authenticated
  using (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
  );

create policy "otp_admin_read" on public.admission_otp_codes
  for select to authenticated
  using (public.is_admin());

-- Anon can request OTP (insert) — the OTP is sent via SMS, expires in 10 min
create policy "otp_anon_insert" on public.admission_otp_codes
  for insert to anon, authenticated
  with check (true);

-- Applicants can verify (update) their own OTP — set is_verified = true
create policy "otp_applicant_update_own" on public.admission_otp_codes
  for update to authenticated
  using (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
  )
  with check (
    applicant_id in (
      select id from public.admission_applicants
      where profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.admission_applicants to authenticated;
grant select, insert, update, delete on public.admission_status_timeline to authenticated;
grant select on public.admission_cycles to anon, authenticated;
grant select, insert, update, delete on public.admission_cycles to authenticated;
grant select on public.admission_quota_config to anon, authenticated;
grant select, insert, update, delete on public.admission_quota_config to authenticated;
grant select on public.programme_subjects to anon, authenticated;
grant select, insert, update, delete on public.programme_subjects to authenticated;
grant select, insert, update on public.admission_otp_codes to anon, authenticated;
grant select, insert, update, delete on public.admission_otp_codes to authenticated;

-- Revoke execute on internal RPCs from anon
revoke execute on function public.update_application_status(uuid, public.admission_status, text) from anon;

-- ---------------------------------------------------------------------------
-- DONE — 0006_admission_rls.sql
-- ---------------------------------------------------------------------------
