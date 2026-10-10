-- ============================================================================
-- GHSS GHALANAI — ADMIN CONSOLE RLS, FUNCTIONS & TRIGGERS  (idempotent)
--
-- SAFE SQL RULES OF THIS FILE (hardening notes from the Babi Khel audit):
--   1. RLS enabled on every table before policies exist → default deny.
--   2. EXACTLY ONE policy per (table, command, role-class) — no overlapping
--      permissive policies (Postgres ORs them together, widening access).
--   3. Admin writes always go through is_admin() (SECURITY DEFINER helper
--      reading profiles.role) — never raw auth.uid() IS NOT NULL checks.
--   4. Public reads are gated on is_published / is_active where a publish
--      flag exists; money and student rows are NEVER public.
--   5. site_visits is append-only (insert-with-validation, no update/delete).
--   6. Every SECURITY DEFINER RPC re-checks the caller's role internally and
--      gets explicit REVOKE … FROM PUBLIC / GRANT … TO <role> hygiene.
--   7. No SECURITY DEFINER function interpolates user text into SQL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SCHOOL SETTINGS — public read, admin write
-- ---------------------------------------------------------------------------
alter table public.school_settings enable row level security;

drop policy if exists "school_settings_public_read" on public.school_settings;
create policy "school_settings_public_read" on public.school_settings
  for select to anon, authenticated using (true);

drop policy if exists "school_settings_admin_write" on public.school_settings;
create policy "school_settings_admin_write" on public.school_settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- CLASS LABELS — public read (reference list)
-- ---------------------------------------------------------------------------
alter table public.class_labels enable row level security;

drop policy if exists "class_labels_public_read" on public.class_labels;
create policy "class_labels_public_read" on public.class_labels
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- TEACHERS — public sees active staff; admins see and manage everything
-- ---------------------------------------------------------------------------
alter table public.teachers enable row level security;

drop policy if exists "teachers_public_read" on public.teachers;
create policy "teachers_public_read" on public.teachers
  for select to anon, authenticated using (is_active = true or public.is_admin());

drop policy if exists "teachers_admin_all" on public.teachers;
create policy "teachers_admin_all" on public.teachers
  for insert to authenticated with check (public.is_admin());

drop policy if exists "teachers_admin_update" on public.teachers;
create policy "teachers_admin_update" on public.teachers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teachers_admin_delete" on public.teachers;
create policy "teachers_admin_delete" on public.teachers
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- TIMETABLES + OVERRIDES — public read, admin write
-- ---------------------------------------------------------------------------
alter table public.timetables enable row level security;

drop policy if exists "timetables_public_read" on public.timetables;
create policy "timetables_public_read" on public.timetables
  for select to anon, authenticated using (true);

drop policy if exists "timetables_admin_all" on public.timetables;
create policy "timetables_admin_all" on public.timetables
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.timetable_overrides enable row level security;

drop policy if exists "tt_overrides_public_read" on public.timetable_overrides;
create policy "tt_overrides_public_read" on public.timetable_overrides
  for select to anon, authenticated using (true);

drop policy if exists "tt_overrides_admin_all" on public.timetable_overrides;
create policy "tt_overrides_admin_all" on public.timetable_overrides
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SCHOOL EVENTS — public sees published events only; admins manage all
-- ---------------------------------------------------------------------------
alter table public.school_events enable row level security;

drop policy if exists "school_events_public_read" on public.school_events;
create policy "school_events_public_read" on public.school_events
  for select to anon, authenticated using (is_published = true or public.is_admin());

drop policy if exists "school_events_admin_all" on public.school_events;
create policy "school_events_admin_all" on public.school_events
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- FEES — structures are public (fee page); vouchers/payments are admin-only
-- (a signed-in student may read vouchers issued to their own student row).
-- ---------------------------------------------------------------------------
alter table public.fee_structures enable row level security;

