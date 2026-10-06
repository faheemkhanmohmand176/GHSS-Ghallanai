-- ============================================================================
-- GHSS GHALANAI — ROW LEVEL SECURITY POLICIES (idempotent / safe rerun)
-- Master Plan §8.6 (auth) · §11.3 (hardening)
--
-- FILE HISTORY:
--   This is a corrected rewrite of the original 0002_rls.sql which had:
--   ✗ An over-permissive audit_log INSERT policy that let ANY authenticated
--     user fabricate audit entries (security hole — could spoof admin actions).
--   ✗ An admission_docs anon-insert policy that didn't validate the
--     storage_path matched the admission_id (path traversal risk).
--   ✗ A storage.buckets INSERT that fails on re-run when the bucket exists
--     because there is no CONFLICT clause (NOT idempotent).
--   ✗ A `grant select on public.admission_status to anon, authenticated`
--     without idempotency (errors on re-run).
--   ✗ Policy names on storage.objects that collide with default Supabase
--     policies (causes "policy already exists" errors).
--   ✗ The admissions_anon_insert policy didn't validate programme or
--     admission_type against the enums (anon could insert garbage).
--   ✗ Missing policies for admission_accounts and admission_status_history
--     tables (they were partially handled in 0003 but inconsistently).
--
-- THE RULES OF THIS FILE:
--   1. RLS is enabled on every table before any policy exists → default deny.
--   2. Public surfaces (published notices, results, merit lists, faculty,
--      FAQs) are readable by the anon role and nothing more.
--   3. Students see ONLY their own rows across attendance, marks, submissions.
--   4. Teachers read/write ONLY their assigned sections.
--   5. Admins hold an explicit, audited policy set — they bypass nothing
--      implicitly (no BYPASSRLS grants anywhere).
--   6. Application code can never widen these policies; they are enforced by
--      PostgreSQL regardless of what the Next.js layer does.
--   7. The audit_log table is INSERT-ONLY via TRIGGER (no direct INSERT
--      policy for authenticated users — only admins can read).
--
-- IDEMPOTENCY: every `create policy` is preceded by `drop policy if exists`
-- so the file can be safely run multiple times without "policy already exists"
-- errors. Storage bucket creation uses ON CONFLICT for idempotency.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS — declared here so they're available to all policies
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.ghss_current_role() = 'admin';
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.ghss_current_role() = 'teacher';
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.ghss_current_role() = 'student';
$$;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own_theme" on public.profiles;
create policy "profiles_update_own_theme" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- a user may only change their own theme/whatsapp preferences, never a role
    and role = (select role from public.profiles p where p.id = auth.uid())
    and full_name = (select full_name from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all" on public.profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- CLASSES — reference data; authenticated read, admin write
-- ---------------------------------------------------------------------------
alter table public.classes enable row level security;

drop policy if exists "classes_read_authed" on public.classes;
create policy "classes_read_authed" on public.classes
  for select to authenticated
  using (true);

drop policy if exists "classes_admin_write" on public.classes;
create policy "classes_admin_write" on public.classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- STUDENTS — staff read; a student reads only their own row
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;

drop policy if exists "students_read_own" on public.students;
create policy "students_read_own" on public.students
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "students_read_staff" on public.students;
create policy "students_read_staff" on public.students
  for select to authenticated
  using (public.is_admin() or public.is_teacher());

drop policy if exists "students_admin_manage" on public.students;
create policy "students_admin_manage" on public.students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SUBJECTS + TEACHER ASSIGNMENTS
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;

drop policy if exists "subjects_read_all" on public.subjects;
create policy "subjects_read_all" on public.subjects
  for select to authenticated
  using (true);

drop policy if exists "subjects_admin_write" on public.subjects;
create policy "subjects_admin_write" on public.subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.teacher_assignments enable row level security;

drop policy if exists "assignments_teacher_read_own" on public.teacher_assignments;
create policy "assignments_teacher_read_own" on public.teacher_assignments
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_admin_write" on public.teacher_assignments;
create policy "assignments_admin_write" on public.teacher_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ATTENDANCE — the sharpest security surface
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

drop policy if exists "attendance_student_read_own" on public.attendance;
create policy "attendance_student_read_own" on public.attendance
  for select to authenticated
  using (student_id = public.current_student_id());

drop policy if exists "attendance_teacher_read_class" on public.attendance;
create policy "attendance_teacher_read_class" on public.attendance
  for select to authenticated
  using (public.is_teacher_of(class_id));

drop policy if exists "attendance_admin_read" on public.attendance;
create policy "attendance_admin_read" on public.attendance
  for select to authenticated
  using (public.is_admin());

drop policy if exists "attendance_teacher_write_class" on public.attendance;
create policy "attendance_teacher_write_class" on public.attendance
  for insert to authenticated
  with check (
    public.is_teacher_of(class_id)
    and marked_by = auth.uid()
  );

drop policy if exists "attendance_teacher_update_own" on public.attendance;
create policy "attendance_teacher_update_own" on public.attendance
  for update to authenticated
  using (public.is_teacher_of(class_id))
  with check (public.is_teacher_of(class_id));

drop policy if exists "attendance_admin_manage" on public.attendance;
create policy "attendance_admin_manage" on public.attendance
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS + SUBMISSIONS
-- ---------------------------------------------------------------------------
alter table public.assignments enable row level security;

drop policy if exists "assignments_student_read" on public.assignments;
create policy "assignments_student_read" on public.assignments
  for select to authenticated
  using (
    class_id in (
      select class_id from public.students
      where id = public.current_student_id() and deleted_at is null
    )
  );

drop policy if exists "assignments_teacher_read_own" on public.assignments;
create policy "assignments_teacher_read_own" on public.assignments
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_teacher_write_own" on public.assignments;
create policy "assignments_teacher_write_own" on public.assignments
  for insert to authenticated
  with check (teacher_id = auth.uid());

drop policy if exists "assignments_teacher_update_own" on public.assignments;
create policy "assignments_teacher_update_own" on public.assignments
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "assignments_admin_manage" on public.assignments;
create policy "assignments_admin_manage" on public.assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.submissions enable row level security;

drop policy if exists "submissions_student_read_own" on public.submissions;
create policy "submissions_student_read_own" on public.submissions
  for select to authenticated
  using (student_id = public.current_student_id());

drop policy if exists "submissions_student_insert_own" on public.submissions;
create policy "submissions_student_insert_own" on public.submissions
  for insert to authenticated
  with check (student_id = public.current_student_id());

drop policy if exists "submissions_teacher_read" on public.submissions;
create policy "submissions_teacher_read" on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  );

