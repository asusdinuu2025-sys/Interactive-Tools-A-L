-- Snapshot the author's selected profile icon on Social content.
-- This avoids exposing private profile rows just to render public post identities.

alter table public.studylab_social_posts
  add column if not exists author_gender text
  check (author_gender in ('male','female'));

alter table public.studylab_social_comments
  add column if not exists author_gender text
  check (author_gender in ('male','female'));

update public.studylab_social_posts p
set author_gender = profile.gender
from public.studylab_profiles profile
where profile.id = p.author_id
  and p.author_gender is null
  and profile.gender in ('male','female');

update public.studylab_social_comments c
set author_gender = profile.gender
from public.studylab_profiles profile
where profile.id = c.author_id
  and c.author_gender is null
  and profile.gender in ('male','female');

create or replace function public.studylab_social_prepare_post()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found or profile_row.display_name is null
     or profile_row.display_name ~ '^Student[0-9]{4}$'
     or profile_row.username is null or profile_row.exam_year is null
     or profile_row.study_stream is null then
    raise exception 'Complete your basic StudyLab profile before posting';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.author_gender := profile_row.gender;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.studylab_social_prepare_comment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare profile_row public.studylab_profiles%rowtype;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception 'Authentication required';
  end if;

  select * into profile_row
  from public.studylab_profiles
  where id = auth.uid();

  if not found or profile_row.display_name is null
     or profile_row.display_name ~ '^Student[0-9]{4}$'
     or profile_row.username is null or profile_row.exam_year is null
     or profile_row.study_stream is null then
    raise exception 'Complete your basic StudyLab profile before commenting';
  end if;

  if not exists (
    select 1 from public.studylab_social_posts
    where id = new.post_id and status = 'approved'
  ) then
    raise exception 'Comments are available on approved posts only';
  end if;

  new.author_display_name := profile_row.display_name;
  new.author_username := profile_row.username;
  new.author_gender := profile_row.gender;
  new.body := btrim(coalesce(new.body, ''));
  new.status := 'pending';
  new.created_at := now();
  return new;
end;
$$;
