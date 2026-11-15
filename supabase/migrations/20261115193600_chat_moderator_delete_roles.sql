-- Chat-specific moderator role for the three owner-approved existing Auth
-- accounts. This is separate from Social admin and does not change profile,
-- Study Room, Social, or Chat author edit privileges.
create table if not exists studylab_private.chat_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
revoke all on studylab_private.chat_moderators from public, anon, authenticated;
alter table studylab_private.chat_moderators enable row level security;

-- Verified Supabase Auth account IDs for:
-- asusdinuu2025@gmail.com, dinushahemal4444@gmail.com,
-- dinushahemal529@gmail.com.
insert into studylab_private.chat_moderators (user_id) values
  ('24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid),
  ('7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid),
  ('b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid)
on conflict (user_id) do nothing;

-- The only callable exposed capability is a boolean about the signed-in
-- account itself. No role list or elevated privileges are exposed.
create or replace function public.studylab_chat_can_moderate()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from studylab_private.chat_moderators m
      where m.user_id=(select auth.uid())
    );
$$;
revoke all on function public.studylab_chat_can_moderate() from public, anon;
grant execute on function public.studylab_chat_can_moderate() to authenticated;

-- Existing "StudyLab chat delete own message" policy remains intact.
-- This adds only the separately protected moderator delete path.
drop policy if exists "StudyLab Chat moderators may delete messages"
  on public.studylab_chat_messages;
create policy "StudyLab Chat moderators may delete messages"
on public.studylab_chat_messages for delete to authenticated
using ((select public.studylab_chat_can_moderate()));

-- Private audit metadata; no duplicate message text is kept.
create table if not exists studylab_private.chat_moderation_log (
  id bigint generated always as identity primary key,
  message_id uuid not null,
  author_id uuid,
  moderator_id uuid not null,
  deleted_at timestamptz not null default now()
);
alter table studylab_private.chat_moderation_log enable row level security;
revoke all on studylab_private.chat_moderation_log from public, anon, authenticated;
revoke all on sequence studylab_private.chat_moderation_log_id_seq from public, anon, authenticated;
create index if not exists chat_moderation_log_deleted_at_idx
  on studylab_private.chat_moderation_log(deleted_at desc);

create or replace function studylab_private.audit_chat_moderator_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare acting_user uuid := (select auth.uid());
begin
  if acting_user is not null and acting_user is distinct from old.user_id then
    if not (select public.studylab_chat_can_moderate()) then
      raise exception 'Not authorized to moderate Chat messages'
        using errcode = '42501';
    end if;
    insert into studylab_private.chat_moderation_log
      (message_id,author_id,moderator_id)
    values (old.id,old.user_id,acting_user);
  end if;
  return old;
end;
$$;
revoke all on function studylab_private.audit_chat_moderator_delete() from public, anon, authenticated;
drop trigger if exists studylab_chat_moderation_audit on public.studylab_chat_messages;
create trigger studylab_chat_moderation_audit
  before delete on public.studylab_chat_messages
  for each row execute function studylab_private.audit_chat_moderator_delete();
