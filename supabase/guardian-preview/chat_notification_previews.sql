-- Return only notification previews of messages that are still present and no longer pending.
-- Existing chat SELECT policy permits authenticated accounts to read the shared chat.
begin;
create or replace function public.studylab_chat_notification_previews(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if coalesce(cardinality(p_ids),0)>20 then raise exception 'Too many notification IDs'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'message',left(m.message,180),'nickname',left(m.nickname,80)))
 from public.studylab_chat_messages m
 where m.id=any(p_ids) and m.user_id<>auth.uid()
 and m.created_at>now()-interval '2 minutes'
 and not exists(select 1 from studylab_private.guardian_post_jobs j where j.message_id=m.id)), '[]'::jsonb);
end $fn$;
revoke all on function public.studylab_chat_notification_previews(uuid[]) from public,anon,authenticated;
grant execute on function public.studylab_chat_notification_previews(uuid[]) to authenticated;
commit;