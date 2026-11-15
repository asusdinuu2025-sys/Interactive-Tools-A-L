-- StudyLab feature-discovery v2. Remove all student read tracking and
-- restrict site-admin actions to the three verified owner-selected accounts.
-- Existing profile, study sessions, Social posts and Chat are not modified.
create or replace function public.studylab_social_is_admin()
returns boolean language sql stable
set search_path to 'public','pg_temp'
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role')='admin',false)
     and (select auth.uid()) in (
       '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,
       '7c97a8d7-f047-4c88-883d-4bed9b1a5f99'::uuid,
       'b6c80613-8217-48ac-851b-a39a3d9bef2b'::uuid
     );
$$;
-- Previously flagged anonymous site admin: drop ONLY elevated role metadata.
update auth.users
set raw_app_meta_data=raw_app_meta_data-'role',updated_at=now()
where id='1bc60c02-b540-469a-915a-305d096f6fef'::uuid
  and is_anonymous=true and raw_app_meta_data->>'role'='admin';

drop table if exists public.studylab_announcement_reads;

alter table public.studylab_announcements
  add column if not exists sort_order integer not null default 1000,
  add column if not exists art_key text not null default 'announcement',
  add column if not exists image_path text;
alter table public.studylab_announcements
  add constraint announcement_sort_order_safe check (sort_order between 1 and 10000),
  add constraint announcement_art_key_safe check
    (art_key in ('profile','social','room','chat','science','about','announcement')),
  add constraint announcement_image_path_safe check
    (image_path is null or image_path ~ '^banners/[0-9a-f-]{36}\.webp$');
create index if not exists announcement_visible_order_idx on public.studylab_announcements
  (published,sort_order,starts_at);

-- Public delivery for published banners; writes are strictly admin-controlled.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('studylab-announcements','studylab-announcements',true,2097152,array['image/webp']::text[])
on conflict (id) do update
  set public=excluded.public,file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "StudyLab announcement images readable" on storage.objects;
create policy "StudyLab announcement images readable" on storage.objects
  for select to anon,authenticated
  using (bucket_id='studylab-announcements');
drop policy if exists "StudyLab admin adds announcement images" on storage.objects;
create policy "StudyLab admin adds announcement images" on storage.objects
  for insert to authenticated
  with check (bucket_id='studylab-announcements'
    and (select public.studylab_social_is_admin())
    and name ~ '^banners/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$');
drop policy if exists "StudyLab admin deletes announcement images" on storage.objects;
create policy "StudyLab admin deletes announcement images" on storage.objects
  for delete to authenticated
  using (bucket_id='studylab-announcements'
    and (select public.studylab_social_is_admin()));

-- Publish seven editable, reorderable feature-discovery posts. They are
-- genuine DB records, not hard-coded fallback cards that reappear after delete.
insert into public.studylab_announcements
  (kind,title,body,cta_label,target_path,published,starts_at,created_by,sort_order,art_key)
select v.kind,v.title,v.body,v.cta,v.path,true,now(),
  '24e78cd0-4565-407a-96f7-9cfde083f6d2'::uuid,v.order_index,v.art
from (values
 (10,'feature','Profile pictures are here!',
  'Upload your photo or keep the original neon avatar.','View Profile','/#profile','profile'),
 (20,'feature','Follow and connect',
  'Follow other students and build your study circle.','Explore Social','/#social','social'),
 (30,'discover','Live Study Room',
  'Study together, track your time and climb the ranks.','Enter Study Room',
  '/study-room.html?completeProfile=1&returnTo=%2Fstudy-room.html','room'),
 (40,'announcement','StudyLab Social',
  'Share notes, study progress, ideas and experiences.','Open Social','/#social','social'),
 (50,'feature','StudyLab Chat',
  'Reply, react and talk with students in the live Chat.','Open Chat','/#study-chat','chat'),
 (60,'discover','Practical Simulations',
  'Explore interactive Maths, Physics, Chemistry and Biology.','Explore Simulations',
  '/#practical-simulations','science'),
 (70,'announcement','About StudyLab',
  'Your A/L study hub for practical learning, resources and community.',
  'Discover StudyLab','/#about-studylab','about')
) as v(order_index,kind,title,body,cta,path,art)
where not exists (
  select 1 from public.studylab_announcements a where a.title=v.title
);
