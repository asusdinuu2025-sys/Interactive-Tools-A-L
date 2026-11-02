drop policy if exists "Students delete their own Social upload objects" on storage.objects;
create policy "Students delete their own Social upload objects"
on storage.objects for delete to authenticated
using (bucket_id = 'studylab-social' and (storage.foldername(name))[1] = (select auth.uid())::text);