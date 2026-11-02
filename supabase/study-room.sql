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
  check (subject in ('Combined Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Information & Communication Technology (ICT)', 'General English', 'General Common Test', 'Accounting', 'Business Studies', 'Economics', 'Business Statistics', 'Logic and Scientific Method', 'Geography', 'Political Science', 'History', 'Home Economics', 'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Buddhist Civilization', 'Christian Civilization', 'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil', 'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese', 'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music', 'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)', 'Drama and Theatre', 'Engineering Technology', 'Science for Technology', 'Bio Systems Technology', 'Agro Technology', 'Food Technology', 'Mechanical Technology', 'Electrical, Electronic and Information Technology', 'Civil Technology', 'Design, Electrical and Electronic Technology', 'Design and Construction Technology', 'Design and Mechanical Technology', 'Design, Quantity Surveying and Construction Process', 'Other'));

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
from public.study_room_members m
where exists (
  select 1 from public.studylab_profiles p
  where p.id = m.user_id
    and p.profile_completed_at is not null
    and length(btrim(p.display_name)) >= 2
    and p.display_name !~ '^Student[0-9]{4}

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
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign-in required'; end if;
  if p_subject not in ('Combined Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science', 'Information & Communication Technology (ICT)', 'General English', 'General Common Test', 'Accounting', 'Business Studies', 'Economics', 'Business Statistics', 'Logic and Scientific Method', 'Geography', 'Political Science', 'History', 'Home Economics', 'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Buddhist Civilization', 'Christian Civilization', 'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil', 'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese', 'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music', 'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)', 'Drama and Theatre', 'Engineering Technology', 'Science for Technology', 'Bio Systems Technology', 'Agro Technology', 'Food Technology', 'Mechanical Technology', 'Electrical, Electronic and Information Technology', 'Civil Technology', 'Design, Electrical and Electronic Technology', 'Design and Construction Technology', 'Design and Mechanical Technology', 'Design, Quantity Surveying and Construction Process', 'Other') then
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
  if not study_room_private.profile_is_complete(uid) then
    update public.study_room_members
      set is_studying = false, session_started_at = null,
          last_heartbeat_at = null, updated_at = now()
      where user_id = uid;
    return;
  end if;
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

    and p.exam_year is not null
    and p.study_stream is not null
    and p.gender in ('male', 'female')
);

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
returns void language plpgsql security definer set search_path = '' as $$
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


-- Security hardening applied to the production database on 2026-10-27.
-- Keep SECURITY DEFINER functions on an empty search_path and qualify objects
-- explicitly to avoid object-shadowing attacks through mutable schemas.
ALTER FUNCTION public.study_room_ensure_profile() SET search_path = '';
ALTER FUNCTION public.study_room_heartbeat() SET search_path = '';
ALTER FUNCTION public.study_room_leave() SET search_path = '';
ALTER FUNCTION public.study_room_set_subject(text) SET search_path = '';
ALTER FUNCTION public.study_room_start() SET search_path = '';
ALTER FUNCTION public.studylab_public_student_count() SET search_path = '';
ALTER FUNCTION public.studylab_release_ai_quota() SET search_path = '';
ALTER FUNCTION public.studylab_reserve_ai_quota() SET search_path = '';

-- Evaluate auth.uid() once per statement instead of once per candidate row.
ALTER POLICY "StudyLab profile read own" ON public.studylab_profiles
  USING (id = (select auth.uid()));
ALTER POLICY "StudyLab profile insert own" ON public.studylab_profiles
  WITH CHECK (id = (select auth.uid()));
ALTER POLICY "StudyLab profile update own" ON public.studylab_profiles
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));
ALTER POLICY "StudyLab chat insert own authenticated messages" ON public.studylab_chat_messages
  WITH CHECK (
    user_id = (select auth.uid())
    AND char_length(btrim(message)) BETWEEN 1 AND 500
    AND char_length(btrim(nickname)) BETWEEN 1 AND 60
    AND created_at >= now() - interval '30 seconds'
    AND created_at <= now() + interval '5 minutes'
  );
ALTER POLICY "StudyLab feedback insert own" ON public.studylab_feedback
  WITH CHECK (
    user_id = (select auth.uid())
    AND char_length(btrim(message)) BETWEEN 2 AND 1200
    AND category IN ('bug', 'suggestion', 'resource')
  );

