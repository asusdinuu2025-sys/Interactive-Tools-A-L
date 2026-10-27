-- StudyLab live Study Room additions.
-- Reuses the existing public.studylab_profiles table for display names.
-- This script creates a separate table for room status/timers; it does not
-- drop tables, drop policies, or alter/delete existing profile records.
-- Run once in the Supabase SQL Editor after confirming studylab_profiles.id
-- is the UUID that corresponds to auth.users.id.

create table if not exists public.study_room_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject text not null default 'Combined Mathematics'
    check (subject in ('Combined Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Information & Communication Technology (ICT)', 'General English', 'General Common Test', 'Accounting', 'Business Studies', 'Economics', 'Business Statistics', 'Logic and Scientific Method', 'Geography', 'Political Science', 'History', 'Home Economics', 'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Buddhist Civilization', 'Christian Civilization', 'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil', 'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese', 'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music', 'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)', 'Drama and Theatre', 'Engineering Technology', 'Science for Technology', 'Bio Systems Technology', 'Agro Technology', 'Food Technology', 'Mechanical Technology', 'Electrical, Electronic and Information Technology', 'Civil Technology', 'Design, Electrical and Electronic Technology', 'Design and Construction Technology', 'Design and Mechanical Technology', 'Design, Quantity Surveying and Construction Process')),
  is_studying boolean not null default false,
  session_started_at timestamptz,
  last_heartbeat_at timestamptz,
  today_seconds integer not null default 0 check (today_seconds >= 0),
  today_date date not null default (timezone('Asia/Colombo', now())::date),
  week_seconds integer not null default 0 check (week_seconds >= 0),
  week_start date not null default (
    timezone('Asia/Colombo', now())::date
    - (extract(isodow from timezone('Asia/Colombo', now()))::int - 1)
  ),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS today_time text
  GENERATED ALWAYS AS (
    lpad((today_seconds / 3600)::text, 2, '0') || ':' ||
    lpad(((today_seconds % 3600) / 60)::text, 2, '0') || ':' ||
    lpad((today_seconds % 60)::text, 2, '0')
  ) STORED;
ALTER TABLE public.study_room_members
  ADD COLUMN IF NOT EXISTS week_time text
  GENERATED ALWAYS AS (
    lpad((week_seconds / 3600)::text, 2, '0') || ':' ||
    lpad(((week_seconds % 3600) / 60)::text, 2, '0') || ':' ||
    lpad((week_seconds % 60)::text, 2, '0')
  ) STORED;

-- Keep the subject constraint in sync when this script is rerun on an existing table.
alter table public.study_room_members
  drop constraint if exists study_room_members_subject_check;
alter table public.study_room_members
  add constraint study_room_members_subject_check
  check (subject in ('Combined Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Information & Communication Technology (ICT)', 'General English', 'General Common Test', 'Accounting', 'Business Studies', 'Economics', 'Business Statistics', 'Logic and Scientific Method', 'Geography', 'Political Science', 'History', 'Home Economics', 'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Buddhist Civilization', 'Christian Civilization', 'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil', 'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese', 'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music', 'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)', 'Drama and Theatre', 'Engineering Technology', 'Science for Technology', 'Bio Systems Technology', 'Agro Technology', 'Food Technology', 'Mechanical Technology', 'Electrical, Electronic and Information Technology', 'Civil Technology', 'Design, Electrical and Electronic Technology', 'Design and Construction Technology', 'Design and Mechanical Technology', 'Design, Quantity Surveying and Construction Process'));

alter table public.study_room_members enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
    where schemaname='public' and tablename='study_room_members'
      and policyname='Authenticated students can read room status') then
    create policy "Authenticated students can read room status"
      on public.study_room_members for select to authenticated using (true);
  end if;
end $$;

revoke insert, update, delete on public.study_room_members from anon, authenticated;
grant select on public.study_room_members to authenticated;

