-- =========================================================
-- STUDY LAB — CLOUD STUDENT BACKEND
-- Run this entire script once in Supabase SQL Editor.
--
-- It creates:
--   1) anonymous/cloud student profiles
--   2) cloud favorites
--   3) cloud study progress
--   4) the 24-hour / 50-message chat
--
-- IMPORTANT:
-- Enable Anonymous Sign-Ins in:
-- Authentication -> Sign In / Providers -> Anonymous
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- =========================================================

create table if not exists public.studylab_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studylab_profiles enable row level security;

grant select, insert, update on table public.studylab_profiles to authenticated;

drop policy if exists "StudyLab profile read own"
  on public.studylab_profiles;

create policy "StudyLab profile read own"
  on public.studylab_profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "StudyLab profile insert own"
  on public.studylab_profiles;

create policy "StudyLab profile insert own"
  on public.studylab_profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "StudyLab profile update own"
  on public.studylab_profiles;

create policy "StudyLab profile update own"
  on public.studylab_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- =========================================================
-- FAVORITES
-- =========================================================

create table if not exists public.studylab_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_url text not null,
  title text not null default '',
  description text not null default '',
  subject text not null default 'study-lab',
  created_at timestamptz not null default now(),
  primary key (user_id, tool_url)
);

create index if not exists studylab_favorites_user_created_idx
  on public.studylab_favorites (user_id, created_at desc);

alter table public.studylab_favorites enable row level security;

grant select, insert, update, delete
  on table public.studylab_favorites
  to authenticated;

drop policy if exists "StudyLab favorites own"
  on public.studylab_favorites;

create policy "StudyLab favorites own"
  on public.studylab_favorites
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- STUDY PROGRESS
-- One row per tool opened by each student.
-- last_opened_at drives Recently Opened.
-- =========================================================

create table if not exists public.studylab_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_url text not null,
  title text not null default '',
  subject text not null default 'study-lab',
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1
    check (open_count > 0),
  primary key (user_id, tool_url)
);

create index if not exists studylab_progress_user_last_opened_idx
  on public.studylab_progress (user_id, last_opened_at desc);

alter table public.studylab_progress enable row level security;

grant select, insert, update
  on table public.studylab_progress
  to authenticated;

drop policy if exists "StudyLab progress own"
  on public.studylab_progress;

create policy "StudyLab progress own"
  on public.studylab_progress
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- TEMPORARY CHAT
-- =========================================================

create table if not exists public.studylab_chat_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null
    check (char_length(btrim(message)) between 1 and 500),
  nickname text not null default 'Student'
    check (char_length(btrim(nickname)) between 1 and 60),
  session_id text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.studylab_chat_messages
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.studylab_chat_messages
  add column if not exists session_id text;

create index if not exists studylab_chat_messages_created_at_idx
  on public.studylab_chat_messages (created_at desc);

create index if not exists studylab_chat_messages_user_idx
  on public.studylab_chat_messages (user_id, created_at desc);

alter table public.studylab_chat_messages enable row level security;

grant select, insert on table public.studylab_chat_messages to authenticated;
revoke all on table public.studylab_chat_messages from anon;
revoke update, delete on table public.studylab_chat_messages from authenticated;

drop policy if exists "StudyLab chat read recent messages"
  on public.studylab_chat_messages;

drop policy if exists "StudyLab chat read recent authenticated messages"
  on public.studylab_chat_messages;

create policy "StudyLab chat read recent authenticated messages"
  on public.studylab_chat_messages
  for select
  to authenticated
  using (
    created_at > now() - interval '24 hours'
  );

drop policy if exists "StudyLab chat insert messages"
  on public.studylab_chat_messages;

drop policy if exists "StudyLab chat insert own authenticated messages"
  on public.studylab_chat_messages;

create policy "StudyLab chat insert own authenticated messages"
  on public.studylab_chat_messages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and char_length(btrim(message)) between 1 and 500
    and char_length(btrim(nickname)) between 1 and 60
    and created_at <= now() + interval '5 minutes'
  );

create or replace function public.cleanup_studylab_chat()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.studylab_chat_messages
  where created_at < now() - interval '24 hours';

  delete from public.studylab_chat_messages
  where id in (
    select id
    from public.studylab_chat_messages
    order by created_at desc, id desc
    offset 50
  );
end;
$$;

revoke all on function public.cleanup_studylab_chat() from public;
grant execute on function public.cleanup_studylab_chat() to authenticated;

create or replace function public.trim_studylab_chat_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cleanup_studylab_chat();
  return new;
end;
$$;

drop trigger if exists studylab_chat_trim_after_insert
  on public.studylab_chat_messages;

create trigger studylab_chat_trim_after_insert
after insert on public.studylab_chat_messages
for each statement
execute function public.trim_studylab_chat_after_insert();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'studylab_chat_messages'
  ) then
    alter publication supabase_realtime
      add table public.studylab_chat_messages;
  end if;
end;
$$;

select public.cleanup_studylab_chat();