-- Keep the standalone setup script aligned with the authoritative timer controls migration.
-- Authoritative, background-safe Study Room sessions with explicit pause/resume/end.
ALTER TABLE public.study_room_members ADD COLUMN IF NOT EXISTS session_active boolean NOT NULL DEFAULT false;
UPDATE public.study_room_members SET session_active = (is_studying OR session_elapsed_seconds > 0) WHERE NOT session_active;
CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
SELECT m.user_id, study_room_private.display_name_for_member(m.user_id) AS display_name,
 m.subject, m.is_studying, m.session_started_at, m.last_heartbeat_at, m.today_seconds,
 m.today_date, m.week_seconds, m.week_start, m.updated_at,
 study_room_private.gender_for_member(m.user_id) AS gender,
 CASE WHEN m.today_date = timezone('Asia/Colombo', now())::date THEN m.today_time ELSE '00:00:00'::text END AS today_time,
 CASE WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) THEN m.week_time ELSE '00:00:00'::text END AS week_time,
 m.session_elapsed_seconds, m.session_date, m.session_active
FROM public.study_room_members m
WHERE study_room_private.profile_is_complete(m.user_id);
REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date;
 monday date:=public.study_room_local_week_start(timezone('Asia/Colombo',now())::date);
 day_start timestamptz:=(timezone('Asia/Colombo',now())::date::timestamp AT TIME ZONE 'Asia/Colombo');
 week_start_ts timestamptz; elapsed_total integer; elapsed_today integer; elapsed_week integer;
 previous public.study_room_members%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 IF NOT study_room_private.profile_is_complete(uid) THEN
  UPDATE public.study_room_members SET is_studying=false,session_active=false,session_started_at=NULL,session_elapsed_seconds=0,last_heartbeat_at=NULL,updated_at=now() WHERE user_id=uid; RETURN;
 END IF;
 week_start_ts:=(monday::timestamp AT TIME ZONE 'Asia/Colombo');
 SELECT * INTO previous FROM public.study_room_members WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND OR NOT previous.is_studying THEN RETURN; END IF;
 IF previous.last_heartbeat_at IS NULL THEN UPDATE public.study_room_members SET last_heartbeat_at=now(),updated_at=now() WHERE user_id=uid; RETURN; END IF;
 elapsed_total:=greatest(0,floor(extract(epoch FROM (now()-previous.last_heartbeat_at)))::integer);
 elapsed_today:=greatest(0,floor(extract(epoch FROM (now()-greatest(previous.last_heartbeat_at,day_start)))::integer));
 elapsed_week:=greatest(0,floor(extract(epoch FROM (now()-greatest(previous.last_heartbeat_at,week_start_ts)))::integer));
 UPDATE public.study_room_members SET
  today_seconds=CASE WHEN today_date=local_day THEN today_seconds+elapsed_today ELSE elapsed_today END,
  today_date=local_day,
  week_seconds=CASE WHEN week_start=monday THEN week_seconds+elapsed_week ELSE elapsed_week END,
  week_start=monday,
  session_elapsed_seconds=CASE WHEN session_date=local_day THEN session_elapsed_seconds+elapsed_total ELSE elapsed_total END,
  session_date=local_day,last_heartbeat_at=now(),updated_at=now()
 WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date; current_member public.study_room_members%rowtype;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 IF NOT study_room_private.profile_is_complete(uid) THEN RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.'; END IF;
 SELECT * INTO current_member FROM public.study_room_members WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
 IF current_member.is_studying THEN PERFORM public.study_room_heartbeat(); RETURN; END IF;
 UPDATE public.study_room_members SET is_studying=true,session_active=true,
  session_elapsed_seconds=CASE WHEN current_member.session_active AND current_member.session_date=local_day THEN current_member.session_elapsed_seconds ELSE 0 END,
  session_date=local_day,session_started_at=now(),last_heartbeat_at=now(),updated_at=now() WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_pause()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 PERFORM public.study_room_heartbeat();
 UPDATE public.study_room_members SET is_studying=false,session_active=true,session_started_at=NULL,last_heartbeat_at=NULL,updated_at=now()
 WHERE user_id=uid AND session_active=true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_end()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE uid uuid:=auth.uid(); local_day date:=timezone('Asia/Colombo',now())::date;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
 PERFORM public.study_room_heartbeat();
 UPDATE public.study_room_members SET is_studying=false,session_active=false,session_started_at=NULL,session_elapsed_seconds=0,session_date=local_day,last_heartbeat_at=NULL,updated_at=now()
 WHERE user_id=uid;
END;
$function$;
CREATE OR REPLACE FUNCTION public.study_room_leave()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
 PERFORM public.study_room_end();
END;
$function$;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_pause() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_end() FROM public,anon;
REVOKE ALL ON FUNCTION public.study_room_leave() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_pause() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_end() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_leave() TO authenticated;


