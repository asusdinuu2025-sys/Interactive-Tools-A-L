-- StudyLab AI: persistent per-student daily quota
-- Run this once in Supabase SQL Editor for project:
-- zpvatyxdbshjuqgtexzw

create table if not exists public.studylab_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.studylab_ai_usage enable row level security;

revoke all on table public.studylab_ai_usage from anon, authenticated;

create or replace function public.studylab_reserve_ai_quota()
returns table (
  allowed boolean,
  remaining integer,
  used integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_usage_date date := (now() at time zone 'Asia/Colombo')::date;
  v_daily_limit integer := 18;
  v_used integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.studylab_ai_usage (
    user_id,
    usage_date,
    request_count,
    updated_at
  )
  values (
    v_user_id,
    v_usage_date,
    1,
    now()
  )
  on conflict (user_id, usage_date)
  do update
    set request_count = public.studylab_ai_usage.request_count + 1,
        updated_at = now()
    where public.studylab_ai_usage.request_count < v_daily_limit
  returning request_count into v_used;

  if v_used is null then
    select request_count
      into v_used
      from public.studylab_ai_usage
     where user_id = v_user_id
       and usage_date = v_usage_date;

    return query
      select false,
             greatest(0, v_daily_limit - coalesce(v_used, 0)),
             coalesce(v_used, 0);
  end if;

  return query
    select true,
           greatest(0, v_daily_limit - v_used),
           v_used;
end;
$$;

revoke all on function public.studylab_reserve_ai_quota() from public, anon;
grant execute on function public.studylab_reserve_ai_quota() to authenticated;

create or replace function public.studylab_release_ai_quota()
returns table (
  released boolean,
  remaining integer,
  used integer
)
language plpgsql
security definer
set search_path = public
as $
declare
  v_user_id uuid := auth.uid();
  v_usage_date date := (now() at time zone 'Asia/Colombo')::date;
  v_daily_limit integer := 18;
  v_used integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.studylab_ai_usage
     set request_count = greatest(0, request_count - 1),
         updated_at = now()
   where user_id = v_user_id
     and usage_date = v_usage_date
     and request_count > 0
   returning request_count into v_used;

  if v_used is null then
    return query select false, v_daily_limit, 0;
  end if;

  return query
    select true,
           greatest(0, v_daily_limit - v_used),
           v_used;
end;
$;

revoke all on function public.studylab_release_ai_quota() from public, anon;
grant execute on function public.studylab_release_ai_quota() to authenticated;
