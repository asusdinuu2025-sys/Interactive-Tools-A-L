-- Tighten the Social image metadata constraint to match the 4 MiB bucket limit.
alter table public.studylab_social_post_images
  drop constraint if exists studylab_social_post_images_size_bytes_check;

alter table public.studylab_social_post_images
  add constraint studylab_social_post_images_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 4194304);