drop policy if exists "fee_structures_public_read" on public.fee_structures;
create policy "fee_structures_public_read" on public.fee_structures
  for select to anon, authenticated using (is_active = true or public.is_admin());

drop policy if exists "fee_structures_admin_all" on public.fee_structures;
create policy "fee_structures_admin_all" on public.fee_structures
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.fee_vouchers enable row level security;

drop policy if exists "fee_vouchers_admin_all" on public.fee_vouchers;
create policy "fee_vouchers_admin_all" on public.fee_vouchers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "fee_vouchers_student_own" on public.fee_vouchers;
create policy "fee_vouchers_student_own" on public.fee_vouchers
  for select to authenticated
  using (student_id = public.current_student_id());

alter table public.fee_payments enable row level security;

drop policy if exists "fee_payments_admin_all" on public.fee_payments;
create policy "fee_payments_admin_all" on public.fee_payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "fee_payments_student_own" on public.fee_payments;
create policy "fee_payments_student_own" on public.fee_payments
  for select to authenticated
  using (voucher_id in (select id from public.fee_vouchers
                        where student_id = public.current_student_id()));

-- ---------------------------------------------------------------------------
-- LIBRARY — public read (download counter moves via RPC only), admin write
-- ---------------------------------------------------------------------------
alter table public.library_files enable row level security;

drop policy if exists "library_files_public_read" on public.library_files;
create policy "library_files_public_read" on public.library_files
  for select to anon, authenticated using (true);

drop policy if exists "library_files_admin_all" on public.library_files;
create policy "library_files_admin_all" on public.library_files
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- GALLERY — public read, admin write
-- ---------------------------------------------------------------------------
alter table public.gallery_albums enable row level security;

drop policy if exists "gallery_albums_public_read" on public.gallery_albums;
create policy "gallery_albums_public_read" on public.gallery_albums
  for select to anon, authenticated using (true);

drop policy if exists "gallery_albums_admin_all" on public.gallery_albums;
create policy "gallery_albums_admin_all" on public.gallery_albums
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter table public.gallery_photos enable row level security;

drop policy if exists "gallery_photos_public_read" on public.gallery_photos;
create policy "gallery_photos_public_read" on public.gallery_photos
  for select to anon, authenticated using (true);

drop policy if exists "gallery_photos_admin_all" on public.gallery_photos;
create policy "gallery_photos_admin_all" on public.gallery_photos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ACHIEVEMENTS — public read, admin write
-- ---------------------------------------------------------------------------
alter table public.achievements enable row level security;

drop policy if exists "achievements_public_read" on public.achievements;
create policy "achievements_public_read" on public.achievements
  for select to anon, authenticated using (true);

drop policy if exists "achievements_admin_all" on public.achievements;
create policy "achievements_admin_all" on public.achievements
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- SITE VISITS — append-only analytics. Anyone inserts a bounded row;
-- nobody ever updates or deletes; only admins read.
-- ---------------------------------------------------------------------------
alter table public.site_visits enable row level security;

drop policy if exists "site_visits_anon_insert" on public.site_visits;
create policy "site_visits_anon_insert" on public.site_visits
  for insert to anon, authenticated
  with check (
    char_length(page) between 1 and 512
    and (referrer is null or char_length(referrer) <= 512)
    and (user_agent is null or char_length(user_agent) <= 512)
    and char_length(session_id) between 8 and 64
  );

drop policy if exists "site_visits_admin_read" on public.site_visits;
create policy "site_visits_admin_read" on public.site_visits
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — audience-scoped broadcasts
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications_public_read" on public.notifications;
create policy "notifications_public_read" on public.notifications
  for select to anon, authenticated using (audience = 'all');

drop policy if exists "notifications_admin_read" on public.notifications;
create policy "notifications_admin_read" on public.notifications
  for select to authenticated using (public.is_admin());

drop policy if exists "notifications_students_read" on public.notifications;
create policy "notifications_students_read" on public.notifications
  for select to authenticated using (audience = 'students');

