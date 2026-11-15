-- Preserve original newest-100 Chat trimming. The trim trigger performs a
-- nested DELETE after INSERT; it must not be treated as a moderator action.
-- Direct moderator deletes are logged; RLS itself rejects unauthorized
-- cross-user deletes. Keep ordinary owner deletion and maintenance working.
create or replace function studylab_private.audit_chat_moderator_delete()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare acting_user uuid := (select auth.uid());
begin
  if pg_trigger_depth() = 1
     and acting_user is not null
     and acting_user is distinct from old.user_id
     and (select public.studylab_chat_can_moderate()) then
    insert into studylab_private.chat_moderation_log
      (message_id,author_id,moderator_id)
    values (old.id,old.user_id,acting_user);
  end if;
  return old;
end;
$$;
revoke all on function studylab_private.audit_chat_moderator_delete() from public, anon, authenticated;
