-- Optional StudyLab avatar images; independent of Social and Study Room progress.
-- One 320x320 WebP object at <authenticated-user-id>/avatar.webp per account.
-- This small public image bucket is intentional: uploaded avatars can be seen
-- in student cards and profiles by anyone who obtains their URL.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('studylab-avatars','studylab-avatars',true,184320,array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.studylab_profile_avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.studylab_profile_avatars enable row level security;
revoke all on public.studylab_profile_avatars from anon;
grant select, insert, update, delete on public.studylab_profile_avatars to authenticated;

drop policy if exists "StudyLab avatars: authenticated read" on public.studylab_profile_avatars;
create policy "StudyLab avatars: authenticated read"
on public.studylab_profile_avatars for select to authenticated using (true);

drop policy if exists "StudyLab avatars: owner insert" on public.studylab_profile_avatars;
create policy "StudyLab avatars: owner insert"
on public.studylab_profile_avatars for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "StudyLab avatars: owner update" on public.studylab_profile_avatars;
create policy "StudyLab avatars: owner update"
on public.studylab_profile_avatars for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "StudyLab avatars: owner delete" on public.studylab_profile_avatars;
create policy "StudyLab avatars: owner delete"
on public.studylab_profile_avatars for delete to authenticated
using (user_id = (select auth.uid()));

-- Do not allow uploads of arbitrary file names or other people's images.
drop policy if exists "StudyLab avatars: owner upload" on storage.objects;
create policy "StudyLab avatars: owner upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'studylab-avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "StudyLab avatars: owner replace" on storage.objects;
create policy "StudyLab avatars: owner replace" on storage.objects
for update to authenticated
using (bucket_id = 'studylab-avatars'
  and name = (select auth.uid())::text || '/avatar.webp')
with check (bucket_id = 'studylab-avatars'
  and name = (select auth.uid())::text || '/avatar.webp');

drop policy if exists "StudyLab avatars: owner remove" on storage.objects;
create policy "StudyLab avatars: owner remove" on storage.objects
for delete to authenticated
using (bucket_id = 'studylab-avatars'
  and name = (select auth.uid())::text || '/avatar.webp');

-- Supabase Storage upsert also requires SELECT on the existing object.
drop policy if exists "StudyLab avatars: owner read for upsert" on storage.objects;
create policy "StudyLab avatars: owner read for upsert" on storage.objects
for select to authenticated
using (bucket_id = 'studylab-avatars'
  and name = (select auth.uid())::text || '/avatar.webp');

-- No Study Room inactivity cleanup or Social maintenance touches this table.
-- On account deletion, metadata cascades via auth.users; the separate Storage
-- object is removed by both authenticated account-deletion backends first.
