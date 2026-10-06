-- GHSS Ghallanai — admission completion fields
-- Safe to run repeatedly in the Supabase SQL Editor.

alter table if exists public.admission_accounts
  add column if not exists email text,
  add column if not exists phone text;

alter type public.doc_type add value if not exists 'father_cnic';
alter type public.doc_type add value if not exists 'first_year_dmc';
alter type public.doc_type add value if not exists 'first_year_registration';

create index if not exists idx_admission_accounts_phone on public.admission_accounts(phone);