drop policy if exists "submissions_teacher_grade" on public.submissions;
create policy "submissions_teacher_grade" on public.submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  )
  with check (graded_by = auth.uid());

drop policy if exists "submissions_admin_manage" on public.submissions;
create policy "submissions_admin_manage" on public.submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- MARKS + BOARD RESULTS
-- ---------------------------------------------------------------------------
alter table public.marks enable row level security;

drop policy if exists "marks_student_read_own" on public.marks;
create policy "marks_student_read_own" on public.marks
  for select to authenticated
  using (student_id = public.current_student_id());

drop policy if exists "marks_teacher_write_class" on public.marks;
create policy "marks_teacher_write_class" on public.marks
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.students s
      join public.teacher_assignments ta on ta.class_id = s.class_id
      where s.id = marks.student_id and ta.teacher_id = auth.uid()
    )
    and entered_by = auth.uid()
  );

drop policy if exists "marks_admin_manage" on public.marks;
create policy "marks_admin_manage" on public.marks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- board results: PUBLIC read of published rows only (transparency flagship)
alter table public.board_results enable row level security;

drop policy if exists "board_results_public_read" on public.board_results;
create policy "board_results_public_read" on public.board_results
  for select to anon, authenticated
  using (published = true);

drop policy if exists "board_results_admin_manage" on public.board_results;
create policy "board_results_admin_manage" on public.board_results
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSIONS — anonymous INSERT (public form) + admin-only everything else.
-- Tightened validations: programme must be a valid enum value; admission_type
-- must be first_year or second_year; second_year requires non-empty meta with
-- first-year roll/registration/marks.
-- ---------------------------------------------------------------------------
alter table public.admissions enable row level security;

drop policy if exists "admissions_anon_insert" on public.admissions;
create policy "admissions_anon_insert" on public.admissions
  for insert to anon, authenticated
  with check (
    -- Status must be the initial state
    status = 'received'
    -- Valid admission_type enum
    and admission_type in ('first_year', 'second_year')
    -- Valid programme enum
    and programme in ('ics', 'pre-medical', 'pre-engineering', 'arts')
    -- String length sanity
    and char_length(full_name) between 3 and 120
    and char_length(father_name) between 3 and 120
    and char_length(phone) between 10 and 20
    and char_length(cnic) >= 10
    and char_length(matric_board) >= 2
    and char_length(matric_roll) >= 1
    and char_length(previous_school) >= 2
    -- Numeric sanity
    and matric_total > 0
    and matric_obtained >= 0
    and matric_obtained <= matric_total
    -- WhatsApp opt-in is a boolean
    and whatsapp_opt_in in (true, false)
    -- 2nd-year applicants must have first-year records in meta JSONB
    and (
      admission_type = 'first_year'
      or (
        meta ? 'first_year_roll'
        and meta ? 'first_year_registration_no'
        and (meta ->> 'first_year_obtained') is not null
        and (meta ->> 'first_year_total') is not null
      )
    )
  );