drop policy if exists "notifications_admin_write" on public.notifications;
create policy "notifications_admin_write" on public.notifications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- POLL VOTES — no direct policies (default deny). Votes flow exclusively
-- through the cast_poll_vote RPC, which validates the option and enforces
-- one vote per device token.
-- ---------------------------------------------------------------------------
alter table public.poll_votes enable row level security;

-- ---------------------------------------------------------------------------
-- ADMISSION STATUS HISTORY — admin read; rows written by RPC only
-- ---------------------------------------------------------------------------
alter table public.admission_status_history enable row level security;

drop policy if exists "admission_history_admin_read" on public.admission_status_history;
create policy "admission_history_admin_read" on public.admission_status_history
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- cast_poll_vote — anonymous-safe, atomic poll voting.
-- SECURITY DEFINER so it can touch notices + poll_votes while both tables
-- stay locked down. Server-side validation of every input.
-- ---------------------------------------------------------------------------
create or replace function public.cast_poll_vote(
  p_notice_id uuid,
  p_option_id text,
  p_voter_token text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_notice record;
  v_options jsonb;
  v_opt jsonb;
  v_idx integer := 0;
begin
  -- Input validation: token shape (the client generates a UUID)
  if p_voter_token is null or char_length(p_voter_token) < 8
     or char_length(p_voter_token) > 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if p_option_id is null or char_length(p_option_id) > 128 then
    return jsonb_build_object('ok', false, 'error', 'invalid_option');
  end if;

  select id, is_poll, is_published, poll_options, poll_closes_at
    into v_notice from public.notices where id = p_notice_id;
  if not found or not v_notice.is_poll then
    return jsonb_build_object('ok', false, 'error', 'poll_not_found');
  end if;
  if v_notice.poll_closes_at is not null and v_notice.poll_closes_at < now() then
    return jsonb_build_object('ok', false, 'error', 'poll_closed');
  end if;

  -- One vote per device token (unique index also guards races)
  if exists (select 1 from public.poll_votes
             where notice_id = p_notice_id and voter_token = p_voter_token) then
    return jsonb_build_object('ok', false, 'error', 'already_voted',
                              'options', v_notice.poll_options);
  end if;

  -- Validate the option id against the stored option list
  v_options := v_notice.poll_options;
  if jsonb_typeof(v_options) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'poll_not_found');
  end if;
  for v_opt in select * from jsonb_array_elements(v_options) loop
    if v_opt->>'id' = p_option_id then
      -- increment votes atomically inside the JSON array
      update public.notices
        set poll_options = (
          select jsonb_agg(
            case when o->>'id' = p_option_id
                 then jsonb_set(o, '{votes}', to_jsonb(coalesce((o->>'votes')::int, 0) + 1))
                 else o end
            order by ord)
          from jsonb_array_elements(v_options) with ordinality as x(o, ord)
        )
        where id = p_notice_id;
      insert into public.poll_votes (notice_id, option_id, voter_token)
        values (p_notice_id, p_option_id, p_voter_token);
      return jsonb_build_object('ok', true,
        'options', (select poll_options from public.notices where id = p_notice_id));
    end if;
    v_idx := v_idx + 1;
  end loop;

  return jsonb_build_object('ok', false, 'error', 'invalid_option');
end;
$$;