-- Expire an abandoned running Study Room session after 24 hours without a heartbeat.
-- A successful heartbeat refreshes last_heartbeat_at and starts a fresh 24-hour window.

CREATE OR REPLACE VIEW public.study_room_live WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT m.*,
    (m.is_studying AND (m.last_heartbeat_at IS NULL OR m.last_heartbeat_at <= now() - interval '24 hours')) AS idle_expired
  FROM public.study_room_members AS m
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_expired THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_expired THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_expired THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  CASE WHEN m.idle_expired THEN 0 ELSE m.today_seconds END AS today_seconds,
  CASE WHEN m.idle_expired THEN timezone('Asia/Colombo', now())::date ELSE m.today_date END AS today_date,
  CASE WHEN m.idle_expired THEN 0 ELSE m.week_seconds END AS week_seconds,
  CASE WHEN m.idle_expired THEN public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) ELSE m.week_start END AS week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE WHEN m.idle_expired THEN '00:00:00'::text
       WHEN m.today_date = timezone('Asia/Colombo', now())::date THEN m.today_time
       ELSE '00:00:00'::text END AS today_time,
  CASE WHEN m.idle_expired THEN '00:00:00'::text
       WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date) THEN m.week_time
       ELSE '00:00:00'::text END AS week_time,
  CASE WHEN m.idle_expired THEN 0 ELSE m.session_elapsed_seconds END AS session_elapsed_seconds,
  CASE WHEN m.idle_expired THEN timezone('Asia/Colombo', now())::date ELSE m.session_date END AS session_date,
  CASE WHEN m.idle_expired THEN false ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;

