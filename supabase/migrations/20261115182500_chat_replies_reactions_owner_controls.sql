-- Shared StudyLab Chat: replies, owner edits/deletes, and 4 lightweight reactions.
-- Keeps the existing 100-message cleanup trigger, timestamps, rate limit,
-- chat history and student profiles unchanged.
alter table public.studylab_chat_messages
  add column if not exists reply_to uuid
    references public.studylab_chat_messages(id) on delete set null;
alter table public.studylab_chat_messages
  add column if not exists edited_at timestamptz;

create index if not exists studylab_chat_reply_target_idx
  on public.studylab_chat_messages(reply_to) where reply_to is not null;

-- Edit only one's own text. No authenticated client can change user_id,
-- session_id, nickname, created_at, reply_to or the edit timestamp.
grant update (message) on public.studylab_chat_messages to authenticated;
grant delete on public.studylab_chat_messages to authenticated;

drop policy if exists "StudyLab chat edit own message" on public.studylab_chat_messages;
create policy "StudyLab chat edit own message"
  on public.studylab_chat_messages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "StudyLab chat delete own message" on public.studylab_chat_messages;
create policy "StudyLab chat delete own message"
  on public.studylab_chat_messages for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function studylab_private.mark_chat_message_edited()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.message is distinct from old.message) then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists studylab_chat_mark_edited on public.studylab_chat_messages;
create trigger studylab_chat_mark_edited
  before update of message on public.studylab_chat_messages
  for each row execute function studylab_private.mark_chat_message_edited();

create table if not exists public.studylab_chat_reactions(
  message_id uuid not null references public.studylab_chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('👍','😂','🔥','❤️')),
  created_at timestamptz not null default now(),
  primary key (message_id,user_id)
);
create index if not exists studylab_chat_reactions_user_idx
  on public.studylab_chat_reactions(user_id);
alter table public.studylab_chat_reactions enable row level security;
revoke all on public.studylab_chat_reactions from anon;
grant select,insert,update,delete on public.studylab_chat_reactions to authenticated;

drop policy if exists "StudyLab chat reactions read" on public.studylab_chat_reactions;
create policy "StudyLab chat reactions read" on public.studylab_chat_reactions
  for select to authenticated using (true);
drop policy if exists "StudyLab chat reactions insert own" on public.studylab_chat_reactions;
create policy "StudyLab chat reactions insert own" on public.studylab_chat_reactions
  for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "StudyLab chat reactions update own" on public.studylab_chat_reactions;
create policy "StudyLab chat reactions update own" on public.studylab_chat_reactions
  for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "StudyLab chat reactions delete own" on public.studylab_chat_reactions;
create policy "StudyLab chat reactions delete own" on public.studylab_chat_reactions
  for delete to authenticated using (user_id=(select auth.uid()));

-- Keep the already published messages table untouched. Only subscribe
-- to reaction changes if not previously published.
do $$
begin
 if not exists (select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public'
    and tablename='studylab_chat_reactions') then
   alter publication supabase_realtime add table public.studylab_chat_reactions;
 end if;
end;
$$;
