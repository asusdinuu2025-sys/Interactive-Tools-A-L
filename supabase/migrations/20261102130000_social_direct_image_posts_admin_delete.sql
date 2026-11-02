-- Let students' image posts publish without a manual image-review queue.
-- Text captions remain subject to the existing AI text moderation flow.
-- Existing admin claims can permanently delete any Social post and its Storage objects.

grant delete on table public.studylab_social_posts to authenticated;

drop policy if exists "Admins delete any social posts" on public.studylab_social_posts;
create policy "Admins delete any social posts"
on public.studylab_social_posts
for delete
to authenticated
using ((select public.studylab_social_is_admin()));

drop policy if exists "Admins delete any Social upload objects" on storage.objects;
create policy "Admins delete any Social upload objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'studylab-social'
  and (select public.studylab_social_is_admin())
);
