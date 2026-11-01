-- Harden image metadata and storage path ownership.
create or replace function public.studylab_social_prepare_image()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare post_author uuid;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;
  select author_id into post_author
  from public.studylab_social_posts
  where id = new.post_id and status = 'pending';
  if post_author is null or post_author <> auth.uid() then
    raise exception 'Images can only be attached to your own pending post';
  end if;
  if split_part(new.bucket_path, '/', 1) <> auth.uid()::text
     or split_part(new.bucket_path, '/', 2) <> new.post_id::text
     or split_part(new.bucket_path, '/', 3) = ''
     or new.bucket_path like '%..%' then
    raise exception 'Invalid image storage path';
  end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists studylab_social_images_prepare on public.studylab_social_post_images;
create trigger studylab_social_images_prepare
before insert on public.studylab_social_post_images
for each row execute function public.studylab_social_prepare_image();

drop policy if exists "Social users upload only into their own pending posts" on storage.objects;
create policy "Social users upload only into their own pending posts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'studylab-social'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is not null
  and (storage.foldername(name))[3] is not null
  and exists (
    select 1 from public.studylab_social_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.author_id = auth.uid()
      and p.status = 'pending'
  )
);