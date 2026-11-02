-- StudyLab Social now publishes posts and comments immediately.
-- Authors may delete their own content; admins may delete any content.
-- Image uploads remain private and keep the existing file/type/count limits.

create or replace function public.studylab_social_prepare_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found
     or profile_row.display_name is null
     or profile_row.display_name ~ '^Student[0-9]{4}$'
     or profile_row.username is null
     or profile_row.exam_year is null
     or profile_row.study_stream is null then
    raise exception 'Complete your basic StudyLab profile before posting';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.author_gender := profile_row.gender;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'uploading';
  new.created_at := now();
  return new;
end;
$$;



create or replace function public.studylab_social_prepare_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found
     or profile_row.display_name is null
     or profile_row.display_name ~ '^Student[0-9]{4}$'
     or profile_row.username is null
     or profile_row.exam_year is null
     or profile_row.study_stream is null then
    raise exception 'Complete your basic StudyLab profile before commenting';
  end if;

  if not exists (
    select 1 from public.studylab_social_posts
    where id = new.post_id and status = 'approved'
  ) then
    raise exception 'Comments are available on published posts only';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.author_gender := profile_row.gender;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'approved';
  new.created_at := now();
  return new;
end;
$$;



-- Old pending items are published. New post rows stay invisible only while files upload.
update public.studylab_social_posts set status = 'approved' where status = 'pending';
update public.studylab_social_comments set status = 'approved' where status = 'pending';

alter table public.studylab_social_posts
  drop constraint if exists studylab_social_posts_status_check;
alter table public.studylab_social_posts
  add constraint studylab_social_posts_status_check
  check (status in ('uploading', 'approved', 'rejected', 'removed'));

alter table public.studylab_social_comments
  drop constraint if exists studylab_social_comments_status_check;
alter table public.studylab_social_comments
  add constraint studylab_social_comments_status_check
  check (status in ('approved', 'rejected', 'removed'));

alter table public.studylab_social_posts
  alter column status set default 'uploading';
alter table public.studylab_social_comments
  alter column status set default 'approved';

-- The temporary uploading state is never exposed in the feed or review queue.
drop policy if exists "Students create pending social posts" on public.studylab_social_posts;
drop policy if exists "Students create published social posts" on public.studylab_social_posts;
drop policy if exists "Students create uploading social posts" on public.studylab_social_posts;
create policy "Students create uploading social posts"
on public.studylab_social_posts
for insert to authenticated
with check (author_id = (select auth.uid()) and status = 'uploading');

drop policy if exists "Students add pending comments to approved posts" on public.studylab_social_comments;
drop policy if exists "Students add published comments to approved posts" on public.studylab_social_comments;
create policy "Students add published comments to approved posts"
on public.studylab_social_comments
for insert to authenticated
with check (author_id = (select auth.uid()) and status = 'approved');

-- Image metadata is attached only while the author's post is in its hidden upload state.
drop policy if exists "Students attach images to their pending posts" on public.studylab_social_post_images;
drop policy if exists "Students attach images to their published posts" on public.studylab_social_post_images;
drop policy if exists "Students attach images to their uploading posts" on public.studylab_social_post_images;
create policy "Students attach images to their uploading posts"
on public.studylab_social_post_images
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id = post_id
      and p.author_id = (select auth.uid())
      and p.status = 'uploading'
  )
);

-- Uploads are permitted only into the author's hidden uploading post.
drop policy if exists "Social users upload only into their own pending posts" on storage.objects;
drop policy if exists "Social users upload into own published posts" on storage.objects;
drop policy if exists "Social users upload into own uploading posts" on storage.objects;
create policy "Social users upload into own uploading posts"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'studylab-social'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.author_id = (select auth.uid())
      and p.status = 'uploading'
  )
);

-- Publish only after every selected photo and metadata row has uploaded.
create or replace function public.studylab_social_publish_own_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.studylab_social_posts
  set status = 'approved'
  where id = p_post_id
    and author_id = auth.uid()
    and status = 'uploading';

  return found;
end;
$$;
revoke all on function public.studylab_social_publish_own_post(uuid) from public, anon;
grant execute on function public.studylab_social_publish_own_post(uuid) to authenticated;

-- Preserve students' existing own-post delete policy and add admin-wide deletion.
grant delete on table public.studylab_social_posts to authenticated;
drop policy if exists "Admins delete any social posts" on public.studylab_social_posts;
create policy "Admins delete any social posts"
on public.studylab_social_posts
for delete to authenticated
using ((select public.studylab_social_is_admin()));

-- Owners can remove their own comments; admins can remove any comment.
grant delete on table public.studylab_social_comments to authenticated;
drop policy if exists "Students delete their own social comments" on public.studylab_social_comments;
create policy "Students delete their own social comments"
on public.studylab_social_comments
for delete to authenticated
using ((select auth.uid()) = author_id);

drop policy if exists "Admins delete any social comments" on public.studylab_social_comments;
create policy "Admins delete any social comments"
on public.studylab_social_comments
for delete to authenticated
using ((select public.studylab_social_is_admin()));

-- Admin can delete any Social image object; the existing owner policy remains.
drop policy if exists "Admins delete any Social upload objects" on storage.objects;
create policy "Admins delete any Social upload objects"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'studylab-social'
  and (select public.studylab_social_is_admin())
);

-- The approval/rejection RPCs are no longer part of the Social workflow.
drop function if exists public.studylab_social_moderate_post(uuid, text);
drop function if exists public.studylab_social_moderate_comment(uuid, text);
drop function if exists public.studylab_social_delete_own_pending_post(uuid);

comment on table public.studylab_social_posts is
  'StudyLab Social posts publish immediately after upload completes; authors and admins may delete.';
comment on table public.studylab_social_comments is
  'StudyLab Social comments. New comments are published immediately; authors and admins may delete.';
