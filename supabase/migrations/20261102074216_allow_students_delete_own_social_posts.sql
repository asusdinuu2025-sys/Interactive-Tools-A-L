grant delete on table public.studylab_social_posts to authenticated;

drop policy if exists "Students delete their own social posts"
  on public.studylab_social_posts;

create policy "Students delete their own social posts"
  on public.studylab_social_posts
  for delete
  to authenticated
  using ((select auth.uid()) = author_id);
