-- ============================================================================
-- GHSS GHALANAI — ROW LEVEL SECURITY POLICIES
-- Master Plan §8.6 (auth) · §11.3 (hardening)
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
-- ============================================================================

-- helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.ghss_current_role() = 'admin';
$$;

-- helper: is the caller a teacher?
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.ghss_current_role() = 'teacher';
$$;

-- helper: is the caller a student?
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

create policy "profiles_read_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own_theme" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- a user may only change their own theme/whatsapp preferences, never a role
    and role = (select role from public.profiles p where p.id = auth.uid())
    and full_name = (select full_name from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_read_all" on public.profiles
  for select to authenticated
  using (public.is_admin());

create policy "profiles_admin_manage" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- CLASSES — reference data; authenticated read, admin write
-- ---------------------------------------------------------------------------
alter table public.classes enable row level security;

create policy "classes_read_authed" on public.classes
  for select to authenticated
  using (true);

create policy "classes_admin_write" on public.classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- STUDENTS — staff read; a student reads only their own row
-- ---------------------------------------------------------------------------
alter table public.students enable row level security;

create policy "students_read_own" on public.students
  for select to authenticated
  using (profile_id = auth.uid());

create policy "students_read_staff" on public.students
  for select to authenticated
  using (public.is_admin() or public.is_teacher());

create policy "students_admin_manage" on public.students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SUBJECTS + TEACHER ASSIGNMENTS
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;

create policy "subjects_read_all" on public.subjects
  for select to authenticated
  using (true);

create policy "subjects_admin_write" on public.subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.teacher_assignments enable row level security;

-- teachers see only their own assignments; admins see all
create policy "assignments_teacher_read_own" on public.teacher_assignments
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

create policy "assignments_admin_write" on public.teacher_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ATTENDANCE — the sharpest security surface:
--   student → own rows only
--   teacher → write only for classes they teach
-- ---------------------------------------------------------------------------
alter table public.attendance enable row level security;

create policy "attendance_student_read_own" on public.attendance
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "attendance_teacher_read_class" on public.attendance
  for select to authenticated
  using (public.is_teacher_of(class_id));

create policy "attendance_admin_read" on public.attendance
  for select to authenticated
  using (public.is_admin());

create policy "attendance_teacher_write_class" on public.attendance
  for insert to authenticated
  with check (
    public.is_teacher_of(class_id)
    and marked_by = auth.uid()
  );

create policy "attendance_teacher_update_own" on public.attendance
  for update to authenticated
  using (public.is_teacher_of(class_id))
  with check (public.is_teacher_of(class_id));

create policy "attendance_admin_manage" on public.attendance
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ASSIGNMENTS + SUBMISSIONS
-- ---------------------------------------------------------------------------
alter table public.assignments enable row level security;

-- students read assignments for their own class
create policy "assignments_student_read" on public.assignments
  for select to authenticated
  using (
    class_id in (
      select class_id from public.students
      where id = public.current_student_id() and deleted_at is null
    )
  );

create policy "assignments_teacher_read_own" on public.assignments
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

create policy "assignments_teacher_write_own" on public.assignments
  for insert to authenticated
  with check (teacher_id = auth.uid());

create policy "assignments_teacher_update_own" on public.assignments
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "assignments_admin_manage" on public.assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.submissions enable row level security;

create policy "submissions_student_read_own" on public.submissions
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "submissions_student_insert_own" on public.submissions
  for insert to authenticated
  with check (student_id = public.current_student_id());

-- teachers see submissions for their assignments only
create policy "submissions_teacher_read" on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  );

create policy "submissions_teacher_grade" on public.submissions
  for update to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and a.teacher_id = auth.uid()
    )
  )
  with check (graded_by = auth.uid());

create policy "submissions_admin_manage" on public.submissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- MARKS + BOARD RESULTS
-- ---------------------------------------------------------------------------
alter table public.marks enable row level security;

create policy "marks_student_read_own" on public.marks
  for select to authenticated
  using (student_id = public.current_student_id());

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

create policy "marks_admin_manage" on public.marks
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- board results: PUBLIC read of published rows only (the transparency flagship)
alter table public.board_results enable row level security;

create policy "board_results_public_read" on public.board_results
  for select to anon, authenticated
  using (published = true);

create policy "board_results_admin_manage" on public.board_results
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- students may read their own unpublished board row early? No — publish is
-- atomic for everyone; that is the point of the supervised pipeline (§7.2).

-- ---------------------------------------------------------------------------
-- ADMISSIONS — anonymous INSERT (the public form) + admin-only everything else
-- ---------------------------------------------------------------------------
alter table public.admissions enable row level security;