-- Expose only the display name needed by the live room. The helper is
-- outside the exposed public schema, uses a fixed search_path, and only returns
-- a name for an existing room member.
ALTER TABLE public.studylab_profiles ADD COLUMN IF NOT EXISTS gender text;
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'studylab_profiles_gender_check'
      AND conrelid = 'public.studylab_profiles'::regclass
  ) THEN
    ALTER TABLE public.studylab_profiles
      ADD CONSTRAINT studylab_profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END
$;

create schema if not exists study_room_private;
revoke all on schema study_room_private from public, anon;
grant usage on schema study_room_private to authenticated;

create or replace function study_room_private.display_name_for_member(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (select nullif(p.display_name, '')
     from public.studylab_profiles p
     where p.id = p_user_id),
    'Student'
  )
  where exists (
    select 1
    from public.study_room_members m
    where m.user_id = p_user_id
  );
$function$;

revoke all on function study_room_private.display_name_for_member(uuid) from public, anon;
grant execute on function study_room_private.display_name_for_member(uuid) to authenticated;

-- SECURITY INVOKER keeps the room-members RLS policy in force.
create or replace view public.study_room_live
with (security_invoker = true) as
select m.user_id,
       study_room_private.display_name_for_member(m.user_id) as display_name,
       m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at,
       m.today_seconds, m.today_date, m.week_seconds, m.week_start, m.updated_at,
       study_room_private.gender_for_member(m.user_id) as gender,
       case when m.today_date = timezone('Asia/Colombo', now())::date
            then m.today_time else '00:00:00' end as today_time,
       case when m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date)
            then m.week_time else '00:00:00' end as week_time
from public.study_room_members m;

revoke all on public.study_room_live from public, anon, authenticated;
grant select on public.study_room_live to authenticated;

create or replace function public.study_room_local_week_start(d date)
returns date
language sql
immutable
set search_path = ''
as $function$
  select d - (extract(isodow from d)::int - 1);
$function$;

create or replace function public.study_room_ensure_profile()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  -- Do not create a second profile or overwrite the existing display name.
  if not exists (select 1 from public.studylab_profiles where id = uid) then
    raise exception 'Your StudyLab profile was not found. Create a profile first.';
  end if;
  insert into public.study_room_members(user_id)
  values (uid) on conflict (user_id) do nothing;
end; $$;

create or replace function public.study_room_set_subject(p_subject text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_subject not in ('Combined Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Information & Communication Technology (ICT)', 'General English', 'General Common Test', 'Accounting', 'Business Studies', 'Economics', 'Business Statistics', 'Logic and Scientific Method', 'Geography', 'Political Science', 'History', 'Home Economics', 'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Buddhist Civilization', 'Christian Civilization', 'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil', 'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese', 'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music', 'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)', 'Drama and Theatre', 'Engineering Technology', 'Science for Technology', 'Bio Systems Technology', 'Agro Technology', 'Food Technology', 'Mechanical Technology', 'Electrical, Electronic and Information Technology', 'Civil Technology', 'Design, Electrical and Electronic Technology', 'Design and Construction Technology', 'Design and Mechanical Technology', 'Design, Quantity Surveying and Construction Process') then
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
  previous public.study_room_members%rowtype;
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  update public.study_room_members
  set today_seconds = case when today_date = local_day then today_seconds else 0 end,
      today_date = local_day,
      week_seconds = case when week_start = monday then week_seconds else 0 end,
      week_start = monday,
      updated_at = now()
  where today_date <> local_day or week_start <> monday;

  select * into previous from public.study_room_members
    where user_id = uid and is_studying for update;
  if not found then return; end if;
  elapsed := greatest(0, least(90,
    floor(extract(epoch from (now() - previous.last_heartbeat_at)))::int));
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

revoke all on function public.study_room_ensure_profile() from public, anon;
revoke all on function public.study_room_set_subject(text) from public, anon;
revoke all on function public.study_room_start() from public, anon;
revoke all on function public.study_room_heartbeat() from public, anon;
revoke all on function public.study_room_leave() from public, anon;
grant execute on function public.study_room_ensure_profile() to authenticated;
grant execute on function public.study_room_set_subject(text) to authenticated;
grant execute on function public.study_room_start() to authenticated;
grant execute on function public.study_room_heartbeat() to authenticated;
grant execute on function public.study_room_leave() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='study_room_members') then
    null;
  else
    alter publication supabase_realtime add table public.study_room_members;
  end if;
