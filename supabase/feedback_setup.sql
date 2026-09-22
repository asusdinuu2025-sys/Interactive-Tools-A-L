-- =========================================================
-- STUDY LAB — FEEDBACK SETUP
-- Run once in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.studylab_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  category text not null
    check (category in ('bug','suggestion','resource')),
  message text not null
    check (char_length(btrim(message)) between 2 and 1200),
  page_url text not null default ''
    check (char_length(page_url) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists studylab_feedback_created_at_idx
  on public.studylab_feedback (created_at desc);

create index if not exists studylab_feedback_user_idx
  on public.studylab_feedback (user_id, created_at desc);

alter table public.studylab_feedback enable row level security;

grant insert on table public.studylab_feedback to authenticated;

revoke select, update, delete on table public.studylab_feedback
  from anon, authenticated;

drop policy if exists "StudyLab feedback insert own"
  on public.studylab_feedback;

create policy "StudyLab feedback insert own"
  on public.studylab_feedback
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and char_length(btrim(message)) between 2 and 1200
    and category in ('bug','suggestion','resource')
  );

-- =========================================================
-- SERVER-SIDE FEEDBACK RATE LIMIT
-- Protects the endpoint even if client-side throttling is bypassed.
-- =========================================================

create or replace function public.enforce_studylab_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'StudyLab feedback requires an authenticated student.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text, 0)
  );

  select count(*)
    into recent_count
  from public.studylab_feedback
  where user_id = auth.uid()
    and created_at > now() - interval '15 seconds';

  if recent_count > 0 then
    raise exception 'Please wait before sending more feedback.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_studylab_feedback_rate_limit() from public;

drop trigger if exists studylab_feedback_rate_limit_before_insert
  on public.studylab_feedback;

create trigger studylab_feedback_rate_limit_before_insert
before insert on public.studylab_feedback
for each row
execute function public.enforce_studylab_feedback_rate_limit();
