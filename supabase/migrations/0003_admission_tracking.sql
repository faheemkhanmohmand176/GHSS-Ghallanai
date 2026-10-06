-- GHSS Ghallanai — applicant account + status history extension
-- Safe to run repeatedly in Supabase SQL Editor.
create table if not exists public.admission_accounts (
  id uuid primary key default gen_random_uuid(),
  nationality text not null check (nationality in ('Pakistani', 'Afghani')),
  cnic text not null unique check (cnic ~ '^[0-9]{13}$'),
  password_digest text not null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admission_accounts_cnic on public.admission_accounts(cnic);

create table if not exists public.admission_status_history (
  id uuid primary key default gen_random_uuid(),
  admission_id uuid not null references public.admissions(id) on delete cascade,
  from_status public.admission_status,
  to_status public.admission_status not null,
  note text,
  changed_at timestamptz not null default now()
);
create index if not exists idx_admission_status_history_admission on public.admission_status_history(admission_id, changed_at desc);

create or replace function public.record_admission_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.admission_status_history(admission_id, from_status, to_status, note)
    values (new.id, null, new.status, 'Application received');
  elsif old.status is distinct from new.status then
    insert into public.admission_status_history(admission_id, from_status, to_status, note)
    values (new.id, old.status, new.status, new.decision_note);
  end if;
  return new;
end;
$$;
drop trigger if exists admission_status_history_trigger on public.admissions;
create trigger admission_status_history_trigger
after insert or update of status, decision_note on public.admissions
for each row execute function public.record_admission_status_change();

alter table public.admission_accounts enable row level security;
drop policy if exists "admission_accounts_no_public_read" on public.admission_accounts;
drop policy if exists "admission_accounts_admin_read" on public.admission_accounts;
create policy "admission_accounts_admin_read" on public.admission_accounts for select to authenticated using (public.is_admin());

alter table public.admission_status_history enable row level security;
drop policy if exists "admission_status_history_admin_read" on public.admission_status_history;
create policy "admission_status_history_admin_read" on public.admission_status_history for select to authenticated using (public.is_admin());
