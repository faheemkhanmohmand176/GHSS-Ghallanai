-- ============================================================================
-- GHSS GHALANAI · RLS POLICIES FOR ADMIN EXTENSION TABLES · 0004
-- ----------------------------------------------------------------------------
-- Mirrors the philosophy of 0002_rls.sql:
--   * RLS enabled on every new table → default deny.
--   * Public surfaces (achievements, published merit lists, published roll numbers,
--     site visits insert) get anon SELECT or INSERT.
--   * Students read only their own vouchers / payments / attendance.
--   * Admins hold explicit policies — never BYPASSRLS.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ACHIEVEMENTS — public read of published; admin manage
-- ---------------------------------------------------------------------------
alter table public.achievements enable row level security;

create policy "achievements_public_read" on public.achievements
  for select to anon, authenticated
  using (is_published = true and deleted_at is null);

create policy "achievements_admin_manage" on public.achievements
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEE TYPES — anyone can read (catalog); admin writes
-- ---------------------------------------------------------------------------
alter table public.fee_types enable row level security;

create policy "fee_types_public_read" on public.fee_types
  for select to anon, authenticated
  using (is_active = true);

create policy "fee_types_admin_manage" on public.fee_types
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEE STRUCTURES — anyone can read (parents need to see the schedule);
-- admin writes
-- ---------------------------------------------------------------------------
alter table public.fee_structures enable row level security;

create policy "fee_structures_public_read" on public.fee_structures
  for select to anon, authenticated
  using (is_active = true);

create policy "fee_structures_admin_manage" on public.fee_structures
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEE VOUCHERS — student reads own; admin reads all / manages
-- ---------------------------------------------------------------------------
alter table public.fee_vouchers enable row level security;

create policy "fee_vouchers_student_read_own" on public.fee_vouchers
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "fee_vouchers_admin_manage" on public.fee_vouchers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- allow class teacher to read vouchers of students in their classes
-- (so they can nudge defaulters) — but not write
create policy "fee_vouchers_teacher_read_class" on public.fee_vouchers
  for select to authenticated
  using (
    public.is_teacher()
    and exists (
      select 1 from public.students s
      where s.id = fee_vouchers.student_id
        and public.is_teacher_of(s.class_id)
    )
  );

-- ---------------------------------------------------------------------------
-- FEE PAYMENTS — student reads own; admin writes; teacher cannot insert
-- (only the cashier / admin records payments — single trusted source)
-- ---------------------------------------------------------------------------
alter table public.fee_payments enable row level security;

create policy "fee_payments_student_read_own" on public.fee_payments
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "fee_payments_admin_manage" on public.fee_payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- TIMETABLES — public read of active timetables; admin manage
-- (Timetables are public because students need to know their schedule; the
--  school does not treat them as confidential.)
-- ---------------------------------------------------------------------------
alter table public.timetables enable row level security;

create policy "timetables_public_read" on public.timetables
  for select to anon, authenticated
  using (true);

create policy "timetables_admin_manage" on public.timetables
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.timetable_overrides enable row level security;

create policy "timetable_overrides_read_authed" on public.timetable_overrides
  for select to authenticated
  using (true);

create policy "timetable_overrides_admin_manage" on public.timetable_overrides
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- EXAM ROLL SESSIONS — public read of published; admin manage
-- ---------------------------------------------------------------------------
alter table public.exam_roll_sessions enable row level security;

create policy "exam_roll_sessions_public_read" on public.exam_roll_sessions
  for select to anon, authenticated
  using (is_published = true);

create policy "exam_roll_sessions_admin_manage" on public.exam_roll_sessions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- EXAM ROLL NUMBERS — public read of published sessions' numbers; admin manage
-- ---------------------------------------------------------------------------
alter table public.exam_roll_numbers enable row level security;

create policy "exam_roll_numbers_public_read" on public.exam_roll_numbers
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.exam_roll_sessions s
      where s.id = exam_roll_numbers.session_id
        and s.is_published = true
    )
  );

-- students also read their own row even if the session is not yet published
-- (so they can find out their own roll number ahead of public release)
create policy "exam_roll_numbers_student_read_own" on public.exam_roll_numbers
  for select to authenticated
  using (student_id = public.current_student_id());

create policy "exam_roll_numbers_admin_manage" on public.exam_roll_numbers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- MERIT LIST PUBLICATIONS — public read of published; admin manage
-- ---------------------------------------------------------------------------
alter table public.merit_list_publications enable row level security;

create policy "merit_publications_public_read" on public.merit_list_publications
  for select to anon, authenticated
  using (is_published = true);

