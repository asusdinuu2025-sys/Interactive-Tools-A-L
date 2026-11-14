-- Optional public 15-word bio; no private profile columns become publicly readable.
alter table public.studylab_profiles
  add column if not exists bio text;
alter table public.studylab_profiles
  drop constraint if exists studylab_profiles_bio_word_limit;
alter table public.studylab_profiles
  add constraint studylab_profiles_bio_word_limit
  check (bio is null or (
    char_length(bio) <= 240 and
    coalesce(array_length(regexp_split_to_array(btrim(bio), '[[:space:]]+'), 1),0) <= 15
  ));

-- Keep the only authorized student directory limited to public-safe data.
-- The public result shape grows one bio column; PostgreSQL requires recreating
-- (not replacing) a function when its RETURNS TABLE columns change.
drop function if exists public.studylab_public_student_lookup(text,uuid[],int);
create function public.studylab_public_student_lookup(
  p_query text default null, p_user_ids uuid[] default null, p_limit int default 20
)
returns table (
  user_id uuid, display_name text, username text, gender text,
  joined_at timestamptz, bio text
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.gender, u.created_at, p.bio
  from public.studylab_profiles p
  join auth.users u on u.id = p.id
  where (select auth.uid()) is not null
    and p.display_name is not null
    and p.username is not null
    and p.exam_year is not null and p.study_stream is not null
    and (
      (p_user_ids is not null and p.id = any(p_user_ids))
      or
      (char_length(btrim(coalesce(p_query,''))) >= 2
       and (p.display_name ilike ('%' || btrim(p_query) || '%')
         or p.username ilike ('%' || ltrim(btrim(p_query),'@') || '%')))
    )
  order by lower(p.display_name),lower(p.username)
  limit least(greatest(coalesce(p_limit,20),1),40);
$$;
revoke all on function public.studylab_public_student_lookup(text,uuid[],int) from public,anon;
grant execute on function public.studylab_public_student_lookup(text,uuid[],int) to authenticated;

-- Midnight in Sri Lanka is 18:30 GMT; pg_cron currently uses GMT even though
-- the DB session's TimeZone is Asia/Colombo.
-- Cleanup deletes ONLY notification records, not posts, likes, comments or follows.
-- Retire the old 14-day follow alert expiry job in favor of midnight expiry.
do $$
begin
  if exists(select 1 from cron.job where jobname='studylab-follow-alerts-expiry') then
    perform cron.unschedule('studylab-follow-alerts-expiry');
  end if;
  perform cron.schedule(
    'studylab-midnight-notification-cleanup-lk',
    '30 18 * * *',
    $job$
      delete from public.studylab_follow_alerts
        where created_at < date_trunc('day', now() at time zone 'Asia/Colombo')
          at time zone 'Asia/Colombo';
      delete from public.studylab_social_notifications
        where created_at < date_trunc('day', now() at time zone 'Asia/Colombo')
          at time zone 'Asia/Colombo';
    $job$
  );
end $$;
