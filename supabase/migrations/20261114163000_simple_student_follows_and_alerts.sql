-- Minimal StudyLab student follows. No student private fields are exposed.
create table if not exists public.studylab_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  constraint studylab_follows_no_self check(follower_id <> following_id)
);

create index if not exists studylab_follows_target_date_idx
  on public.studylab_follows (following_id,created_at desc);
create index if not exists studylab_follows_source_date_idx
  on public.studylab_follows (follower_id,created_at desc);

alter table public.studylab_follows enable row level security;
revoke all on public.studylab_follows from public,anon,authenticated;
grant select,insert,delete on public.studylab_follows to authenticated;
create policy "StudyLab members may view follow relationships"
  on public.studylab_follows for select to authenticated using (true);
create policy "StudyLab members follow only from their own account"
  on public.studylab_follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and following_id <> (select auth.uid()));
create policy "StudyLab members unfollow only from their own account"
  on public.studylab_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- A small public directory RPC; the underlying studylab_profiles table
-- stays owner-only under its existing RLS, so school/phone/email are private.
-- Search requires at least 2 characters or an explicit array of user IDs.
create or replace function public.studylab_public_student_lookup(
  p_query text default null,
  p_user_ids uuid[] default null,
  p_limit int default 20
)
returns table(
  user_id uuid,
  display_name text,
  username text,
  gender text,
  joined_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.gender, u.created_at
  from public.studylab_profiles p
  join auth.users u on u.id = p.id
  where (select auth.uid()) is not null
    and p.display_name is not null
    and p.username is not null
    and p.exam_year is not null
    and p.study_stream is not null
    and (
      (p_user_ids is not null and p.id = any(p_user_ids))
      or
      (char_length(btrim(coalesce(p_query,''))) >= 2
       and (
         p.display_name ilike ('%' || btrim(p_query) || '%')
         or p.username ilike ('%' || ltrim(btrim(p_query),'@') || '%')
       ))
    )
  order by lower(p.display_name),lower(p.username)
  limit least(greatest(coalesce(p_limit,20),1),40);
$$;
revoke all on function public.studylab_public_student_lookup(text,uuid[],int) from public,anon;
grant execute on function public.studylab_public_student_lookup(text,uuid[],int) to authenticated;

-- Follow alerts are separate from likes/comments, visible only to recipients.
-- One current alert per follow pair; re-follow refreshes the alert date.
create table if not exists public.studylab_follow_alerts (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  constraint studylab_follow_alert_unique unique(recipient_id,actor_id),
  constraint studylab_follow_alert_no_self check(recipient_id <> actor_id)
);
create index if not exists studylab_follow_alerts_recipient_date_idx
  on public.studylab_follow_alerts (recipient_id,created_at desc);
alter table public.studylab_follow_alerts enable row level security;
revoke all on public.studylab_follow_alerts from public,anon,authenticated;
grant select on public.studylab_follow_alerts to authenticated;
grant update (is_read) on public.studylab_follow_alerts to authenticated;
create policy "Only recipients view follow alerts"
  on public.studylab_follow_alerts for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "Only recipients mark follow alerts as read"
  on public.studylab_follow_alerts for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Trigger checks the target is an actual student with a basic profile.
-- It runs server side, without granting other students access to private rows.
create or replace function public.studylab_follow_validate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.follower_id = new.following_id then
    raise check_violation using message = 'You cannot follow yourself.';
  end if;
  if not exists (
    select 1 from public.studylab_profiles p
    where p.id = new.follower_id and p.exam_year is not null
      and p.study_stream is not null
  ) then
    raise check_violation using message = 'Complete your StudyLab profile first.';
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
drop trigger if exists studylab_follow_validate_insert on public.studylab_follows;
create trigger studylab_follow_validate_insert before insert on public.studylab_follows
  for each row execute function public.studylab_follow_validate();

create or replace function public.studylab_follow_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.studylab_follow_alerts(recipient_id,actor_id,created_at,is_read)
    values(new.following_id,new.follower_id,now(),false)
    on conflict(recipient_id,actor_id) do update
      set created_at = excluded.created_at, is_read = false;
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.studylab_follow_alerts
      where recipient_id = old.following_id and actor_id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;
revoke all on function public.studylab_follow_notify() from public,anon,authenticated;
drop trigger if exists studylab_follow_notification_change on public.studylab_follows;
create trigger studylab_follow_notification_change
after insert or delete on public.studylab_follows
for each row execute function public.studylab_follow_notify();

-- Notifications older than two weeks are temporary and cleaned daily.
-- Uses the existing pg_cron extension already installed for StudyLab.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule(
      'studylab-follow-alerts-expiry',
      '24 3 * * *',
      'delete from public.studylab_follow_alerts where created_at < now() - interval ''14 days'';'
    );
  end if;
end $$;
