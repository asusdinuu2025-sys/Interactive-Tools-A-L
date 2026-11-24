-- Chat presentation preference only. No moderation or publishing permissions change.
begin;
create table if not exists studylab_private.guardian_chat_preferences(
 singleton boolean primary key default true check(singleton),
 mode text not null default 'instant' check(mode in ('instant','strict'))
);
alter table studylab_private.guardian_chat_preferences enable row level security;
revoke all on studylab_private.guardian_chat_preferences from public,anon,authenticated;
insert into studylab_private.guardian_chat_preferences(singleton) values(true) on conflict do nothing;
create or replace function public.studylab_guardian_chat_mode()
returns text language sql stable security definer set search_path='' as $mode$
 select coalesce((select mode from studylab_private.guardian_chat_preferences where singleton),'instant') where (select auth.uid()) is not null
$mode$;
revoke all on function public.studylab_guardian_chat_mode() from public,anon,authenticated;
grant execute on function public.studylab_guardian_chat_mode() to authenticated;
create or replace function public.studylab_guardian_set_chat_mode(p_mode text)
returns text language plpgsql security definer set search_path='' as $mode$
begin
 if (select auth.uid()) is null or not exists(select 1 from auth.users where id=(select auth.uid()) and raw_app_meta_data->>'role'='admin') then
  raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_mode is null or p_mode not in ('instant','strict') then raise exception 'Invalid chat mode'; end if;
 update studylab_private.guardian_chat_preferences set mode=p_mode where singleton;
 return p_mode;
end $mode$;
revoke all on function public.studylab_guardian_set_chat_mode(text) from public,anon,authenticated;
grant execute on function public.studylab_guardian_set_chat_mode(text) to authenticated;
commit;