exception when undefined_object then
  raise notice 'The supabase_realtime publication was not found; enable Realtime for study_room_members in Supabase.';
end $$;


-- Require a completed profile before any student can enter or start a room session.
create or replace function study_room_private.profile_is_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.studylab_profiles p
    where p.id = p_user_id
      and p.profile_completed_at is not null
      and length(btrim(p.display_name)) >= 2
      and p.display_name !~ '^Student[0-9]{4}$'
      and p.exam_year is not null
      and p.study_stream is not null
      and p.gender in ('male', 'female')
  );
$function$;
revoke all on function study_room_private.profile_is_complete(uuid) from public, anon;
grant execute on function study_room_private.profile_is_complete(uuid) to authenticated;

create or replace function public.study_room_ensure_profile()
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
begin
  if uid is null then raise exception 'Sign-in required'; end if;
  if not study_room_private.profile_is_complete(uid) then
    raise exception 'Complete your StudyLab profile before entering the Live Study Room.';
  end if;
  update public.study_room_members
  set today_seconds = case when today_date = local_day then today_seconds else 0 end,
      today_date = local_day,
      week_seconds = case when week_start = monday then week_seconds else 0 end,
      week_start = monday,
      updated_at = now()
  where today_date <> local_day or week_start <> monday;
  insert into public.study_room_members(user_id) values (uid)
  on conflict (user_id) do nothing;
end;
$function$;

create or replace function public.study_room_set_subject(p_subject text)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if not study_room_private.profile_is_complete(auth.uid()) then
    raise exception 'Complete your StudyLab profile before entering the Live Study Room.';
  end if;
  if p_subject not in (
    'Combined Mathematics','Physics','Chemistry','Biology','Agricultural Science',
    'Information & Communication Technology (ICT)','General English','General Common Test',
    'Accounting','Business Studies','Economics','Business Statistics','Logic and Scientific Method',
    'Geography','Political Science','History','Home Economics','Communication and Media Studies',
    'Buddhism','Christianity','Hinduism','Islam','Buddhist Civilization','Christian Civilization',
    'Hindu Civilization','Islamic Civilization','Sinhala','Tamil','English','Pali','Sanskrit','Arabic',
    'French','German','Japanese','Korean','Chinese','Russian','Art','Oriental Music','Western Music',
    'Carnatic Music','Dancing (Oriental)','Dancing (Bharatha)','Drama and Theatre',
    'Engineering Technology','Science for Technology','Bio Systems Technology','Agro Technology',
    'Food Technology','Mechanical Technology','Electrical, Electronic and Information Technology',
    'Civil Technology','Design, Electrical and Electronic Technology','Design and Construction Technology',
    'Design and Mechanical Technology','Design, Quantity Surveying and Construction Process'
  ) then raise exception 'Invalid subject'; end if;
  update public.study_room_members set subject = p_subject, updated_at = now()
  where user_id = auth.uid();
  if not found then raise exception 'Create a profile first'; end if;
end;
$function$;

create or replace function public.study_room_start()
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if not study_room_private.profile_is_complete(auth.uid()) then
    raise exception 'Complete your StudyLab profile before entering the Live Study Room.';
  end if;
  update public.study_room_members
    set is_studying = true, session_started_at = now(),
        last_heartbeat_at = now(), updated_at = now()
    where user_id = auth.uid();
  if not found then raise exception 'Create a profile first'; end if;
end;
$function$;

revoke all on function public.study_room_ensure_profile() from public, anon;
revoke all on function public.study_room_set_subject(text) from public, anon;
revoke all on function public.study_room_start() from public, anon;
grant execute on function public.study_room_ensure_profile() to authenticated;
grant execute on function public.study_room_set_subject(text) to authenticated;
grant execute on function public.study_room_start() to authenticated;
