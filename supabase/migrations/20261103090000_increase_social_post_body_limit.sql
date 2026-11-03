-- Increase Social post capacity to support longer student updates.
-- The editor enforces a 1,000-word limit and a 15,000-character storage ceiling.
alter table public.studylab_social_posts
  drop constraint if exists studylab_social_posts_body_check;

alter table public.studylab_social_posts
  add constraint studylab_social_posts_body_check
  check (char_length(body) <= 15000);
