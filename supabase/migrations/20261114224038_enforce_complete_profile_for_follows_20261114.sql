-- Enforce the same basic-profile rule on the server, not just the Follow UI.
create or replace function public.studylab_follow_validate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.follower_id = new.following_id then
    raise check_violation using message = 'You cannot follow yourself.';
  end if;
  if not exists (
    select 1 from public.studylab_profiles p
    where p.id = new.follower_id
      and p.display_name is not null
      and char_length(btrim(p.display_name)) >= 2
      and p.display_name !~ '^Student[0-9]{4}$'
      and p.username is not null
      and p.exam_year is not null
      and p.study_stream is not null
  ) then
    raise check_violation using message = 'First Complete Your Profile to follow others';
  end if;
  if not exists (
    select 1 from public.studylab_profiles p
    where p.id = new.following_id
      and p.display_name is not null and p.username is not null
      and p.exam_year is not null and p.study_stream is not null
  ) then
    raise check_violation using message = 'That student profile is unavailable.';
  end if;
  return new;
end;
$$;
revoke all on function public.studylab_follow_validate() from public,anon,authenticated;
