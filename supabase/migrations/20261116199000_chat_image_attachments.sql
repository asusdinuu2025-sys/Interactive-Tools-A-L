-- StudyLab Chat: private image attachments, maximum three 1MB WebP images.
-- Pure additive migration. Existing chat messages, reactions and edit grants
-- are retained; uploads require an authenticated account and path ownership.
begin;
alter table public.studylab_chat_messages
  add column if not exists image_paths text[] not null default array[]::text[];

create or replace function studylab_private.chat_image_paths_valid(
  p_paths text[], p_user uuid, p_message uuid
) returns boolean language sql immutable set search_path=''
as $$
  select coalesce(cardinality(p_paths),0)<=3
    and (coalesce(cardinality(p_paths),0)=0 or (p_user is not null and p_message is not null))
    and not exists (
      select 1 from unnest(coalesce(p_paths,array[]::text[])) as path
      where path is null or path !~
        ('^'||p_user::text||'/'||p_message::text||'/[0-2]\\.webp$')
    )
    and (select count(distinct path)=count(*)
         from unnest(coalesce(p_paths,array[]::text[])) as path);
$$;
revoke all on function studylab_private.chat_image_paths_valid(text[],uuid,uuid)
 from public, anon, authenticated;

alter table public.studylab_chat_messages
  add constraint studylab_chat_image_paths_valid
  check (studylab_private.chat_image_paths_valid(image_paths,user_id,id));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('studylab-chat-images','studylab-chat-images',false,1048576,array['image/webp'])
 on conflict (id) do update set
  public=false,file_size_limit=1048576,
  allowed_mime_types=array['image/webp'];

-- Never allow untrusted clients to modify an existing message's file list.
revoke update (image_paths) on public.studylab_chat_messages from authenticated;
-- Existing insert RLS requires a matching authenticated user_id.
grant select,insert on public.studylab_chat_messages to authenticated;

create policy "StudyLab chat authenticated image read"
  on storage.objects for select to authenticated
  using (bucket_id='studylab-chat-images');

create policy "StudyLab chat own image upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='studylab-chat-images'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ ('^'||(select auth.uid())::text||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-2]\\.webp$')
    and coalesce((select auth.uid()),'00000000-0000-0000-0000-000000000000'::uuid)
        <> '00000000-0000-0000-0000-000000000000'::uuid
  );

create policy "StudyLab chat owners and moderators remove images"
 on storage.objects for delete to authenticated using (
    bucket_id='studylab-chat-images'
    and (
      (storage.foldername(name))[1]=(select auth.uid())::text
      or (select public.studylab_chat_can_moderate())
    )
  );
commit;
