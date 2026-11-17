-- StudyLab chat hotfix: image-path CHECK must be executable by ordinary
-- authenticated users. The earlier private-schema function is not callable
-- by the table-inserting role; chat inserts fail with "permission denied".
-- A pure public-schema validator keeps the private schema unexposed.
begin;
create or replace function public.studylab_chat_image_paths_check_v2(
  p_paths text[], p_user uuid, p_message uuid
) returns boolean language sql immutable set search_path=''
as $$
 select coalesce(cardinality(p_paths),0)<=3
   and (coalesce(cardinality(p_paths),0)=0 or (p_user is not null and p_message is not null))
   and not exists(
     select 1 from unnest(coalesce(p_paths,array[]::text[])) as path
     where path is null or path !~
       ('^'||p_user::text||'/'||p_message::text||'/[0-2]\.webp$')
   )
   and (select count(distinct path)=count(*)
      from unnest(coalesce(p_paths,array[]::text[])) as path);
$$;
revoke all on function public.studylab_chat_image_paths_check_v2(text[],uuid,uuid)
 from public,anon;
grant execute on function public.studylab_chat_image_paths_check_v2(text[],uuid,uuid)
 to authenticated,service_role;
alter table public.studylab_chat_messages
 drop constraint if exists studylab_chat_image_paths_valid;
alter table public.studylab_chat_messages
 add constraint studylab_chat_image_paths_valid
 check(public.studylab_chat_image_paths_check_v2(image_paths,user_id,id)) not valid;
alter table public.studylab_chat_messages
 validate constraint studylab_chat_image_paths_valid;
commit;