CREATE OR REPLACE FUNCTION public.study_room_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  monday date := public.study_room_local_week_start(timezone('Asia/Colombo', now())::date);
  day_start timestamptz := (timezone('Asia/Colombo', now())::date::timestamp AT TIME ZONE 'Asia/Colombo');
  week_start_ts timestamptz;
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
  previous public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    UPDATE public.study_room_members
    SET is_studying = false, session_active = false, session_started_at = NULL,
        session_elapsed_seconds = 0, last_heartbeat_at = NULL, updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  -- Expire all abandoned running sessions so their attendance and rank totals
  -- clear even when the student whose session expired does not return.
  UPDATE public.study_room_members
  SET is_studying = false, session_active = false, session_started_at = NULL,
      last_heartbeat_at = NULL, session_elapsed_seconds = 0,
      session_date = local_day, today_seconds = 0, today_date = local_day,
      week_seconds = 0, week_start = monday, updated_at = now()
  WHERE is_studying = true
    AND (last_heartbeat_at IS NULL OR last_heartbeat_at <= now() - interval '24 hours');

  week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');
  SELECT * INTO previous
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT previous.is_studying THEN RETURN; END IF;
  IF previous.last_heartbeat_at IS NULL THEN
    UPDATE public.study_room_members SET last_heartbeat_at = now(), updated_at = now()
    WHERE user_id = uid;
    RETURN;
  END IF;

  elapsed_total := greatest(0, floor(extract(epoch FROM (now() - previous.last_heartbeat_at)))::integer);
  elapsed_today := greatest(0, floor(extract(epoch FROM (now() - greatest(previous.last_heartbeat_at, day_start)))::integer));
  elapsed_week := greatest(0, floor(extract(epoch FROM (now() - greatest(previous.last_heartbeat_at, week_start_ts)))::integer);

  UPDATE public.study_room_members
  SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds + elapsed_today ELSE elapsed_today END,
      today_date = local_day,
      week_seconds = CASE WHEN week_start = monday THEN week_seconds + elapsed_week ELSE elapsed_week END,
      week_start = monday,
      session_elapsed_seconds = CASE WHEN session_date = local_day THEN session_elapsed_seconds + elapsed_total ELSE elapsed_total END,
      session_date = local_day, last_heartbeat_at = now(), updated_at = now()
  WHERE user_id = uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.study_room_start()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  local_day date := timezone('Asia/Colombo', now())::date;
  current_member public.study_room_members%rowtype;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign-in required'; END IF;
  IF NOT study_room_private.profile_is_complete(uid) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  -- Apply expiry before deciding whether this is a duplicate Start or a new session.
  PERFORM public.study_room_heartbeat();

  SELECT * INTO current_member
  FROM public.study_room_members
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Create a profile first'; END IF;
  IF current_member.is_studying THEN RETURN; END IF;

  UPDATE public.study_room_members
  SET is_studying = true,
      session_active = true,
      session_elapsed_seconds = CASE
        WHEN current_member.session_active AND current_member.session_date = local_day
          THEN current_member.session_elapsed_seconds
        ELSE 0
      END,
      session_date = local_day, session_started_at = now(),
      last_heartbeat_at = now(), updated_at = now()
  WHERE user_id = uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.study_room_heartbeat() FROM public, anon;
REVOKE ALL ON FUNCTION public.study_room_start() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_room_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_room_start() TO authenticated;


-- Final subject RPC/constraint definition: keep Other, profile validation and safe search_path.
-- Allow the existing Other dropdown option while preserving profile requirements and safe function resolution.
ALTER TABLE public.study_room_members
  DROP CONSTRAINT IF EXISTS study_room_members_subject_check;
ALTER TABLE public.study_room_members
  ADD CONSTRAINT study_room_members_subject_check
  CHECK (subject IN (
    'Combined Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Information & Communication Technology (ICT)',
    'General English', 'General Common Test', 'Accounting', 'Business Studies',
    'Economics', 'Business Statistics', 'Logic and Scientific Method',
    'Geography', 'Political Science', 'History', 'Home Economics',
    'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism',
    'Islam', 'Buddhist Civilization', 'Christian Civilization',
    'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil',
    'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese',
    'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music',
    'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)',
    'Drama and Theatre', 'Engineering Technology', 'Science for Technology',
    'Bio Systems Technology', 'Agro Technology', 'Food Technology',
    'Mechanical Technology',
    'Electrical, Electronic and Information Technology', 'Civil Technology',
    'Design, Electrical and Electronic Technology',
    'Design and Construction Technology', 'Design and Mechanical Technology',
    'Design, Quantity Surveying and Construction Process', 'Other'
  ));

CREATE OR REPLACE FUNCTION public.study_room_set_subject(p_subject text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign-in required';
  END IF;

  IF NOT study_room_private.profile_is_complete(auth.uid()) THEN
    RAISE EXCEPTION 'Complete your StudyLab profile before entering the Live Study Room.';
  END IF;

  IF p_subject IS NULL OR p_subject NOT IN (
    'Combined Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Information & Communication Technology (ICT)',
    'General English', 'General Common Test', 'Accounting', 'Business Studies',
    'Economics', 'Business Statistics', 'Logic and Scientific Method',
    'Geography', 'Political Science', 'History', 'Home Economics',
    'Communication and Media Studies', 'Buddhism', 'Christianity', 'Hinduism',
    'Islam', 'Buddhist Civilization', 'Christian Civilization',
    'Hindu Civilization', 'Islamic Civilization', 'Sinhala', 'Tamil',
    'English', 'Pali', 'Sanskrit', 'Arabic', 'French', 'German', 'Japanese',
    'Korean', 'Chinese', 'Russian', 'Art', 'Oriental Music', 'Western Music',
    'Carnatic Music', 'Dancing (Oriental)', 'Dancing (Bharatha)',
    'Drama and Theatre', 'Engineering Technology', 'Science for Technology',
    'Bio Systems Technology', 'Agro Technology', 'Food Technology',
    'Mechanical Technology',
    'Electrical, Electronic and Information Technology', 'Civil Technology',
    'Design, Electrical and Electronic Technology',
    'Design and Construction Technology', 'Design and Mechanical Technology',
    'Design, Quantity Surveying and Construction Process', 'Other'
  ) THEN
    RAISE EXCEPTION 'Invalid subject';
  END IF;

  UPDATE public.study_room_members
  SET subject = p_subject, updated_at = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Create a profile first';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.study_room_set_subject(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.study_room_set_subject(text) TO authenticated;


-- Schedule the 24-hour idle-session cleanup (safe to rerun from this setup script).
DO $schedule$
DECLARE existing_job bigint;
BEGIN
  FOR existing_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'study-room-expire-idle-sessions'
  LOOP
    PERFORM cron.unschedule(existing_job);
  END LOOP;
  PERFORM cron.schedule(
    'study-room-expire-idle-sessions',
    '* * * * *',
    $job$
      UPDATE public.study_room_members
      SET is_studying = false,
          session_active = false,
          session_started_at = NULL,
          last_heartbeat_at = NULL,
          session_elapsed_seconds = 0,
          session_date = timezone('Asia/Colombo', now())::date,
          today_seconds = 0,
          today_date = timezone('Asia/Colombo', now())::date,
          week_seconds = 0,
          week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date),
          updated_at = now()
      WHERE is_studying = true
        AND (last_heartbeat_at IS NULL OR last_heartbeat_at <= now() - interval '24 hours');
    $job$
  );
END;
$schedule$;


-- Final background-tab grace period.
-- Browsers may throttle timers when the Study Room is in a background tab
-- or another app is in the foreground. Keep students active for up to five
-- minutes without a heartbeat, then pause abandoned sessions and credit only
-- the five-minute grace period (never across the Sri Lanka midnight boundary).
CREATE OR REPLACE FUNCTION public.study_room_pause_stale_sessions(p_user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  member_row public.study_room_members%rowtype;
  reference_now timestamptz := now();
  credit_until timestamptz;
  local_day date;
  monday date;
  day_start timestamptz;
  week_start_ts timestamptz;
  elapsed_total integer;
  elapsed_today integer;
  elapsed_week integer;
BEGIN
  FOR member_row IN
    SELECT *
    FROM public.study_room_members
    WHERE is_studying = true
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (last_heartbeat_at IS NULL OR last_heartbeat_at <= reference_now - interval '5 minutes')
    FOR UPDATE SKIP LOCKED
  LOOP
    IF member_row.last_heartbeat_at IS NULL THEN
      UPDATE public.study_room_members
      SET is_studying = false, session_active = true,
          session_started_at = NULL, last_heartbeat_at = NULL,
          updated_at = reference_now
      WHERE user_id = member_row.user_id;
      CONTINUE;
    END IF;

    credit_until := LEAST(
      reference_now,
      member_row.last_heartbeat_at + interval '5 minutes',
      ((timezone('Asia/Colombo', member_row.last_heartbeat_at)::date + 1)::timestamp AT TIME ZONE 'Asia/Colombo')
    );
    local_day := timezone('Asia/Colombo', credit_until)::date;
    monday := public.study_room_local_week_start(local_day);
    day_start := (local_day::timestamp AT TIME ZONE 'Asia/Colombo');
    week_start_ts := (monday::timestamp AT TIME ZONE 'Asia/Colombo');

    elapsed_total := greatest(0, floor(extract(epoch FROM (credit_until - member_row.last_heartbeat_at)))::integer);
    elapsed_today := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, day_start)))::integer));
    elapsed_week := greatest(0, floor(extract(epoch FROM (credit_until - greatest(member_row.last_heartbeat_at, week_start_ts)))::integer));

    UPDATE public.study_room_members
    SET today_seconds = CASE WHEN today_date = local_day THEN today_seconds + elapsed_today ELSE elapsed_today END,
        today_date = local_day,
        week_seconds = CASE WHEN week_start = monday THEN week_seconds + elapsed_week ELSE elapsed_week END,
        week_start = monday,
        session_elapsed_seconds = coalesce(session_elapsed_seconds, 0) + elapsed_total,
        is_studying = false,
        session_active = true,
        session_started_at = NULL,
        last_heartbeat_at = NULL,
        updated_at = credit_until
    WHERE user_id = member_row.user_id;
  END LOOP;
