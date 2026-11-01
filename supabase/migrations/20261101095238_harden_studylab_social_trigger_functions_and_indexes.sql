-- Reduce privilege surface of trigger helpers and tune Social indexes/RLS.
alter function public.studylab_social_prepare_post() security invoker;
alter function public.studylab_social_prepare_comment() security invoker;
alter function public.studylab_social_prepare_image() security invoker;
alter function public.studylab_social_is_admin() security invoker;
revoke all on function public.studylab_social_prepare_post() from public, anon, authenticated;
revoke all on function public.studylab_social_prepare_comment() from public, anon, authenticated;
revoke all on function public.studylab_social_prepare_image() from public, anon, authenticated;
create index if not exists studylab_social_likes_user_idx on public.studylab_social_likes(user_id);
create index if not exists studylab_social_post_images_author_idx on public.studylab_social_post_images(author_id);
drop policy if exists "Students create pending social posts" on public.studylab_social_posts;
create policy "Students create pending social posts" on public.studylab_social_posts for insert to authenticated
with check (author_id = (select auth.uid()) and status = 'pending');
drop policy if exists "Students attach images to their pending posts" on public.studylab_social_post_images;
create policy "Students attach images to their pending posts" on public.studylab_social_post_images for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.studylab_social_posts p where p.id = post_id and p.author_id = (select auth.uid()) and p.status = 'pending'
));
drop policy if exists "Students add pending comments to approved posts" on public.studylab_social_comments;
create policy "Students add pending comments to approved posts" on public.studylab_social_comments for insert to authenticated
with check (author_id = (select auth.uid()) and status = 'pending' and exists (
  select 1 from public.studylab_social_posts p where p.id = post_id and p.status = 'approved'
));
drop policy if exists "Students like approved posts" on public.studylab_social_likes;
create policy "Students like approved posts" on public.studylab_social_likes for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.studylab_social_posts p where p.id = post_id and p.status = 'approved'
));
drop policy if exists "Students remove their own likes" on public.studylab_social_likes;
create policy "Students remove their own likes" on public.studylab_social_likes for delete to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "Social users upload only into their own pending posts" on storage.objects;
create policy "Social users upload only into their own pending posts" on storage.objects for insert to authenticated
with check (
  bucket_id = 'studylab-social'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] is not null
  and (storage.foldername(name))[3] is not null
  and exists (select 1 from public.studylab_social_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.author_id = (select auth.uid()) and p.status = 'pending')
);
revoke all on cron.job from public, anon, authenticated;
revoke all on cron.job_run_details from public, anon, authenticated;