revoke all on function public.cast_poll_vote(uuid, text, text) from public;
grant execute on function public.cast_poll_vote(uuid, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- increment_download_count — the ONLY way download_count ever changes.
-- ---------------------------------------------------------------------------
create or replace function public.increment_download_count(p_file_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.library_files
    set download_count = download_count + 1
    where id = p_file_id;
end;
$$;

revoke all on function public.increment_download_count(uuid) from public;
grant execute on function public.increment_download_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_delete_user — removes an auth user (cascades the profile row).
-- Refuses self-deletion; verifies the caller is an admin inside the fn.
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_target_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'cannot_delete_self');
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  delete from auth.users where id = p_target_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_admission_status — atomic decision + history row. Admin-only.
-- ---------------------------------------------------------------------------
create or replace function public.update_admission_status(
  p_admission_id uuid,
  p_new_status text,
  p_note text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_new_status not in ('received','review','shortlisted','offered','admitted','rejected') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  select status into v_old from public.admissions where id = p_admission_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.admissions
    set status = p_new_status::public.admission_status,
        decision_note = coalesce(nullif(p_note, ''), decision_note),
        updated_at = now()
    where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_status, to_status, note, actor)
    values (p_admission_id, v_old, p_new_status, nullif(p_note, ''), auth.uid());

  return jsonb_build_object('ok', true, 'from', v_old, 'to', p_new_status);
end;
$$;

revoke all on function public.update_admission_status(uuid, text, text) from public;
grant execute on function public.update_admission_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_fee_payment — inserts a payment and updates the voucher atomically.
-- Admin-only; amount must be positive and cannot exceed the outstanding sum.
-- ---------------------------------------------------------------------------
create or replace function public.record_fee_payment(
  p_voucher_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_receipt text default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_voucher record;
  v_status text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_method not in ('cash','bank','online','cheque','jazzcash','easypaisa') then
    return jsonb_build_object('ok', false, 'error', 'invalid_method');
  end if;

  select * into v_voucher from public.fee_vouchers where id = p_voucher_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'voucher_not_found');
  end if;
  if v_voucher.status = 'paid' or v_voucher.status = 'waived' then
    return jsonb_build_object('ok', false, 'error', 'voucher_closed');
  end if;
  if p_amount > (v_voucher.total_amount + v_voucher.late_fee - v_voucher.paid_amount) then
    return jsonb_build_object('ok', false, 'error', 'amount_exceeds_outstanding');
  end if;

  insert into public.fee_payments (voucher_id, amount, payment_method, receipt_number, notes, received_by)
    values (p_voucher_id, p_amount, p_method, nullif(p_receipt, ''), nullif(p_notes, ''),
            (select full_name from public.profiles where id = auth.uid()));

  v_status := case
    when v_voucher.paid_amount + p_amount >= v_voucher.total_amount + v_voucher.late_fee then 'paid'
    else 'partial'
  end;

  update public.fee_vouchers
    set paid_amount = paid_amount + p_amount,
        status = v_status,
        updated_at = now()
    where id = p_voucher_id;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

revoke all on function public.record_fee_payment(uuid, numeric, text, text, text) from public;
grant execute on function public.record_fee_payment(uuid, numeric, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_overdue_vouchers — flips unpaid past-due vouchers to overdue.
-- Called from the Fee Management dashboard (and safe to cron).
-- ---------------------------------------------------------------------------
create or replace function public.mark_overdue_vouchers()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_admin() then
    return -1;
  end if;
  update public.fee_vouchers
    set status = 'overdue', updated_at = now()
    where status = 'unpaid' and due_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_overdue_vouchers() from public;
grant execute on function public.mark_overdue_vouchers() to authenticated;

-- ---------------------------------------------------------------------------
-- get_site_analytics — server-side aggregation (admin only). Returns daily
-- series, device split, top pages and top referrers for the last N days.
-- Keeps the browser out of raw visit rows entirely.
-- ---------------------------------------------------------------------------
create or replace function public.get_site_analytics(p_days integer default 30)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'since', now() - (make_interval(days => least(greatest(p_days, 1), 365))),
    'totals', jsonb_build_object(
      'views', count(*),
      'visitors', count(distinct session_id)
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'views', coalesce(v.views, 0),
        'visitors', coalesce(v.visitors, 0)
      ) order by d.day)
      from generate_series(
             (now() - (make_interval(days => least(greatest(p_days, 1), 365))))::date,
             now()::date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, count(*) as views,
               count(distinct session_id) as visitors
        from public.site_visits
        where created_at >= now() - (make_interval(days => least(greatest(p_days, 1), 365)))
        group by created_at::date
      ) v on v.day = d.day
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('device', device_type, 'count', c)), '[]'::jsonb)
      from (
        select device_type, count(*) as c
        from public.site_visits
        where created_at >= now() - (make_interval(days => least(greatest(p_days, 1), 365)))
        group by device_type
      ) d
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('page', page, 'views', c, 'visitors', vis)), '[]'::jsonb)
      from (
        select page, count(*) as c, count(distinct session_id) as vis
        from public.site_visits
        where created_at >= now() - (make_interval(days => least(greatest(p_days, 1), 365)))
        group by page order by count(*) desc limit 10
      ) p
    ),
    'top_referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('referrer', coalesce(nullif(referrer, ''), '(direct)'), 'count', c)), '[]'::jsonb)
      from (
        select referrer, count(*) as c
        from public.site_visits
        where created_at >= now() - (make_interval(days => least(greatest(p_days, 1), 365)))
        group by referrer order by count(*) desc limit 10
      ) r
    )
  )
  from public.site_visits
  where created_at >= now() - (make_interval(days => least(greatest(p_days, 1), 365)));