END;
$function$;

CREATE OR REPLACE VIEW public.study_room_live
WITH (security_invoker = true) AS
WITH member_state AS (
  SELECT m.*,
    (m.is_studying AND (
      m.last_heartbeat_at IS NULL
      OR m.last_heartbeat_at <= now() - interval '5 minutes'
    )) AS idle_stale
  FROM public.study_room_members AS m
)
SELECT
  m.user_id,
  study_room_private.display_name_for_member(m.user_id) AS display_name,
  m.subject,
  CASE WHEN m.idle_stale THEN false ELSE m.is_studying END AS is_studying,
  CASE WHEN m.idle_stale THEN NULL::timestamptz ELSE m.session_started_at END AS session_started_at,
  CASE WHEN m.idle_stale THEN NULL::timestamptz ELSE m.last_heartbeat_at END AS last_heartbeat_at,
  m.today_seconds,
  m.today_date,
  m.week_seconds,
  m.week_start,
  m.updated_at,
  study_room_private.gender_for_member(m.user_id) AS gender,
  CASE WHEN m.today_date = timezone('Asia/Colombo', now())::date
       THEN m.today_time ELSE '00:00:00'::text END AS today_time,
  CASE WHEN m.week_start = public.study_room_local_week_start(timezone('Asia/Colombo', now())::date)
       THEN m.week_time ELSE '00:00:00'::text END AS week_time,
  m.session_elapsed_seconds,
  m.session_date,
  CASE WHEN m.idle_stale THEN true ELSE m.session_active END AS session_active
FROM member_state AS m
WHERE study_room_private.profile_is_complete(m.user_id);

REVOKE ALL ON public.study_room_live FROM public, anon, authenticated;
GRANT SELECT ON public.study_room_live TO authenticated;
