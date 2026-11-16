-- PR #102 · Uploadable standalone HTML simulations, restricted to StudyLab administrators.
-- HTML is rendered only inside the sandboxed StudyLab simulation viewer.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('studylab-simulations','studylab-simulations',true,5242880,array['text/html'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['text/html'];

create policy "StudyLab admins upload simulation HTML"
on storage.objects for insert to authenticated
with check (
 bucket_id='studylab-simulations'
 and (select public.studylab_social_is_admin())
 and name ~ '^html/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]html$'
);

create policy "StudyLab admins remove simulation HTML"
on storage.objects for delete to authenticated
using(bucket_id='studylab-simulations' and (select public.studylab_social_is_admin()));

create policy "StudyLab admins list simulation HTML"
on storage.objects for select to authenticated
using(bucket_id='studylab-simulations' and (select public.studylab_social_is_admin()));
commit;