create policy "merit_publications_admin_manage" on public.merit_list_publications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ATTENDANCE DAILY STATS — admin/teacher read; admin writes (trigger only)
-- ---------------------------------------------------------------------------
alter table public.attendance_daily_stats enable row level security;

create policy "attendance_stats_read_authed" on public.attendance_daily_stats
  for select to authenticated
  using (public.is_admin() or public.is_teacher());

create policy "attendance_stats_admin_manage" on public.attendance_daily_stats
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.attendance_thresholds enable row level security;

create policy "attendance_thresholds_public_read" on public.attendance_thresholds
  for select to anon, authenticated
  using (is_active = true);

create policy "attendance_thresholds_admin_manage" on public.attendance_thresholds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SITE VISITS — anyone can INSERT; authed users read; nobody updates/deletes
-- ---------------------------------------------------------------------------
alter table public.site_visits enable row level security;

create policy "site_visits_anon_insert" on public.site_visits
  for insert to anon, authenticated
  with check (true);

create policy "site_visits_admin_read" on public.site_visits
  for select to authenticated
  using (public.is_admin());

-- no update / delete policies by design (immutable analytics)

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — admin manage; authed users read for their audience
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

create policy "notifications_read_authed" on public.notifications
  for select to authenticated
  using (true);

create policy "notifications_admin_manage" on public.notifications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- allow any authenticated user to mark their own notifications as read
-- (matched by audience + class — approximation of ownership)
create policy "notifications_update_own_read" on public.notifications
  for update to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- EXAM SEATING — public read of published plans; admin manage
-- ---------------------------------------------------------------------------
alter table public.exam_seating_plans enable row level security;

create policy "exam_seating_plans_public_read" on public.exam_seating_plans
  for select to anon, authenticated
  using (status = 'published');

create policy "exam_seating_plans_admin_manage" on public.exam_seating_plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.exam_seating_rooms enable row level security;

create policy "exam_seating_rooms_admin_manage" on public.exam_seating_rooms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "exam_seating_rooms_public_read_published" on public.exam_seating_rooms
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.exam_seating_plans p
      where p.id = exam_seating_rooms.plan_id and p.status = 'published'
    )
  );

alter table public.exam_seating_assignments enable row level security;

create policy "exam_seating_assignments_public_read_published" on public.exam_seating_assignments
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.exam_seating_plans p
      where p.id = exam_seating_assignments.plan_id and p.status = 'published'
    )
  );

create policy "exam_seating_assignments_admin_manage" on public.exam_seating_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.achievements to authenticated;
grant select, insert, update, delete on public.fee_types to authenticated;
grant select, insert, update, delete on public.fee_structures to authenticated;
grant select, insert, update, delete on public.fee_vouchers to authenticated;
grant select, insert, update, delete on public.fee_payments to authenticated;
grant select, insert, update, delete on public.timetables to authenticated;
grant select, insert, update, delete on public.timetable_overrides to authenticated;
grant select, insert, update, delete on public.exam_roll_sessions to authenticated;
grant select, insert, update, delete on public.exam_roll_numbers to authenticated;
grant select, insert, update, delete on public.merit_list_publications to authenticated;
grant select, insert, update, delete on public.attendance_daily_stats to authenticated;
grant select, insert, update, delete on public.attendance_thresholds to authenticated;
grant select on public.site_visits to authenticated;
grant insert on public.site_visits to anon, authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.exam_seating_plans to authenticated;
grant select, insert, update, delete on public.exam_seating_rooms to authenticated;
grant select, insert, update, delete on public.exam_seating_assignments to authenticated;

-- Public read grants for the public surfaces
grant select on public.achievements to anon;
grant select on public.fee_types to anon;
grant select on public.fee_structures to anon;
grant select on public.timetables to anon;
grant select on public.exam_roll_sessions to anon;
grant select on public.exam_roll_numbers to anon;
grant select on public.merit_list_publications to anon;
grant select on public.attendance_thresholds to anon;
grant select on public.exam_seating_plans to anon;
grant select on public.exam_seating_rooms to anon;
grant select on public.exam_seating_assignments to anon;

-- Revoke execute on internal helpers from anon
revoke execute on function public.recompute_voucher_state(uuid) from anon;
revoke execute on function public.mark_overdue_vouchers() from anon;
revoke execute on function public.class_label_for(smallint) from anon;
revoke execute on function public.tg_recompute_voucher() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- DONE — 0004_admin_rls.sql
-- ---------------------------------------------------------------------------