-- the website's application form inserts directly with the anon key:
-- nothing else on this table is exposed without authentication
create policy "admissions_anon_insert" on public.admissions
  for insert to anon, authenticated
  with check (
    status = 'received'
    and whatsapp_opt_in in (true, false)
    and char_length(full_name) between 3 and 120
    and char_length(phone) between 10 and 20
  );

create policy "admissions_admin_read" on public.admissions
  for select to authenticated
  using (public.is_admin());

create policy "admissions_admin_update" on public.admissions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.admission_docs enable row level security;

create policy "admission_docs_admin_read" on public.admission_docs
  for select to authenticated
  using (public.is_admin());

create policy "admission_docs_anon_insert" on public.admission_docs
  for insert to anon, authenticated
  with check (char_length(storage_path) <= 512);

-- ---------------------------------------------------------------------------
-- MERIT LISTS — public read of published rows; admin writes
-- ---------------------------------------------------------------------------
alter table public.merit_lists enable row level security;

create policy "merit_public_read" on public.merit_lists
  for select to anon, authenticated
  using (published = true);

create policy "merit_admin_manage" on public.merit_lists
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- NOTICES + NEWS — public reads the published feed; admins and teachers draft
-- ---------------------------------------------------------------------------
alter table public.notices enable row level security;

create policy "notices_public_read" on public.notices
  for select to anon, authenticated
  using (published = true and deleted_at is null);

create policy "notices_authenticated_read" on public.notices
  for select to authenticated
  using (deleted_at is null);

-- teachers draft notices for admin approval (§7.3 Table 8)
create policy "notices_teacher_insert_draft" on public.notices
  for insert to authenticated
  with check (public.is_teacher() and published = false);

create policy "notices_admin_manage" on public.notices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.news_posts enable row level security;

create policy "news_public_read" on public.news_posts
  for select to anon, authenticated
  using (published = true and deleted_at is null);

create policy "news_admin_manage" on public.news_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FACULTY + FAQS — public read; admin write
-- ---------------------------------------------------------------------------
alter table public.faculty enable row level security;

create policy "faculty_public_read" on public.faculty
  for select to anon, authenticated
  using (deleted_at is null);

create policy "faculty_admin_manage" on public.faculty
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.faqs enable row level security;

create policy "faqs_public_read" on public.faqs
  for select to anon, authenticated
  using (true);

create policy "faqs_admin_manage" on public.faqs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEEDBACK — anonymous insert (the complaint channel); admin reads/resolves
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;

create policy "feedback_anon_insert" on public.feedback
  for insert to anon, authenticated
  with check (
    char_length(name) between 2 and 120
    and char_length(message) between 5 and 4000
  );

create policy "feedback_admin_read" on public.feedback
  for select to authenticated
  using (public.is_admin());

create policy "feedback_admin_update" on public.feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS — users manage only their own subscriptions
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

create policy "push_own_read" on public.push_subscriptions
  for select to authenticated
  using (profile_id = auth.uid());

create policy "push_own_insert" on public.push_subscriptions
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "push_own_delete" on public.push_subscriptions
  for delete to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- SETTINGS — admin only (admission window status etc.)
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;

create policy "settings_admin_all" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admission status is read publicly via a narrow view instead of table access
create or replace view public.admission_status as
  select value from public.settings where key = 'admission_status';

grant select on public.admission_status to anon, authenticated;

-- ---------------------------------------------------------------------------
-- AUDIT LOG — append-only, admin-read. No update or delete policies exist:
-- the trail is immutable by construction (§11.3).
-- ---------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy "audit_admin_read" on public.audit_log
  for select to authenticated
  using (public.is_admin());

create policy "audit_insert_authenticated" on public.audit_log
  for insert to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- FINAL HARDENING (§11.3)
-- ---------------------------------------------------------------------------
-- Revoke direct function EXECUTE on helpers from anon where not needed
revoke execute on function public.ghss_current_role() from anon;
revoke execute on function public.current_student_id() from anon;
revoke execute on function public.is_teacher_of(uuid) from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_teacher() from anon;
revoke execute on function public.is_student() from anon;
revoke execute on function public.audit_row() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Supabase Storage bucket for admission documents (private, signed URLs only)
insert into storage.buckets (id, name, public)
values ('admission-docs', 'admission-docs', false)
on conflict (id) do nothing;

-- Storage policies: admins read all docs; anon writes only (upload via signed
-- session); nobody reads another family's documents without admin rights.
create policy "admission_docs_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'admission-docs' and public.is_admin());

create policy "admission_docs_upload" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'admission-docs'
    and (storage.foldername(name))[1] ~ '^GHSS-[0-9]{4}-[0-9]{4}$'
  );
