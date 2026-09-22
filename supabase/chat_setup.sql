-- =========================================================
-- STUDY LAB — TEMPORARY 24-HOUR CHAT SETUP
-- Run this entire script once in Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.studylab_chat_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null
    check (char_length(btrim(message)) between 1 and 500),
  nickname text not null default 'Student'
    check (char_length(btrim(nickname)) between 1 and 40),
  session_id text not null
    check (char_length(session_id) between 8 and 120),
  created_at timestamptz not null default now()
);

create index if not exists studylab_chat_messages_created_at_idx
  on public.studylab_chat_messages (created_at desc);

alter table public.studylab_chat_messages enable row level security;

grant select, insert on table public.studylab_chat_messages to anon, authenticated;
revoke update, delete on table public.studylab_chat_messages from anon, authenticated;

drop policy if exists "StudyLab chat read recent messages"
  on public.studylab_chat_messages;

create policy "StudyLab chat read recent messages"
  on public.studylab_chat_messages
  for select
  to anon, authenticated
  using (
    created_at > now() - interval '24 hours'
  );

drop policy if exists "StudyLab chat insert messages"
  on public.studylab_chat_messages;

create policy "StudyLab chat insert messages"
  on public.studylab_chat_messages
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(message)) between 1 and 500
    and char_length(btrim(nickname)) between 1 and 40
    and char_length(session_id) between 8 and 120
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
grant execute on function public.cleanup_studylab_chat() to anon, authenticated;

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

-- The browser chat is text-only, anonymous, and limited to
-- the newest 50 messages. Messages older than 24 hours are
-- excluded from reads and removed during cleanup.
