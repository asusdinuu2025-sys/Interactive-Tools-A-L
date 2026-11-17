-- StudyLab Chat document sharing. Prepared for PR #102; NOT applied to live Supabase.
-- Keep the existing private image bucket, image_paths and 100-message policy intact.
-- Maximum two study documents per message, each at most 5 MiB.
begin;

alter table public.studylab_chat_messages
  add column if not exists file_attachments jsonb not null default '[]'::jsonb;

create or replace function public.studylab_chat_file_attachments_valid_v1(
  p_files jsonb, p_user uuid, p_message uuid
) returns boolean
language sql immutable set search_path=''
as $$
  select jsonb_typeof(p_files)='array'
    and jsonb_array_length(case when jsonb_typeof(p_files)='array'
          then p_files else '[]'::jsonb end)<=2
    and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(p_files)='array'
          then p_files else '[]'::jsonb end) as f(item)
      where jsonb_typeof(f.item)<>'object'
        or jsonb_typeof(f.item->'path')<>'string'
        or jsonb_typeof(f.item->'name')<>'string'
        or jsonb_typeof(f.item->'size')<>'number'
        or f.item->>'path' !~
          ('^'||p_user::text||'/'||p_message::text||'/[0-1]\\.(pdf|docx|pptx|txt)$')
        or char_length(f.item->>'name') not between 1 and 120
        or f.item->>'name' ~ '[[:cntrl:]]'
        or f.item->>'name' !~* '\\.(pdf|docx|pptx|txt)$'
        or f.item->>'size' !~ '^[0-9]{1,7}$'
        or (f.item->>'size')::integer not between 1 and 5242880
    )
    and (
      select count(distinct f.item->>'path')=count(*)
      from jsonb_array_elements(case when jsonb_typeof(p_files)='array'
          then p_files else '[]'::jsonb end) as f(item)
    );
$$;
revoke all on function public.studylab_chat_file_attachments_valid_v1(jsonb,uuid,uuid)
  from public,anon;
grant execute on function public.studylab_chat_file_attachments_valid_v1(jsonb,uuid,uuid)
  to authenticated,service_role;
alter table public.studylab_chat_messages
  drop constraint if exists studylab_chat_file_attachments_valid;
alter table public.studylab_chat_messages
  add constraint studylab_chat_file_attachments_valid
  check (public.studylab_chat_file_attachments_valid_v1(
    file_attachments,user_id,id)) not valid;
alter table public.studylab_chat_messages
  validate constraint studylab_chat_file_attachments_valid;

-- Students can submit their own attachments during INSERT, but cannot
-- modify the file lists afterward. Existing message edit grants are untouched.
revoke update (file_attachments) on public.studylab_chat_messages from authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'studylab-chat-files','studylab-chat-files',false,5242880,
  array[
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ])
on conflict(id) do update set public=false,file_size_limit=5242880,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "StudyLab chat private documents read"
  on storage.objects for select to authenticated
  using (bucket_id='studylab-chat-files');

create policy "StudyLab chat own documents upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='studylab-chat-files'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and name ~ ('^'||(select auth.uid())::text||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-1]\\.(pdf|docx|pptx|txt)$')
  );

create policy "StudyLab chat owners and moderators remove documents"
  on storage.objects for delete to authenticated using (
    bucket_id='studylab-chat-files'
    and (
      (storage.foldername(name))[1]=(select auth.uid())::text
      or (select public.studylab_chat_can_moderate())
    )
  );
commit;
