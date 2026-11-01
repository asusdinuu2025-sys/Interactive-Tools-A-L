drop policy if exists "Social users upload only into their own pending posts" on storage.objects;
create policy "Social users upload only into their own pending posts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'studylab-social'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] is not null
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.author_id = (select auth.uid())
      and p.status = 'pending'
  )
);