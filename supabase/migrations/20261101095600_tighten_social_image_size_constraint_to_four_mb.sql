-- Keep Social image metadata, trigger checks and Storage aligned at 4 MiB.
update storage.buckets
set file_size_limit = 4194304
where id = 'studylab-social';

alter table public.studylab_social_post_images
  drop constraint if exists studylab_social_post_images_size_bytes_check;

alter table public.studylab_social_post_images
  add constraint studylab_social_post_images_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 4194304);

create or replace function public.studylab_social_prepare_image()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  post_author uuid;
  existing_images integer;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  -- Serialize metadata inserts for a post so concurrent uploads cannot exceed the cap.
  select author_id into post_author
  from public.studylab_social_posts
  where id = new.post_id and status = 'pending'
  for update;

  if post_author is null or post_author <> auth.uid() then
    raise exception 'Images can only be attached to your own pending post';
  end if;

  if new.size_bytes is null or new.size_bytes <= 0 or new.size_bytes > 4194304 then
    raise exception 'Each image must be 4 MB or smaller';
  end if;

  select count(*) into existing_images
  from public.studylab_social_post_images
  where post_id = new.post_id;

  if existing_images >= 4 then
    raise exception 'A post can contain up to 4 images';
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
$function$;