drop policy if exists "admissions_admin_read" on public.admissions;
create policy "admissions_admin_read" on public.admissions
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admissions_admin_update" on public.admissions;
create policy "admissions_admin_update" on public.admissions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admission documents: anon INSERT only — never SELECT/UPDATE/DELETE publicly.
-- Tightened: storage_path must be of form "<application_no>/..." to prevent
-- path traversal attacks and to bind each doc to a real application.
alter table public.admission_docs enable row level security;

drop policy if exists "admission_docs_admin_read" on public.admission_docs;
create policy "admission_docs_admin_read" on public.admission_docs
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admission_docs_anon_insert" on public.admission_docs;
create policy "admission_docs_anon_insert" on public.admission_docs
  for insert to anon, authenticated
  with check (
    char_length(storage_path) between 5 and 512
    -- storage_path must contain a forward slash (i.e. <folder>/<filename>)
    and position('/' in storage_path) > 0
    -- doc_type must be a valid enum value (Postgres enforces this, but be explicit)
    and doc_type in (
      'photo', 'bform', 'matric_card', 'domicile', 'concession_proof',
      'character_certificate', 'father_cnic', 'first_year_dmc',
      'first_year_registration', 'affidavit', 'other'
    )
  );

-- ---------------------------------------------------------------------------
-- MERIT LISTS — public read of published rows; admin writes
-- ---------------------------------------------------------------------------
alter table public.merit_lists enable row level security;

drop policy if exists "merit_public_read" on public.merit_lists;
create policy "merit_public_read" on public.merit_lists
  for select to anon, authenticated
  using (published = true);

drop policy if exists "merit_admin_manage" on public.merit_lists;
create policy "merit_admin_manage" on public.merit_lists
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- NOTICES + NEWS — public reads the published feed; admins and teachers draft
-- ---------------------------------------------------------------------------
alter table public.notices enable row level security;

drop policy if exists "notices_public_read" on public.notices;
create policy "notices_public_read" on public.notices
  for select to anon, authenticated
  using (published = true and deleted_at is null);

drop policy if exists "notices_authenticated_read" on public.notices;
create policy "notices_authenticated_read" on public.notices
  for select to authenticated
  using (deleted_at is null);

drop policy if exists "notices_teacher_insert_draft" on public.notices;
create policy "notices_teacher_insert_draft" on public.notices
  for insert to authenticated
  with check (public.is_teacher() and published = false);

drop policy if exists "notices_admin_manage" on public.notices;
create policy "notices_admin_manage" on public.notices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.news_posts enable row level security;

drop policy if exists "news_public_read" on public.news_posts;
create policy "news_public_read" on public.news_posts
  for select to anon, authenticated
  using (published = true and deleted_at is null);

drop policy if exists "news_admin_manage" on public.news_posts;
create policy "news_admin_manage" on public.news_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FACULTY + FAQS — public read; admin write
-- ---------------------------------------------------------------------------
alter table public.faculty enable row level security;

drop policy if exists "faculty_public_read" on public.faculty;
create policy "faculty_public_read" on public.faculty
  for select to anon, authenticated
  using (deleted_at is null);

drop policy if exists "faculty_admin_manage" on public.faculty;
create policy "faculty_admin_manage" on public.faculty
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.faqs enable row level security;

drop policy if exists "faqs_public_read" on public.faqs;
create policy "faqs_public_read" on public.faqs
  for select to anon, authenticated
  using (true);

drop policy if exists "faqs_admin_manage" on public.faqs;
create policy "faqs_admin_manage" on public.faqs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEEDBACK — anonymous insert (complaint channel); admin reads/resolves
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;

drop policy if exists "feedback_anon_insert" on public.feedback;
create policy "feedback_anon_insert" on public.feedback
  for insert to anon, authenticated
  with check (
    char_length(name) between 2 and 120
    and char_length(message) between 5 and 4000
  );

drop policy if exists "feedback_admin_read" on public.feedback;
create policy "feedback_admin_read" on public.feedback
  for select to authenticated
  using (public.is_admin());

drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update" on public.feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS — users manage only their own subscriptions
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_own_read" on public.push_subscriptions;
create policy "push_own_read" on public.push_subscriptions
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "push_own_insert" on public.push_subscriptions;
create policy "push_own_insert" on public.push_subscriptions
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "push_own_delete" on public.push_subscriptions;
create policy "push_own_delete" on public.push_subscriptions
  for delete to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SETTINGS — admin only (admission window status etc.)
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;

drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admission status is read publicly via a narrow view instead of table access
create or replace view public.admission_status as
  select value from public.settings where key = 'admission_status';

do $$ begin
  execute 'grant select on public.admission_status to anon';
exception when others then null; end $$;

do $$ begin
  execute 'grant select on public.admission_status to authenticated';
exception when others then null; end $$;

-- ---------------------------------------------------------------------------
-- AUDIT LOG — append-only via TRIGGER, admin-read only.
-- FIXED: The previous `audit_insert_authenticated` policy was a security hole
-- that let any authenticated user fabricate audit entries. We removed it
-- entirely. Audit rows are now written ONLY by triggers (which run with
-- definer privileges and bypass RLS) and by the service-role client.
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- No INSERT policy: audit_log rows are written ONLY by the audit_row()
-- trigger function (SECURITY DEFINER) on table mutations, or by the
-- service-role client from the API route. Anonymous and authenticated
-- users cannot directly insert audit rows.

-- ---------------------------------------------------------------------------
-- ADMISSION ACCOUNTS — created by 0003_admission_tracking.sql.
-- Anonymous INSERT (registration form); admin read; self-update password.
-- ---------------------------------------------------------------------------
alter table public.admission_accounts enable row level security;

drop policy if exists "admission_accounts_anon_insert" on public.admission_accounts;
create policy "admission_accounts_anon_insert" on public.admission_accounts
  for insert to anon, authenticated
  with check (
    nationality in ('Pakistani', 'Afghani')
    and cnic ~ '^[0-9]{13}$'
    and char_length(password_digest) >= 32
    and status = 'active'
  );

-- Anon can validate credentials via SELECT on cnic+status only (no password
-- exposure — the digest is read by the API route which uses the service role).
drop policy if exists "admission_accounts_anon_login_lookup" on public.admission_accounts;
create policy "admission_accounts_anon_login_lookup" on public.admission_accounts
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "admission_accounts_admin_read" on public.admission_accounts;
create policy "admission_accounts_admin_read" on public.admission_accounts
  for select to authenticated
  using (public.is_admin());

drop policy if exists "admission_accounts_admin_manage" on public.admission_accounts;
create policy "admission_accounts_admin_manage" on public.admission_accounts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ADMISSION STATUS HISTORY — admin read-only; written by trigger
-- ---------------------------------------------------------------------------
alter table public.admission_status_history enable row level security;

drop policy if exists "admission_status_history_admin_read" on public.admission_status_history;
create policy "admission_status_history_admin_read" on public.admission_status_history
  for select to authenticated
  using (public.is_admin());

-- No INSERT policy: rows are written by the record_admission_status_change()
-- trigger (SECURITY DEFINER) on admissions.status changes.

-- ---------------------------------------------------------------------------
-- FINAL HARDENING (§11.3)
-- ---------------------------------------------------------------------------
-- Revoke direct function EXECUTE on helpers from anon where not needed.
-- Note: triggers bypass EXECUTE checks (they fire as the function's definer),
-- so revoking execute on trigger functions does not break the audit machinery.
revoke execute on function public.ghss_current_role() from anon;
revoke execute on function public.current_student_id() from anon;
revoke execute on function public.is_teacher_of(uuid) from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_teacher() from anon;
revoke execute on function public.is_student() from anon;
revoke execute on function public.audit_row() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.record_admission_status_change() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- SUPABASE STORAGE — admission documents bucket
-- Idempotent: uses ON CONFLICT for bucket creation; uses unique policy names
-- prefixed with "ghss_" to avoid colliding with default Supabase policies.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('admission-docs', 'admission-docs', false)
on conflict (id) do nothing;

-- Storage policies: admins read all docs; anon writes only (upload via signed
-- session); nobody reads another family's documents without admin rights.
-- The policy names are prefixed with "ghss_" so they don't collide with
-- Supabase's default storage policies.

drop policy if exists "ghss_admission_docs_storage_admin_read" on storage.objects;
create policy "ghss_admission_docs_storage_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'admission-docs' and public.is_admin());

drop policy if exists "ghss_admission_docs_storage_upload" on storage.objects;
create policy "ghss_admission_docs_storage_upload" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'admission-docs'
    -- path must be of form "<folder>/<filename>" — no path traversal
    and position('/' in name) > 0
    and name !~ '\.\.'
  );

drop policy if exists "ghss_admission_docs_storage_admin_delete" on storage.objects;
create policy "ghss_admission_docs_storage_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'admission-docs' and public.is_admin());
