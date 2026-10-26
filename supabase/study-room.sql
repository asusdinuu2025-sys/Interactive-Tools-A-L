-- StudyLab shared Study Room: run once in Supabase SQL Editor.
-- Uses anonymous Supabase Auth identities; no email/password is required.
create table if not exists public.study_room_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 24),
  subject text not null default 'Combined Mathematics'
    check (subject in ('Combined Mathematics', 'Physics', 'Chemistry')),
  is_studying boolean not null default false,
  session_started_at timestamptz,
  last_heartbeat_at timestamptz,
  today_seconds integer not null default 0 check (today_seconds >= 0),
  today_date date not null default (timezone('Asia/Colombo', now())::date),
  week_seconds integer not null default 0 check (week_seconds >= 0),
  week_start date not null default (
    timezone('Asia/Colombo', now())::date
    - ((extract(isodow from timezone('Asia/Colombo', now()))::int) - 1)
  ),
  updated_at timestamptz not null default now()
);

alter table public.study_room_members enable row level security;
drop policy if exists "Authenticated students can read the room" on public.study_room_members;
create policy "Authenticated students can read the room"
  on public.study_room_members for select to authenticated using (true);

-- Browser clients cannot directly write totals or attendance. Only these
-- server-side functions may mutate rows, and each function uses auth.uid().
revoke insert, update, delete on public.study_room_members from anon, authenticated;
grant select on public.study_room_members to authenticated;

create or replace function public.study_room_local_week_start(d date)
returns date language sql immutable as $$
  select d - (extract(isodow from d)::int - 1);
$$;

create or replace function public.study_room_ensure_profile(p_display_name text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  insert into public.study_room_members(user_id, display_name)
  values (uid, left(regexp_replace(coalesce(p_display_name, ''), '[^[:alnum:] _.-]', '', 'g'), 24))
  on conflict (user_id) do nothing;
  if not exists (select 1 from public.study_room_members where user_id = uid) then
    raise exception 'Could not create profile';
  end if;
end; $$;

create or replace function public.study_room_set_subject(p_subject text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_subject not in ('Combined Mathematics', 'Physics', 'Chemistry') then
    raise exception 'Invalid subject';
  end if;
  update public.study_room_members set subject = p_subject, updated_at = now()
  where user_id = auth.uid();
  if not found then raise exception 'Create a profile first'; end if;
end; $$;

create or replace function public.study_room_start()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  update public.study_room_members
  set is_studying = true, session_started_at = now(),
      last_heartbeat_at = now(), updated_at = now()
  where user_id = auth.uid();
  if not found then raise exception 'Create a profile first'; end if;
end; $$;

create or replace function public.study_room_heartbeat()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  elapsed integer;
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  update public.study_room_members m
  set today_seconds =
        (case when m.today_date = local_day then m.today_seconds else 0 end) + elapsed,
      today_date = local_day,
      week_seconds =
        (case when m.week_start = monday then m.week_seconds else 0 end) + elapsed,
      week_start = monday,
      last_heartbeat_at = now(),
      updated_at = now()
  where m.user_id = uid and m.is_studying
    and m.last_heartbeat_at is not null;
  -- elapsed is computed from the previously stored heartbeat, capped at 90s.
end; $$;

-- Replace heartbeat with an implementation that computes elapsed before UPDATE.
create or replace function public.study_room_heartbeat()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  elapsed integer;
  previous public.study_room_members%rowtype;
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  select * into previous from public.study_room_members
    where user_id = uid and is_studying for update;
  if not found then return; end if;
  elapsed := greatest(0, least(90, floor(extract(epoch from (now() - previous.last_heartbeat_at)))::int));
  update public.study_room_members
  set today_seconds = (case when today_date = local_day then today_seconds else 0 end) + elapsed,
      today_date = local_day,
      week_seconds = (case when week_start = monday then week_seconds else 0 end) + elapsed,
      week_start = monday,
      last_heartbeat_at = now(), updated_at = now()
  where user_id = uid;
end; $$;

create or replace function public.study_room_leave()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.study_room_heartbeat();
  update public.study_room_members
  set is_studying = false, session_started_at = null, last_heartbeat_at = null,
      updated_at = now()
  where user_id = auth.uid();
end; $$;

grant execute on function public.study_room_ensure_profile(text) to authenticated;
grant execute on function public.study_room_set_subject(text) to authenticated;
grant execute on function public.study_room_start() to authenticated;
grant execute on function public.study_room_heartbeat() to authenticated;
grant execute on function public.study_room_leave() to authenticated;

-- Enable row-change broadcasts for live attendance and leaderboard refreshes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'study_room_members'
  ) then
    alter publication supabase_realtime add table public.study_room_members;
  end if;
exception when undefined_object then
  raise notice 'Create/enable the supabase_realtime publication in Supabase first.';
end $$;