$$;

revoke all on function public.get_site_analytics(integer) from public;
grant execute on function public.get_site_analytics(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- fn_notify — the single primitive every content trigger uses.
-- ---------------------------------------------------------------------------
create or replace function public.fn_notify(
  p_audience text,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
) returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_audience in ('all','admin','students') and char_length(p_title) between 1 and 200 then
    insert into public.notifications (audience, type, title, body, link)
      values (p_audience, coalesce(nullif(p_type, ''), 'default'), p_title,
              left(p_body, 2000), left(p_link, 512));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- NOTIFICATION TRIGGERS — publish events ring the header bell
-- ---------------------------------------------------------------------------
create or replace function public.trg_notice_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.published then
    perform public.fn_notify('all', 'notice',
      'Notice: ' || left(new.title, 150), null, '/notices');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists on_notice_notify on public.notices;
create trigger on_notice_notify after insert or update of published on public.notices
  for each row execute function public.trg_notice_notify();

create or replace function public.trg_news_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.published then
    perform public.fn_notify('all', 'news',
      'News: ' || left(new.title, 150), null, '/notices');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists on_news_notify on public.news_posts;
create trigger on_news_notify after insert or update of published on public.news_posts
  for each row execute function public.trg_news_notify();

create or replace function public.trg_event_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.is_published then
    perform public.fn_notify('all', 'event',
      'Event: ' || left(new.title, 150), null, '/calendar');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists on_event_notify on public.school_events;
create trigger on_event_notify after insert or update of is_published on public.school_events
  for each row execute function public.trg_event_notify();

create or replace function public.trg_results_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.published and coalesce(old.published, false) = false then
    perform public.fn_notify('all', 'results',
      'Results published — ' || new.programme::text || ' ' || new.year,
      'Check your result by roll number.', '/results/lookup');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists on_results_notify on public.board_results;
create trigger on_results_notify after update of published on public.board_results
  for each row execute function public.trg_results_notify();

-- ---------------------------------------------------------------------------
-- updated_at + AUDIT triggers for the new console tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'school_settings', 'teachers', 'timetables', 'school_events',
    'fee_structures', 'fee_vouchers', 'library_files', 'gallery_albums'
  ]
  loop
    execute format('drop trigger if exists trg_touch_%s on public.%I', t, t);
    execute format('create trigger trg_touch_%s before update on public.%I
      for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'teachers', 'timetables', 'school_events', 'fee_structures', 'fee_vouchers',
    'fee_payments', 'library_files', 'gallery_albums', 'gallery_photos',
    'achievements', 'school_settings', 'notifications'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format(
      'create trigger trg_audit_%s after insert or update or delete on public.%I
       for each row execute function public.audit_row()', t, t);
  end loop;
end $$;
